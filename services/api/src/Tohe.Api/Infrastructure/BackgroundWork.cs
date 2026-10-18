using System.Collections.Concurrent;

namespace Tohe.Api.Infrastructure;

/// <summary>The last run of one background worker.</summary>
/// <param name="Name">The worker: <c>catalog-sync</c>, <c>email-delivery</c>, <c>telemetry-maintenance</c>,
/// <c>ranked-replays</c>, <c>account-deletion</c> or <c>audit-retention</c>.</param>
/// <param name="LastRunAt">When a run last ended, well or not.</param>
/// <param name="LastSuccessAt">When a run last went well.</param>
/// <param name="LastError">What went wrong, while the last run failed.</param>
/// <param name="FailuresInARow">Failed runs since the last good one.</param>
public sealed record WorkerStatus(
    string Name,
    DateTimeOffset LastRunAt,
    DateTimeOffset? LastSuccessAt,
    string? LastError,
    int FailuresInARow);

/// <summary>
/// What the background workers last did, for the admin console's System page (ADR 0027). Kept in memory: one API
/// process runs every worker, and a restart starts the record afresh.
/// </summary>
public sealed class BackgroundWork(TimeProvider clock)
{
    public const string CatalogSync = "catalog-sync";
    public const string EmailDelivery = "email-delivery";
    public const string TelemetryMaintenance = "telemetry-maintenance";
    public const string RankedReplays = "ranked-replays";
    public const string AccountDeletion = "account-deletion";
    public const string AuditRetention = "audit-retention";

    private const int MaxErrorLength = 300;

    private readonly ConcurrentDictionary<string, WorkerStatus> _workers = new(StringComparer.Ordinal);

    public void Succeeded(string worker)
    {
        var now = clock.GetUtcNow();
        _workers[worker] = new WorkerStatus(worker, now, now, null, 0);
    }

    public void Failed(string worker, Exception error)
    {
        var now = clock.GetUtcNow();
        var what = $"{error.GetType().Name}: {error.Message}";
        if (what.Length > MaxErrorLength)
        {
            what = what[..MaxErrorLength];
        }

        _workers.AddOrUpdate(
            worker,
            _ => new WorkerStatus(worker, now, null, what, 1),
            (_, last) => last with { LastRunAt = now, LastError = what, FailuresInARow = last.FailuresInARow + 1 });
    }

    public WorkerStatus? Of(string worker) => _workers.GetValueOrDefault(worker);

    public IReadOnlyList<WorkerStatus> All => [.. _workers.Values.OrderBy(w => w.Name, StringComparer.Ordinal)];
}
