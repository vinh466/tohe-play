using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Identity;

/// <summary>
/// Merge aliases as other modules read them (ADR 0043, step I2b): the old id of a device profile merged into another
/// profile still finds that profile — a replay, a result, an invitation by id.
/// </summary>
public interface IProfileAliases
{
    /// <summary>The profile an id names now: the one it was merged into, or the id itself.</summary>
    Task<Guid> ResolveAsync(Guid id, CancellationToken ct);

    /// <summary>Every id that names the profile: its own first, then the ids merged into it.</summary>
    Task<IReadOnlyList<Guid>> IdsOfAsync(Guid profileId, CancellationToken ct);
}

internal sealed class ProfileAliases(ToheDbContext db) : IProfileAliases
{
    public async Task<Guid> ResolveAsync(Guid id, CancellationToken ct) =>
        await db.ProfileAliases.AsNoTracking()
            .Where(alias => alias.OldId == id)
            .Select(alias => (Guid?)alias.ProfileId)
            .FirstOrDefaultAsync(ct) ?? id;

    public async Task<IReadOnlyList<Guid>> IdsOfAsync(Guid profileId, CancellationToken ct) =>
        [
            profileId,
            .. await db.ProfileAliases.AsNoTracking()
                .Where(alias => alias.ProfileId == profileId)
                .OrderBy(alias => alias.CreatedAt)
                .Select(alias => alias.OldId)
                .ToListAsync(ct),
        ];
}
