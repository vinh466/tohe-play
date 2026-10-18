using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Email;
using Tohe.Api.Modules.Platform;

namespace Tohe.Api.Modules.Identity;

/// <summary>
/// What a module keeps under profiles' ids, and lets go of when they are deleted (ADR 0034). Identity deletes profiles
/// and accounts; every module that stores something of a profile implements this, so nothing is left behind.
/// </summary>
public interface IProfileData
{
    /// <summary>
    /// The profiles stop taking part at once — they leave the tables they sit at, and invitations to them end — while
    /// what is stored stays: an account asking to be deleted still has its wait.
    /// </summary>
    Task WithdrawAsync(IReadOnlyCollection<Guid> profileIds, CancellationToken ct);

    /// <summary>
    /// Deletes what the module stores of the profiles, in the caller's transaction, which has said it is the purge
    /// (<see cref="AccountDeletion.PurgeSetting"/>): the one way past the append-only tables.
    /// </summary>
    Task PurgeAsync(IReadOnlyCollection<Guid> profileIds, CancellationToken ct);
}

/// <summary>
/// Deleting profiles and accounts (ADR 0034, design §3.14). A profile is deleted at once, with all its data: its owner
/// asked behind the parent gate. An account waits <see cref="IdentityOptions.DeletionWait"/> first — it stops at once,
/// and signing in to it before the time keeps it — then goes for good with all its profiles.
/// </summary>
internal sealed partial class AccountDeletion(
    ToheDbContext db,
    UserManager<Account> users,
    IEnumerable<IProfileData> modules,
    IEmailOutbox outbox,
    IOptions<IdentityOptions> options,
    IOptions<AppOptions> app,
    TimeProvider clock,
    ILogger<AccountDeletion> logger)
{
    /// <summary>
    /// The transaction-local setting that lets the purge past the append-only triggers: a decision of a deleted
    /// profile's result goes with its result, and nothing else (ADR 0034).
    /// </summary>
    public const string PurgeSetting = "tohe.purge";

    /// <summary>
    /// The owner asked to delete the account: every session ends, its profiles leave boards and tables, its address
    /// hears when and how to keep it. Returns when it goes for good.
    /// </summary>
    public async Task<DateTimeOffset> RequestAsync(Account account, CancellationToken ct)
    {
        var deleteAfter = clock.GetUtcNow() + options.Value.DeletionWait;
        await using (var transaction = await db.Database.BeginTransactionAsync(ct))
        {
            account.DeleteAfter = deleteAfter;
            // A new security stamp: every session of the account ends (ADR 0024). Saves the account too.
            await users.UpdateSecurityStampAsync(account);
            if (outbox.Enabled && account.Email is { } email)
            {
                outbox.Add(IdentityEmails.DeletionScheduled(email, deleteAfter, Link("/welcome")));
                await db.SaveChangesAsync(ct);
            }

            await transaction.CommitAsync(ct);
        }

        var profiles = await db.Profiles.Where(p => p.AccountId == account.Id).Select(p => p.Id).ToListAsync(ct);
        foreach (var module in modules)
        {
            await module.WithdrawAsync(profiles, ct);
        }

        LogRequested(account.Id, deleteAfter);
        return deleteAfter;
    }

    /// <summary>
    /// Someone signed in to an account waiting to be deleted: it stays (design §3.14). False when it is already gone —
    /// deleted at this very moment.
    /// </summary>
    public async Task<bool> KeepAsync(Account account, CancellationToken ct)
    {
        if (account.DeleteAfter is null)
        {
            return true;
        }

        account.DeleteAfter = null;
        if (!(await users.UpdateAsync(account)).Succeeded)
        {
            return false;
        }

        if (outbox.Enabled && account.Email is { } email)
        {
            outbox.Add(IdentityEmails.DeletionCancelled(email));
            await db.SaveChangesAsync(ct);
        }

        LogKept(account.Id);
        return true;
    }

    /// <summary>
    /// Deletes a profile and everything of it, now, within the caller's transaction (which holds the account): it
    /// leaves its tables, each module purges, and its public ID is retired.
    /// </summary>
    public async Task DeleteProfileAsync(Profile profile, CancellationToken ct)
    {
        foreach (var module in modules)
        {
            await module.WithdrawAsync([profile.Id], ct);
        }

        await PurgeAsync([profile], ct);
        db.Profiles.Remove(profile);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Deletes the accounts whose wait is over, each in its own transaction, with all their profiles. Returns how many.
    /// </summary>
    public async Task<int> PurgeDueAsync(CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var due = await db.Users.AsNoTracking()
            .Where(account => account.DeleteAfter != null && account.DeleteAfter <= now)
            .OrderBy(account => account.DeleteAfter)
            .Select(account => account.Id)
            .Take(options.Value.DeletionBatch)
            .ToListAsync(ct);
        var deleted = 0;
        foreach (var id in due)
        {
            if (await PurgeAccountAsync(id, now, ct))
            {
                deleted++;
            }
        }

        return deleted;
    }

    private async Task<bool> PurgeAccountAsync(Guid accountId, DateTimeOffset now, CancellationToken ct)
    {
        db.ChangeTracker.Clear();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        // Held and read again under the lock: a sign-in at this moment either kept it already or waits for this.
        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM identity.accounts WHERE id = {accountId} FOR UPDATE", ct);
        var account = await db.Users.FirstOrDefaultAsync(a => a.Id == accountId, ct);
        if (account?.DeleteAfter is not { } deleteAfter || deleteAfter > now)
        {
            return false;
        }

        var profiles = await db.Profiles.Where(p => p.AccountId == accountId).ToListAsync(ct);
        foreach (var module in modules)
        {
            await module.WithdrawAsync([.. profiles.Select(p => p.Id)], ct);
        }

        await PurgeAsync(profiles, ct);
        await db.AuthAttempts.Where(attempt => attempt.AccountId == accountId).ExecuteDeleteAsync(ct);
        // Its profiles, their name history, its sign-in methods, roles and keys go with it (foreign keys cascade).
        db.Users.Remove(account);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        LogDeleted(accountId, profiles.Count);
        return true;
    }

    /// <summary>Each module deletes what it keeps of the profiles, then their public IDs are retired for good.</summary>
    private async Task PurgeAsync(IReadOnlyCollection<Profile> profiles, CancellationToken ct)
    {
        if (profiles.Count == 0)
        {
            return;
        }

        // Only for this transaction: it ends with it, whatever happens.
        await db.Database.ExecuteSqlAsync($"SELECT set_config({PurgeSetting}, 'profiles', true)", ct);
        var ids = profiles.Select(p => p.Id).ToList();
        foreach (var module in modules)
        {
            await module.PurgeAsync(ids, ct);
        }

        var now = clock.GetUtcNow();
        db.RetiredProfileIds.AddRange(profiles.Select(p => new RetiredProfileId { PublicId = p.PublicId, RetiredAt = now }));
    }

    private Uri? Link(string path) => app.Value.PublicUrl is { } hub ? new Uri(hub, path) : null;

    [LoggerMessage(Level = LogLevel.Information, Message = "Account {AccountId} asked to be deleted; it goes at {DeleteAfter}")]
    private partial void LogRequested(Guid accountId, DateTimeOffset deleteAfter);

    [LoggerMessage(Level = LogLevel.Information, Message = "Account {AccountId} signed in while waiting to be deleted: it stays")]
    private partial void LogKept(Guid accountId);

    [LoggerMessage(Level = LogLevel.Information, Message = "Deleted account {AccountId} and its {Profiles} profiles")]
    private partial void LogDeleted(Guid accountId, int profiles);
}

/// <summary>Deletes the accounts whose wait is over (Identity:DeletionCheckInterval), as <c>account-deletion</c>.</summary>
internal sealed partial class AccountDeletionWorker(
    IServiceScopeFactory scopes,
    IOptions<IdentityOptions> options,
    BackgroundWork work,
    ILogger<AccountDeletionWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(options.Value.DeletionCheckInterval);
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<AccountDeletion>().PurgeDueAsync(stoppingToken);
                work.Succeeded(BackgroundWork.AccountDeletion);
            }
            catch (Exception error) when (error is not OperationCanceledException)
            {
                work.Failed(BackgroundWork.AccountDeletion, error);
                LogFailed(error);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Deleting accounts whose wait is over failed")]
    private partial void LogFailed(Exception error);
}
