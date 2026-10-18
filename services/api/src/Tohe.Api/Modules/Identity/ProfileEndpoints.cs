using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Identity;

/// <param name="Telemetry">Turn technical telemetry on or off for the account's devices (ADR 0015).</param>
public sealed record UpdateAccountRequest(bool? Telemetry = null);

/// <param name="Name">Chosen freely: up to 24 visible characters, emoji included (ADR 0023).</param>
/// <param name="AgeBand">A child's age band; leave it out for an adult's profile.</param>
/// <param name="Pin">Optional 4-digit PIN.</param>
public sealed record CreateProfileRequest(
    [Required(AllowEmptyStrings = true)] string Name,
    [Required] string Avatar,
    string? AgeBand = null,
    [StringLength(4)] string? Pin = null);

/// <param name="Pin">A new 4-digit PIN.</param>
/// <param name="RemovePin">Remove the PIN.</param>
/// <param name="PlayWithOthers">Let a child play online with other accounts (ADR 0016).</param>
/// <param name="OnPublicBoards">Show the profile on public boards (ADR 0029).</param>
/// <param name="AskedChild">Turning it on for a child: its owner asked the child first (D-06).</param>
/// <param name="Invites">Who may ask it to a table by its ID: <c>anyone</c>, <c>played-with</c>, <c>account</c>; a child
/// stays <c>account</c> (ADR 0033).</param>
public sealed record UpdateProfileRequest(
    string? Name = null,
    string? Avatar = null,
    string? AgeBand = null,
    [StringLength(4)] string? Pin = null,
    bool? RemovePin = null,
    bool? PlayWithOthers = null,
    bool? OnPublicBoards = null,
    bool? AskedChild = null,
    string? Invites = null);

/// <summary>The account's profiles and settings. Every change requires the parent gate (ADR 0011, 0023).</summary>
internal static class ProfileEndpoints
{
    public static void Map(IEndpointRouteBuilder api)
    {
        api.MapGet("/profiles/options", () => new ProfileOptionsView(
                ProfileOptions.Avatars, ProfileOptions.AgeBands, ProfileOptions.MaxProfilesPerAccount))
            .WithTags("Identity")
            .WithName("GetProfileOptions")
            .WithSummary("Allowed avatars and age bands, and how many profiles an account may own.");

        var account = Gated(api.MapGroup("/account"));
        account.MapPatch("/", async (UpdateAccountRequest request, Context context, CancellationToken ct) =>
            {
                if (request.Telemetry is { } telemetry)
                {
                    context.Account.TelemetryEnabled = telemetry;
                    await context.Users.UpdateAsync(context.Account);
                }

                return TypedResults.Ok(await context.MeAsync(ct));
            })
            .WithName("UpdateAccount")
            .WithSummary("Turn the account's telemetry on or off.");

        var profiles = Gated(api.MapGroup("/profiles"));
        profiles.MapPost("/", CreateProfileAsync)
            .WithName("CreateProfile")
            .WithSummary("Add a profile to the account (at most five).");

        profiles.MapPatch("/{id:guid}", UpdateProfileAsync)
            .WithName("UpdateProfile")
            .WithSummary("Edit one of the account's profiles.");

        profiles.MapDelete("/{id:guid}", DeleteProfileAsync)
            .WithName("DeleteProfile")
            .WithSummary("Remove one of the account's profiles — never the last one.");
    }

    private static RouteGroupBuilder Gated(RouteGroupBuilder group) => group
        .WithTags("Identity")
        .RequireAuthorization()
        .AddEndpointFilter(async (context, next) =>
        {
            var clock = context.HttpContext.RequestServices.GetRequiredService<TimeProvider>();
            return SessionClaims.IsParentUnlocked(context.HttpContext.User, clock.GetUtcNow())
                ? await next(context)
                : Problems.ParentGateRequired();
        })
        .ProducesProblem(StatusCodes.Status403Forbidden);

