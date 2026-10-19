using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Modules.Platform;
using Tohe.Api.Modules.Registry;

namespace Tohe.Api.Tests;

public sealed class ApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    [Fact]
    public async Task Health_is_healthy_when_the_database_is_reachable()
    {
        var response = await factory.CreateClient().GetAsync(new Uri("/api/health", UriKind.Relative), Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync(Ct));
    }

    [Fact]
    public async Task Config_exposes_the_games_origin()
    {
        var config = await factory.CreateClient().GetFromJsonAsync<ClientConfig>(new Uri("/api/config", UriKind.Relative), Ct);

        Assert.Equal("https://games.example.test", config?.GamesOrigin);
    }

    [Theory]
    [InlineData("https://tohe.example.test/hub")]
    [InlineData("tohe.example.test")]
    [InlineData("ftp://tohe.example.test")]
    public void A_public_url_that_is_not_a_bare_http_origin_stops_the_api_from_starting(string publicUrl)
    {
        using var misconfigured = factory.WithWebHostBuilder(builder => builder.UseSetting("App:PublicUrl", publicUrl));

        var error = Assert.ThrowsAny<Exception>(() => misconfigured.CreateClient());

        Assert.Contains("App:PublicUrl", error.ToString(), StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("https://console.example.test/admin")]
    [InlineData("console.example.test")]
    // The console is a host of its own (ADR 0042), never the hub's, nor the games' (ApiFactory: Games:PublicOrigin).
    [InlineData("https://tohe.example.test")]
    [InlineData("https://games.example.test")]
    public void A_console_url_that_is_not_an_origin_of_its_own_stops_the_api_from_starting(string consoleUrl)
    {
        using var misconfigured = factory.WithWebHostBuilder(builder => builder
            .UseSetting("App:PublicUrl", "https://tohe.example.test")
            .UseSetting("App:ConsoleUrl", consoleUrl));

        var error = Assert.ThrowsAny<Exception>(() => misconfigured.CreateClient());

        Assert.Contains("App:ConsoleUrl", error.ToString(), StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("/api/docs")]
    [InlineData("/api/openapi/v1.json")]
    [InlineData("/api/openapi/admin.json")]
    public async Task The_api_reference_is_off_unless_switched_on(string path)
    {
        // The factory runs as "Testing": off by default, as everywhere but Development (ADR 0042).
        var off = await factory.CreateClient().GetAsync(new Uri(path, UriKind.Relative), Ct);
        Assert.Equal(HttpStatusCode.NotFound, off.StatusCode);

        using var switchedOn = factory.WithWebHostBuilder(builder => builder.UseSetting("Api:Reference:Enabled", "true"));
        var on = await switchedOn.CreateClient().GetAsync(new Uri(path, UriKind.Relative), Ct);
        Assert.Equal(HttpStatusCode.OK, on.StatusCode);
    }

    [Fact]
    public async Task Catalog_sync_lists_valid_games_and_unlists_removed_ones()
    {
        factory.Catalog.Json = Catalog(Entry("hello", "1.0.0"), Entry("merge-block", "0.1.0"), Entry("Bad Id", "1.0.0"));
        var first = await Sync();
        Assert.Equal(new SyncResult(Added: 2, Updated: 0, Unlisted: 0, Skipped: 1), first);

        var client = factory.CreateClient();
        var games = await client.GetFromJsonAsync<List<GameSummary>>(new Uri("/api/games", UriKind.Relative), Ct);
        var hello = Assert.Single(games!, game => game.Id == "hello");
        Assert.Equal("https://games.example.test/hello/1.0.0/index.html", hello.EntryUrl);
        Assert.Equal("https://games.example.test/hello/1.0.0/icon.svg", hello.IconUrl);

        factory.Catalog.Json = Catalog(Entry("hello", "1.1.0"));
        var second = await Sync();
        Assert.Equal(new SyncResult(Added: 0, Updated: 1, Unlisted: 1, Skipped: 0), second);

        var afterRemoval = await client.GetFromJsonAsync<List<GameSummary>>(new Uri("/api/games", UriKind.Relative), Ct);
        Assert.Equal(["hello"], afterRemoval!.Select(game => game.Id));
        Assert.Equal("1.1.0", afterRemoval![0].Version);

        var missing = await client.GetAsync(new Uri("/api/games/merge-block", UriKind.Relative), Ct);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }

    private async Task<SyncResult> Sync()
    {
        await using var scope = factory.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<CatalogSync>().RunAsync(Ct);
    }

    private static string Catalog(params string[] entries) =>
        $$"""{ "generatedAt": "2026-10-13T00:00:00Z", "games": [{{string.Join(",", entries)}}] }""";

    private static string Entry(string id, string version) => $$"""
        {
          "manifest": {
            "id": "{{id}}", "name": "{{id}}", "version": "{{version}}", "protocol": 1,
            "description": "", "entry": "index.html", "icon": "icon.svg", "orientation": "portrait",
            "capabilities": ["save"], "minAge": 0, "tags": [], "sizeBudgetKb": 3000
          },
          "path": "{{id.ToLowerInvariant().Replace(' ', '-')}}/{{version}}/",
          "sizeKb": 10
        }
        """;
}
