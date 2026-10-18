using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Progress;

/// <summary>Profiles that played in the last day and in the last week.</summary>
public sealed record ActivePlayers(int LastDay, int LastWeek);

/// <summary>
/// What the admin console counts about play (ADR 0027). A profile played when it saved a game or recorded a score: the
/// server sees nothing else of a game.
/// </summary>
internal sealed class ProgressFacts(ToheDbContext db)
{
    public async Task<ActivePlayers> PlayersAsync(DateTimeOffset now, CancellationToken ct) =>
        new(await PlayersSinceAsync(now.AddDays(-1), ct), await PlayersSinceAsync(now.AddDays(-7), ct));

    /// <summary>The profiles that played each game since then.</summary>
    public async Task<IReadOnlyDictionary<string, int>> PlayersByGameAsync(DateTimeOffset since, CancellationToken ct)
    {
        var games = await db.SavedGames.Where(save => save.UpdatedAt > since)
            .Select(save => new { save.GameId, save.ProfileId })
            .Union(db.Scores.Where(score => score.RecordedAt > since).Select(score => new { score.GameId, score.ProfileId }))
            .GroupBy(play => play.GameId)
            .Select(game => new { game.Key, Players = game.Count() })
            .ToListAsync(ct);
        return games.ToDictionary(game => game.Key, game => game.Players, StringComparer.Ordinal);
    }

    private Task<int> PlayersSinceAsync(DateTimeOffset since, CancellationToken ct) =>
        db.SavedGames.Where(save => save.UpdatedAt > since).Select(save => save.ProfileId)
            .Union(db.Scores.Where(score => score.RecordedAt > since).Select(score => score.ProfileId))
            .CountAsync(ct);
}