    private static async Task<Results<Ok<MeView>, ValidationProblem>> CreateProfileAsync(
        CreateProfileRequest request, Context context, TimeProvider clock, CancellationToken ct)
    {
        if (!ProfileNames.TryNormalize(request.Name, out var name, out var nameError))
        {
            return Problems.Field("name", nameError);
        }

        if (Invalid(request.Avatar, request.AgeBand, request.Pin) is { } invalid)
        {
            return invalid;
        }

        await using var transaction = await context.Db.Database.BeginTransactionAsync(ct);
        await LockAccountAsync(context.Db, context.Account.Id, ct);
        var count = await context.Db.Profiles.CountAsync(p => p.AccountId == context.Account.Id, ct);
        if (count >= ProfileOptions.MaxProfilesPerAccount)
        {
            return Problems.Field("", "too_many_profiles");
        }

        var child = request.AgeBand is not null;
        var profile = new Profile
        {
            Id = Guid.CreateVersion7(),
            AccountId = context.Account.Id,
            PublicId = await NewPublicIdAsync(context.Db, ct),
            Name = name,
            Avatar = request.Avatar,
            Kind = child ? ProfileKind.Child : ProfileKind.Adult,
            AgeBand = request.AgeBand,
            // A child stays off public boards until its owner asks it (D-06), and is asked to tables only within the
            // account (ADR 0033).
            OnPublicBoards = !child,
            Invites = child ? InviteScope.Account : InviteScope.Anyone,
            CreatedAt = clock.GetUtcNow(),
        };
        if (!string.IsNullOrEmpty(request.Pin))
        {
            profile.PinHash = Pins.Hash(profile, request.Pin);
        }

        context.Db.Profiles.Add(profile);
        await context.Db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return TypedResults.Ok(await context.MeAsync(ct));
    }

    private static async Task<Results<Ok<MeView>, NotFound, ValidationProblem>> UpdateProfileAsync(
        Guid id, UpdateProfileRequest request, Context context, TimeProvider clock, CancellationToken ct)
    {
        var profile = await context.Db.Profiles
            .FirstOrDefaultAsync(p => p.Id == id && p.AccountId == context.Account.Id, ct);
        if (profile is null)
        {
            return TypedResults.NotFound();
        }

        if (profile.Kind == ProfileKind.Adult && request.AgeBand is not null)
        {
            return Problems.Field("ageBand", "adults_have_no_age_band");
        }

        if (Invalid(request.Avatar, request.AgeBand, request.Pin) is { } invalid)
        {
            return invalid;
        }

        // A child's name and avatar go public only once its owner says they asked the child (D-06).
        var showingChild = request.OnPublicBoards == true && profile.Kind == ProfileKind.Child && !profile.OnPublicBoards;
        if (showingChild && request.AskedChild != true)
        {
            return Problems.Field("askedChild", "asked_child_required");
        }

        var invites = profile.Invites;
        if (request.Invites is not null && !InviteScopes.TryParse(request.Invites, out invites))
        {
            return Problems.Field("invites", "invites_invalid");
        }

        // A child is asked to tables only within its account, and its ID is not found from outside (ADR 0033).
        if (profile.Kind == ProfileKind.Child && invites != InviteScope.Account)
        {
            return Problems.Field("invites", "child_invites_account_only");
        }

        if (request.Name is not null)
        {
            if (!ProfileNames.TryNormalize(request.Name, out var name, out var nameError))
            {
                return Problems.Field("name", nameError);
            }

            profile.Name = name;
        }

        profile.Avatar = request.Avatar ?? profile.Avatar;
        profile.AgeBand = request.AgeBand ?? profile.AgeBand;
        profile.Invites = invites;
        if (request.PlayWithOthers is { } others && profile.Kind == ProfileKind.Child)
        {
            profile.PlayWithOthers = others;
        }

        if (request.OnPublicBoards is { } shown)
        {
            profile.OnPublicBoards = shown;
            profile.AskedChildAt = showingChild ? clock.GetUtcNow() : profile.AskedChildAt;
        }

        if (request.RemovePin == true)
        {
            profile.PinHash = null;
        }
        else if (!string.IsNullOrEmpty(request.Pin))
        {
            profile.PinHash = Pins.Hash(profile, request.Pin);
        }

        await context.Db.SaveChangesAsync(ct);
        return TypedResults.Ok(await context.MeAsync(ct));
    }

