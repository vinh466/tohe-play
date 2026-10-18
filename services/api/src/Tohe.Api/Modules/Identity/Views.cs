using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Identity;

/// <summary>The signed-in account.</summary>
/// <param name="Email">The address it signs in with (ADR 0024); none yet for an account from before email sign-in.</param>
/// <param name="Username">What an account from before email sign-in signs in with, until it adds an email.</param>
/// <param name="Telemetry">The account's devices send technical telemetry (ADR 0015).</param>
public sealed record AccountView(Guid Id, string? Email, string? Username, string DisplayName, bool Telemetry);

/// <param name="PublicId">12 digits, the profile's public identifier (ADR 0023).</param>
/// <param name="Kind"><c>adult</c> or <c>child</c>.</param>
/// <param name="PlayWithOthers">May play online with other accounts: adults, and children the owner allowed.</param>
public sealed record ProfileView(
    Guid Id,
    string PublicId,
    string Name,
    string Avatar,
    string Kind,
    string? AgeBand,
    bool HasPin,
    bool PlayWithOthers);

/// <summary>Everything the hub needs about the device session.</summary>
/// <param name="Profiles">The account's profiles, its first (created with it) first.</param>
/// <param name="ActiveProfileId">The profile playing on this device, if one was chosen.</param>
/// <param name="ParentUnlockedUntil">Profile management is unlocked until then (parent gate), or null.</param>
public sealed record MeView(
    AccountView Account,
    IReadOnlyList<ProfileView> Profiles,
    Guid? ActiveProfileId,
    DateTimeOffset? ParentUnlockedUntil);

internal sealed class MeQueries(ToheDbContext db, TimeProvider clock)
{
    public async Task<MeView?> LoadAsync(
        Guid accountId,
        Guid? activeProfileId,
        DateTimeOffset? parentUntil,
        CancellationToken cancellationToken)
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
        var active = views.Any(p => p.Id == activeProfileId) ? activeProfileId : null;
        var unlocked = parentUntil > clock.GetUtcNow();

        return new MeView(
            new AccountView(
                account.Id,
                account.Email,
                account.Email is null ? account.UserName : null,
                account.DisplayName,
                account.TelemetryEnabled),
            views,
            active,
            unlocked ? parentUntil : null);
    }

    public static ProfileView ToView(Profile profile) => new(
        profile.Id,
        profile.PublicId,
        profile.Name,
        profile.Avatar,
        profile.Kind == ProfileKind.Adult ? "adult" : "child",
        profile.AgeBand,
        profile.PinHash is not null,
        profile.Kind == ProfileKind.Adult || profile.PlayWithOthers);
}
