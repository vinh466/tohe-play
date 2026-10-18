using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Platform;

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

/// <summary>A build the games origin serves, to open in the console (ADR 0032).</summary>
/// <param name="EntryUrl">Absolute URL to load in the game iframe.</param>
public sealed record RegistryBuild(
    string Name, string Version, string EntryUrl, string Orientation, IReadOnlyList<string> Capabilities);

/// <summary>What the admin console reads of the registry (ADR 0027); the table stays this module's.</summary>
internal sealed class RegistryFacts(ToheDbContext db, IOptions<GamesOptions> games)
{
    /// <summary>
    /// The game's build at <paramref name="path"/> — e.g. <c>merge-block/1.9.0/</c> — while the catalog lists it: the
    /// games origin serves the listed builds only (ADR 0007). Null once the catalog moved on.
    /// </summary>
    public async Task<RegistryBuild?> BuildAsync(string gameId, string path, CancellationToken ct)
    {
        var game = await db.Games.AsNoTracking()
            .FirstOrDefaultAsync(game => game.Id == gameId && game.Listed && game.Path == path, ct);
        if (game is null)
        {
            return null;
        }

        var root = new Uri(games.Value.PublicOrigin, game.Path);
        return new RegistryBuild(game.Name, game.Version, new Uri(root, game.Entry).ToString(), game.Orientation, game.Capabilities);
    }

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
