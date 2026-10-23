using System.Globalization;
using System.Text.Json;

namespace Tohe.Api.Modules.Studio;

/// <summary>
/// The checks of a version's metadata (docs/architecture/asset-studio.md#checks): ids, style, source, licence and
/// attribution, the AI vendor, the version's bytes, and semver against the version approved before it. Pure: the caller
/// brings the vendors whose terms were checked.
/// </summary>
internal static class StudioVersionChecks
{
    /// <summary>The kinds of source, and the fields each must fill.</summary>
    public static readonly IReadOnlyDictionary<string, IReadOnlyList<string>> SourceFields = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
    {
        ["pack"] = ["name", "url", "author"],
        ["upload"] = ["by"],
        ["ai"] = ["vendor", "model", "prompt", "seed", "date"],
        ["code"] = ["script"],
    };

    private enum Bump
    {
        Patch,
        Minor,
        Major,
    }

    public static List<StudioCheckProblem> Check(
        StudioVersionToCheck version, StudioCheckStage stage, IReadOnlySet<string> checkedVendors, StudioCheckLimits limits)
    {
        var problems = new List<StudioCheckProblem>();
        foreach (var id in version.Assets.GroupBy(asset => asset.AssetId, StringComparer.Ordinal).Where(group => group.Count() > 1).Select(group => group.Key))
        {
            problems.Add(new(id, "id_duplicate", $"Two assets of this version have the id {id}"));
        }

        if (version.Style is null)
        {
            problems.Add(new(null, "style_unknown", $"The pack's style {version.Pack.StyleId} does not exist"));
        }
        else if (stage == StudioCheckStage.Approve && version.Style.Status != StyleStatus.Approved)
        {
            problems.Add(new(null, "style_not_approved", $"The style {version.Style.Id} is not approved yet: a reviewer approves it first"));
        }

        foreach (var asset in version.Assets)
        {
            Source(problems, asset, checkedVendors);
            Licence(problems, asset, stage, version.Version.ShareAlikeAllowed);
        }

        var bytes = version.Assets.DistinctBy(asset => (asset.Sha256, asset.Ext)).Sum(asset => asset.Bytes);
        if (bytes > limits.MaxPackBytes)
        {
            problems.Add(new(null, "too_large", $"The version's files hold {bytes} bytes together; at most {limits.MaxPackBytes}"));
        }

        Semver(problems, version);
        return problems;
    }

    /// <summary>The problems in a stable order: the version's first, then by asset, then by code.</summary>
    public static List<StudioCheckProblem> Ordered(IEnumerable<StudioCheckProblem> problems) =>
        [.. problems.OrderBy(problem => problem.Asset is not null).ThenBy(problem => problem.Asset, StringComparer.Ordinal).ThenBy(problem => problem.Code, StringComparer.Ordinal)];

    private static void Source(List<StudioCheckProblem> problems, StudioAsset asset, IReadOnlySet<string> checkedVendors)
    {
        JsonElement source;
        try
        {
            using var json = JsonDocument.Parse(asset.Source);
            source = json.RootElement.Clone();
        }
        catch (JsonException)
        {
            problems.Add(new(asset.AssetId, "source_incomplete", "Its source is not a JSON object"));
            return;
        }

        var type = source.ValueKind == JsonValueKind.Object && source.TryGetProperty("type", out var named) && named.ValueKind == JsonValueKind.String
            ? named.GetString()
            : null;
        if (type is null || !SourceFields.TryGetValue(type, out var fields))
        {
            problems.Add(new(asset.AssetId, "source_incomplete", $"Its source's type must be one of {string.Join(", ", SourceFields.Keys)}"));
            return;
        }

        var missing = fields.Where(field => !Filled(source, type, field)).ToList();
        if (missing.Count > 0)
        {
            problems.Add(new(asset.AssetId, "source_incomplete", $"Its source ({type}) lacks {string.Join(", ", missing)}"));
            return;
        }

        if (type == "ai" && source.GetProperty("vendor").GetString() is { } vendor && !checkedVendors.Contains(vendor))
        {
            problems.Add(new(asset.AssetId, "vendor_not_checked", $"The vendor {vendor} is not on the Studio's list of vendors whose terms were checked"));
        }
    }

