using System.Text.Json;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Rooms;

/// <param name="Firsts">Hands won (first place).</param>
public sealed record PlayerStats(int Hands, int Firsts, int Points);

/// <summary>One profile of the household on the game's weekly board.</summary>
public sealed record LeaderRow(Guid ProfileId, string Name, string Avatar, int Hands, int Firsts, int Points);

/// <summary>The active profile's online results in a game, and the household's board over the last 7 days.</summary>
public sealed record RoomStatsView(PlayerStats AllTime, PlayerStats Week, IReadOnlyList<LeaderRow> Household);

/// <summary>A finished hand the active profile played.</summary>
/// <param name="Seat">Its seat in the hand (the rules module's).</param>
/// <param name="Place">0 for first place.</param>
public sealed record HandSummary(Guid RoomId, int Hand, DateTimeOffset FinishedAt, int Seat, int Place, int Points, int Players);

/// <summary>A seat of a finished hand, as a replay shows it.</summary>
public sealed record ReplaySeat(Guid? ProfileId, string? Name, string? Avatar, string? Bot);

public sealed record ReplayAction(int Seat, JsonElement Action);

/// <summary>Everything the game needs to replay a finished hand with its own rules module.</summary>
/// <param name="Seed">The hand's seed: shown only after the hand is over, to the people who played it.</param>
/// <param name="MySeat">The active profile's seat in the hand, whose view the replay shows.</param>
public sealed record HandReplay(
    Guid RoomId,
    int Hand,
    string GameId,
    string GameVersion,
    int Seed,
    JsonElement Options,
    JsonElement Carry,
    IReadOnlyList<ReplaySeat> Seats,
    IReadOnlyList<ReplayAction> Actions,
    JsonElement Result,
    int MySeat,
    DateTimeOffset FinishedAt);

/// <summary>Statistics, the household board and replays of online hands (ADR 0016, phase 3).</summary>
internal static class RoomStats
{
    private const int HistoryLength = 20;

    public static void Map(RouteGroupBuilder rooms, Func<HttpContext, Player> playerOf)
    {
        rooms.MapGet("/stats", async (string game, HttpContext http, ToheDbContext db, IHouseholdProfiles profiles, TimeProvider clock, CancellationToken ct) =>
            {
                var player = playerOf(http);
                var since = clock.GetUtcNow().AddDays(-7);
                var mine = await db.RoomResults.AsNoTracking()
                    .Where(r => r.GameId == game && r.ProfileId == player.ProfileId)
                    .Select(r => new { r.Place, r.Points, r.At })
                    .ToListAsync(ct);
                var week = await db.RoomResults.AsNoTracking()
                    .Where(r => r.GameId == game && r.HouseholdId == player.HouseholdId && r.ProfileId != null && r.At >= since)
                    .GroupBy(r => r.ProfileId!.Value)
                    .Select(g => new { ProfileId = g.Key, Hands = g.Count(), Firsts = g.Count(r => r.Place == 0), Points = g.Sum(r => r.Points) })
                    .ToListAsync(ct);
                var cards = (await profiles.ListAsync(player.HouseholdId, ct)).ToDictionary(p => p.Id);
                var board = week
                    .Where(row => cards.ContainsKey(row.ProfileId))
                    .Select(row => new LeaderRow(row.ProfileId, cards[row.ProfileId].Name, cards[row.ProfileId].Avatar, row.Hands, row.Firsts, row.Points))
                    .OrderByDescending(row => row.Points)
                    .ThenByDescending(row => row.Firsts)
                    .ToList();
                var recent = mine.Where(r => r.At >= since).ToList();
                return new RoomStatsView(
                    new PlayerStats(mine.Count, mine.Count(r => r.Place == 0), mine.Sum(r => r.Points)),
                    new PlayerStats(recent.Count, recent.Count(r => r.Place == 0), recent.Sum(r => r.Points)),
                    board);
            })
            .WithName("GetRoomStats")
            .WithSummary("The active profile's online results in a game, and its household's board over the last 7 days.");

        rooms.MapGet("/history", async (string game, HttpContext http, ToheDbContext db, CancellationToken ct) =>
            {
                var player = playerOf(http);
                var mine = await db.RoomResults.AsNoTracking()
                    .Where(r => r.GameId == game && r.ProfileId == player.ProfileId)
                    .OrderByDescending(r => r.At)
                    .Take(HistoryLength)
                    .ToListAsync(ct);
                var keys = mine.Select(r => new { r.RoomId, r.Hand }).ToList();
                var roomIds = keys.Select(k => k.RoomId).Distinct().ToList();
                var players = await db.RoomResults.AsNoTracking()
                    .Where(r => roomIds.Contains(r.RoomId))
                    .GroupBy(r => new { r.RoomId, r.Hand })
                    .Select(g => new { g.Key.RoomId, g.Key.Hand, Count = g.Count() })
                    .ToListAsync(ct);
                return mine.Select(r => new HandSummary(
                    r.RoomId,
                    r.Hand,
                    r.At,
                    r.Seat,
                    r.Place,
                    r.Points,
                    players.FirstOrDefault(p => p.RoomId == r.RoomId && p.Hand == r.Hand)?.Count ?? 0)).ToList();
            })
            .WithName("ListMyHands")
            .WithSummary("The active profile's last 20 finished online hands of a game, newest first.");

        rooms.MapGet("/{id:guid}/hands/{hand:int}", async Task<Results<Ok<HandReplay>, NotFound>> (
                Guid id, int hand, HttpContext http, ToheDbContext db, CancellationToken ct) =>
            {
                var player = playerOf(http);
                // Only the people who played a hand see it again: its seed reveals every card.
                var played = await db.RoomResults.AsNoTracking()
                    .FirstOrDefaultAsync(r => r.RoomId == id && r.Hand == hand && r.ProfileId == player.ProfileId, ct);
                var record = await db.RoomHands.AsNoTracking().FirstOrDefaultAsync(h => h.RoomId == id && h.Hand == hand, ct);
                if (played is null || record is null)
                {
                    return TypedResults.NotFound();
                }

                var actions = await db.RoomActions.AsNoTracking()
                    .Where(a => a.RoomId == id && a.Hand == hand)
                    .OrderBy(a => a.Id)
                    .Select(a => new { a.Seat, a.Action })
                    .ToListAsync(ct);
                var seats = JsonSerializer.Deserialize<List<SeatRecord>>(record.Seats) ?? [];
                return TypedResults.Ok(new HandReplay(
                    id,
                    hand,
                    record.GameId,
                    record.GameVersion,
                    record.Seed,
                    Parse(record.Options),
                    Parse(record.Carry ?? "null"),
                    [.. seats.Select(s => new ReplaySeat(s.ProfileId, s.Name, s.Avatar, s.Bot))],
                    [.. actions.Select(a => new ReplayAction(a.Seat, Parse(a.Action)))],
                    Parse(record.Result),
                    played.Seat,
                    record.FinishedAt));
            })
            .WithName("GetHandReplay")
            .WithSummary("A finished hand the active profile played, with its seed and actions, to replay it in the game.");
    }

    private static JsonElement Parse(string json)
    {
        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }
}
