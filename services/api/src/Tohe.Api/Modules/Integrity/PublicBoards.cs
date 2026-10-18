using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Integrity;

/// <summary>A place on a public board.</summary>
/// <param name="Rank">1 for first; nobody shares a place — ties go to whoever got there first.</param>
/// <param name="Value">A run's best, or a room game's points.</param>
/// <param name="Hands">A room game's hands of the period; null on a run board.</param>
/// <param name="Verified">The server refereed or reproduced it; otherwise only checked, labelled "chưa xác minh".</param>
public sealed record PublicRow(
    int Rank,
    Guid ProfileId,
    string Name,
    string Avatar,
    string PublicId,
    double Value,
    int? Hands,
    int? Firsts,
    bool Verified);

/// <param name="Scope"><c>community</c> — the viewer's account's — or <c>server</c>.</param>
/// <param name="Hands">A room game: points of the period, with hands and firsts.</param>
/// <param name="Reproducible">The server can verify the game's results — refereed hands, or runs it replays. Without it
/// a run board of the server stays empty, and a community's takes checked runs.</param>
/// <param name="Listed">The viewer's profile is on public boards; when it is not, it never shows on one.</param>
/// <param name="Players">How many profiles the board has.</param>
/// <param name="Top">The first <see cref="PublicBoards.TopSize"/>.</param>
/// <param name="Me">The viewer's place, when it has one.</param>
/// <param name="Around">The viewer and two places on each side, when it is past the top.</param>
public sealed record PublicBoardView(
    string GameId,
    string Board,
    string Scope,
    string Period,
    DateTimeOffset? Since,
    bool Hands,
    bool Reproducible,
    bool Listed,
    int Players,
    IReadOnlyList<PublicRow> Top,
    PublicRow? Me,
    IReadOnlyList<PublicRow> Around);

/// <summary>
/// A community's board and the server's (ADR 0029), read from the results: only what each audience can trust, only
/// profiles on public boards of accounts that are not suspended. Hands count with two people at the table (D-11).
/// </summary>
internal sealed class PublicBoards(ToheDbContext db, IBoardAudience audience)
{
    public const int TopSize = 50;

    private const int Neighbours = 2;

    /// <summary>
    /// Games a verifier can reproduce a run of. None yet: ranked runs (D-10) add them, and from then on their community
    /// boards take verified runs only (D-16 Q4).
    /// </summary>
    public static bool CanReproduce(string gameId) => false;

    public async Task<(IReadOnlyList<PublicRow> Rows, bool Listed)> RankAsync(
        Guid viewer, string gameId, string board, bool hands, Guid? community, DateTimeOffset? since, CancellationToken ct)
    {
        var standings = hands
            ? await HandsAsync(gameId, since, ct)
            : await RunsAsync(gameId, board, community is not null && !CanReproduce(gameId), since, ct);
        var listed = await audience.ListedAsync([.. standings.Select(standing => standing.ProfileId).Append(viewer).Distinct()], ct);
        var rows = standings
            .Where(standing => listed.TryGetValue(standing.ProfileId, out var player) && (community is null || player.CommunityId == community))
            .Select((standing, index) =>
            {
                var player = listed[standing.ProfileId];
                return new PublicRow(
                    index + 1, player.Id, player.Name, player.Avatar, player.PublicId, standing.Value, standing.Hands, standing.Firsts, standing.Verified);
            })
            .ToList();
        return (rows, listed.ContainsKey(viewer));
    }

    public static PublicBoardView View(
        string gameId, string board, string scope, string period, DateTimeOffset? since, bool hands, bool listed, IReadOnlyList<PublicRow> rows, Guid viewer)
    {
        var me = rows.FirstOrDefault(row => row.ProfileId == viewer);
        var around = me is { Rank: > TopSize }
            ? rows.Skip(me.Rank - 1 - Neighbours).Take((2 * Neighbours) + 1).ToList()
            : [];
        return new PublicBoardView(
            gameId, board, scope, period, since, hands, hands || CanReproduce(gameId), listed, rows.Count, [.. rows.Take(TopSize)], me, around);
    }

    /// <summary>Each profile's best run: verified — and checked on a community board, for a game nothing can replay yet.</summary>
    private async Task<List<Standing>> RunsAsync(string gameId, string board, bool takeChecked, DateTimeOffset? since, CancellationToken ct)
    {
        var best = await db.IntegrityResults.AsNoTracking()
            .Where(result => result.Kind == ResultKind.Run && result.GameId == gameId && result.Board == board && result.Public
                && (result.Level == TrustLevel.Verified || (takeChecked && result.Level == TrustLevel.Checked))
                && (since == null || result.At >= since))
            .GroupBy(result => result.ProfileId)
            .Select(group => group.OrderByDescending(result => result.Value).ThenBy(result => result.At).First())
            .ToListAsync(ct);
        return
        [
            .. best
                .OrderByDescending(result => result.Value)
                .ThenBy(result => result.At)
                .Select(result => new Standing(result.ProfileId, result.Value, null, null, result.Level == TrustLevel.Verified)),
        ];
    }

    /// <summary>Each profile's points of verified hands with two people at the table or more.</summary>
    private async Task<List<Standing>> HandsAsync(string gameId, DateTimeOffset? since, CancellationToken ct)
    {
        var sums = await db.IntegrityResults.AsNoTracking()
            .Where(result => result.Kind == ResultKind.Hand && result.GameId == gameId && result.Public
                && result.Level == TrustLevel.Verified && (since == null || result.At >= since))
            .GroupBy(result => result.ProfileId)
            .Select(group => new
            {
                ProfileId = group.Key,
                Points = group.Sum(result => result.Value),
                Hands = group.Count(),
                Firsts = group.Count(result => result.Place == 0),
                Last = group.Max(result => result.At),
            })
            .ToListAsync(ct);
        return
        [
            .. sums
                .OrderByDescending(row => row.Points)
                .ThenByDescending(row => row.Firsts)
                .ThenBy(row => row.Last)
                .Select(row => new Standing(row.ProfileId, row.Points, row.Hands, row.Firsts, true)),
        ];
    }

    private sealed record Standing(Guid ProfileId, double Value, int? Hands, int? Firsts, bool Verified);
}
