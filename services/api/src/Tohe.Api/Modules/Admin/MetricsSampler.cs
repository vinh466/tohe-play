using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Email;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Integrity;
using Tohe.Api.Modules.Rooms;

namespace Tohe.Api.Modules.Admin;

/// <summary>
/// Puts together what each module tells into <see cref="ToheMetrics"/>' gauges (ADR 0036), as the console's overview
/// does (ADR 0027): the tables at once, the rest from the database. A database that does not answer is itself the
/// reading — <c>tohe_database_up</c> 0 — and the other numbers keep their last values.
/// </summary>
internal sealed class MetricsSample(
    ToheDbContext db,
    RoomRegistry rooms,
    EmailFacts email,
    IntegrityReview review,
    RankedReplays replays,
    IdentityFacts identity,
    ToheMetrics metrics,
    TimeProvider clock)
{
    public async Task RunAsync(CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var live = rooms.Live();
        var readings = (metrics.Last ?? new MetricsReadings(false, 0, 0, 0, 0, 0, 0, 0, 0))
            with { RoomsOpen = live.Open, RoomsPlaying = live.Playing, RoomsConnected = live.Online };
        try
        {
            await db.Database.ExecuteSqlRawAsync("SELECT 1", ct);
            var outbox = await email.StateAsync(now, ct);
            readings = readings with
            {
                DatabaseUp = true,
                OutboxWaiting = outbox.Waiting,
                OutboxOldestSeconds = outbox.OldestWaitingSince is { } since ? Math.Max(0, (now - since).TotalSeconds) : 0,
                Held = await review.HeldCountAsync(ct),
                ReplaysWaiting = await replays.WaitingAsync(ct),
                DeletionsDue = await identity.DeletionsDueAsync(now, ct),
            };
        }
        catch (Exception error) when (error is not OperationCanceledException)
        {
            readings = readings with { DatabaseUp = false };
        }

        metrics.Read(readings);
    }
}

/// <summary>Runs <see cref="MetricsSample"/> when the API starts and every <c>Metrics:SampleInterval</c>.</summary>
internal sealed class MetricsSampler(IServiceScopeFactory scopes, IOptions<MetricsOptions> options) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(options.Value.SampleInterval);
        do
        {
            await using var scope = scopes.CreateAsyncScope();
            await scope.ServiceProvider.GetRequiredService<MetricsSample>().RunAsync(stoppingToken);
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
