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
/// and signing in to it before it goes keeps it — then an admin deletes it for good with all its profiles (ADR 0038):
/// nothing deletes an account by itself while the law's deadlines are not known.
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
    /// hears when and how to keep it. Returns when its wait ends: after that, an admin deletes it (ADR 0038).
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
                outbox.Add(IdentityEmails.DeletionScheduled(email, deleteAfter, Link(HubPaths.Welcome)));
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
    /// An admin deletes for good an account whose wait is over, with all its profiles (ADR 0038) — within the caller's
    /// transaction, which also writes the audit entry. The account's row is locked and read again: a sign-in at this
    /// moment either kept it already, or waits for this and finds it gone.
    /// </summary>
    public async Task<AccountDeletionOutcome> DeleteAsync(Guid accountId, DateTimeOffset now, CancellationToken ct)
    {
        if (db.Database.CurrentTransaction is null)
        {
            throw new InvalidOperationException("Deleting an account needs the caller's transaction.");
        }

        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM identity.accounts WHERE id = {accountId} FOR UPDATE", ct);
        var account = await db.Users.FirstOrDefaultAsync(a => a.Id == accountId, ct);
        if (account is null)
        {
            return new AccountDeletionOutcome(AccountDeletionState.NotFound, 0);
        }

        // Read again from the database, not the copy the caller may have loaded before the lock.
        await db.Entry(account).ReloadAsync(ct);
        if (account.DeleteAfter is not { } deleteAfter)
        {
            return new AccountDeletionOutcome(AccountDeletionState.NotRequested, 0);
        }

        if (deleteAfter > now)
        {
            return new AccountDeletionOutcome(AccountDeletionState.NotDue, 0);
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
        LogDeleted(accountId, profiles.Count);
        return new AccountDeletionOutcome(AccountDeletionState.Deleted, profiles.Count);
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

    [LoggerMessage(Level = LogLevel.Information, Message = "Account {AccountId} asked to be deleted; an admin may delete it after {DeleteAfter}")]
    private partial void LogRequested(Guid accountId, DateTimeOffset deleteAfter);

    [LoggerMessage(Level = LogLevel.Information, Message = "Account {AccountId} signed in while waiting to be deleted: it stays")]
    private partial void LogKept(Guid accountId);

    [LoggerMessage(Level = LogLevel.Information, Message = "Deleted account {AccountId} and its {Profiles} profiles")]
    private partial void LogDeleted(Guid accountId, int profiles);
}

/// <summary>What an admin's deletion found (ADR 0038).</summary>
internal enum AccountDeletionState
{
    Deleted,
    NotFound,

    /// <summary>Its owner never asked, or signed in since and kept it.</summary>
    NotRequested,

    /// <summary>Its seven days are not over: its owner may still keep it.</summary>
    NotDue,
}

/// <param name="Profiles">The profiles deleted with it.</param>
internal sealed record AccountDeletionOutcome(AccountDeletionState State, int Profiles);
