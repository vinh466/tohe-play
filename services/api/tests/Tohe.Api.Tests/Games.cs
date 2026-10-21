using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Registry;

namespace Tohe.Api.Tests;

/// <summary>Games the registry knows, put there directly: the engine rejects scores of a game it never heard of.</summary>
internal static class Games
{
    public static Task KnowAsync(ApiFactory factory, params string[] ids) => AddAsync(factory, rooms: null, ranked: null, ids);

    /// <summary>A game whose build opens share entries itself (ADR 0045), asking <paramref name="play"/> to open.</summary>
    public static Task KnowEntryGameAsync(ApiFactory factory, string id, string play = GameLevels.Any) =>
        AddAsync(factory, rooms: null, ranked: null, [id], play, [GameLevels.ShareEntry]);

    /// <summary>A game played at tables (ADR 0016): its boards are hands.</summary>
    public static Task KnowRoomGameAsync(ApiFactory factory, string id) =>
        AddAsync(factory, """{ "seats": { "min": 2, "max": 4 } }""", ranked: null, id);

    /// <summary>A game whose runs the server replays (ADR 0030), with its verify module served from its build.</summary>
    public static Task KnowRankedGameAsync(ApiFactory factory, string id, string verify, int minMsPerMove = 0, int maxMoves = 5)
    {
        factory.Catalog.Files[$"/{id}/1.0.0/verify.js"] = verify;
        return AddAsync(
            factory,
            rooms: null,
            ranked: $$"""{ "verify": "verify.js", "board": "default", "minMsPerMove": {{minMsPerMove}}, "maxMoves": {{maxMoves}} }""",
            id);
    }

    private static Task AddAsync(ApiFactory factory, string? rooms, string? ranked, params string[] ids) =>
        AddAsync(factory, rooms, ranked, ids, GameLevels.Any, []);

    private static async Task AddAsync(
        ApiFactory factory, string? rooms, string? ranked, string[] ids, string play, string[] entries)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        foreach (var id in ids)
        {
            if (await db.Games.AnyAsync(game => game.Id == id, TestContext.Current.CancellationToken))
            {
                continue;
            }

            db.Games.Add(new Game
            {
                Id = id,
                Version = "1.0.0",
                Name = id,
                Path = $"{id}/1.0.0/",
                Entry = "index.html",
                Orientation = "portrait",
                Rooms = rooms,
                Ranked = ranked,
                IdentityPlay = play,
                IdentityRooms = rooms is null ? null : GameLevels.Named,
                Entries = entries,
                FirstSeenAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow,
            });
        }

        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }
}
