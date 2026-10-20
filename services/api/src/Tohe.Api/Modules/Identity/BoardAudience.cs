using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Identity;

/// <summary>A profile on a public board as other modules may show it: a name, an avatar, an ID — never its account.</summary>
/// <param name="CommunityId">The community its account came with (ADR 0028), if any.</param>
public sealed record BoardPlayer(Guid Id, string Name, string Avatar, string PublicId, Guid? CommunityId);

/// <summary>
/// Who may appear on public boards (ADR 0029): profiles switched on and not hidden by a moderator, of accounts that are
/// neither suspended nor waiting to be deleted (ADR 0034).
/// </summary>
public interface IBoardAudience
{
    /// <summary>Of <paramref name="profileIds"/>, those on public boards.</summary>
    Task<IReadOnlyDictionary<Guid, BoardPlayer>> ListedAsync(IReadOnlyCollection<Guid> profileIds, CancellationToken ct);

    /// <summary>The community an account came with, if any.</summary>
    Task<Guid?> CommunityOfAsync(Guid accountId, CancellationToken ct);
}

internal sealed class BoardAudience(ToheDbContext db) : IBoardAudience
{
    public async Task<IReadOnlyDictionary<Guid, BoardPlayer>> ListedAsync(IReadOnlyCollection<Guid> profileIds, CancellationToken ct) =>
        await db.Profiles.AsNoTracking()
            .Where(profile => profileIds.Contains(profile.Id) && profile.OnPublicBoards && profile.HiddenFromBoardsAt == null)
            .Join(
                db.Users.Where(account => account.SuspendedAt == null && account.DeleteAfter == null),
                profile => profile.AccountId,
                account => (Guid?)account.Id,
                (profile, account) => new BoardPlayer(profile.Id, profile.Name, profile.Avatar, profile.PublicId!, account.CommunityId))
            .ToDictionaryAsync(player => player.Id, ct);

    public Task<Guid?> CommunityOfAsync(Guid accountId, CancellationToken ct) =>
        db.Users.AsNoTracking().Where(account => account.Id == accountId).Select(account => account.CommunityId).FirstOrDefaultAsync(ct);
}
