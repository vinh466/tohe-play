using System.ComponentModel.DataAnnotations;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Registry;

namespace Tohe.Api.Modules.Links;

/// <summary>A share link to make (ADR 0044).</summary>
/// <param name="Kind"><c>game</c>: the game's menu. <c>entry</c>: a place inside the game, with
/// <paramref name="Payload"/>, for a game whose current build takes share entries (ADR 0045; else
/// <c>400 entry_not_supported</c>).</param>
/// <param name="GameId">A game the registry lists, which the maker may see; its version is the registry's.</param>
/// <param name="Level"><c>any</c> (the default), <c>named</c> or <c>account</c>: the least level asked of whoever opens
/// it — raised to the game's own (ADR 0045).</param>
/// <param name="ExpiresInHours">From 1 to 2160 (90 days); 720 (30 days) when not given.</param>
/// <param name="MaxUses">From 1 to 1000; no limit when not given.</param>
/// <param name="Payload">For an <c>entry</c> link only, and required with it: the game's JSON, at most 2 KB as UTF-8.</param>
/// <param name="Text">The message the player would send with the link (ADR 0045), to be checked — never stored: the
/// answer's <c>message</c> is it when it may be sent.</param>
/// <param name="Language">The language the maker's hub speaks: <c>vi</c> (the default) or <c>en</c> (ADR 0047). The
/// link's preview card speaks it; the link itself carries none.</param>
public sealed record MakeLinkRequest(
    [Required(AllowEmptyStrings = true)] string Kind,
    [Required(AllowEmptyStrings = true), StringLength(40)] string GameId,
    string? Level = null,
    int? ExpiresInHours = null,
    int? MaxUses = null,
    JsonElement? Payload = null,
    [StringLength(ShareTexts.MaxRequestLength)] string? Text = null,
    string? Language = null);

/// <param name="ExpiresInHours">The new expiry, from now: 1 to 2160 hours (90 days).</param>
public sealed record ChangeLinkRequest(int ExpiresInHours);

/// <summary>
/// Share links (ADR 0044): its maker — a profile acting with the account's session or with its device's key — makes,
/// lists, changes and revokes its links; anyone resolves one by its code, limited per address.
/// </summary>
internal static class LinkEndpoints
{
    /// <summary>A profile acting: an account's session, or the device key naming a device profile (ADR 0043).</summary>
    private static readonly AuthorizationPolicy MakerPolicy =
        new AuthorizationPolicyBuilder(DeviceKey.PlayerScheme).RequireAuthenticatedUser().Build();

    public static void Map(IEndpointRouteBuilder api)
    {
        var links = api.MapGroup("/links").WithTags("Links");

        var mine = links.MapGroup("")
            .RequireAuthorization(MakerPolicy)
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status412PreconditionFailed);

        mine.MapPost("/", MakeAsync)
            .WithName("MakeShareLink")
            .WithSummary("Make a share link to a game, as the acting profile: a `named` feature — a device profile with its terms accepted, a child only with \"play with others\" on; 30 a day per profile, 60 per device key. An `entry` link carries the game's payload (at most 2 KB), only for a game that takes share entries; its level is raised to the game's.");

        mine.MapGet("/mine", ListAsync)
            .WithName("ListMyShareLinks")
            .WithSummary("The acting profile's share links, newest first (100 at most), with their state and counts; accounts made only from three upward.");

        mine.MapPatch("/{code}", ChangeAsync)
            .WithName("ChangeShareLink")
            .WithSummary("A new expiry for one of the acting profile's links, from now: one hour to 90 days.");

        mine.MapPost("/{code}/revoke", RevokeAsync)
            .WithName("RevokeShareLink")
            .WithSummary("Revoke one of the acting profile's links: it resolves as revoked from now on.");

        links.MapPost("/{code}/open", OpenAsync)
            .AllowAnonymous()
            .ProducesProblem(StatusCodes.Status429TooManyRequests)
            .WithName("OpenShareLink")
            .WithSummary("Resolve a share link by its code to a typed intent — ok, expired, revoked, used_up or unknown; counts it opened. Limited per address (an IPv6 address by its /64).");

