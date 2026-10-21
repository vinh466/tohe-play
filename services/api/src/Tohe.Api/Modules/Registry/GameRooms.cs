using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Registry;

/// <summary>
/// A game's <c>rooms</c> block (ADR 0016), mirroring RoomsManifest in packages/contract/src/manifest.ts: the catalog
/// already passed the contract's validation, so this only reads it, and checks a room's options against it.
/// </summary>
public sealed class GameRooms
{
    public required string Rules { get; init; }
    public int MinSeats { get; init; }
    public int MaxSeats { get; init; }
    public IReadOnlyList<string> Bots { get; init; } = [];
    public required JsonElement Options { get; init; }

    public static GameRooms Parse(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        var seats = root.GetProperty("seats");
        return new GameRooms
        {
            Rules = root.TryGetProperty("rules", out var rules) ? rules.GetString() ?? "rules.js" : "rules.js",
            MinSeats = seats.GetProperty("min").GetInt32(),
            MaxSeats = seats.GetProperty("max").GetInt32(),
            Bots = root.TryGetProperty("bots", out var bots)
                ? [.. bots.EnumerateArray().Select(level => level.GetString() ?? "")]
                : [],
            Options = root.TryGetProperty("options", out var options) ? options.Clone() : JsonDocument.Parse("[]").RootElement.Clone(),
        };
    }

    public GameRoomsView ToView() => new(MinSeats, MaxSeats, Bots, Options);

    /// <summary>The middle bot level (e.g. <c>normal</c> of easy, normal, hard), or null without bots.</summary>
    public string? DefaultBot => Bots.Count == 0 ? null : Bots[(Bots.Count - 1) / 2];

    /// <summary>
    /// A room's options: every declared option, the given value when it is valid, else the default. Returns null and
    /// the offending id when a given value does not fit the option.
    /// </summary>
    public (string? Json, string? Invalid) Normalize(JsonElement? given)
    {
        var result = new JsonObject();
        var input = given is { ValueKind: JsonValueKind.Object } value ? value : default;
        foreach (var option in Options.EnumerateArray())
        {
            var id = option.GetProperty("id").GetString() ?? "";
            var type = option.GetProperty("type").GetString();
            var fallback = option.GetProperty("default");
            if (input.ValueKind != JsonValueKind.Object || !input.TryGetProperty(id, out var chosen))
            {
                result[id] = JsonNode.Parse(fallback.GetRawText());
                continue;
            }

            var choices = option.TryGetProperty("choices", out var list)
                ? list.EnumerateArray().Select(choice => choice.GetProperty("id").GetString()).ToHashSet(StringComparer.Ordinal)
                : [];
            var valid = type switch
            {
                "boolean" => chosen.ValueKind is JsonValueKind.True or JsonValueKind.False,
                "choice" => chosen.ValueKind == JsonValueKind.String && choices.Contains(chosen.GetString()),
                "multi" => chosen.ValueKind == JsonValueKind.Array
                    && chosen.EnumerateArray().All(item => item.ValueKind == JsonValueKind.String && choices.Contains(item.GetString()))
                    && chosen.GetArrayLength() == chosen.EnumerateArray().Select(item => item.GetString()).Distinct().Count(),
                _ => false,
            };
            if (!valid)
            {
                return (null, id);
            }

            result[id] = JsonNode.Parse(chosen.GetRawText());
        }

        return (result.ToJsonString(), null);
    }
}

/// <summary>
/// A game's <c>ranked</c> block (ADR 0030), mirroring RankedManifest in packages/contract/src/manifest.ts: its verify
/// module, the board ranked runs count on, and how fast a person can play.
/// </summary>
public sealed record GameRanked(string Verify, string Board, int MinMsPerMove, int MaxMoves)
{
    public static GameRanked Parse(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        return new GameRanked(
            root.TryGetProperty("verify", out var verify) ? verify.GetString() ?? "verify.js" : "verify.js",
            root.TryGetProperty("board", out var board) ? board.GetString() ?? "default" : "default",
            root.TryGetProperty("minMsPerMove", out var pace) ? pace.GetInt32() : 100,
            root.TryGetProperty("maxMoves", out var most) ? most.GetInt32() : 20_000);
    }
}

/// <summary>A game as other modules may see it, by id.</summary>
/// <param name="Path">The immutable build's path on the games origin, e.g. <c>tien-len/0.2.0/</c>.</param>
/// <param name="Ranked">Set for games whose runs the server replays (ADR 0030).</param>
/// <param name="IdentityPlay">What opening the game asks for (ADR 0045).</param>
/// <param name="IdentityRooms">The least a table of it asks for; null without rooms.</param>
/// <param name="Entries">The kinds of entry the current build opens itself (ADR 0045).</param>
public sealed record RegistryGame(
    string Id,
    string Name,
    string Version,
    string Path,
    int MinAge,
    GameRooms? Rooms,
    GameRanked? Ranked = null,
    string IdentityPlay = GameLevels.Any,
    string? IdentityRooms = null,
    IReadOnlyList<string>? Entries = null)
{
    /// <summary>What a table of this game asks for at least (ADR 0045): the highest of <c>play</c> and <c>rooms</c>.</summary>
    public string TableLevel => GameLevels.Highest(IdentityPlay, IdentityRooms ?? GameLevels.Named);

    /// <summary>The current build opens this kind of entry itself.</summary>
    public bool Takes(string kind) => Entries?.Contains(kind) == true;
}

/// <summary>Read access to the registry for other modules (Rooms reads a game's rooms block and build path).</summary>
public interface IRegistryGames
{
    /// <summary>A listed game; null when the catalog does not list it now.</summary>
    Task<RegistryGame?> GetAsync(string id, CancellationToken cancellationToken);

    /// <summary>The registry has known the game, listed now or not: its scores can be real (ADR 0029).</summary>
    Task<bool> KnowsAsync(string id, CancellationToken cancellationToken);
}

internal sealed class RegistryGames(ToheDbContext db) : IRegistryGames
{
    public async Task<RegistryGame?> GetAsync(string id, CancellationToken cancellationToken)
    {
        var game = await db.Games.AsNoTracking().FirstOrDefaultAsync(g => g.Id == id && g.Listed, cancellationToken);
        return game is null
            ? null
            : new RegistryGame(
                game.Id,
                game.Name,
                game.Version,
                game.Path,
                game.MinAge,
                game.Rooms is { } rooms ? GameRooms.Parse(rooms) : null,
                game.Ranked is { } ranked ? GameRanked.Parse(ranked) : null,
                game.IdentityPlay,
                game.IdentityRooms,
                game.Entries);
    }

    public Task<bool> KnowsAsync(string id, CancellationToken cancellationToken) =>
        db.Games.AsNoTracking().AnyAsync(g => g.Id == id, cancellationToken);
}
