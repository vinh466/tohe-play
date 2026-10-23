using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Modules.Registry;

namespace Tohe.Api.Tests;

/// <summary>
/// A game's standard name and its names and descriptions per language (ADR 0048), as the registry keeps them from each
/// build's game.json and the hub reads them with each game.
/// </summary>
public sealed class GameNamesTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    [Fact]
    public async Task Catalog_sync_keeps_each_builds_names_and_descriptions_per_language()
    {
        const string merge = """
            {
              "manifest": {
                "id": "ghep-khoi", "name": "Merge Blocks", "version": "1.0.0", "protocol": 1,
                "names": { "vi": "Ghép Khối" },
                "description": "Drop number blocks.",
                "descriptions": { "vi": "Thả khối số.", "en": "Drop number blocks." }
              },
              "path": "ghep-khoi/1.0.0/", "sizeKb": 10
            }
            """;
        const string cards = """
            {
              "manifest": {
                "id": "tien-len-x", "name": "Tiến Lên", "version": "1.0.0", "protocol": 1,
                "description": "The Southern card game."
              },
              "path": "tien-len-x/1.0.0/", "sizeKb": 10
            }
            """;
        factory.Catalog.Json = Catalog(merge, cards);
        await Sync();

        var games = await ListAsync();
        var merged = Assert.Single(games, game => game.Id == "ghep-khoi");
        Assert.Equal(("Merge Blocks", "Drop number blocks."), (merged.Name, merged.Description));
        Assert.Equal(new Dictionary<string, string> { ["vi"] = "Ghép Khối" }, merged.Names);
        Assert.Equal(new Dictionary<string, string> { ["vi"] = "Thả khối số.", ["en"] = "Drop number blocks." }, merged.Descriptions);

        // Without them, the standard name and description are all there is.
        var plain = Assert.Single(games, game => game.Id == "tien-len-x");
        Assert.Equal(("Tiến Lên", 0, 0), (plain.Name, plain.Names.Count, plain.Descriptions.Count));

        // The next build without them takes them away; one game, read by id, reads the same.
        factory.Catalog.Json = Catalog(merge.Replace("1.0.0", "1.1.0", StringComparison.Ordinal)
            .Replace("\"names\": { \"vi\": \"Ghép Khối\" },", "", StringComparison.Ordinal));
        await Sync();
        var next = (await factory.CreateClient().GetFromJsonAsync<GameSummary>(new Uri("/api/games/ghep-khoi", UriKind.Relative), Ct))!;
        Assert.Equal(("1.1.0", 0, 2), (next.Version, next.Names.Count, next.Descriptions.Count));
    }

    [Fact]
    public async Task Catalog_sync_drops_an_entry_that_breaks_the_contracts_rules_and_keeps_the_rest()
    {
        var tooLong = new string('x', 41);
        var manifest = $$"""
            {
              "manifest": {
                "id": "loi-ten", "name": "Odd Names", "version": "1.0.0", "protocol": 1,
                "names": { "vi": "Tên Lạ", "EN": "Shouting", "en_GB": "Underscore", "fr": "", "de": 7, "es": "{{tooLong}}", "zh-Hant": "怪名" },
                "descriptions": "not a map"
              },
              "path": "loi-ten/1.0.0/", "sizeKb": 10
            }
            """;
        factory.Catalog.Json = Catalog(manifest);
        await Sync();

        var game = Assert.Single(await ListAsync(), game => game.Id == "loi-ten");
        Assert.Equal(new Dictionary<string, string> { ["vi"] = "Tên Lạ", ["zh-Hant"] = "怪名" }, game.Names);
        Assert.Empty(game.Descriptions);
    }

    [Theory]
    [InlineData("vi", "Ghép Khối")]
    [InlineData("vi-VN", "Ghép Khối")]
    [InlineData("VI", "Ghép Khối")]
    [InlineData("en-GB", "Merging Blocks")]
    [InlineData("en_gb", "Merging Blocks")]
    [InlineData("en", "Merge Blocks")]
    [InlineData("en-US", "Merge Blocks")]
    [InlineData("", "Merge Blocks")]
    public void The_lookup_takes_the_exact_tag_then_its_primary_subtag_then_the_standard_name(string language, string name)
    {
        var names = new Dictionary<string, string> { ["vi"] = "Ghép Khối", ["en-GB"] = "Merging Blocks" };
        Assert.Equal(name, GameWords.InLanguage(names, language, "Merge Blocks"));
        Assert.Equal("Merge Blocks", GameWords.InLanguage(null, language, "Merge Blocks"));
    }

    private async Task<List<GameSummary>> ListAsync() =>
        (await factory.CreateClient().GetFromJsonAsync<List<GameSummary>>(new Uri("/api/games", UriKind.Relative), Ct))!;

    private async Task Sync()
    {
        await using var scope = factory.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<CatalogSync>().RunAsync(Ct);
    }

    private static string Catalog(params string[] entries) =>
        $$"""{ "generatedAt": "2026-10-22T00:00:00Z", "games": [{{string.Join(",", entries)}}] }""";
}
