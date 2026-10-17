using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Registry;

namespace Tohe.Api.Tests;

/// <summary>Games the registry knows, put there directly: the engine rejects scores of a game it never heard of.</summary>
internal static class Games
{
    public static async Task KnowAsync(ApiFactory factory, params string[] ids)
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
                FirstSeenAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow,
            });
        }

        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }
}
