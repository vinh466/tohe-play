using Microsoft.EntityFrameworkCore;
using Npgsql;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Registry;

namespace Tohe.Api.Modules.Links;

/// <summary>What a share link resolves to (ADR 0044), in the API: <c>ok</c>, <c>expired</c>, <c>revoked</c>, <c>used_up</c>, <c>unknown</c>.</summary>
public static class LinkStates
{
    public const string Ok = "ok";
    public const string Expired = "expired";
    public const string Revoked = "revoked";
    public const string UsedUp = "used_up";
    public const string Unknown = "unknown";
}

/// <summary>A share link's counts as its maker sees them (ADR 0044).</summary>
/// <param name="AccountsMade">Only from three upward, so a link sent to one friend never tells that this friend signed
/// up; null below that.</param>
public sealed record LinkCounts(int Opened, int Played, int? AccountsMade);

/// <summary>A share link as its maker sees it (ADR 0044).</summary>
/// <param name="Kind"><c>game</c> (or <c>entry</c>, from step I4).</param>
/// <param name="Level"><c>any</c>, <c>named</c> or <c>account</c>.</param>
/// <param name="State">What it resolves to now: <c>ok</c>, <c>expired</c>, <c>revoked</c> or <c>used_up</c>.</param>
public sealed record ShareLinkView(
    string Code,
    string Kind,
    string GameId,
    string GameVersion,
    string Level,
    string State,
    DateTimeOffset CreatedAt,
    DateTimeOffset ExpiresAt,
    int? MaxUses,
    int Uses,
    DateTimeOffset? RevokedAt,
    LinkCounts Counts);

/// <summary>
/// A share link resolved to a typed intent (ADR 0044): never a free path. For <c>unknown</c>, the state alone; for
/// <c>expired</c>, <c>revoked</c> and <c>used_up</c>, the kind and the game too, so the hub can offer the game's menu;
/// the maker's current name only for <c>ok</c>, and never a child's.
/// </summary>
/// <param name="Code">The code in its canonical form; empty when what was asked is no code.</param>
/// <param name="GameName">The game's name as the registry lists it now; null when it is not listed.</param>
public sealed record LinkIntent(
    string Code,
    string State,
    string? Kind = null,
    string? GameId = null,
    string? GameName = null,
    string? Level = null,
    string? MakerName = null);

/// <summary>A share link found by its code, with its maker as strangers may see it (null: the maker is gone).</summary>
internal sealed record ResolvedLink(ShareLink Link, ProfileStanding? Maker, string State);

/// <summary>Share links on the server (ADR 0044): finding, their state, uses and counts.</summary>
internal sealed class ShareLinks(ToheDbContext db, IProfileStandings standings, IRegistryGames games, TimeProvider clock)
{
    /// <summary>The maker sees "accounts made" only from this many upward.</summary>
    public const int AccountsMadeShownFrom = 3;

    /// <summary>A link's expiry when its maker chooses none: 30 days, in hours.</summary>
    public const int DefaultExpiresInHours = 30 * 24;

    /// <summary>The longest expiry a maker may choose: 90 days, in hours.</summary>
    public const int MaxExpiresInHours = 90 * 24;

    /// <summary>The largest maximum of uses a maker may set.</summary>
    public const int MaxUsesLimit = 1000;

    /// <summary>The links its maker sees at most, newest first.</summary>
    public const int MineLimit = 100;

    /// <summary>The link with this code — typed any way the codes are read — with its maker and its state; or null.</summary>
    public async Task<ResolvedLink?> ResolveAsync(string? input, CancellationToken ct)
    {
        if (!LinkCodes.TryNormalize(input, out var code)
            || await db.ShareLinks.AsNoTracking().FirstOrDefaultAsync(link => link.Code == code, ct) is not { } link)
        {
            return null;
        }

        var maker = await standings.FindAsync(link.MakerProfileId, ct);
        return new ResolvedLink(link, maker, StateOf(link, maker is null or { Silenced: true }, clock.GetUtcNow()));
    }

    /// <summary>
    /// What a link resolves to now: revoked — by its maker, the console, or while its maker's account is suspended or
    /// waiting to be deleted, or its maker is a child whose "play with others" is off — then expired, then used up.
    /// </summary>
    public static string StateOf(ShareLink link, bool makerStopped, DateTimeOffset now) =>
        link.RevokedAt is not null || makerStopped ? LinkStates.Revoked
        : link.ExpiresAt <= now ? LinkStates.Expired
        : link.MaxUses is { } max && link.Uses >= max ? LinkStates.UsedUp
        : LinkStates.Ok;

    /// <summary>The intent the hub reads (<see cref="LinkIntent"/>).</summary>
    public async Task<LinkIntent> IntentAsync(ResolvedLink? resolved, string? input, CancellationToken ct)
    {
        if (resolved is null)
        {
            return new LinkIntent(LinkCodes.TryNormalize(input, out var code) ? code : "", LinkStates.Unknown);
        }

        var (link, maker, state) = resolved;
        var game = await games.GetAsync(link.GameId, ct);
        var name = state == LinkStates.Ok && maker is { Child: false } ? maker.Name : null;
        return new LinkIntent(link.Code, state, LinkNames.Of(link.Kind), link.GameId, game?.Name, LinkNames.Of(link.Level), name);
    }

    /// <summary>
    /// Takes one use of the link, if it still opens: atomically, so two players at the same moment never take its last
    /// use twice. False when it was revoked, expired or used up meanwhile.
    /// </summary>
    public async Task<bool> TakeUseAsync(Guid linkId, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        return await db.ShareLinks
            .Where(link => link.Id == linkId
                && link.RevokedAt == null
                && link.ExpiresAt > now
                && (link.MaxUses == null || link.Uses < link.MaxUses))
            .ExecuteUpdateAsync(set => set.SetProperty(link => link.Uses, link => link.Uses + 1), ct) == 1;
    }

