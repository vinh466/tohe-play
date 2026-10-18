using System.Diagnostics.Metrics;

namespace Tohe.Api.Infrastructure;

/// <summary>Where the API serves its metrics (ADR 0036).</summary>
public sealed class MetricsOptions
{
    public const string Section = "Metrics";

    /// <summary>Serve <c>/metrics</c>. Tests turn it off: each host would take the same port.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// A port of its own, never the API's: the hub's Caddy proxies only the API's, so <c>/metrics</c> is not on the
    /// internet; in the cluster a NetworkPolicy lets only the monitoring namespace reach it.
    /// </summary>
    public int Port { get; set; } = 9464;

    /// <summary>How often the numbers that come from the database are read again.</summary>
    public TimeSpan SampleInterval { get; set; } = TimeSpan.FromSeconds(30);
}

/// <summary>What the last sample read (the Admin module's sampler puts together what each module tells).</summary>
/// <param name="DatabaseUp">The database answered.</param>
/// <param name="OutboxOldestSeconds">How long the message waiting longest has waited; 0 when none waits.</param>
/// <param name="Held">Results the integrity engine held for a person (ADR 0031).</param>
/// <param name="ReplaysWaiting">Ranked runs handed in and waiting for their replay (ADR 0030).</param>
public sealed record MetricsReadings(
    bool DatabaseUp,
    int RoomsOpen,
    int RoomsPlaying,
    int RoomsConnected,
    int OutboxWaiting,
    double OutboxOldestSeconds,
    int Held,
    int ReplaysWaiting);

/// <summary>
/// Tò He's own metrics (ADR 0036, E-08): one .NET meter, which prometheus-net exports with the runtime's, ASP.NET Core's
/// and Npgsql's. Labels are always bounded — never a profile, an address, a room code or a raw path.
/// </summary>
public sealed class ToheMetrics
{
    public const string MeterName = "Tohe";

    private readonly Counter<long> _emailsSent;
    private readonly Counter<long> _emailsFailed;
    private readonly Counter<long> _signIns;
    private MetricsReadings? _readings;

    public ToheMetrics(IMeterFactory meters, BackgroundWork work, TimeProvider clock)
    {
        var meter = meters.Create(MeterName);
        _emailsSent = meter.CreateCounter<long>("email_sent", description: "Emails the relay took.");
        _emailsFailed = meter.CreateCounter<long>(
            "email_failed", description: "Emails given up on after every try (EmailOptions.MaxAttempts).");
        _signIns = meter.CreateCounter<long>(
            "sign_ins", description: "Sign-ins by method (password, google, github, oidc) and outcome (ok, refused, locked).");

        Gauge(meter, "database_up", "1 when the database answered the last sample, else 0.", r => r.DatabaseUp ? 1 : 0);
        Gauge(meter, "rooms_open", "Tables open.", r => r.RoomsOpen);
        Gauge(meter, "rooms_playing", "Tables in a hand.", r => r.RoomsPlaying);
        Gauge(meter, "rooms_connected", "People connected to a table.", r => r.RoomsConnected);
        Gauge(meter, "email_outbox_waiting", "Emails waiting in the outbox.", r => r.OutboxWaiting);
        Gauge(meter, "email_outbox_oldest_seconds", "How long the email waiting longest has waited.", r => r.OutboxOldestSeconds);
        Gauge(meter, "integrity_held", "Results held for a person.", r => r.Held);
        Gauge(meter, "ranked_replays_waiting", "Ranked runs waiting for their replay.", r => r.ReplaysWaiting);

        // The background workers, from what they last told BackgroundWork: the workers' names are a fixed few.
        meter.CreateObservableGauge(
            "worker_failures_in_row",
            () => work.All.Select(w => new Measurement<int>(w.FailuresInARow, new KeyValuePair<string, object?>("worker", w.Name))),
            description: "Failed runs of a background worker since its last good one.");
        meter.CreateObservableGauge(
            "worker_last_success_age_seconds",
            () => work.All
                .Where(w => w.LastSuccessAt is not null)
                .Select(w => new Measurement<double>(
                    (clock.GetUtcNow() - w.LastSuccessAt!.Value).TotalSeconds,
                    new KeyValuePair<string, object?>("worker", w.Name))),
            description: "Seconds since a background worker's last good run.");
    }

    public void EmailSent() => _emailsSent.Add(1);

    public void EmailFailed() => _emailsFailed.Add(1);

    /// <param name="method"><c>password</c> or a provider's id: <c>google</c>, <c>github</c>, <c>oidc</c>.</param>
    /// <param name="outcome"><c>ok</c>, <c>refused</c> (wrong password, suspended) or <c>locked</c>.</param>
    public void SignIn(string method, string outcome) =>
        _signIns.Add(1, new KeyValuePair<string, object?>("method", method), new KeyValuePair<string, object?>("outcome", outcome));

    /// <summary>The sampler's latest reading; the gauges show nothing until the first.</summary>
    public void Read(MetricsReadings readings) => Volatile.Write(ref _readings, readings);

    /// <summary>The latest reading, if any: a sample that cannot read the database keeps the rest of it.</summary>
    public MetricsReadings? Last => Volatile.Read(ref _readings);

    private void Gauge(Meter meter, string name, string description, Func<MetricsReadings, double> value) =>
        meter.CreateObservableGauge(
            name,
            () => Volatile.Read(ref _readings) is { } readings ? [new Measurement<double>(value(readings))] : Array.Empty<Measurement<double>>(),
            description: description);
}
