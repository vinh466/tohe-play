using System.Text.RegularExpressions;

namespace Tohe.Api.Modules.Registry;

// Mirrors Catalog / CatalogEntry / GameManifest in packages/contract/src/manifest.ts.
// The TypeScript schema is the source of truth; keep these in step with it.

internal sealed record CatalogDocument(DateTimeOffset GeneratedAt, IReadOnlyList<CatalogEntryDocument> Games);

internal sealed record CatalogEntryDocument(GameManifestDocument? Manifest, string Path, int SizeKb);

internal sealed record GameManifestDocument(
    string Id,
    string Name,
    string Version,
    int Protocol,
    string? Description,
    string? Entry,
    string? Icon,
    string? Orientation,
    IReadOnlyList<string>? Capabilities,
    int? MinAge,
    IReadOnlyList<string>? Tags);

internal static partial class CatalogRules
{
    public const int SupportedProtocol = 1;

    [GeneratedRegex("^[a-z][a-z0-9-]{1,38}[a-z0-9]$")]
    public static partial Regex GameId();

    [GeneratedRegex(@"^[a-z0-9-]+/[^/]+/$")]
    public static partial Regex BuildPath();

    /// <summary>Returns why an entry cannot be indexed, or null when it is acceptable.</summary>
    public static string? Problem(GameManifestDocument manifest, string path) => manifest switch
    {
        _ when !GameId().IsMatch(manifest.Id ?? "") => $"invalid id '{manifest.Id}'",
        _ when manifest.Protocol != SupportedProtocol => $"unsupported protocol {manifest.Protocol}",
        _ when !BuildPath().IsMatch(path ?? "") || path!.Contains("..", StringComparison.Ordinal) =>
            $"invalid path '{path}'",
        _ when string.IsNullOrWhiteSpace(manifest.Name) => "missing name",
        _ => null,
    };
}
