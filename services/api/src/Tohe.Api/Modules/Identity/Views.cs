using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Identity;

/// <summary>The signed-in adult.</summary>
public sealed record AccountView(Guid Id, string Username, string DisplayName);

/// <summary>An adult of the household.</summary>
public sealed record MemberView(Guid AccountId, string DisplayName, string Username);

/// <summary>Code another adult can use to register into this household.</summary>
public sealed record InviteView(string Code, DateTimeOffset ExpiresAt);

/// <param name="Invite">Only while the parent gate is unlocked.</param>
/// <param name="Telemetry">The household's devices send technical telemetry (ADR 0015).</param>
public sealed record HouseholdView(
    Guid Id,
    string Name,
    IReadOnlyList<MemberView> Members,
    InviteView? Invite,
    bool Telemetry);

/// <param name="Kind"><c>adult</c> or <c>child</c>.</param>
/// <param name="IsMine">The signed-in adult's own profile.</param>
/// <param name="PlayWithOthers">May play online with other households: adults, and children a parent allowed.</param>
public sealed record ProfileView(
    Guid Id,
    string Name,
    string Avatar,
    string Kind,
    string? AgeBand,
    bool HasPin,
    bool IsMine,
    bool PlayWithOthers);

/// <summary>Everything the hub needs about the device session.</summary>
/// <param name="ActiveProfileId">The profile playing on this device, if one was chosen.</param>
/// <param name="ParentUnlockedUntil">Household management is unlocked until then (parent gate), or null.</param>
public sealed record MeView(
    AccountView Account,
    HouseholdView Household,
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

        var household = await db.Households.AsNoTracking()
            .Include(h => h.Profiles)
            .FirstAsync(h => h.Id == account.HouseholdId, cancellationToken);
        var members = await db.Users.AsNoTracking()
            .Where(a => a.HouseholdId == household.Id)
            .OrderBy(a => a.CreatedAt)
            .Select(a => new MemberView(a.Id, a.DisplayName, a.UserName!))
            .ToListAsync(cancellationToken);

        var now = clock.GetUtcNow();
        var unlocked = parentUntil > now;
        var invite = unlocked && household.InviteCode is { } code && household.InviteExpiresAt > now
            ? new InviteView(code, household.InviteExpiresAt.Value)
            : null;

        var profiles = household.Profiles
            .OrderBy(p => p.Kind)
            .ThenBy(p => p.CreatedAt)
            .Select(p => ToView(p, accountId))
            .ToList();
        var active = profiles.Any(p => p.Id == activeProfileId) ? activeProfileId : null;

        return new MeView(
            new AccountView(account.Id, account.UserName!, account.DisplayName),
            new HouseholdView(household.Id, household.Name, members, invite, household.TelemetryEnabled),
            profiles,
            active,
            unlocked ? parentUntil : null);
    }

    public static ProfileView ToView(Profile profile, Guid accountId) => new(
        profile.Id,
        profile.Name,
        profile.Avatar,
        profile.Kind == ProfileKind.Adult ? "adult" : "child",
        profile.AgeBand,
        profile.PinHash is not null,
        profile.AccountId == accountId,
        profile.Kind == ProfileKind.Adult || profile.PlayWithOthers);
}
