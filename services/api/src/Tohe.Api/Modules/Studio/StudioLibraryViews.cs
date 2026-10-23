using System.Text.Json;
using System.Text.RegularExpressions;

namespace Tohe.Api.Modules.Studio;

/// <summary>Who made a style, a pack or a version.</summary>
/// <param name="Kind"><c>agent</c> or <c>account</c>.</param>
/// <param name="Id">The agent's id or the account's.</param>
public sealed record StudioCreatorView(string Kind, Guid Id);

/// <param name="Uploaded">Its file has arrived.</param>
public sealed record StyleSampleView(string Sha256, string Ext, long Bytes, bool Uploaded);

/// <summary>A style: an art bible kept in the Studio.</summary>
/// <param name="Status"><c>draft</c> or <c>approved</c>.</param>
/// <param name="TileSize">The tile's side in pixels, for a tiled style.</param>
/// <param name="View"><c>top-down</c>, <c>side</c>, <c>isometric</c> or <c>other</c>.</param>
/// <param name="Palette">The colours, <c>#rrggbb</c>; none for a painted style.</param>
/// <param name="Outline">A note on the outline.</param>
public sealed record StyleView(
    string Id,
    string Name,
    string Status,
    int? TileSize,
    string View,
    IReadOnlyList<string>? Palette,
    string? Outline,
    IReadOnlyList<StyleSampleView> Samples,
    StudioCreatorView CreatedBy,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

/// <param name="Status"><c>draft</c>, <c>submitted</c>, <c>approved</c>, <c>rejected</c>, <c>deprecated</c> or <c>withdrawn</c>.</param>
public sealed record PackVersionSummaryView(
    Guid Id,
    string Version,
    string Status,
    StudioCreatorView CreatedBy,
    DateTimeOffset CreatedAt,
    DateTimeOffset? SubmittedAt,
    DateTimeOffset? ReviewedAt);

/// <summary>A pack and its versions, newest first.</summary>
public sealed record PackView(
    string Id,
    string StyleId,
    string? Description,
    StudioCreatorView CreatedBy,
    DateTimeOffset CreatedAt,
    IReadOnlyList<PackVersionSummaryView> Versions);

/// <summary>One asset of a version.</summary>
/// <param name="Kind"><c>image</c>, <c>spritesheet</c>, <c>tileset</c>, <c>audio</c>, <c>font</c> or <c>palette</c>.</param>
/// <param name="Licence">An SPDX identifier.</param>
/// <param name="Source">Where it came from, as it was sent.</param>
/// <param name="Uploaded">Its file has arrived.</param>
/// <param name="PublicUrl">Its file in the public library, while the version is published and a public address is configured.</param>
public sealed record AssetView(
    string Id,
    string Kind,
    string Sha256,
    string Ext,
    long Bytes,
    int? Width,
    int? Height,
    AssetFrames? Frames,
    IReadOnlyList<string> Tags,
    string Licence,
    string? Attribution,
    JsonElement Source,
    bool Uploaded,
    string? PublicUrl);

/// <summary>A pack version: its assets, where it is in its life and its review.</summary>
/// <param name="Status"><c>draft</c>, <c>submitted</c>, <c>approved</c>, <c>rejected</c>, <c>deprecated</c> or <c>withdrawn</c>.</param>
/// <param name="ReviewedBy">The reviewer who approved or rejected it.</param>
/// <param name="Reason">Why it was rejected.</param>
/// <param name="ManifestSha256">The sha256 of its manifest, once approved.</param>
/// <param name="ManifestUrl">Its manifest in the public library, while published and a public address is configured.</param>
public sealed record PackVersionView(
    Guid Id,
    string PackId,
    string Version,
    string Status,
    StudioCreatorView CreatedBy,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? SubmittedAt,
    Guid? ReviewedBy,
    DateTimeOffset? ReviewedAt,
    string? Reason,
    DateTimeOffset? DeprecatedAt,
    DateTimeOffset? WithdrawnAt,
    string? WithdrawReason,
    string? ManifestSha256,
    string? ManifestUrl,
    IReadOnlyList<AssetView> Assets);

/// <summary>A sample picture of a style, before its file is uploaded.</summary>
/// <param name="Sha256">The sha256 of the file, lower-case hex.</param>
/// <param name="Ext">Its extension without the dot, e.g. <c>png</c>.</param>
public sealed record StyleSampleInput(string? Sha256, string? Ext, long? Bytes);

/// <summary>A style draft.</summary>
/// <param name="Id">On creating only: <c>a-z</c>, digits and <c>-</c>, 3 to 40 characters.</param>
/// <param name="TileSize">The tile's side in pixels, 1 to 1024; none for a style without tiles.</param>
/// <param name="View"><c>top-down</c>, <c>side</c>, <c>isometric</c> or <c>other</c>.</param>
/// <param name="Palette">Colours as <c>#rrggbb</c>, at most 256; none for a painted style.</param>
/// <param name="Outline">A note on the outline, at most 500 characters.</param>
/// <param name="Samples">The sample pictures, at most 20; their files are uploaded after.</param>
public sealed record StyleRequest(
    string? Id,
    string? Name,
    int? TileSize,
    string? View,
    IReadOnlyList<string>? Palette,
    string? Outline,
    IReadOnlyList<StyleSampleInput>? Samples);

/// <summary>One asset of a draft: its metadata; its file is uploaded after.</summary>
/// <param name="Id">Unique in the pack: <c>a-z</c>, digits, <c>-</c>, and <c>/</c> for folders (<c>crops/carrot</c>).</param>
/// <param name="Kind"><c>image</c>, <c>spritesheet</c>, <c>tileset</c>, <c>audio</c>, <c>font</c> or <c>palette</c>.</param>
/// <param name="Sha256">The sha256 of the file, lower-case hex.</param>
/// <param name="Ext">Its extension without the dot, e.g. <c>png</c>.</param>
/// <param name="Bytes">Its size.</param>
/// <param name="Licence">An SPDX identifier, e.g. <c>CC0-1.0</c>.</param>
/// <param name="Attribution">The credit, when the licence asks for one.</param>
/// <param name="Source">Where it came from — <c>pack</c>, <c>upload</c>, <c>ai</c> or <c>code</c> with its details — as a JSON object.</param>
public sealed record AssetInput(
    string? Id,
    string? Kind,
    string? Sha256,
    string? Ext,
    long? Bytes,
    int? Width,
    int? Height,
    AssetFrames? Frames,
    IReadOnlyList<string>? Tags,
    string? Licence,
    string? Attribution,
    JsonElement? Source);

/// <summary>A new draft version of a pack.</summary>
/// <param name="PackId">The pack: <c>a-z</c>, digits and <c>-</c>, 3 to 40 characters. A new one is made with the draft.</param>
/// <param name="Version">Semver, e.g. <c>1.0.0</c>.</param>
/// <param name="StyleId">The pack's style: required for a new pack; for an existing one, its own or nothing.</param>
/// <param name="Description">A new pack's description, at most 500 characters.</param>
public sealed record DraftRequest(
    string? PackId,
    string? Version,
    string? StyleId,
    string? Description,
    IReadOnlyList<AssetInput>? Assets);

/// <summary>A draft's version and assets, replacing what it had.</summary>
public sealed record DraftUpdateRequest(string? Version, IReadOnlyList<AssetInput>? Assets);

/// <param name="Reason">Why: required to reject, optional to deprecate; at most 1000 characters.</param>
public sealed record ReviewReasonRequest(string? Reason);

/// <param name="Reason">Why it is withdrawn — a takedown, say; at most 1000 characters.</param>
/// <param name="Code">A fresh code from the authenticator.</param>
public sealed record WithdrawRequest(string? Reason, string? Code);

/// <summary>The rules a style's or a draft's metadata must follow before it is kept, as field codes.</summary>
internal static partial class StudioInput
{
    public const int MaxAssets = 500;
    public const int MaxSamples = 20;
    public const int MaxTags = 20;
    public const int MaxTag = 40;
    public const int MaxPalette = 256;
    public const int MaxSource = 8000;
    public const int MaxPixels = 16384;
    public const int MaxFrames = 10000;

    public static readonly IReadOnlyList<string> Kinds = ["image", "spritesheet", "tileset", "audio", "font", "palette"];

    public static readonly IReadOnlyList<string> Views = ["top-down", "side", "isometric", "other"];

    /// <summary>A pack's or a style's id: the Game Contract's <c>PackId</c>.</summary>
    public static bool IsId(string? id) => id is not null && Id().IsMatch(id);

    public static bool IsSha256(string? sha256) => sha256 is not null && Sha256().IsMatch(sha256);

    public static bool IsExt(string? ext) => ext is not null && Ext().IsMatch(ext);

    public static bool IsVersion(string? version) =>
        version is { Length: <= 64 } && SemVersion.Parse(version) is not null;

    /// <summary>The field errors of a style draft; empty when it is fine.</summary>
    public static Dictionary<string, string[]> Style(StyleRequest request, bool creating, long maxFileBytes)
    {
        var errors = new Errors();
        if (creating && !IsId(request.Id))
        {
            errors.Add("id", "id_invalid");
        }

        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > StudioStyle.MaxName)
        {
            errors.Add("name", "name_required");
        }

        if (request.TileSize is { } tile && tile is < 1 or > 1024)
        {
            errors.Add("tileSize", "size_invalid");
        }

        if (request.View is null || !Views.Contains(request.View))
        {
            errors.Add("view", "view_invalid");
        }

        if (request.Palette is { } palette
            && (palette.Count is 0 or > MaxPalette || palette.Any(colour => colour is null || !Colour().IsMatch(colour))))
        {
            errors.Add("palette", "palette_invalid");
        }

        if (request.Outline is { Length: > StudioStyle.MaxOutline })
        {
            errors.Add("outline", "outline_too_long");
        }

        var samples = request.Samples ?? [];
        if (samples.Count > MaxSamples)
        {
            errors.Add("samples", "too_many_samples");
        }

        for (var i = 0; i < samples.Count; i++)
        {
            File(errors, $"samples[{i}]", samples[i].Sha256, samples[i].Ext, samples[i].Bytes, maxFileBytes);
        }

        Conflicts(errors, "samples", samples.Select(sample => (sample.Sha256, sample.Ext, sample.Bytes)).ToList(), unique: true);
        return errors.Fields;
    }

    /// <summary>The field errors of a draft's version and assets; empty when they are fine.</summary>
    public static Dictionary<string, string[]> Draft(string? version, IReadOnlyList<AssetInput>? assets, long maxFileBytes)
    {
        var errors = new Errors();
        if (!IsVersion(version))
        {
            errors.Add("version", "version_invalid");
        }

        var list = assets ?? [];
        if (list.Count > MaxAssets)
        {
            errors.Add("assets", "too_many_assets");
            return errors.Fields;
        }

        var ids = new HashSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < list.Count; i++)
        {
            Asset(errors, $"assets[{i}]", list[i], ids, maxFileBytes);
        }

        Conflicts(errors, "assets", list.Select(asset => (asset.Sha256, asset.Ext, asset.Bytes)).ToList(), unique: false);
        return errors.Fields;
    }

    private static void Asset(Errors errors, string at, AssetInput asset, HashSet<string> ids, long maxFileBytes)
    {
        if (asset.Id is not { Length: <= 100 } id || !AssetId().IsMatch(id))
        {
            errors.Add($"{at}.id", "asset_id_invalid");
        }
        else if (!ids.Add(id))
        {
            errors.Add($"{at}.id", "asset_id_repeated");
        }

        if (asset.Kind is null || !Kinds.Contains(asset.Kind))
        {
            errors.Add($"{at}.kind", "kind_invalid");
        }

        File(errors, at, asset.Sha256, asset.Ext, asset.Bytes, maxFileBytes);
        if (asset.Licence is null || !Spdx().IsMatch(asset.Licence))
        {
            errors.Add($"{at}.licence", "licence_invalid");
        }

        if (asset.Attribution is { } attribution && (attribution.Trim().Length == 0 || attribution.Length > 1000))
        {
            errors.Add($"{at}.attribution", "attribution_invalid");
        }

        if (asset.Width is { } width && width is < 1 or > MaxPixels)
        {
            errors.Add($"{at}.width", "size_invalid");
        }

        if (asset.Height is { } height && height is < 1 or > MaxPixels)
        {
            errors.Add($"{at}.height", "size_invalid");
        }

        if (asset.Frames is { } frames
            && (frames.Width is < 1 or > MaxPixels || frames.Height is < 1 or > MaxPixels || frames.Count is < 1 or > MaxFrames))
        {
            errors.Add($"{at}.frames", "frames_invalid");
        }

        var tags = asset.Tags ?? [];
        if (tags.Count > MaxTags || tags.Any(tag => string.IsNullOrWhiteSpace(tag) || tag.Length > MaxTag))
        {
            errors.Add($"{at}.tags", "tags_invalid");
        }

        if (asset.Source is not { ValueKind: JsonValueKind.Object } source || source.GetRawText().Length > MaxSource)
        {
            errors.Add($"{at}.source", "source_invalid");
        }
    }

    private static void File(Errors errors, string at, string? sha256, string? ext, long? bytes, long maxFileBytes)
    {
        if (!IsSha256(sha256))
        {
            errors.Add($"{at}.sha256", "sha256_invalid");
        }

        if (!IsExt(ext))
        {
            errors.Add($"{at}.ext", "ext_invalid");
        }

        if (bytes is not { } size || size < 0 || size > maxFileBytes)
        {
            errors.Add($"{at}.bytes", "bytes_invalid");
        }
    }

    /// <summary>One file is one sha256: the same hash with another extension or size is a mistake.</summary>
    private static void Conflicts(Errors errors, string field, List<(string? Sha256, string? Ext, long? Bytes)> files, bool unique)
    {
        var groups = files.Where(file => file.Sha256 is not null).GroupBy(file => file.Sha256, StringComparer.Ordinal);
        if (groups.Any(group => (unique && group.Count() > 1) || group.Select(file => (file.Ext, file.Bytes)).Distinct().Count() > 1))
        {
            errors.Add(field, "file_conflict");
        }
    }

    private sealed class Errors
    {
        public Dictionary<string, string[]> Fields { get; } = new(StringComparer.Ordinal);

        public void Add(string field, string code) => Fields[field] = [.. Fields.GetValueOrDefault(field, []), code];
    }

    [GeneratedRegex("^[a-z][a-z0-9-]{1,38}[a-z0-9]$")]
    private static partial Regex Id();

    [GeneratedRegex("^[a-z0-9][a-z0-9-]*(?:/[a-z0-9][a-z0-9-]*)*$")]
    private static partial Regex AssetId();

    [GeneratedRegex("^[0-9a-f]{64}$")]
    private static partial Regex Sha256();

    [GeneratedRegex("^[a-z0-9]{1,8}$")]
    private static partial Regex Ext();

    [GeneratedRegex("^[A-Za-z0-9][A-Za-z0-9.+-]{0,63}$")]
    private static partial Regex Spdx();

    [GeneratedRegex("^#[0-9a-f]{6}$")]
    private static partial Regex Colour();
}
