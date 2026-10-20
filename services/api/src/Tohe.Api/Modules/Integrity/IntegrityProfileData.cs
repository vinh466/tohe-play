using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Integrity;

/// <summary>
/// A deleted profile's results on the boards go with it, each with its decisions, and so do its ranked runs (ADR 0034).
/// </summary>
internal sealed class IntegrityProfileData(ToheDbContext db) : IProfileData, IProfileMoves
{
    /// <summary>
    /// A device profile brought into an account (ADR 0043): its results now name the account — still marked as a device
    /// profile's, so never on a public board.
    /// </summary>
    public Task AdoptedAsync(Guid profileId, Guid accountId, CancellationToken ct) =>
        db.IntegrityResults.Where(result => result.ProfileId == profileId)
            .ExecuteUpdateAsync(set => set.SetProperty(r => r.AccountId, accountId), ct);

    /// <summary>A device profile merged into another: its results move there, marked as before.</summary>
    public Task MergedAsync(Guid from, Guid to, Guid accountId, CancellationToken ct) =>
        db.IntegrityResults.Where(result => result.ProfileId == from)
            .ExecuteUpdateAsync(set => set.SetProperty(r => r.ProfileId, to).SetProperty(r => r.AccountId, accountId), ct);

    /// <summary>
    /// Boards already leave the profiles out: the board audience lists no profile of an account waiting to be deleted,
    /// and a deleted profile is in no audience at all.
    /// </summary>
    public Task WithdrawAsync(IReadOnlyCollection<Guid> profileIds, CancellationToken ct) => Task.CompletedTask;

    public async Task PurgeAsync(IReadOnlyCollection<Guid> profileIds, CancellationToken ct)
    {
        await db.RankedRuns.Where(run => profileIds.Contains(run.ProfileId)).ExecuteDeleteAsync(ct);
        // A result's decisions go with it, by the foreign key: the append-only trigger lets a decision go only in the
        // purge's transaction, and only once its result is gone.
        await db.IntegrityResults.Where(result => profileIds.Contains(result.ProfileId)).ExecuteDeleteAsync(ct);
    }
}
