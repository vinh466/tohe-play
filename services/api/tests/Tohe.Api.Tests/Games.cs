using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Registry;

namespace Tohe.Api.Tests;

/// <summary>Games the registry knows, put there directly: the engine rejects scores of a game it never heard of.</summary>
internal static class Games
{
    public static Task KnowAsync(ApiFactory factory, params string[] ids) => AddAsync(factory, rooms: null, ids);

    /// <summary>A game played at tables (ADR 0016): its boards are hands.</summary>
    public static Task KnowRoomGameAsync(ApiFactory factory, string id) =>
        AddAsync(factory, """{ "seats": { "min": 2, "max": 4 } }""", id);

    private static async Task AddAsync(ApiFactory factory, string? rooms, params string[] ids)
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
                FirstSeenAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow,
            });
        }

        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }
}
