using System.Buffers;
using System.Globalization;
using System.Security.Cryptography;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Tohe.Api.Modules.Studio;

/// <summary>
/// The manifest of an approved pack version, <c>packs/&lt;id&gt;/&lt;version&gt;.json</c>: exactly the format the build
/// tool reads (<c>PackManifest</c> of <c>tools/assets</c>, docs/guides/use-assets-in-a-game.md#the-manifest). Byte-stable —
/// files sorted by id, every object's keys in ordinal order, two-space indents, <c>\n</c> — so one version always makes
/// the same bytes, and the sha256 a game's lock pins holds.
/// </summary>
internal static class PackManifests
{
    public const int ManifestVersion = 1;

    private static readonly JsonWriterOptions Writing = new()
    {
        Indented = true,
        IndentSize = 2,
        NewLine = "\n",
        // Readable Vietnamese in attributions; the manifest is JSON served as JSON, never put into HTML.
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    /// <summary>The manifest's bytes, and their sha256 in lower-case hex.</summary>
    public static (byte[] Bytes, string Sha256) Write(string packId, string version, IEnumerable<StudioAsset> assets)
    {
        var buffer = new ArrayBufferWriter<byte>();
        using (var json = new Utf8JsonWriter(buffer, Writing))
        {
            // Keys in ordinal order: files, id, manifestVersion, version.
            json.WriteStartObject();
            json.WriteStartArray("files");
            foreach (var asset in assets.OrderBy(asset => asset.AssetId, StringComparer.Ordinal))
            {
                WriteFile(json, asset);
            }

            json.WriteEndArray();
            json.WriteString("id", packId);
            json.WriteNumber("manifestVersion", ManifestVersion);
            json.WriteString("version", version);
            json.WriteEndObject();
        }

        buffer.Write("\n"u8);
        var bytes = buffer.WrittenSpan.ToArray();
        return (bytes, Sha256(bytes));
    }

    public static string Sha256(ReadOnlySpan<byte> bytes) => Convert.ToHexStringLower(SHA256.HashData(bytes));

    /// <summary>
    /// One file. Keys in ordinal order: attribution, bytes, ext, frames (count, height, width), height, id, kind, licence,
    /// sha256, width; the optional ones only when set.
    /// </summary>
    private static void WriteFile(Utf8JsonWriter json, StudioAsset asset)
    {
        json.WriteStartObject();
        if (asset.Attribution is { } attribution)
        {
            json.WriteString("attribution", attribution);
        }

        json.WriteNumber("bytes", asset.Bytes);
        json.WriteString("ext", asset.Ext);
        if (asset.Frames is { } frames)
        {
            json.WriteStartObject("frames");
            json.WriteNumber("count", frames.Count);
            json.WriteNumber("height", frames.Height);
            json.WriteNumber("width", frames.Width);
            json.WriteEndObject();
        }

        if (asset.Height is { } height)
        {
            json.WriteNumber("height", height);
        }

        json.WriteString("id", asset.AssetId);
        json.WriteString("kind", asset.Kind);
        json.WriteString("licence", asset.Licence);
        json.WriteString("sha256", asset.Sha256);
        if (asset.Width is { } width)
        {
            json.WriteNumber("width", width);
        }

        json.WriteEndObject();
    }
}

/// <summary>
/// A semantic version, as the Game Contract's <c>SemVer</c> takes it (<c>1.2.0</c>, <c>1.2.0-beta.1</c>), ordered by
/// semver's precedence: major, minor, patch, then a pre-release before its release, identifiers compared one by one.
/// </summary>
internal sealed partial record SemVersion(long Major, long Minor, long Patch, string[] PreRelease) : IComparable<SemVersion>
{
    public static SemVersion? Parse(string? text)
    {
        if (text is null || Shape().Match(text) is not { Success: true } match)
        {
            return null;
        }

        if (!long.TryParse(match.Groups[1].ValueSpan, NumberStyles.None, CultureInfo.InvariantCulture, out var major)
            || !long.TryParse(match.Groups[2].ValueSpan, NumberStyles.None, CultureInfo.InvariantCulture, out var minor)
            || !long.TryParse(match.Groups[3].ValueSpan, NumberStyles.None, CultureInfo.InvariantCulture, out var patch))
        {
            return null;
        }

        var pre = match.Groups[4].Success ? match.Groups[4].Value.Split('.') : [];
        return new SemVersion(major, minor, patch, pre);
    }

    public int CompareTo(SemVersion? other)
    {
        if (other is null)
        {
            return 1;
        }

        var core = (Major, Minor, Patch).CompareTo((other.Major, other.Minor, other.Patch));
        if (core != 0)
        {
            return core;
        }

        // A release outranks its pre-releases.
        if (PreRelease.Length == 0 || other.PreRelease.Length == 0)
        {
            return Math.Sign(other.PreRelease.Length.CompareTo(PreRelease.Length));
        }

        for (var i = 0; i < Math.Min(PreRelease.Length, other.PreRelease.Length); i++)
        {
            var order = CompareIdentifiers(PreRelease[i], other.PreRelease[i]);
            if (order != 0)
            {
                return order;
            }
        }

        return PreRelease.Length.CompareTo(other.PreRelease.Length);
    }

    private static int CompareIdentifiers(string a, string b)
    {
        var aNumber = a.All(char.IsAsciiDigit);
        var bNumber = b.All(char.IsAsciiDigit);
        return (aNumber, bNumber) switch
        {
            (true, true) => a.Length != b.Length ? a.Length.CompareTo(b.Length) : string.CompareOrdinal(a, b),
            (true, false) => -1,
            (false, true) => 1,
            _ => Math.Sign(string.CompareOrdinal(a, b)),
        };
    }

    // The contract's rule (packages/contract/src/ids.ts), digits capped so they fit a long.
    [GeneratedRegex(@"^(\d{1,15})\.(\d{1,15})\.(\d{1,15})(?:-([0-9A-Za-z.-]+))?$")]
    private static partial Regex Shape();
}
