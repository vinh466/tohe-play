using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Identity;

/// <summary>The profile playing in this request's session, as other modules may see it.</summary>
/// <param name="AccountId">The account that owns the profile.</param>
/// <param name="PlayWithOthers">A child the owner lets play online with other accounts (ADR 0016).</param>
public sealed record ActiveProfile(
    Guid Id,
    Guid AccountId,
    ProfileKind Kind,
    string? AgeBand,
    string Name = "",
    string Avatar = "",
    bool PlayWithOthers = false)
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
            .Select(p => new ActiveProfile(p.Id, p.AccountId, p.Kind, p.AgeBand, p.Name, p.Avatar, p.PlayWithOthers))
            .FirstOrDefaultAsync(cancellationToken);
    }
}

/// <summary>A player as other modules may show it (e.g. on a leaderboard).</summary>
public sealed record PlayerCard(Guid Id, string Name, string Avatar);

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
