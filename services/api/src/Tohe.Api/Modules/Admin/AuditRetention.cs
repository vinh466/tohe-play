using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Admin;

/// <summary>
/// The audit log keeps a year (ADR 0034, E-07 Q3): a security record long enough to look back on, not forever — its
/// entries name accounts, some by their email. Older entries are deleted once a day, through the one exception the
/// append-only trigger makes: this job's transaction, and only entries past the year.
/// </summary>
internal sealed partial class AuditRetention(ToheDbContext db, ILogger<AuditRetention> logger)
{
    public async Task<int> RunAsync(CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlAsync($"SELECT set_config('tohe.purge', 'audit', true)", ct);
        // The year exactly as the trigger counts it — the database's clock, 365 days (migration AccountDeletion) — so
        // nothing this picks is refused. Changing it is a migration, on purpose.
        var deleted = await db.Database.ExecuteSqlAsync(
            $"DELETE FROM admin.audit_log WHERE at < now() - interval '365 days'", ct);
        await transaction.CommitAsync(ct);
        if (deleted > 0)
        {
            LogDeleted(deleted);
        }

        return deleted;
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Audit log: deleted {Entries} entries older than a year")]
    private partial void LogDeleted(int entries);
}

/// <summary>Runs <see cref="AuditRetention"/> once a day, as <c>audit-retention</c>.</summary>
internal sealed partial class AuditRetentionWorker(
    IServiceScopeFactory scopes,
    BackgroundWork work,
    ILogger<AuditRetentionWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromDays(1));
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<AuditRetention>().RunAsync(stoppingToken);
                work.Succeeded(BackgroundWork.AuditRetention);
            }
            catch (Exception error) when (error is not OperationCanceledException)
            {
                work.Failed(BackgroundWork.AuditRetention, error);
                LogFailed(error);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Deleting audit entries older than a year failed")]
    private partial void LogFailed(Exception error);
}
