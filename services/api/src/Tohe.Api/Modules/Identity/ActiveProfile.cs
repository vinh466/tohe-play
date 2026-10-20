using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Identity;

/// <summary>The profile playing in this request's session, as other modules may see it.</summary>
/// <param name="AccountId">The account that owns the profile.</param>
/// <param name="PlayWithOthers">A child the owner lets play online with other accounts (ADR 0016).</param>
/// <param name="DeviceUntil">When it came from a device (ADR 0043): what it reached until then was a device profile's.</param>
public sealed record ActiveProfile(
    Guid Id,
    Guid AccountId,
    ProfileKind Kind,
    string? AgeBand,
    string Name = "",
    string Avatar = "",
    bool PlayWithOthers = false,
    DateTimeOffset? DeviceUntil = null)
{
    /// <summary>Highest game <c>minAge</c> this profile may see; unlimited for adults and guests.</summary>
    public int MaxGameMinAge => Kind == ProfileKind.Child && AgeBand is { } band ? ProfileOptions.MinAgeOf(band) : int.MaxValue;

    /// <summary>May sit at a table with people of other accounts: adults, and children the owner allowed.</summary>
    public bool MayPlayWithOthers => Kind == ProfileKind.Adult || PlayWithOthers;
}

/// <summary>Read access to the active profile for other modules (e.g. Registry filters games by age).</summary>
public interface IActiveProfile
{
    /// <summary>Null for guests and for sessions without a chosen profile.</summary>
    Task<ActiveProfile?> GetAsync(ClaimsPrincipal user, CancellationToken cancellationToken);
}

internal sealed class ActiveProfileReader(ToheDbContext db) : IActiveProfile
{
    public async Task<ActiveProfile?> GetAsync(ClaimsPrincipal user, CancellationToken cancellationToken)
    {
        if (SessionClaims.ProfileId(user) is not { } profileId || SessionClaims.AccountId(user) is not { } accountId)
        {
            return null;
        }

        // Only a profile of the signed-in account: a profile id from another account can never be used.
        return await db.Profiles.AsNoTracking()
            .Where(p => p.Id == profileId && p.AccountId == accountId)
            .Select(p => new ActiveProfile(p.Id, p.AccountId!.Value, p.Kind, p.AgeBand, p.Name, p.Avatar, p.PlayWithOthers, p.DeviceUntil))
            .FirstOrDefaultAsync(cancellationToken);
    }
}

/// <summary>
/// Children kept to their account — "Chơi online với người ngoài" off — as their accounts say now (ADR 0016, 0043): a
/// table reads it before a device profile joins, rather than trusting what was true when the child sat down.
/// </summary>
public interface IKeptProfiles
{
    /// <summary>Those of <paramref name="profileIds"/> that are children whose switch is off.</summary>
    Task<IReadOnlySet<Guid>> KeptAsync(IReadOnlyCollection<Guid> profileIds, CancellationToken ct);
}

internal sealed class KeptProfiles(ToheDbContext db) : IKeptProfiles
{
    public async Task<IReadOnlySet<Guid>> KeptAsync(IReadOnlyCollection<Guid> profileIds, CancellationToken ct) =>
        profileIds.Count == 0
            ? new HashSet<Guid>()
            : (await db.Profiles.AsNoTracking()
                .Where(p => profileIds.Contains(p.Id) && p.Kind == ProfileKind.Child && !p.PlayWithOthers)
                .Select(p => p.Id)
                .ToListAsync(ct)).ToHashSet();
}

/// <summary>
/// Told when an account turns a child's "play with outsiders" off (ADR 0016, 0043): implemented by the tables, which
/// keep the child only where the account keeps to itself.
/// </summary>
public interface IKeptChildren
{
    Task KeptAsync(Guid profileId, Guid accountId, CancellationToken ct);
}

/// <summary>Told when a profile's name changes on the server (ADR 0035, 0043): the tables show the new one at once.</summary>
public interface IProfileNames
{
    Task RenamedAsync(Guid profileId, string name, CancellationToken ct);
}

/// <summary>A player as other modules may show it (e.g. on a leaderboard).</summary>
public sealed record PlayerCard(Guid Id, string Name, string Avatar);

/// <summary>A profile another account may ask to a table, as the rooms see it (ADR 0033).</summary>
public sealed record InviteTarget(Guid ProfileId, Guid AccountId, string PublicId, string Name, string Avatar, InviteScope Invites);

/// <summary>
/// Finds profiles for other accounts (ADR 0033): never a child of another account — a child is not found from outside
/// its account — nor a profile of an account suspended or waiting to be deleted (ADR 0034).
/// </summary>
public interface IProfileDirectory
{
    /// <summary>The profile with this public ID as someone of <paramref name="askingAccount"/> may find it, or null.</summary>
    Task<InviteTarget?> FindByPublicIdAsync(string publicId, Guid askingAccount, CancellationToken cancellationToken);

    /// <summary>The same, by the profile's id.</summary>
    Task<InviteTarget?> FindAsync(Guid profileId, Guid askingAccount, CancellationToken cancellationToken);
}

internal sealed class ProfileDirectory(ToheDbContext db) : IProfileDirectory
{
    public Task<InviteTarget?> FindByPublicIdAsync(string publicId, Guid askingAccount, CancellationToken cancellationToken) =>
        FindAsync(db.Profiles.Where(profile => profile.PublicId == publicId), askingAccount, cancellationToken);

    public Task<InviteTarget?> FindAsync(Guid profileId, Guid askingAccount, CancellationToken cancellationToken) =>
        FindAsync(db.Profiles.Where(profile => profile.Id == profileId), askingAccount, cancellationToken);

    private async Task<InviteTarget?> FindAsync(IQueryable<Profile> profiles, Guid askingAccount, CancellationToken cancellationToken) =>
        await profiles.AsNoTracking()
            .Where(profile => profile.Kind == ProfileKind.Adult || profile.AccountId == askingAccount)
            .Join(
                db.Users.Where(account => account.SuspendedAt == null && account.DeleteAfter == null),
                profile => profile.AccountId,
                account => (Guid?)account.Id,
                (profile, account) => new InviteTarget(
                    profile.Id, account.Id, profile.PublicId!, profile.Name, profile.Avatar, profile.Invites))
            .FirstOrDefaultAsync(cancellationToken);
}

/// <summary>Profile IDs each account looks up in an hour (ADR 0033, <c>Identity:ProfileLookupsPerHour</c>).</summary>
internal sealed class ProfileLookups(TimeProvider clock) : HourlyAllowance(clock);

/// <summary>Read access to an account's profiles for other modules.</summary>
public interface IAccountProfiles
{
    Task<IReadOnlyList<PlayerCard>> ListAsync(Guid accountId, CancellationToken cancellationToken);
}

internal sealed class AccountProfilesReader(ToheDbContext db) : IAccountProfiles
{
    public async Task<IReadOnlyList<PlayerCard>> ListAsync(Guid accountId, CancellationToken cancellationToken) =>
        await db.Profiles.AsNoTracking()
            .Where(p => p.AccountId == accountId)
            .OrderBy(p => p.CreatedAt)
            .Select(p => new PlayerCard(p.Id, p.Name, p.Avatar))
            .ToListAsync(cancellationToken);
}
