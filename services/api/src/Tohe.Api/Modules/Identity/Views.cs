using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Identity;

/// <summary>The signed-in account.</summary>
/// <param name="Email">The address it signs in with (ADR 0024); none yet for an account from before email sign-in.</param>
/// <param name="Username">What an account from before email sign-in signs in with, until it adds an email.</param>
/// <param name="Telemetry">The account's devices send technical telemetry (ADR 0015).</param>
/// <param name="HasPassword">It can step up with its password; otherwise with a code by email (ADR 0025).</param>
/// <param name="HasManagePin">Its manage PIN is set, so profile management opens with it (ADR 0025).</param>
/// <param name="TermsVersion">The terms its owner accepted, at 16 or older; the hub asks again for newer ones.</param>
/// <param name="Logins">The providers it signs in with besides its email (ADR 0026): <c>google</c>, <c>github</c>, <c>oidc</c>.</param>
/// <param name="Role">Its platform role (ADR 0027) — <c>owner</c>, <c>admin</c>, <c>moderator</c> or <c>viewer</c> — which opens
/// the admin console; none for players.</param>
/// <param name="Community">The community it came with by an invite code (ADR 0028): its board is one of the public ones.</param>
public sealed record AccountView(
    Guid Id,
    string? Email,
    string? Username,
    string DisplayName,
    bool Telemetry,
    bool HasPassword,
    bool HasManagePin,
    string? TermsVersion,
    IReadOnlyList<string> Logins,
    string? Role,
    string? Community);

/// <param name="PublicId">12 digits, the profile's public identifier (ADR 0023).</param>
/// <param name="Kind"><c>adult</c> or <c>child</c>.</param>
/// <param name="PlayWithOthers">May play online with other accounts: adults, and children the owner allowed.</param>
/// <param name="OnPublicBoards">On the public boards — a community's and the server's (ADR 0029).</param>
public sealed record ProfileView(
    Guid Id,
    string PublicId,
    string Name,
    string Avatar,
    string Kind,
    string? AgeBand,
    bool HasPin,
    bool PlayWithOthers,
    bool OnPublicBoards);

/// <summary>Everything the hub needs about the device session.</summary>
/// <param name="Profiles">The account's profiles, its first (created with it) first.</param>
/// <param name="ActiveProfileId">The profile playing on this device, if one was chosen.</param>
/// <param name="ParentUnlockedUntil">Profile management (step-up level 1) is open on this device until then, or null.</param>
/// <param name="SecureUntil">Account security (step-up level 2) is open on this device until then, or null.</param>
public sealed record MeView(
    AccountView Account,
    IReadOnlyList<ProfileView> Profiles,
    Guid? ActiveProfileId,
    DateTimeOffset? ParentUnlockedUntil,
    DateTimeOffset? SecureUntil);

internal sealed class MeQueries(ToheDbContext db, PlatformRoles roles, TimeProvider clock)
{
    public async Task<MeView?> LoadAsync(Guid accountId, DeviceSession session, CancellationToken cancellationToken)
    {
        var account = await db.Users.AsNoTracking().FirstOrDefaultAsync(a => a.Id == accountId, cancellationToken);
        if (account is null)
        {
            return null;
        }

        var profiles = await db.Profiles.AsNoTracking()
            .Where(p => p.AccountId == accountId)
            .OrderBy(p => p.CreatedAt)
            .ToListAsync(cancellationToken);
        var views = profiles.Select(ToView).ToList();
        var logins = await db.UserLogins.AsNoTracking()
            .Where(login => login.UserId == accountId)
            .Select(login => login.LoginProvider)
            .OrderBy(provider => provider)
            .ToListAsync(cancellationToken);
        var role = await roles.RoleOfAsync(accountId, cancellationToken);
        var community = account.CommunityId is { } communityId
            ? await db.Communities.AsNoTracking().Where(c => c.Id == communityId).Select(c => c.Name).FirstOrDefaultAsync(cancellationToken)
            : null;
        var active = views.Any(p => p.Id == session.ProfileId) ? session.ProfileId : null;
        var now = clock.GetUtcNow();

        return new MeView(
            new AccountView(
                account.Id,
                account.Email,
                account.Email is null ? account.UserName : null,
                account.DisplayName,
                account.TelemetryEnabled,
                account.PasswordHash is not null,
                account.ManagePinHash is not null,
                account.TermsVersion,
                logins,
                role is { } held ? PlatformRoles.NameOf(held) : null,
                community),
            views,
            active,
            session.ParentUntil > now ? session.ParentUntil : null,
            session.SecureUntil > now ? session.SecureUntil : null);
    }

    public static ProfileView ToView(Profile profile) => new(
        profile.Id,
        profile.PublicId,
        profile.Name,
        profile.Avatar,
        profile.Kind == ProfileKind.Adult ? "adult" : "child",
        profile.AgeBand,
        profile.PinHash is not null,
        profile.Kind == ProfileKind.Adult || profile.PlayWithOthers,
        profile.OnPublicBoards);
}