    private static async Task<Results<Ok<MeView>, NotFound, ProblemHttpResult>> DeleteProfileAsync(
        Guid id, Context context, CancellationToken ct)
    {
        // Looked up under the lock, so a second tap on "delete" finds nothing rather than racing the first.
        await using var transaction = await context.Db.Database.BeginTransactionAsync(ct);
        await LockAccountAsync(context.Db, context.Account.Id, ct);
        var profile = await context.Db.Profiles
            .FirstOrDefaultAsync(p => p.Id == id && p.AccountId == context.Account.Id, ct);
        if (profile is null)
        {
            return TypedResults.NotFound();
        }

        // An account always has someone to play as: its first profile is created with it, and the last one stays.
        if (await context.Db.Profiles.CountAsync(p => p.AccountId == context.Account.Id, ct) <= 1)
        {
            return Problems.Of(StatusCodes.Status409Conflict, "last_profile", "An account keeps at least one profile");
        }

        context.Db.Profiles.Remove(profile);
        await context.Db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return TypedResults.Ok(await context.MeAsync(ct));
    }

    /// <summary>
    /// Holds the account's row until the transaction ends, so two requests cannot both pass a count — five profiles
    /// at most, one at least — and break it together.
    /// </summary>
    private static Task LockAccountAsync(ToheDbContext db, Guid accountId, CancellationToken ct) =>
        db.Database.ExecuteSqlAsync($"SELECT 1 FROM identity.accounts WHERE id = {accountId} FOR UPDATE", ct);

    /// <summary>A public ID no profile has yet. Collisions are one in tens of billions; a few tries is plenty.</summary>
    public static async Task<string> NewPublicIdAsync(ToheDbContext db, CancellationToken ct)
    {
        for (var attempt = 0; attempt < 5; attempt++)
        {
            var id = ProfileIds.New();
            if (!await db.Profiles.AnyAsync(p => p.PublicId == id, ct))
            {
                return id;
            }
        }

        throw new InvalidOperationException("Could not find a free public profile ID after 5 tries.");
    }

    /// <summary>Checks values that DataAnnotations cannot express; null when everything given is valid.</summary>
    private static ValidationProblem? Invalid(string? avatar, string? ageBand, string? pin)
    {
        if (avatar is not null && !ProfileOptions.Avatars.Contains(avatar))
        {
            return Problems.Field("avatar", "avatar_invalid");
        }

        if (ageBand is not null && !ProfileOptions.AgeBands.Contains(ageBand))
        {
            return Problems.Field("ageBand", "age_band_invalid");
        }

        if (!string.IsNullOrEmpty(pin) && !ProfileOptions.Pin().IsMatch(pin))
        {
            return Problems.Field("pin", "pin_format");
        }

        return null;
    }

    /// <summary>The signed-in account and what every endpoint here needs, bound per request.</summary>
    internal sealed class Context(ToheDbContext db, MeQueries me, UserManager<Account> users, Account account, HttpContext http)
    {
        public ToheDbContext Db { get; } = db;

        public UserManager<Account> Users { get; } = users;

        public Account Account { get; } = account;

        public async Task<MeView> MeAsync(CancellationToken ct) =>
            (await me.LoadAsync(Account.Id, DeviceSession.Of(http.User), ct))!;

        public static async ValueTask<Context?> BindAsync(HttpContext http)
        {
            var services = http.RequestServices;
            var users = services.GetRequiredService<UserManager<Account>>();
            var account = await users.GetUserAsync(http.User);
            return account is null
                ? null
                : new Context(services.GetRequiredService<ToheDbContext>(), services.GetRequiredService<MeQueries>(), users, account, http);
        }
    }
}
