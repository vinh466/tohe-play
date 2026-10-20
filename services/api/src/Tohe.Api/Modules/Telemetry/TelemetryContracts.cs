using System.ComponentModel.DataAnnotations;

namespace Tohe.Api.Modules.Telemetry;

/// <summary>What the hub sends: the device's context once, and the events since the last batch.</summary>
/// <param name="DeviceId">Random per device, renewed every 30 days; tied to no account.</param>
/// <param name="SessionId">Random per page load of the hub.</param>
public sealed record TelemetryBatch(
    Guid DeviceId,
    Guid SessionId,
    [Required] TelemetryContext Context,
    [Required, MaxLength(TelemetryRules.MaxEvents)] IReadOnlyList<TelemetryEventInput> Events);

/// <summary>The device and the hub, as far as they matter for compatibility. OS and browser come from the User-Agent header.</summary>
/// <param name="HubVersion">The commit the hub was built from.</param>
/// <param name="DeviceClass"><c>phone</c>, <c>tablet</c> or <c>desktop</c>.</param>
/// <param name="ViewportWidth">CSS pixels, rounded to 50.</param>
/// <param name="ViewportHeight">CSS pixels, rounded to 50.</param>
/// <param name="Cores">navigator.hardwareConcurrency, capped at 16.</param>
/// <param name="MemoryGb">navigator.deviceMemory (Chromium only).</param>
/// <param name="DisplayMode"><c>browser</c> or <c>standalone</c> (installed app).</param>
public sealed record TelemetryContext(
    [Required, StringLength(40)] string HubVersion,
    [Required, StringLength(10)] string DeviceClass,
    int ViewportWidth,
    int ViewportHeight,
    double PixelRatio,
    int? Cores = null,
    double? MemoryGb = null,
    string DisplayMode = "browser",
    string Theme = "light",
    string Locale = "vi");

/// <summary>
/// One event: the Game Contract's telemetry events (error, count, metric, frames), from a game or from the hub itself.
/// Fields that do not belong to the event's kind are left out.
/// </summary>
/// <param name="Kind"><c>error</c>, <c>count</c>, <c>metric</c> or <c>frames</c>.</param>
/// <param name="Source"><c>game</c> (reported by a game through the SDK) or <c>hub</c>.</param>
/// <param name="GameId">The game it happened in; required for <c>game</c> events.</param>
/// <param name="Name">For counts and metrics: lower-case words joined by dots; a metric's ends in its unit.</param>
/// <param name="Buckets">For frames: frames per duration bucket, ≤ 17, 25, 33, 50, 100 ms, then slower.</param>
public sealed record TelemetryEventInput(
    [Required] string Kind,
    string Source = "hub",
    string? GameId = null,
    string? GameVersion = null,
    string? Name = null,
    string? Message = null,
    string? Stack = null,
    int? Count = null,
    double? Value = null,
    IReadOnlyList<int>? Buckets = null,
    double? SlowestMs = null,
    double? StepP50Ms = null,
    double? StepP95Ms = null,
    string? Renderer = null);

/// <summary>What happened on players' devices over a window of days (raw events, at most 30 days back).</summary>
/// <param name="Games">One entry per game version, and one for the hub itself (no game id).</param>
/// <param name="Daily">Errors and plays per day and game, from the daily roll-ups.</param>
/// <param name="Funnel">The newcomer funnel: the hub's <c>hub.funnel.*</c> counts per day, and three ratios.</param>
public sealed record TelemetryReport(
    DateTimeOffset From,
    DateTimeOffset To,
    TelemetryTotals Totals,
    IReadOnlyList<DeviceShare> Devices,
    IReadOnlyList<GameHealth> Games,
    IReadOnlyList<DailyPoint> Daily,
    FunnelReport Funnel);