        links.MapPost("/{code}/play", PlayAsync)
            .AllowAnonymous()
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status429TooManyRequests)
            .WithName("PlayShareLink")
            .WithSummary("Resolve a share link to open its game: takes one use and counts it played; an `entry` link answers with its payload and version (ADR 0045). A link asking `named` or `account` needs such a player (403 level_required). Limited as opening.");
    }

    /// <summary>A profile making or managing links: who it is, and what it may.</summary>
    /// <param name="DeviceId">The device whose key acts, for a device profile.</param>
    private sealed record LinkMaker(Guid ProfileId, Guid? AccountId, Guid? DeviceId, bool MayPlayWithOthers, int MaxGameMinAge);

    private static async Task<Results<Ok<ShareLinkView>, ValidationProblem, ProblemHttpResult>> MakeAsync(
        MakeLinkRequest request,
        HttpContext http,
        IActiveProfile active,
        IDevicePlayers devices,
        IRegistryGames games,
        ShareLinks links,
        LinkMakers makers,
        Infrastructure.Database.ToheDbContext db,
        IOptions<LinksOptions> options,
        TimeProvider clock,
        CancellationToken ct)
    {
        var (maker, problem) = await MakerAsync(http, active, devices, ct);
        if (maker is null)
        {
            return problem!;
        }

        // Others see the maker's name: a child's profile makes links only with "Chơi online với người ngoài" on.
        if (!maker.MayPlayWithOthers)
        {
            return Problems.Of(StatusCodes.Status403Forbidden, "play_with_others_off", "The account's owner keeps this profile to the account");
        }

        if (!LinkNames.TryParseKind(request.Kind, out var kind))
        {
            return Problems.Field("kind", "invalid_options");
        }

        // A game link carries nothing for the game; an entry link carries the game's payload (ADR 0045), compact.
        string? payload = null;
        if (kind == ShareLinkKind.Entry)
        {
            if (request.Payload is not { } given || given.ValueKind == JsonValueKind.Undefined)
            {
                return Problems.Field("payload", "invalid_options");
            }

            payload = Compact(given);
            if (Encoding.UTF8.GetByteCount(payload) > ShareLinks.MaxPayloadBytes)
            {
                return Problems.Of(StatusCodes.Status400BadRequest, "payload_too_large", "An entry's payload is at most 2 KB");
            }
        }
        else if (request.Payload is { ValueKind: not JsonValueKind.Undefined })
        {
            return Problems.Field("payload", "invalid_options");
        }

        var level = LinkLevel.Any;
        if (request.Level is not null && !LinkNames.TryParseLevel(request.Level, out level))
        {
            return Problems.Field("level", "invalid_options");
        }

        var hours = request.ExpiresInHours ?? ShareLinks.DefaultExpiresInHours;
        if (hours is < 1 or > ShareLinks.MaxExpiresInHours)
        {
            return Problems.Field("expiresInHours", "invalid_options");
        }

        if (request.MaxUses is < 1 or > ShareLinks.MaxUsesLimit)
        {
            return Problems.Field("maxUses", "invalid_options");
        }

        if (!Languages.TryParse(request.Language, out var language))
        {
            return Problems.Field("language", "invalid_options");
        }

        if (await games.GetAsync(request.GameId, ct) is not { } game)
        {
            return Problems.Of(StatusCodes.Status404NotFound, "game_not_found", "No such game in the catalog");
        }

        if (game.MinAge > maker.MaxGameMinAge)
        {
            return Problems.Of(StatusCodes.Status403Forbidden, "too_young", "This game is not for this profile's age");
        }

        // Only a game whose current build opens share entries itself gets one (ADR 0045).
        if (kind == ShareLinkKind.Entry && !game.Takes(GameLevels.ShareEntry))
        {
            return Problems.Of(StatusCodes.Status400BadRequest, "entry_not_supported", "This game does not take share entries");
        }

        // Opening the link asks at least what opening the game does (ADR 0045).
        level = (LinkLevel)Math.Max((int)level, (int)LinkNames.LevelOf(game.IdentityPlay));

        // The device key, whichever profile acts — or the account, when its session carries no device key.
        var key = maker.DeviceId ?? await DeviceOfRequestAsync(http) ?? maker.AccountId!.Value;

        // The profile's count of the day and its new link, one request at a time: two at once never pass the limit both.
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await links.LockMakerAsync(maker.ProfileId, ct);
        if (await links.MadeTodayAsync(maker.ProfileId, ct) >= options.Value.MakesPerProfilePerDay)
        {
            return LinkLimit();
        }

        if (!makers.TryTake(key, options.Value.MakesPerDevicePerDay))
        {
            return LinkLimit();
        }

        var now = clock.GetUtcNow();
        var link = new ShareLink
        {
            Id = Guid.CreateVersion7(now),
            Code = "",
            Kind = kind,
            GameId = game.Id,
            GameVersion = game.Version,
            Level = level,
            Payload = payload,
            MakerProfileId = maker.ProfileId,
            CreatedAt = now,
            ExpiresAt = now.AddHours(hours),
            MaxUses = request.MaxUses,
            Language = language,
        };
        try
        {
            await links.SaveNewAsync(link, ct);
            await transaction.CommitAsync(ct);
        }
        catch
        {
            makers.GiveBack(key);
            throw;
        }

        // The message goes back to the hub only when it may be sent; it is kept nowhere.
        return TypedResults.Ok(await links.ViewAsync(link, !maker.MayPlayWithOthers, ct) with { Message = ShareTexts.Accept(request.Text) });
    }

    private static async Task<Results<Ok<IReadOnlyList<ShareLinkView>>, ProblemHttpResult>> ListAsync(
        HttpContext http, IActiveProfile active, IDevicePlayers devices, ShareLinks links, CancellationToken ct)
    {
        var (maker, problem) = await MakerAsync(http, active, devices, ct);
        return maker is null ? problem! : TypedResults.Ok(await links.MineAsync(maker.ProfileId, !maker.MayPlayWithOthers, ct));
    }

    private static async Task<Results<Ok<ShareLinkView>, NotFound, ValidationProblem, ProblemHttpResult>> ChangeAsync(
        string code,
        ChangeLinkRequest request,
        HttpContext http,
        IActiveProfile active,
        IDevicePlayers devices,
        ShareLinks links,
        Infrastructure.Database.ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        var (maker, problem) = await MakerAsync(http, active, devices, ct);
        if (maker is null)
        {
            return problem!;
        }

        if (request.ExpiresInHours is < 1 or > ShareLinks.MaxExpiresInHours)
        {
            return Problems.Field("expiresInHours", "invalid_options");
        }

        if (await links.MineAsync(maker.ProfileId, code, ct) is not { } link)
        {
            return TypedResults.NotFound();
        }

        if (link.RevokedAt is not null)
        {
            return Problems.Of(StatusCodes.Status409Conflict, "link_revoked", "A revoked link stays revoked");
        }

        link.ExpiresAt = clock.GetUtcNow().AddHours(request.ExpiresInHours);
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(await links.ViewAsync(link, !maker.MayPlayWithOthers, ct));
    }

    private static async Task<Results<Ok<ShareLinkView>, NotFound, ProblemHttpResult>> RevokeAsync(
        string code,
        HttpContext http,
        IActiveProfile active,
        IDevicePlayers devices,
        ShareLinks links,
        Infrastructure.Database.ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        var (maker, problem) = await MakerAsync(http, active, devices, ct);
        if (maker is null)
        {
            return problem!;
        }

        if (await links.MineAsync(maker.ProfileId, code, ct) is not { } link)
        {
            return TypedResults.NotFound();
        }

        // Revoking again is harmless: it keeps when it was first revoked.
        link.RevokedAt ??= clock.GetUtcNow();
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(await links.ViewAsync(link, !maker.MayPlayWithOthers, ct));
    }

    private static async Task<Results<Ok<LinkIntent>, ProblemHttpResult>> OpenAsync(
        string code, HttpContext http, ShareLinks links, LinkLimits limits, CancellationToken ct)
    {
        if (!limits.TryResolve(http))
        {
            return TooManyResolves();
        }

        var resolved = await links.ResolveAsync(code, ct);
        if (resolved is { State: LinkStates.Ok })
        {
            await links.CountAsync(resolved.Link.Id, opened: 1, played: 0, accountsMade: 0, ct);
        }

        return TypedResults.Ok(await links.IntentAsync(resolved, code, ct));
    }

    private static async Task<Results<Ok<LinkIntent>, ProblemHttpResult>> PlayAsync(
        string code,
        HttpContext http,
        ShareLinks links,
        LinkLimits limits,
        IActiveProfile active,
        IDevicePlayers devices,
        CancellationToken ct)
    {
        if (!limits.TryResolve(http))
        {
            return TooManyResolves();
        }

        var resolved = await links.ResolveAsync(code, ct);
        if (resolved is not { State: LinkStates.Ok })
        {
            return TypedResults.Ok(await links.IntentAsync(resolved, code, ct));
        }

        // The hub's identity gate comes first; this is its backstop: a use is taken only by a player the link admits.
        if (resolved.Link.Level != LinkLevel.Any && !await MeetsAsync(http, resolved.Link.Level, active, devices, ct))
        {
            return TypedResults.Problem(
                title: "This link asks for a player first",
                statusCode: StatusCodes.Status403Forbidden,
                extensions: new Dictionary<string, object?> { ["code"] = "level_required", ["level"] = LinkNames.Of(resolved.Link.Level) });
        }

        if (!await links.TakeUseAsync(resolved.Link.Id, ct))
        {
            // Used up, expired or revoked at this very moment: read it again to say which.
            return TypedResults.Ok(await links.IntentAsync(await links.ResolveAsync(code, ct), code, ct));
        }

        await links.CountAsync(resolved.Link.Id, opened: 0, played: 1, accountsMade: 0, ct);
        return TypedResults.Ok(await links.IntentAsync(resolved, code, ct, opening: true));
    }

    /// <summary>A JSON value without whitespace: what the payload's size is measured on, and what is kept.</summary>
    private static string Compact(JsonElement value)
    {
        using var stream = new MemoryStream();
        // Numbers kept as written, text as UTF-8 (not \uXXXX), as the game's JSON.stringify measured it.
        var options = new JsonWriterOptions { Indented = false, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
        using (var writer = new Utf8JsonWriter(stream, options))
        {
            value.WriteTo(writer);
        }

        return Encoding.UTF8.GetString(stream.ToArray());
    }

    /// <summary>
    /// Whether this request's player meets the level: <c>named</c> — a device profile on the server with its terms, or an
    /// account's profile; <c>account</c> — an account's profile.
    /// </summary>
    private static async Task<bool> MeetsAsync(HttpContext http, LinkLevel level, IActiveProfile active, IDevicePlayers devices, CancellationToken ct)
    {
        if (DeviceKey.NamesDeviceProfile(http))
        {
            if (level == LinkLevel.Account)
            {
                return false;
            }

            var device = await http.AuthenticateAsync(DeviceKey.Scheme);
            if (!device.Succeeded)
            {
                return false;
            }

            http.User = device.Principal;
            return (await devices.FindAsync(http, ct)).Player is not null;
        }

        return await active.GetAsync(http.User, ct) is not null;
    }

    /// <summary>
    /// The profile acting (ADR 0043): with the device key, the device profile it names — of that device, with the terms
    /// the hub shows accepted — else the account session's active profile. Or the problem to answer.
    /// </summary>
    private static async Task<(LinkMaker? Maker, ProblemHttpResult? Problem)> MakerAsync(
        HttpContext http, IActiveProfile active, IDevicePlayers devices, CancellationToken ct)
    {
        if (DeviceKey.DeviceOf(http.User) is not null)
        {
            var found = await devices.FindAsync(http, ct);
            var code = found.Code ?? "profile_required";
            return found.Player is { } device
                ? (new LinkMaker(device.Id, null, device.DeviceId, MayPlayWithOthers: true, int.MaxValue), null)
                : (null, Problems.Of(found.Status, code, code.Replace('_', ' ')));
        }

        var profile = await active.GetAsync(http.User, ct);
        return profile is null
            ? (null, Problems.Of(StatusCodes.Status403Forbidden, "profile_required", "Choose a profile first"))
            : (new LinkMaker(profile.Id, profile.AccountId, null, profile.MayPlayWithOthers, profile.MaxGameMinAge), null);
    }

    /// <summary>The device whose key came with an account's request, if one did.</summary>
    private static async Task<Guid?> DeviceOfRequestAsync(HttpContext http)
    {
        var device = await http.AuthenticateAsync(DeviceKey.Scheme);
        return device.Succeeded ? DeviceKey.DeviceOf(device.Principal) : null;
    }

    private static ProblemHttpResult LinkLimit() =>
        Problems.Of(StatusCodes.Status429TooManyRequests, "link_limit", "Enough links for today");

    private static ProblemHttpResult TooManyResolves() =>
        Problems.Of(StatusCodes.Status429TooManyRequests, "resolve_limit", "Too many links at once: try again in a minute");
}
