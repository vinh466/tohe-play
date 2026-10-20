using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
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
        // Outside the parent gate: whoever is signed in looks up an ID to ask its profile to a table (ADR 0033).
        api.MapGet("/profiles/by-id/{publicId}", FindByIdAsync)
            .WithTags("Identity")
            .RequireAuthorization()
            .WithName("FindProfileById")
            .WithSummary("A profile's card by its public ID, as this account may find it: never a child of another account.");

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

        profiles.MapPost("/adopt", AdoptProfileAsync)
            .WithName("AdoptProfile")
            .WithSummary("Bring a device profile into the account with its id, saves and scores (ADR 0043); 409 id_taken when the id cannot be taken.");

        profiles.MapPost("/{id:guid}/merge", MergeProfileAsync)
            .WithName("MergeProfile")
            .WithSummary("Upload a device profile's saves and scores under one of the account's profiles: the newer save wins (ADR 0043).");

        profiles.MapPatch("/{id:guid}", UpdateProfileAsync)
            .WithName("UpdateProfile")
            .WithSummary("Edit one of the account's profiles.");

        profiles.MapDelete("/{id:guid}", DeleteProfileAsync)
            .WithName("DeleteProfile")
            .WithSummary("Delete one of the account's profiles — never the last one — and everything of it, for good.");
    }

    /// <summary>
    /// The card of the profile with this ID — its name, avatar and ID — to confirm before asking it to a table
    /// (ADR 0033, D-17). Every lookup counts, found or not, so IDs cannot be walked through.
    /// </summary>
    private static async Task<Results<Ok<ProfileCardView>, ValidationProblem, ProblemHttpResult>> FindByIdAsync(
        string publicId,
        HttpContext http,
        IProfileDirectory directory,
        ProfileLookups lookups,
        IOptions<IdentityOptions> options,
        CancellationToken ct)
    {
        if (!ProfileIds.TryNormalize(publicId, out var id))
        {
            return Problems.Field("publicId", "profile_id_invalid");
        }

        var accountId = SessionClaims.AccountId(http.User) ?? Guid.Empty;
        if (!lookups.TryTake(accountId, options.Value.ProfileLookupsPerHour))
        {
            return Problems.Of(StatusCodes.Status429TooManyRequests, "lookup_limit", "Too many profile IDs looked up this hour");
        }

        return await directory.FindByPublicIdAsync(id, accountId, ct) is { } found
            ? TypedResults.Ok(new ProfileCardView(found.ProfileId, found.PublicId, found.Name, found.Avatar))
            : Problems.Of(StatusCodes.Status404NotFound, "profile_not_found", "No profile with that ID");
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

    /// <summary>
    /// A device profile comes into the account keeping its id (ADR 0043): an adult's profile, or a child's with an age
    /// band, made with its saves and scores in one transaction. Its scores are marked as a device's and stay off public
    /// boards. Profile management: step-up level 1, as adding a profile (ADR 0025).
    /// </summary>
    private static async Task<Results<Ok<MeView>, ValidationProblem, ProblemHttpResult>> AdoptProfileAsync(
        DeviceProfileUpload request, Context context, DeviceProfiles devices, HttpContext http, TimeProvider clock, CancellationToken ct)
    {
        if (Closed(context.Account) is { } closed)
        {
            return closed;
        }

        if (devices.Check(request, out var name) is { } refused)
        {
            return refused;
        }

        await using var transaction = await context.Db.Database.BeginTransactionAsync(ct);
        await LockAccountAsync(context.Db, context.Account.Id, ct);

        // Already this account's: the answer to an earlier request was lost. Taken again, idempotently — scores by their
        // client ids, marked as before — so the device can drop it without making a second profile.
        if (await devices.OwnAsync(request.Id, context.Account.Id, ct) is { } own)
        {
            await devices.ImportAsync(own.Id, context.Account.Id, request.Data, ct);
            await context.Db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return TypedResults.Ok(await context.MeAsync(ct));
        }

        if (await context.Db.Profiles.CountAsync(p => p.AccountId == context.Account.Id, ct) >= ProfileOptions.MaxProfilesPerAccount)
        {
            return Problems.Field("", "too_many_profiles");
        }

        // A device profile on the server, of this request's device (its key came with it): the same row becomes the
        // account's, keeping its id, its seats and results (ADR 0043).
        if (await devices.ServerCopyAsync(http, request.Id, ct) is { } copy)
        {
            // Gone at this very moment — deleted or cleaned up, its id retired: the hub gives it a new one.
            if (!await devices.ConvertAsync(copy, context.Account.Id, request, name, clock.GetUtcNow(), ct))
            {
                return DeviceProfiles.IdTaken();
            }

            await devices.ImportAsync(copy.Id, context.Account.Id, request.Data, ct);
            await devices.SaveAsync(ct);
            await transaction.CommitAsync(ct);
            return TypedResults.Ok(await context.MeAsync(ct));
        }

        // Any other profile, a profile that was, or another device's copy: not this device's to bring in.
        if (await devices.IdTakenAsync(request.Id, ct))
        {
            return DeviceProfiles.IdTaken();
        }

        var profile = await devices.AddAsync(context.Account.Id, request, name, clock.GetUtcNow(), ct);
        await devices.ImportAsync(profile.Id, context.Account.Id, request.Data, ct);

        // Another request brought the same id in at this very moment.
        if (!await devices.SaveAsync(ct))
        {
            return DeviceProfiles.IdTaken();
        }

        await transaction.CommitAsync(ct);
        return TypedResults.Ok(await context.MeAsync(ct));
    }

    /// <summary>
    /// A device profile merged into one of the account's profiles (ADR 0043, step I1): its saves and scores go up under
    /// the target's id — the newer save wins, the other is kept as the previous one — its scores marked as a device's;
    /// the target keeps its name and avatar, and the device profile's name joins its name history. Its copy on the server,
    /// of this request's device, moves into the target and its id becomes the target's alias (ADR 0043, step I2b).
    /// </summary>
    private static async Task<Results<Ok<MeView>, NotFound, ProblemHttpResult>> MergeProfileAsync(
        Guid id,
        MergeProfileRequest request,
        Context context,
        DeviceProfiles devices,
        AccountDeletion deletion,
        HttpContext http,
        TimeProvider clock,
        CancellationToken ct)
    {
        if (Closed(context.Account) is { } closed)
        {
            return closed;
        }

        if (DeviceProfiles.CheckName(request.Name, out var name) is { } refused)
        {
            return refused;
        }

        if (devices.CheckData(request.Data) is { } invalid)
        {
            return invalid;
        }

        await using var transaction = await context.Db.Database.BeginTransactionAsync(ct);
        await LockAccountAsync(context.Db, context.Account.Id, ct);
        var target = await context.Db.Profiles.FirstOrDefaultAsync(p => p.Id == id && p.AccountId == context.Account.Id, ct);
        if (target is null)
        {
            return TypedResults.NotFound();
        }

        // Its server copy (ADR 0043): this device's moves into the target and is deleted, its id retired and kept as the
        // target's alias; another device's, or any other profile's id, is not this device's to merge.
        Profile? copy = null;
        var again = false;
        if (request.DeviceProfileId is { } deviceProfileId && deviceProfileId != target.Id)
        {
            copy = await devices.ServerCopyAsync(http, deviceProfileId, ct);
            var alias = copy is null ? await devices.AliasOfAsync(deviceProfileId, ct) : null;
            if (copy is null && (await context.Db.Profiles.AnyAsync(p => p.Id == deviceProfileId, ct) || (alias is { } other && other != target.Id)))
            {
                return DeviceProfiles.IdTaken();
            }

            // Merged into this target already: the answer was lost. The data is taken again, idempotently.
            again = alias == target.Id;
        }

        var now = clock.GetUtcNow();
        if (!again)
        {
            context.Db.ProfileNameHistory.Add(
                new ProfileName { ProfileId = target.Id, Name = name, At = now, Kind = ProfileNameKind.Merged });
        }

        await devices.ImportAsync(target.Id, context.Account.Id, request.Data, ct);
        if (copy is not null)
        {
            await devices.MoveAsync(copy, target, now, ct);
            await deletion.DeleteProfileAsync(copy, ct);
        }

        await context.Db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return TypedResults.Ok(await context.MeAsync(ct));
    }

    /// <summary>
    /// Nothing comes into a suspended account (ADR 0027), nor one waiting to be deleted (ADR 0034) — as for any way into
    /// an account (ADR 0043).
    /// </summary>
    private static ProblemHttpResult? Closed(Account account) =>
        account.SuspendedAt is not null ? Problems.AccountSuspended()
        : account.DeleteAfter is not null ? Problems.SessionEnded()
        : null;

    private static async Task<Results<Ok<MeView>, NotFound, ValidationProblem, ProblemHttpResult>> UpdateProfileAsync(
        Guid id,
        UpdateProfileRequest request,
        Context context,
        TimeProvider clock,
        IOptions<IdentityOptions> options,
        IEnumerable<IKeptChildren> tables,
        CancellationToken ct)
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

            // A few renames a day (E-07 Q5): enough for anyone, too few to swear and swap back. Moderators rename from
            // the console, without a limit.
            if (name != profile.Name
                && await RenamesTodayAsync(context.Db, profile.Id, clock.GetUtcNow(), ct) >= options.Value.ProfileRenamesPerDay)
            {
                return Problems.Of(StatusCodes.Status429TooManyRequests, "rename_limit", "This profile was renamed enough for today");
            }

            profile.Name = name;
        }

        profile.Avatar = request.Avatar ?? profile.Avatar;
        profile.AgeBand = request.AgeBand ?? profile.AgeBand;
        profile.Invites = invites;
        var keptNow = false;
        if (request.PlayWithOthers is { } others && profile.Kind == ProfileKind.Child)
        {
            keptNow = profile.PlayWithOthers && !others;
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

        // Kept to its account from now on: it leaves the tables where outsiders — device profiles too — may sit.
        if (keptNow)
        {
            foreach (var table in tables)
            {
                await table.KeptAsync(profile.Id, context.Account.Id, ct);
            }
        }

        return TypedResults.Ok(await context.MeAsync(ct));
    }

    /// <summary>
    /// Deletes the profile and everything of it at once (ADR 0034): saves, scores, results on boards, ranked runs; its
    /// seats in finished hands stay for the others at the table, without anything of it. For a child, this is its
    /// parent taking the consent back (R-07).
    /// </summary>
    private static async Task<Results<Ok<MeView>, NotFound, ProblemHttpResult>> DeleteProfileAsync(
        Guid id, Context context, AccountDeletion deletion, CancellationToken ct)
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

        await deletion.DeleteProfileAsync(profile, ct);
        await transaction.CommitAsync(ct);
        return TypedResults.Ok(await context.MeAsync(ct));
    }

    /// <summary>
    /// Renames in the last 24 hours, read from the name history (D-17): every name it had but its first, the one it
    /// was created with. A moderator's renames are in it too; a device profile's name merged into it is not (ADR 0043).
    /// </summary>
    internal static async Task<int> RenamesTodayAsync(ToheDbContext db, Guid profileId, DateTimeOffset now, CancellationToken ct)
    {
        var names = db.ProfileNameHistory.Where(n => n.ProfileId == profileId && n.Kind == ProfileNameKind.Rename);
        var first = await names.MinAsync(n => (long?)n.Id, ct);
        var since = now.AddDays(-1);
        return await names.CountAsync(n => n.At > since && n.Id != first, ct);
    }

    /// <summary>
    /// Holds the account's row until the transaction ends, so two requests cannot both pass a count — five profiles
    /// at most, one at least — and break it together.
    /// </summary>
    private static Task LockAccountAsync(ToheDbContext db, Guid accountId, CancellationToken ct) =>
        db.Database.ExecuteSqlAsync($"SELECT 1 FROM identity.accounts WHERE id = {accountId} FOR UPDATE", ct);

    /// <summary>
    /// A public ID no profile has, nor ever had (ADR 0034): a deleted profile's ID is never given again. Collisions are
    /// one in tens of billions; a few tries is plenty.
    /// </summary>
    public static async Task<string> NewPublicIdAsync(ToheDbContext db, CancellationToken ct)
    {
        for (var attempt = 0; attempt < 5; attempt++)
        {
            var id = ProfileIds.New();
            if (!await db.Profiles.AnyAsync(p => p.PublicId == id, ct)
                && !await db.RetiredProfileIds.AnyAsync(retired => retired.PublicId == id, ct))
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