/// <summary>
/// How newcomers move through the hub, counted without following anyone (docs/architecture/telemetry.md, "Newcomer
/// funnel"): sums of the hub's <c>hub.funnel.*</c> counts over the window, with headless runs left out as everywhere
/// in the report. A device counts once for the steps that happen once, so these are about as many devices as events.
/// </summary>
/// <param name="Days">One entry per UTC day that has any funnel event, oldest first.</param>
/// <param name="Totals">The whole window: each <c>hub.funnel.*</c> name with its count.</param>
/// <param name="Ratios">Three steps against the one before; null when that one has no count yet.</param>
public sealed record FunnelReport(
    IReadOnlyList<FunnelDay> Days,
    IReadOnlyDictionary<string, long> Totals,
    FunnelRatios Ratios);

/// <param name="Counts">Each <c>hub.funnel.*</c> name seen that day with its count.</param>
public sealed record FunnelDay(DateOnly Day, IReadOnlyDictionary<string, long> Counts);

/// <param name="FirstGamePerGuestStart"><c>hub.funnel.first-game</c> / <c>hub.funnel.guest-start</c>.</param>
/// <param name="InstallAcceptedPerOffered"><c>hub.funnel.install-accepted</c> / the sum of every <c>hub.funnel.install-offered.*</c>.</param>
/// <param name="AccountCreatedPerSignInOpened"><c>hub.funnel.account-created</c> / <c>hub.funnel.sign-in-opened</c>.</param>
public sealed record FunnelRatios(
    double? FirstGamePerGuestStart,
    double? InstallAcceptedPerOffered,
    double? AccountCreatedPerSignInOpened);

public sealed record TelemetryTotals(int Devices, int Sessions, int Events);

/// <summary>How many devices and hub sessions ran on a platform.</summary>
public sealed record DeviceShare(string Os, string OsVersion, string Browser, string DeviceClass, int Devices, int Sessions);

/// <summary>
/// Health of one game version: what the game reported and what the hub saw of it (plays, load time, protocol
/// errors). With no game id, the hub's own events outside games.
/// </summary>
/// <param name="Sessions">Hub sessions with events about this game version.</param>
/// <param name="SessionsWithErrors">Of those, sessions with an error.</param>
public sealed record GameHealth(
    string? GameId,
    string? GameVersion,
    int Sessions,
    int Devices,
    int SessionsWithErrors,
    IReadOnlyList<ErrorGroup> Errors,
    IReadOnlyList<FrameGroup> Frames,
    IReadOnlyList<MetricSummary> Metrics,
    IReadOnlyList<CountSummary> Counts);

/// <param name="Source"><c>game</c> or <c>hub</c>: who caught the error.</param>
/// <param name="New">Not seen before the window (in raw events or daily roll-ups).</param>
public sealed record ErrorGroup(
    string Source,
    string Fingerprint,
    string Message,
    string? Stack,
    long Occurrences,
    int Sessions,
    int Devices,
    DateTimeOffset FirstSeen,
    DateTimeOffset LastSeen,
    bool New);

/// <summary>Frame times on one platform and renderer.</summary>
/// <param name="SlowShare">Share of frames slower than 33 ms (under 30 fps).</param>
/// <param name="P95">The bucket the 95th-percentile frame falls in, e.g. <c>≤ 17 ms</c> or <c>&gt; 100 ms</c>.</param>
public sealed record FrameGroup(
    string Os,
    string Browser,
    string DeviceClass,
    string? Renderer,
    int Sessions,
    long Frames,
    double SlowShare,
    string P95,
    double SlowestMs,
    double? StepP95Ms);

public sealed record MetricSummary(string Name, int Samples, double P50, double P95, double Max);

public sealed record CountSummary(string Name, long Total, int Sessions);

/// <summary>A day from the roll-ups: errors and plays (<c>hub.play.session</c>) of one game, or the hub's own errors.</summary>
public sealed record DailyPoint(DateOnly Day, string? GameId, long Errors, long Plays);
