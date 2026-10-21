using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Modules.Registry;

namespace Tohe.Api.Tests;

/// <summary>
/// What a game asks of its player and the entries it takes (ADR 0045), as the registry keeps them from each build's
/// game.json and the hub reads them with each game.
/// </summary>
public sealed class GameIdentityTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    [Fact]
    public async Task Catalog_sync_keeps_what_each_build_asks_of_its_player_and_the_entries_it_takes()
    {
        const string online = """
            {
              "manifest": {
                "id": "co-tuong", "name": "Cờ tướng", "version": "1.0.0", "protocol": 1,
                "capabilities": ["rooms"], "rooms": { "seats": { "min": 2, "max": 2 } },
                "identity": { "play": "named", "rooms": "account" }
              },
              "path": "co-tuong/1.0.0/", "sizeKb": 10
            }
            """;
        const string sharing = """
            {
              "manifest": {
                "id": "thach-ban", "name": "Thách bạn", "version": "1.0.0", "protocol": 1,
                "capabilities": ["save"], "entries": ["share", "daily"], "identity": { "rooms": "account" }
              },
              "path": "thach-ban/1.0.0/", "sizeKb": 10
            }
            """;
        factory.Catalog.Json = Catalog(Entry("hello", "1.0.0"), online, sharing);
        await Sync();

        var games = (await factory.CreateClient().GetFromJsonAsync<List<GameSummary>>(new Uri("/api/games", UriKind.Relative), Ct))!;
        // Without it in the manifest: any profile opens it, and it takes no entry.
        var hello = Assert.Single(games, game => game.Id == "hello");
        Assert.Equal((new GameIdentityView("any", null), 0), (hello.Identity, hello.Entries.Count));
        Assert.Equal(new GameIdentityView("named", "account"), Assert.Single(games, game => game.Id == "co-tuong").Identity);
        // Kinds it does not know, and a table's level without rooms, are not kept.
        var shared = Assert.Single(games, game => game.Id == "thach-ban");
        Assert.Equal(new GameIdentityView("any", null), shared.Identity);
        Assert.Equal(["share"], shared.Entries);

        // The next build takes them away again.
        factory.Catalog.Json = Catalog(Entry("thach-ban", "1.1.0"));
        await Sync();
        var next = (await factory.CreateClient().GetFromJsonAsync<GameSummary>(new Uri("/api/games/thach-ban", UriKind.Relative), Ct))!;
        Assert.Equal(("1.1.0", 0), (next.Version, next.Entries.Count));
    }

    private async Task Sync()
    {
        await using var scope = factory.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<CatalogSync>().RunAsync(Ct);
    }

    private static string Catalog(params string[] entries) =>
        $$"""{ "generatedAt": "2026-10-21T00:00:00Z", "games": [{{string.Join(",", entries)}}] }""";

    private static string Entry(string id, string version) => $$"""
        {
          "manifest": {
            "id": "{{id}}", "name": "{{id}}", "version": "{{version}}", "protocol": 1,
            "entry": "index.html", "orientation": "portrait", "capabilities": ["save"]
          },
          "path": "{{id}}/{{version}}/",
          "sizeKb": 10
        }
        """;
}
