using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Tohe.Api.Infrastructure;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Studio;

/// <summary>
/// Drafts not submitted within 30 days are removed (ADR 0051): their files in the drafts area, their assets and the
/// version; a pack left with no version goes too. Each removal is in the Studio's audit, made by nobody.
/// </summary>
internal sealed partial class StudioDraftCleanup(
    ToheDbContext db,
    IStudioStorage storage,
    TimeProvider clock,
    ILogger<StudioDraftCleanup> logger)
{
    /// <summary>How long a draft waits to be submitted.</summary>
    public static readonly TimeSpan DraftLifetime = TimeSpan.FromDays(30);

    /// <summary>The worker's name on the console's System page.</summary>
    public const string Worker = "studio-draft-cleanup";

    /// <summary>Removes every expired draft; how many it removed.</summary>
    public async Task<int> RunAsync(CancellationToken ct)
    {
        if (!storage.IsConfigured)
        {
            return 0;
        }

        var before = clock.GetUtcNow() - DraftLifetime;
        var expired = await db.StudioPackVersions
            .Where(version => version.Status == PackVersionStatus.Draft && version.CreatedAt < before)
            .OrderBy(version => version.CreatedAt)
            .ToListAsync(ct);
        var removed = 0;
        foreach (var version in expired)
        {
            // The files first: deleting is safe to repeat, and a version whose files are not gone stays to try again.
            foreach (var key in await storage.ListAsync(StudioKeys.DraftPrefix(version.Id), ct))
            {
                await storage.DeleteAsync(key, ct);
            }

            // Its status is read again in the DELETE: a draft submitted this very moment keeps its row, though its files
            // are gone — its approval then fails on the missing files, and a new draft fixes it.
            db.StudioPackVersions.Remove(version);
            db.StudioAudit.Add(new StudioAuditEntry
            {
                At = clock.GetUtcNow(),
                Action = "draft.expire",
                Target = StudioLibraryEndpoints.Target(version),
                VersionId = version.Id,
                Details = JsonSerializer.Serialize(new { createdAt = version.CreatedAt }, JsonSerializerOptions.Web),
            });
            try
            {
                await db.SaveChangesAsync(ct);
                removed++;
            }
            catch (DbUpdateConcurrencyException)
            {
                db.ChangeTracker.Clear();
                continue;
            }

            try
            {
                await db.StudioPacks
                    .Where(pack => pack.Id == version.PackId && !db.StudioPackVersions.Any(other => other.PackId == pack.Id))
                    .ExecuteDeleteAsync(ct);
            }
            catch (PostgresException e) when (e.SqlState == PostgresErrorCodes.ForeignKeyViolation)
            {
                // A new draft of the pack arrived meanwhile: the pack stays.
            }
        }

        if (removed > 0)
        {
            LogRemoved(removed);
        }

        return removed;
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Studio: removed {Drafts} drafts not submitted within 30 days")]
    private partial void LogRemoved(int drafts);
}

/// <summary>Runs <see cref="StudioDraftCleanup"/> once a day, as <c>studio-draft-cleanup</c>.</summary>
internal sealed partial class StudioDraftCleanupWorker(
    IServiceScopeFactory scopes,
    BackgroundWork work,
    ILogger<StudioDraftCleanupWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromDays(1));
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<StudioDraftCleanup>().RunAsync(stoppingToken);
                work.Succeeded(StudioDraftCleanup.Worker);
            }
            catch (Exception error) when (error is not OperationCanceledException)
            {
                work.Failed(StudioDraftCleanup.Worker, error);
                LogFailed(error);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Removing the Studio's expired drafts failed")]
    private partial void LogFailed(Exception error);
}
