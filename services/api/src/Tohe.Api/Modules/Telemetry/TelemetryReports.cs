using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Telemetry;

/// <summary>
/// Builds the report agents and the owner read (GET /api/telemetry/report). The database filters the window; the
/// grouping happens here, which keeps it plain to read and test. A family's month is a few thousand events.
/// </summary>
internal sealed class TelemetryReports(ToheDbContext db, TimeProvider clock)
{
    public const int MaxDays = 30;
    private const int TopErrors = 20;
    private static readonly string[] BucketLabels = ["≤ 17 ms", "≤ 25 ms", "≤ 33 ms", "≤ 50 ms", "≤ 100 ms", "> 100 ms"];

    private sealed record Row(
        long SessionId,
        DateTimeOffset ReceivedAt,
        string Source,
        string? GameId,
        string? GameVersion,
        string Kind,
        string? Name,
        string? Fingerprint,
        string? Message,
        string? Stack,
        int Count,
        double? Value,
        int[]? Buckets,
        double? SlowestMs,
        double? StepP95Ms,
        string? Renderer);

    private sealed record SessionInfo(long Id, Guid DeviceId, string Os, string OsVersion, string Browser, string DeviceClass);

    public async Task<TelemetryReport> BuildAsync(int days, bool includeHeadless, CancellationToken ct)
    {
        var to = clock.GetUtcNow();
        var from = to.AddDays(-Math.Clamp(days, 1, MaxDays));

        var sessions = (await db.TelemetrySessions.AsNoTracking()
                .Where(s => s.LastSeenAt >= from)
                .Select(s => new SessionInfo(s.Id, s.DeviceId, s.Os, s.OsVersion, s.Browser, s.DeviceClass))
                .ToListAsync(ct))
            .Where(s => includeHeadless || s.Browser != "HeadlessChrome")
            .ToDictionary(s => s.Id);

        var rows = (await db.TelemetryRecords.AsNoTracking()
                .Where(e => e.ReceivedAt >= from)
                .Select(e => new Row(
                    e.SessionId, e.ReceivedAt, e.Source, e.GameId, e.GameVersion, e.Kind, e.Name, e.Fingerprint,
                    e.Message, e.Stack, e.Count, e.Value, e.Buckets, e.SlowestMs, e.StepP95Ms, e.Renderer))
                .ToListAsync(ct))
            .Where(r => sessions.ContainsKey(r.SessionId))
            .ToList();

        var known = await KnownErrorsAsync(from, ct);
        var games = rows
            .GroupBy(r => (r.GameId, r.GameVersion))
            .OrderBy(g => g.Key.GameId is null ? 0 : 1)
            .ThenBy(g => g.Key.GameId, StringComparer.Ordinal)
            .ThenByDescending(g => g.Key.GameVersion, StringComparer.Ordinal)
            .Select(g => Health(g.Key.GameId, g.Key.GameVersion, [.. g], sessions, known))
            .ToList();

        var devices = sessions.Values
            .GroupBy(s => (s.Os, s.OsVersion, s.Browser, s.DeviceClass))
            .Select(g => new DeviceShare(
                g.Key.Os, g.Key.OsVersion, g.Key.Browser, g.Key.DeviceClass,
                g.Select(s => s.DeviceId).Distinct().Count(), g.Count()))
            .OrderByDescending(d => d.Sessions)
            .ToList();

        var totals = new TelemetryTotals(
            sessions.Values.Select(s => s.DeviceId).Distinct().Count(), sessions.Count, rows.Count);
        return new TelemetryReport(from, to, totals, devices, games, await DailyAsync(from, ct), Funnel(rows));
    }

    /// <summary>The prefix of the hub's newcomer-funnel counts (docs/architecture/telemetry.md).</summary>
    internal const string FunnelPrefix = "hub.funnel.";

    /// <summary>
    /// The newcomer funnel from the raw rows (the window is at most the 30 days raw events are kept): the hub's own
    /// <c>hub.funnel.*</c> counts per UTC day and in total, and three ratios.
    /// </summary>
    private static FunnelReport Funnel(List<Row> rows)
    {
        var funnel = rows
            .Where(r => r.Kind == "count" && r.Source == "hub" && r.GameId is null
                && r.Name!.StartsWith(FunnelPrefix, StringComparison.Ordinal))
            .ToList();

        var days = funnel
            .GroupBy(r => DateOnly.FromDateTime(r.ReceivedAt.UtcDateTime))
            .OrderBy(g => g.Key)
            .Select(g => new FunnelDay(g.Key, Sum(g)))
            .ToList();
        var totals = Sum(funnel);

        long Of(string name) => totals.GetValueOrDefault(FunnelPrefix + name);
        var offered = totals.Where(t => t.Key.StartsWith(FunnelPrefix + "install-offered.", StringComparison.Ordinal)).Sum(t => t.Value);
        return new FunnelReport(
            days,
            totals,
            new FunnelRatios(
                Ratio(Of("first-game"), Of("guest-start")),
                Ratio(Of("install-accepted"), offered),
                Ratio(Of("account-created"), Of("sign-in-opened"))));

        static Dictionary<string, long> Sum(IEnumerable<Row> of) => of
            .GroupBy(r => r.Name!)
            .OrderBy(g => g.Key, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.Sum(r => (long)r.Count));
    }

    internal static double? Ratio(long part, long whole) => whole == 0 ? null : Math.Round((double)part / whole, 4);

