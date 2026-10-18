using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Telemetry;

/// <param name="RolledUp">Days added up into daily rows by this run.</param>
internal sealed record MaintenanceResult(int RolledUp, int EventsDeleted, int SessionsDeleted, int DaysDeleted);

/// <summary>
/// Adds up every finished UTC day into <see cref="TelemetryDay"/> rows (once per day), then deletes raw events past
/// their 30 days and daily rows past their year (ADR 0015).
/// </summary>
internal sealed partial class TelemetryMaintenance(
    ToheDbContext db,
    IOptions<TelemetryOptions> options,
    TimeProvider clock,
    ILogger<TelemetryMaintenance> logger)
{
    public async Task<MaintenanceResult> RunAsync(CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var today = DateOnly.FromDateTime(now.UtcDateTime);
        var rolledUp = await RollUpAsync(today, now, ct);

        var rawCutoff = now.AddDays(-options.Value.RawRetentionDays);
        var events = await db.TelemetryRecords.Where(e => e.ReceivedAt < rawCutoff).ExecuteDeleteAsync(ct);
        var sessions = await db.TelemetrySessions.Where(s => s.LastSeenAt < rawCutoff).ExecuteDeleteAsync(ct);
        var dailyCutoff = today.AddDays(-options.Value.DailyRetentionDays);
        var days = await db.TelemetryDays.Where(d => d.Day < dailyCutoff).ExecuteDeleteAsync(ct);
        await db.TelemetryRollups.Where(r => r.Day < dailyCutoff).ExecuteDeleteAsync(ct);

        var result = new MaintenanceResult(rolledUp, events, sessions, days);
        if (result != new MaintenanceResult(0, 0, 0, 0))
        {
            LogMaintenance(result.RolledUp, result.EventsDeleted, result.SessionsDeleted, result.DaysDeleted);
        }

        return result;
    }

    private async Task<int> RollUpAsync(DateOnly today, DateTimeOffset now, CancellationToken ct)
    {
        var oldest = await db.TelemetryRecords.MinAsync(e => (DateTimeOffset?)e.ReceivedAt, ct);
        if (oldest is null)
        {
            return 0;
        }

        var done = (await db.TelemetryRollups.Select(r => r.Day).ToListAsync(ct)).ToHashSet();
        var rolled = 0;
        for (var day = DateOnly.FromDateTime(oldest.Value.UtcDateTime); day < today; day = day.AddDays(1))
        {
            if (done.Contains(day))
            {
                continue;
            }

            var start = new DateTimeOffset(day.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            var end = start.AddDays(1);
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            await db.Database.ExecuteSqlAsync(
                $"""
                INSERT INTO telemetry.daily (day, source, game_id, game_version, os, browser, device_class, kind, name,
                    fingerprint, message, stack, sessions, devices, total, value_p50, value_p95, value_max, buckets,
                    slowest_max)
                SELECT {day}, e.source, e.game_id, e.game_version, s.os, s.browser, s.device_class, e.kind, e.name,
                    e.fingerprint, min(e.message), min(e.stack), count(DISTINCT e.session_id),
                    count(DISTINCT s.device_id), sum(e.count),
                    percentile_cont(0.5) WITHIN GROUP (ORDER BY e.value),
                    percentile_cont(0.95) WITHIN GROUP (ORDER BY e.value),
                    max(e.value),
                    CASE WHEN e.kind = 'frames' THEN ARRAY[sum(e.buckets[1]), sum(e.buckets[2]), sum(e.buckets[3]),
                        sum(e.buckets[4]), sum(e.buckets[5]), sum(e.buckets[6])] END,
                    max(e.slowest_ms)
                FROM telemetry.events e
                JOIN telemetry.sessions s ON s.id = e.session_id
                WHERE e.received_at >= {start} AND e.received_at < {end}
                GROUP BY e.source, e.game_id, e.game_version, s.os, s.browser, s.device_class, e.kind, e.name,
                    e.fingerprint
                """,
                ct);
            db.TelemetryRollups.Add(new TelemetryRollup { Day = day, DoneAt = now });
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            rolled++;
        }

        return rolled;
    }

    [LoggerMessage(Level = LogLevel.Information,
        Message = "Telemetry maintenance: {RolledUp} days rolled up; deleted {Events} events, {Sessions} sessions, {Days} daily rows")]
    private partial void LogMaintenance(int rolledUp, int events, int sessions, int days);
}

/// <summary>Runs <see cref="TelemetryMaintenance"/> now and then (Telemetry:MaintenanceInterval).</summary>
internal sealed partial class TelemetryMaintenanceWorker(
    IServiceScopeFactory scopes,
    IOptions<TelemetryOptions> options,
    BackgroundWork work,
    ILogger<TelemetryMaintenanceWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(options.Value.MaintenanceInterval);
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<TelemetryMaintenance>().RunAsync(stoppingToken);
                work.Succeeded(BackgroundWork.TelemetryMaintenance);
            }
            catch (Exception error) when (error is not OperationCanceledException)
            {
                work.Failed(BackgroundWork.TelemetryMaintenance, error);
                LogFailed(error);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Telemetry maintenance failed; next try at the next interval")]
    private partial void LogFailed(Exception error);
}