    /// <summary>Adds to the link's counts of today (UTC). A link deleted at this very moment counts nothing.</summary>
    public async Task CountAsync(Guid linkId, int opened, int played, int accountsMade, CancellationToken ct)
    {
        var day = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        try
        {
            await db.Database.ExecuteSqlAsync(
                $"""
                INSERT INTO links.share_link_days (link_id, day, opened, played, accounts_made)
                VALUES ({linkId}, {day}, {opened}, {played}, {accountsMade})
                ON CONFLICT (link_id, day) DO UPDATE SET
                    opened = share_link_days.opened + EXCLUDED.opened,
                    played = share_link_days.played + EXCLUDED.played,
                    accounts_made = share_link_days.accounts_made + EXCLUDED.accounts_made
                """,
                ct);
        }
        catch (PostgresException e) when (e.SqlState == PostgresErrorCodes.ForeignKeyViolation)
        {
            // Its maker was deleted, with its links, between finding it and counting.
        }
    }

    /// <summary>The maker's links, newest first, with their totals as the maker sees them.</summary>
    public async Task<IReadOnlyList<ShareLinkView>> MineAsync(Guid makerId, bool makerSilenced, CancellationToken ct)
    {
        var rows = await db.ShareLinks.AsNoTracking()
            .Where(link => link.MakerProfileId == makerId)
            .OrderByDescending(link => link.CreatedAt)
            .Take(MineLimit)
            .Select(link => new
            {
                Link = link,
                Opened = db.ShareLinkDays.Where(day => day.LinkId == link.Id).Sum(day => (int?)day.Opened) ?? 0,
                Played = db.ShareLinkDays.Where(day => day.LinkId == link.Id).Sum(day => (int?)day.Played) ?? 0,
                Made = db.ShareLinkDays.Where(day => day.LinkId == link.Id).Sum(day => (int?)day.AccountsMade) ?? 0,
            })
            .ToListAsync(ct);
        var now = clock.GetUtcNow();
        return [.. rows.Select(row => View(row.Link, row.Opened, row.Played, row.Made, makerSilenced, now))];
    }

    /// <summary>One link of the maker's, as the maker sees it.</summary>
    public async Task<ShareLinkView> ViewAsync(ShareLink link, bool makerSilenced, CancellationToken ct)
    {
        var totals = await db.ShareLinkDays.AsNoTracking()
            .Where(day => day.LinkId == link.Id)
            .GroupBy(day => day.LinkId)
            .Select(days => new { Opened = days.Sum(d => d.Opened), Played = days.Sum(d => d.Played), Made = days.Sum(d => d.AccountsMade) })
            .FirstOrDefaultAsync(ct);
        return View(link, totals?.Opened ?? 0, totals?.Played ?? 0, totals?.Made ?? 0, makerSilenced, clock.GetUtcNow());
    }

    /// <summary>The maker's own link — a session acts for its profile, never for a stranger's links.</summary>
    public Task<ShareLink?> MineAsync(Guid makerId, string? input, CancellationToken ct) =>
        LinkCodes.TryNormalize(input, out var code)
            ? db.ShareLinks.FirstOrDefaultAsync(link => link.Code == code && link.MakerProfileId == makerId, ct)
            : Task.FromResult<ShareLink?>(null);

    /// <summary>Links the profile made in the last 24 hours, revoked ones too.</summary>
    public Task<int> MadeTodayAsync(Guid makerId, CancellationToken ct)
    {
        var since = clock.GetUtcNow().AddDays(-1);
        return db.ShareLinks.CountAsync(link => link.MakerProfileId == makerId && link.CreatedAt > since, ct);
    }

    /// <summary>
    /// Holds the maker's links until the caller's transaction ends: a transaction-scoped advisory lock on the profile's
    /// id, so its count of the day and its new link are one step.
    /// </summary>
    public Task LockMakerAsync(Guid makerId, CancellationToken ct) =>
        db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({"links.make:" + makerId}, 0))", ct);

    /// <summary>
    /// The link saved with a fresh code, within the caller's transaction; drawn again when another link has it (40 bits:
    /// rarely, if ever) — back to a savepoint, as a failed statement ends the transaction otherwise.
    /// </summary>
    public async Task SaveNewAsync(ShareLink link, CancellationToken ct)
    {
        var transaction = db.Database.CurrentTransaction
            ?? throw new InvalidOperationException("A new link is saved in the caller's transaction.");
        for (var attempt = 0; ; attempt++)
        {
            link.Code = LinkCodes.New();
            db.ShareLinks.Add(link);
            await transaction.CreateSavepointAsync("new_link", ct);
            try
            {
                await db.SaveChangesAsync(ct);
                return;
            }
            catch (DbUpdateException e) when (attempt < 3
                && e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                await transaction.RollbackToSavepointAsync("new_link", ct);
                db.Entry(link).State = EntityState.Detached;
            }
        }
    }

    private static ShareLinkView View(ShareLink link, int opened, int played, int made, bool makerSilenced, DateTimeOffset now) => new(
        link.Code,
        LinkNames.Of(link.Kind),
        link.GameId,
        link.GameVersion,
        LinkNames.Of(link.Level),
        StateOf(link, makerSilenced, now),
        link.CreatedAt,
        link.ExpiresAt,
        link.MaxUses,
        link.Uses,
        link.RevokedAt,
        new LinkCounts(opened, played, made >= AccountsMadeShownFrom ? made : null));
}
