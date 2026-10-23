using System.Text.Json;
using System.Text.RegularExpressions;

namespace Tohe.Api.Modules.Registry;

/// <summary>
/// A game's names and descriptions per language (ADR 0048), as its manifest carries them: a language tag → the words.
/// Mirrors <c>LanguageTag</c>, <c>inLanguage</c> and the limits in packages/contract/src/manifest.ts — the TypeScript is
/// the source of truth; keep these in step with it.
/// </summary>
public static partial class GameWords
{
    /// <summary>Most languages a manifest's <c>names</c> or <c>descriptions</c> holds.</summary>
    public const int MaxLanguages = 10;

    /// <summary>Most characters of a game's name, standard or per language.</summary>
    public const int MaxName = 40;

    /// <summary>Most characters of a game's description, standard or per language.</summary>
    public const int MaxDescription = 200;

    private static readonly IReadOnlyDictionary<string, string> None = new Dictionary<string, string>();

    /// <summary>A language tag: a language, an optional script and an optional region, in canonical case.</summary>
    [GeneratedRegex("^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-(?:[A-Z]{2}|[0-9]{3}))?$")]
    public static partial Regex LanguageTag();

    /// <summary>
    /// The manifest's map as the registry keeps it (JSON): only entries with a valid tag and non-empty text of at most
    /// <paramref name="maxLength"/> characters, the first <see cref="MaxLanguages"/> of them. The catalog passed the
    /// contract's validation; anything else is dropped rather than shown.
    /// </summary>
    public static string FromManifest(JsonElement? given, int maxLength)
    {
        var kept = new Dictionary<string, string>(StringComparer.Ordinal);
        if (given is { ValueKind: JsonValueKind.Object } map)
        {
            foreach (var entry in map.EnumerateObject())
            {
                if (kept.Count < MaxLanguages
                    && LanguageTag().IsMatch(entry.Name)
                    && entry.Value.ValueKind == JsonValueKind.String
                    && entry.Value.GetString() is { Length: > 0 } words
                    && words.Length <= maxLength)
                {
                    kept[entry.Name] = words;
                }
            }
        }

        return JsonSerializer.Serialize(kept);
    }

    /// <summary>The registry's JSON as a map; empty for anything that is not one.</summary>
    public static IReadOnlyDictionary<string, string> Parse(string? json)
    {
        if (string.IsNullOrEmpty(json))
        {
            return None;
        }

        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string>>(json) ?? None;
        }
        catch (JsonException)
        {
            return None;
        }
    }

    /// <summary>
    /// The words for a reader's <paramref name="language"/>: the exact tag, then its primary subtag (<c>en-GB</c> →
    /// <c>en</c>), then <paramref name="fallback"/>. Tags compare without regard to case; <c>_</c> reads as <c>-</c>.
    /// </summary>
    public static string InLanguage(IReadOnlyDictionary<string, string>? byTag, string language, string fallback)
    {
        if (byTag is null || byTag.Count == 0)
        {
            return fallback;
        }

        var wanted = language.Trim().Replace('_', '-');
        var primary = wanted.Split('-')[0];
        foreach (var tag in new[] { wanted, primary })
        {
            if (tag.Length == 0)
            {
                continue;
            }

            foreach (var (key, words) in byTag)
            {
                if (string.Equals(key, tag, StringComparison.OrdinalIgnoreCase) && words.Length > 0)
                {
                    return words;
                }
            }
        }

        return fallback;
    }
}
