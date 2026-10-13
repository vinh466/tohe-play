using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Identity;

/// <summary>The profile playing in this request's session, as other modules may see it.</summary>
public sealed record ActiveProfile(Guid Id, Guid HouseholdId, ProfileKind Kind, string? AgeBand)
{
    /// <summary>Highest game <c>minAge</c> this profile may see; unlimited for adults and guests.</summary>
    public int MaxGameMinAge => Kind == ProfileKind.Child && AgeBand is { } band ? ProfileOptions.MinAgeOf(band) : int.MaxValue;
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

        // Join through the account so a profile id from another household can never be used.
        return await db.Profiles.AsNoTracking()
            .Where(p => p.Id == profileId && db.Users.Any(a => a.Id == accountId && a.HouseholdId == p.HouseholdId))
            .Select(p => new ActiveProfile(p.Id, p.HouseholdId, p.Kind, p.AgeBand))
            .FirstOrDefaultAsync(cancellationToken);
    }
}

/// <summary>A player as other modules may show it (e.g. on a leaderboard).</summary>
public sealed record PlayerCard(Guid Id, string Name, string Avatar);

/// <summary>Read access to a household's profiles for other modules.</summary>
public interface IHouseholdProfiles
{
    Task<IReadOnlyList<PlayerCard>> ListAsync(Guid householdId, CancellationToken cancellationToken);
}

internal sealed class HouseholdProfilesReader(ToheDbContext db) : IHouseholdProfiles
{
    public async Task<IReadOnlyList<PlayerCard>> ListAsync(Guid householdId, CancellationToken cancellationToken) =>
        await db.Profiles.AsNoTracking()
            .Where(p => p.HouseholdId == householdId)
            .OrderBy(p => p.CreatedAt)
            .Select(p => new PlayerCard(p.Id, p.Name, p.Avatar))
            .ToListAsync(cancellationToken);
}
