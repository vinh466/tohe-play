using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Integrity;

/// <summary>A profile on a run board: its best of the period.</summary>
/// <param name="InProgress">The best is a run still going on (ADR 0014).</param>
/// <param name="UnderReview">The viewer's own best is held: only they see it, labelled "Đang được xem xét".</param>
public sealed record BoardRow(
    Guid ProfileId,
    string Name,
    string Avatar,
    double Value,
    DateTimeOffset At,
    bool InProgress,
    bool UnderReview);

/// <summary>A profile on a room game's board: its hands of the period.</summary>
public sealed record HandsRow(Guid ProfileId, string Name, string Avatar, int Hands, int Firsts, int Points);

/// <summary>The boards other modules show (ADR 0029): Rooms puts the account's hands into its statistics.</summary>
public interface IBoards
{
    /// <summary>The account's profiles by points since <paramref name="since"/> (all time when null), bots' tables too.</summary>
    Task<IReadOnlyList<HandsRow>> AccountHandsAsync(Guid accountId, string gameId, DateTimeOffset? since, CancellationToken ct);
}

/// <summary>
/// The account's boards: five profiles at most, read from the results themselves. They take every level but
/// rejected — and the viewer's own held results, which nobody else sees (ADR 0029).
/// </summary>
internal sealed class Boards(ToheDbContext db, IAccountProfiles profiles) : IBoards
{
    public async Task<IReadOnlyList<BoardRow>> AccountRunsAsync(
        Guid accountId, Guid viewer, string gameId, string board, DateTimeOffset? since, CancellationToken ct)
    {
        var best = await db.IntegrityResults.AsNoTracking()
            .Where(result => result.AccountId == accountId && result.Kind == ResultKind.Run
                && result.GameId == gameId && result.Board == board
                && (since == null || result.At >= since)
                && (result.Level == TrustLevel.Reported || result.Level == TrustLevel.Checked
                    || result.Level == TrustLevel.Verified
                    || (result.Level == TrustLevel.Held && result.ProfileId == viewer)))
            .GroupBy(result => result.ProfileId)
            .Select(group => group.OrderByDescending(result => result.Value).ThenBy(result => result.At).First())
            .ToListAsync(ct);
        var cards = (await profiles.ListAsync(accountId, ct)).ToDictionary(card => card.Id);
        return
        [
            .. best
                .Where(result => cards.ContainsKey(result.ProfileId))
                .Select(result => new BoardRow(
                    result.ProfileId,
                    cards[result.ProfileId].Name,
                    cards[result.ProfileId].Avatar,
                    result.Value,
                    result.At,
                    !result.Final,
                    result.Level == TrustLevel.Held))
                .OrderByDescending(row => row.Value)
                .ThenBy(row => row.At),
        ];
    }

    public async Task<IReadOnlyList<HandsRow>> AccountHandsAsync(Guid accountId, string gameId, DateTimeOffset? since, CancellationToken ct)
    {
        var sums = await db.IntegrityResults.AsNoTracking()
            .Where(result => result.AccountId == accountId && result.Kind == ResultKind.Hand && result.GameId == gameId
                && result.Level == TrustLevel.Verified && (since == null || result.At >= since))
            .GroupBy(result => result.ProfileId)
            .Select(group => new
            {
                ProfileId = group.Key,
                Hands = group.Count(),
                Firsts = group.Count(result => result.Place == 0),
                Points = group.Sum(result => result.Value),
            })
            .ToListAsync(ct);
        var cards = (await profiles.ListAsync(accountId, ct)).ToDictionary(card => card.Id);
        return
        [
            .. sums
                .Where(row => cards.ContainsKey(row.ProfileId))
                .Select(row => new HandsRow(
                    row.ProfileId, cards[row.ProfileId].Name, cards[row.ProfileId].Avatar, row.Hands, row.Firsts, (int)row.Points))
                .OrderByDescending(row => row.Points)
                .ThenByDescending(row => row.Firsts),
        ];
    }
}
