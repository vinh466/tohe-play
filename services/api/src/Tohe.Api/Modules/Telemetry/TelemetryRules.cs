using System.Text.RegularExpressions;

namespace Tohe.Api.Modules.Telemetry;

/// <summary>
/// What a batch may contain. The Game Contract's telemetry rules (packages/contract/src/telemetry.ts) repeated for
/// the hub's batches, plus the context; the API trusts nothing the device says beyond these shapes.
/// </summary>
internal static partial class TelemetryRules
{
    public const int MaxEvents = 200;
    public const int MaxBatchBytes = 32 * 1024;
    public const int FrameBuckets = 6;

    private static readonly string[] Kinds = ["error", "count", "metric", "frames"];
    private static readonly string[] DeviceClasses = ["phone", "tablet", "desktop"];

    [GeneratedRegex("^[a-z][a-z0-9-]*(\\.[a-z0-9-]+){0,5}$")]
    private static partial Regex NamePattern();

    [GeneratedRegex("^[a-z][a-z0-9-]{1,38}[a-z0-9]$")]
    private static partial Regex GameIdPattern();

    [GeneratedRegex("^\\d+\\.\\d+\\.\\d+([-+][0-9A-Za-z.-]+)?$")]
    private static partial Regex VersionPattern();

    [GeneratedRegex("^[0-9a-zA-Z.+-]{1,40}$")]
    private static partial Regex HubVersionPattern();

    [GeneratedRegex("^[a-z]{2}$")]
    private static partial Regex LocalePattern();

    [GeneratedRegex("\\d+")]
    private static partial Regex Digits();

    [GeneratedRegex(":\\d+:\\d+")]
    private static partial Regex LineAndColumn();

    /// <summary>The content hash Vite puts in a bundle's file name (index-J_5sACB-.js), new in every build.</summary>
    [GeneratedRegex("-[A-Za-z0-9_-]{6,}(?=\\.js)")]
    private static partial Regex BundleHash();

    /// <summary>The first problem found, as a validation code with the field it is about; null when the batch is valid.</summary>
    public static (string Field, string Code)? Problem(TelemetryBatch batch)
    {
        if (batch.DeviceId == Guid.Empty || batch.SessionId == Guid.Empty)
        {
            return ("deviceId", "id_invalid");
        }

        var context = batch.Context;
        if (!HubVersionPattern().IsMatch(context.HubVersion)
            || !DeviceClasses.Contains(context.DeviceClass)
            || context.ViewportWidth is < 0 or > 10_000
            || context.ViewportHeight is < 0 or > 10_000
            || !double.IsFinite(context.PixelRatio) || context.PixelRatio is < 0.25 or > 8
            || context.Cores is < 1 or > 256
            || context.MemoryGb is { } memory && (!double.IsFinite(memory) || memory is < 0 or > 1024)
            || context.DisplayMode is not ("browser" or "standalone")
            || context.Theme is not ("light" or "dark")
            || !LocalePattern().IsMatch(context.Locale))
        {
            return ("context", "context_invalid");
        }

        if (batch.Events.Count is 0 or > MaxEvents)
        {
            return ("events", "events_count");
        }

        return batch.Events.Any(e => !Valid(e)) ? ("events", "event_invalid") : null;
    }

    private static bool Valid(TelemetryEventInput e)
    {
        if (!Kinds.Contains(e.Kind) || e.Source is not ("game" or "hub"))
        {
            return false;
        }

        if (e.GameId is { } game ? !GameIdPattern().IsMatch(game) : e.Source == "game")
        {
            return false;
        }

        if (e.GameVersion is { } version && (version.Length > 20 || !VersionPattern().IsMatch(version)))
        {
            return false;
        }

        return e.Kind switch
        {
            "error" => e.Message is { Length: > 0 and <= 300 }
                && e.Stack is null or { Length: <= 1000 }
                && e.Count is null or (>= 1 and <= 100_000),
            "count" => ValidName(e.Name) && e.Count is >= 1 and <= 1_000_000,
            "metric" => ValidName(e.Name) && e.Value is { } value && double.IsFinite(value) && value is >= 0 and <= 1_000_000,
            _ => e.Buckets is { Count: FrameBuckets } buckets
                && buckets.All(b => b is >= 0 and <= 1_000_000)
                && Duration(e.SlowestMs) && e.SlowestMs is not null
                && (e.StepP50Ms is null || Duration(e.StepP50Ms))
                && (e.StepP95Ms is null || Duration(e.StepP95Ms))
                && e.Renderer is null or "webgl" or "canvas",
        };
    }

    private static bool ValidName(string? name) => name is { Length: <= 64 } && NamePattern().IsMatch(name);

    private static bool Duration(double? ms) => ms is { } value && double.IsFinite(value) && value is >= 0 and <= 600_000;

    /// <summary>
    /// Errors that differ only in numbers (ids, positions, versions in a path) or in a bundle's hash are one error, so
    /// an error that survives a release is not new in the next version. The SDK groups the same way (errorFingerprint).
    /// </summary>
    public static string Fingerprint(string message, string? stack)
    {
        var firstFrame = BundleHash().Replace(LineAndColumn().Replace(stack?.Split('\n')[0] ?? "", ""), "");
        var fingerprint = $"{Digits().Replace(message, "#")}|{Digits().Replace(firstFrame, "#")}";
        return fingerprint.Length > 400 ? fingerprint[..400] : fingerprint;
    }

    public static TelemetryRecord ToRecord(TelemetryEventInput e, long sessionId, DateTimeOffset now) => new()
    {
        SessionId = sessionId,
        ReceivedAt = now,
        Source = e.Source,
        GameId = e.GameId,
        GameVersion = e.GameVersion,
        Kind = e.Kind,
        Name = e.Kind is "count" or "metric" ? e.Name : null,
        Message = e.Kind == "error" ? e.Message : null,
        Stack = e.Kind == "error" ? e.Stack : null,
        Fingerprint = e.Kind == "error" ? Fingerprint(e.Message!, e.Stack) : null,
        Count = e.Kind is "error" or "count" ? e.Count ?? 1 : 1,
        Value = e.Kind == "metric" ? e.Value : null,
        Buckets = e.Kind == "frames" ? [.. e.Buckets!] : null,
        SlowestMs = e.Kind == "frames" ? e.SlowestMs : null,
        StepP50Ms = e.Kind == "frames" ? e.StepP50Ms : null,
        StepP95Ms = e.Kind == "frames" ? e.StepP95Ms : null,
        Renderer = e.Kind == "frames" ? e.Renderer : null,
    };
}
