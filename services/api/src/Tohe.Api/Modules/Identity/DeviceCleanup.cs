using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Identity;

/// <summary>
/// Device profiles on the server unused for 90 days, and devices unseen for 90 days, are deleted there (ADR 0043) —
/// through ADR 0034's deletion, so each module purges what it keeps, seats read "Người chơi đã xoá" and ids are retired.
/// The copies on the devices stay: a device that needs the server again gives its profile a new id.
/// </summary>
internal sealed partial class DeviceCleanup(ToheDbContext db, AccountDeletion deletion, TimeProvider clock, ILogger<DeviceCleanup> logger)
{
    /// <summary>Profiles deleted in one transaction.</summary>
    private const int Batch = 50;

    /// <summary>Unused this long, a device profile — or a device — is deleted on the server.</summary>
    public static readonly TimeSpan Unused = TimeSpan.FromDays(90);

    /// <summary>Deletes what is due; returns how many device profiles and devices went.</summary>
    public async Task<(int Profiles, int Devices)> RunAsync(CancellationToken ct)
    {
        var cutoff = clock.GetUtcNow() - Unused;
        var profiles = 0;
        while (true)
        {
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var due = await db.Profiles
                .Where(p => p.DeviceId != null && (p.LastUsedAt ?? p.CreatedAt) < cutoff)
                .OrderBy(p => p.Id)
                .Take(Batch)
                .ToListAsync(ct);
            if (due.Count == 0)
            {
                break;
            }

            await deletion.DeleteProfilesAsync(due, ct);
            await transaction.CommitAsync(ct);
            db.ChangeTracker.Clear();
            profiles += due.Count;
        }

        var devices = 0;
        foreach (var deviceId in await db.Devices.Where(d => d.LastSeenAt < cutoff).Select(d => d.Id).ToListAsync(ct))
        {
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            await db.Database.ExecuteSqlAsync($"SELECT 1 FROM identity.devices WHERE id = {deviceId} FOR UPDATE", ct);
            // Its profiles were used since it was seen? Never: every use of one is a use of its key. They go with it.
            var left = await db.Profiles.Where(p => p.DeviceId == deviceId).ToListAsync(ct);
            await deletion.DeleteProfilesAsync(left, ct);
            profiles += left.Count;
            devices += await db.Devices.Where(d => d.Id == deviceId && d.LastSeenAt < cutoff).ExecuteDeleteAsync(ct);
            await transaction.CommitAsync(ct);
            db.ChangeTracker.Clear();
        }

        if (profiles > 0 || devices > 0)
        {
            LogDeleted(profiles, devices);
        }

        return (profiles, devices);
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Device cleanup: deleted {Profiles} device profiles and {Devices} devices unused for 90 days")]
    private partial void LogDeleted(int profiles, int devices);
}

/// <summary>Runs <see cref="DeviceCleanup"/> once a day, as <c>device-cleanup</c>.</summary>
internal sealed partial class DeviceCleanupWorker(
    IServiceScopeFactory scopes,
    BackgroundWork work,
    ILogger<DeviceCleanupWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromDays(1));
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<DeviceCleanup>().RunAsync(stoppingToken);
                work.Succeeded(BackgroundWork.DeviceCleanup);
            }
            catch (Exception error) when (error is not OperationCanceledException)
            {
                work.Failed(BackgroundWork.DeviceCleanup, error);
                LogFailed(error);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Deleting device profiles and devices unused for 90 days failed")]
    private partial void LogFailed(Exception error);
}