    /// <summary>A field of a source is there and makes sense: a URL for a pack's url, a date for an AI's, text otherwise.</summary>
    private static bool Filled(JsonElement source, string type, string field)
    {
        if (!source.TryGetProperty(field, out var value))
        {
            return false;
        }

        return (type, field) switch
        {
            ("pack", "url") => value.ValueKind == JsonValueKind.String
                && Uri.TryCreate(value.GetString(), UriKind.Absolute, out var url)
                && (url.Scheme == Uri.UriSchemeHttps || url.Scheme == Uri.UriSchemeHttp),
            ("ai", "seed") => value.ValueKind == JsonValueKind.Number
                || (value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(value.GetString())),
            ("ai", "date") => value.ValueKind == JsonValueKind.String
                && (DateOnly.TryParseExact(value.GetString(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _)
                    || DateTimeOffset.TryParse(value.GetString(), CultureInfo.InvariantCulture, DateTimeStyles.None, out _)),
            _ => value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(value.GetString()),
        };
    }

    private static void Licence(List<StudioCheckProblem> problems, StudioAsset asset, StudioCheckStage stage, bool shareAlikeAllowed)
    {
        if (!StudioLicences.IsAccepted(asset.Licence))
        {
            problems.Add(new(asset.AssetId, "licence_not_accepted", $"{asset.Licence} is not a licence the Studio accepts"));
            return;
        }

        if (asset.Licence == StudioLicences.ShareAlike && stage == StudioCheckStage.Approve && !shareAlikeAllowed)
        {
            problems.Add(new(asset.AssetId, "licence_not_accepted", $"{asset.Licence} is accepted only when the reviewer allows it for this version, with a reason"));
            return;
        }

        if (StudioLicences.NeedsAttribution(asset.Licence) && string.IsNullOrWhiteSpace(asset.Attribution))
        {
            problems.Add(new(asset.AssetId, "attribution_missing", $"{asset.Licence} asks for credit: give its attribution"));
        }
    }

    /// <summary>
    /// Patch: pixels change, not sizes or frames. Minor: an asset added. Major: an asset removed, renamed, resized, its
    /// frames or its kind changed — against the version approved last.
    /// </summary>
    private static void Semver(List<StudioCheckProblem> problems, StudioVersionToCheck version)
    {
        if (version.Previous is null || SemVersion.Parse(version.Previous.Version) is not { } before || SemVersion.Parse(version.Version.Version) is not { } now)
        {
            return;
        }

        var bump = now.Major != before.Major ? Bump.Major : now.Minor != before.Minor ? Bump.Minor : Bump.Patch;
        var previous = version.PreviousAssets.ToDictionary(asset => asset.AssetId, StringComparer.Ordinal);
        var current = version.Assets.DistinctBy(asset => asset.AssetId).ToDictionary(asset => asset.AssetId, StringComparer.Ordinal);
        var needs = new List<(string Asset, Bump Needs, string Why)>();
        foreach (var (id, old) in previous)
        {
            if (!current.TryGetValue(id, out var asset))
            {
                needs.Add((id, Bump.Major, "was removed or renamed"));
            }
            else if (asset.Kind != old.Kind)
            {
                needs.Add((id, Bump.Major, $"changed its kind from {old.Kind} to {asset.Kind}"));
            }
            else if (asset.Width != old.Width || asset.Height != old.Height)
            {
                needs.Add((id, Bump.Major, $"was resized from {old.Width}×{old.Height} to {asset.Width}×{asset.Height}"));
            }
            else if (asset.Frames != old.Frames)
            {
                needs.Add((id, Bump.Major, "changed its frames"));
            }
        }

        needs.AddRange(current.Keys.Where(id => !previous.ContainsKey(id)).Select(id => (id, Bump.Minor, "was added")));
        foreach (var (asset, level, why) in needs.Where(need => need.Needs > bump))
        {
            var name = level == Bump.Major ? "major" : "minor";
            problems.Add(new(asset, "semver_too_small", $"It {why} since {version.Previous.Version}: that needs a new {name} version, and {version.Version.Version} is not one"));
        }
    }
}