    private static GameHealth Health(
        string? gameId,
        string? version,
        List<Row> rows,
        Dictionary<long, SessionInfo> sessions,
        HashSet<string> known)
    {
        int Devices(IEnumerable<Row> of) => of.Select(r => sessions[r.SessionId].DeviceId).Distinct().Count();
        var errors = rows.Where(r => r.Kind == "error").ToList();

        var errorGroups = errors
            .GroupBy(r => (r.Source, r.Fingerprint!))
            .Select(g => new ErrorGroup(
                g.Key.Source,
                g.Key.Item2,
                g.First().Message ?? "",
                g.First().Stack,
                g.Sum(r => (long)r.Count),
                g.Select(r => r.SessionId).Distinct().Count(),
                Devices(g),
                g.Min(r => r.ReceivedAt),
                g.Max(r => r.ReceivedAt),
                !known.Contains(g.Key.Item2)))
            .OrderByDescending(e => e.Occurrences)
            .Take(TopErrors)
            .ToList();

        var frames = rows
            .Where(r => r.Kind == "frames" && r.Buckets is { Length: TelemetryRules.FrameBuckets })
            .GroupBy(r =>
            {
                var session = sessions[r.SessionId];
                return (session.Os, session.Browser, session.DeviceClass, r.Renderer);
            })
            .Select(g =>
            {
                var buckets = new long[TelemetryRules.FrameBuckets];
                foreach (var row in g)
                {
                    for (var i = 0; i < buckets.Length; i++)
                    {
                        buckets[i] += row.Buckets![i];
                    }
                }

                var total = buckets.Sum();
                var steps = g.Where(r => r.StepP95Ms is not null).Select(r => r.StepP95Ms!.Value).Order().ToList();
                return new FrameGroup(
                    g.Key.Os,
                    g.Key.Browser,
                    g.Key.DeviceClass,
                    g.Key.Renderer,
                    g.Select(r => r.SessionId).Distinct().Count(),
                    total,
                    total == 0 ? 0 : Math.Round((double)(buckets[3] + buckets[4] + buckets[5]) / total, 4),
                    BucketLabels[P95Bucket(buckets)],
                    g.Max(r => r.SlowestMs ?? 0),
                    steps.Count == 0 ? null : Percentile(steps, 95));
            })
            .OrderByDescending(f => f.SlowShare)
            .ToList();

        var metrics = rows
            .Where(r => r.Kind == "metric" && r.Value is not null)
            .GroupBy(r => r.Name!)
            .Select(g =>
            {
                var values = g.Select(r => r.Value!.Value).Order().ToList();
                return new MetricSummary(g.Key, values.Count, Percentile(values, 50), Percentile(values, 95), values[^1]);
            })
            .OrderBy(m => m.Name, StringComparer.Ordinal)
            .ToList();

        var counts = rows
            .Where(r => r.Kind == "count")
            .GroupBy(r => r.Name!)
            .Select(g => new CountSummary(g.Key, g.Sum(r => (long)r.Count), g.Select(r => r.SessionId).Distinct().Count()))
            .OrderBy(c => c.Name, StringComparer.Ordinal)
            .ToList();

        return new GameHealth(
            gameId,
            version,
            rows.Select(r => r.SessionId).Distinct().Count(),
            Devices(rows),
            errors.Select(r => r.SessionId).Distinct().Count(),
            errorGroups,
            frames,
            metrics,
            counts);
    }

    /// <summary>Error fingerprints seen before the window, so the report can mark the new ones.</summary>
    private async Task<HashSet<string>> KnownErrorsAsync(DateTimeOffset from, CancellationToken ct)
    {
        var firstDay = DateOnly.FromDateTime(from.UtcDateTime);
        var raw = await db.TelemetryRecords.AsNoTracking()
            .Where(e => e.Kind == "error" && e.ReceivedAt < from && e.Fingerprint != null)
            .Select(e => e.Fingerprint!)
            .Distinct()
            .ToListAsync(ct);
        var rolled = await db.TelemetryDays.AsNoTracking()
            .Where(d => d.Kind == "error" && d.Day < firstDay && d.Fingerprint != null)
            .Select(d => d.Fingerprint!)
            .Distinct()
            .ToListAsync(ct);
        return [.. raw, .. rolled];
    }

    private async Task<List<DailyPoint>> DailyAsync(DateTimeOffset from, CancellationToken ct)
    {
        var firstDay = DateOnly.FromDateTime(from.UtcDateTime);
        var days = await db.TelemetryDays.AsNoTracking()
            .Where(d => d.Day >= firstDay && (d.Kind == "error" || (d.Kind == "count" && d.Name == "hub.play.session")))
            .Select(d => new { d.Day, d.GameId, d.Kind, d.Total })
            .ToListAsync(ct);
        return days
            .GroupBy(d => (d.Day, d.GameId))
            .Select(g => new DailyPoint(
                g.Key.Day,
                g.Key.GameId,
                g.Where(d => d.Kind == "error").Sum(d => d.Total),
                g.Where(d => d.Kind == "count").Sum(d => d.Total)))
            .OrderBy(p => p.Day)
            .ThenBy(p => p.GameId, StringComparer.Ordinal)
            .ToList();
    }

    /// <summary>The bucket where the 95th-percentile frame falls.</summary>
    internal static int P95Bucket(long[] buckets)
    {
        var total = buckets.Sum();
        long seen = 0;
        for (var i = 0; i < buckets.Length; i++)
        {
            seen += buckets[i];
            if (total > 0 && seen >= total * 0.95)
            {
                return i;
            }
        }

        return 0;
    }

    internal static double Percentile(List<double> sorted, int p) =>
        sorted.Count == 0 ? 0 : sorted[Math.Min(sorted.Count - 1, (int)Math.Floor(p / 100.0 * sorted.Count))];
}
