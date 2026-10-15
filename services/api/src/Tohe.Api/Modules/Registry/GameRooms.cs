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

/// <summary>A game as other modules may see it, by id.</summary>
/// <param name="Path">The immutable build's path on the games origin, e.g. <c>tien-len/0.2.0/</c>.</param>
public sealed record RegistryGame(string Id, string Name, string Version, string Path, int MinAge, GameRooms? Rooms);

/// <summary>Read access to the registry for other modules (Rooms reads a game's rooms block and build path).</summary>
public interface IRegistryGames
{
    Task<RegistryGame?> GetAsync(string id, CancellationToken cancellationToken);
}

internal sealed class RegistryGames(ToheDbContext db) : IRegistryGames
{
    public async Task<RegistryGame?> GetAsync(string id, CancellationToken cancellationToken)
    {
        var game = await db.Games.AsNoTracking().FirstOrDefaultAsync(g => g.Id == id && g.Listed, cancellationToken);
        return game is null
            ? null
            : new RegistryGame(game.Id, game.Name, game.Version, game.Path, game.MinAge, game.Rooms is { } rooms ? GameRooms.Parse(rooms) : null);
    }
}
