using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Registry;

/// <summary>A game in the registry, listed or not, as the admin console shows it.</summary>
/// <param name="Listed">In the catalog the games origin serves now; unlisted games stay for their saves and scores.</param>
/// <param name="Online">Played at tables, refereed by the API (ADR 0016).</param>
public sealed record RegistryEntry(
    string Id,
    string Name,
    string Version,
    bool Listed,
    int MinAge,
    IReadOnlyList<string> Capabilities,
    IReadOnlyList<string> Tags,
    bool Online,
    int SizeKb,
    DateTimeOffset FirstSeenAt,
    DateTimeOffset UpdatedAt);

/// <summary>What the admin console reads of the registry (ADR 0027); the table stays this module's.</summary>
internal sealed class RegistryFacts(ToheDbContext db)
{
    public async Task<IReadOnlyList<RegistryEntry>> GamesAsync(CancellationToken ct) =>
        [.. (await db.Games.AsNoTracking().OrderBy(game => game.Id).ToListAsync(ct))
            .Select(game => new RegistryEntry(
                game.Id,
                game.Name,
                game.Version,
                game.Listed,
                game.MinAge,
                game.Capabilities,
                game.Tags,
                game.Rooms is not null,
                game.SizeKb,
                game.FirstSeenAt,
                game.UpdatedAt))];
}
