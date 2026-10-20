using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Links;

/// <summary>
/// A share link's maker through its life (ADR 0044): deleted — on its device, by its owner, with its account, or cleaned
/// up after 90 days — its links and their counts go with it; merged into another profile, its links move there;
/// moved to another device, nothing changes (the same id). And the accounts made from a link, which Identity reports.
/// </summary>
internal sealed class LinksProfileData(ToheDbContext db, ShareLinks links) : IProfileData, IProfileMoves, IEntrySignUps
{
    /// <summary>Nothing to stop at once: a suspended or leaving account's links already resolve as revoked.</summary>
    public Task WithdrawAsync(IReadOnlyCollection<Guid> profileIds, CancellationToken ct) => Task.CompletedTask;

    /// <summary>Their links, and the links' counts by the foreign key.</summary>
    public Task PurgeAsync(IReadOnlyCollection<Guid> profileIds, CancellationToken ct) =>
        db.ShareLinks.Where(link => profileIds.Contains(link.MakerProfileId)).ExecuteDeleteAsync(ct);

    /// <summary>The device profile is now the account's, with the same id: its links stay its own.</summary>
    public Task AdoptedAsync(Guid profileId, Guid accountId, CancellationToken ct) => Task.CompletedTask;

    /// <summary>The device profile was merged into <paramref name="to"/>: its links are the target's now.</summary>
    public Task MergedAsync(Guid from, Guid to, Guid accountId, CancellationToken ct) =>
        db.ShareLinks.Where(link => link.MakerProfileId == from)
            .ExecuteUpdateAsync(set => set.SetProperty(link => link.MakerProfileId, to), ct);

    /// <summary>Counted once, as the request that made the account says; a code that names no link counts nothing.</summary>
    public async Task AccountMadeAsync(string code, CancellationToken ct)
    {
        if (!LinkCodes.TryNormalize(code, out var normalized))
        {
            return;
        }

        var id = await db.ShareLinks.AsNoTracking()
            .Where(link => link.Code == normalized)
            .Select(link => (Guid?)link.Id)
            .FirstOrDefaultAsync(ct);
        if (id is { } linkId)
        {
            await links.CountAsync(linkId, opened: 0, played: 0, accountsMade: 1, ct);
        }
    }
}
