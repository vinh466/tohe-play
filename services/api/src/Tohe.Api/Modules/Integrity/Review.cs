using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Integrity;

/// <summary>What a person decides about a result (ADR 0029): the engine only hides, people decide.</summary>
public enum ReviewDecision
{
    /// <summary>A held result is fine: verified when the server refereed or replayed it, checked otherwise.</summary>
    Approve,

    /// <summary>It is false: on no board.</summary>
    Reject,

    /// <summary>Another look at a decided result: held again.</summary>
    Reopen,
}

/// <summary>A result as a list of the review shows it: what it claims, and where it stands.</summary>
/// <param name="Kind"><c>run</c> or <c>hand</c>.</param>
/// <param name="At">Server time of its value.</param>
/// <param name="Reason">Why it stands there: the signal that held it, <c>replay_mismatch</c>…, or a person's
/// <c>approved</c>, <c>rejected</c>, <c>reopened</c>.</param>
/// <param name="Since">When it got there.</param>
/// <param name="By">Who put it there, when a person did.</param>
/// <param name="Evidence"><c>device</c> (only the device's number), <c>refereed</c> (a room hand) or <c>replayed</c> (a
/// ranked run whose replay agreed).</param>
public sealed record ReviewSummary(
    long Id,
    string Kind,
    Guid ProfileId,
    string GameId,
    string Board,
    double Value,
    DateTimeOffset At,
    string Level,
    string Reason,
    DateTimeOffset Since,
    string? By,
    string Evidence);

/// <summary>Another result of the profile on the same board.</summary>
public sealed record RecentResult(long Id, double Value, string Level, DateTimeOffset At);

/// <summary>What the profile did on the board before, to compare with.</summary>
/// <param name="Best">Its best other finished result that counts — reported, checked or verified: what
/// <c>personal_jump</c> compares with.</param>
/// <param name="Runs">How many such results.</param>
/// <param name="Recent">Its latest other results on the board, at any level, newest first.</param>
public sealed record ReviewHistory(double? Best, int Runs, IReadOnlyList<RecentResult> Recent);

/// <summary>One change of a result's level.</summary>
/// <param name="Actor">Who decided, when a person did; null for the engine.</param>
public sealed record DecisionView(
    string? From, string To, string Reason, JsonElement? Details, int RuleVersion, string? Actor, DateTimeOffset At);

/// <summary>A ranked run's evidence (ADR 0030): what was handed in, and what its replay made of it.</summary>
/// <param name="Seconds">Between the start and the hand-in, by the server's clock.</param>
public sealed record RankedEvidence(int Moves, double Seconds, int MinMsPerMove, double? Claimed, double? Replayed);

/// <summary>A result as a person reviews it: where it stands, what the profile did before, the evidence, every decision.</summary>
public sealed record ReviewItem(
    ReviewSummary Result, ReviewHistory History, RankedEvidence? Ranked, IReadOnlyList<DecisionView> Decisions);

/// <summary>
/// The review of results (ADR 0029): the held ones, oldest first; the ones people decided about or the engine rejected,
/// latest first; and what a person decides. Every decision is logged with who made it, and the engine never judges a
/// result again once a person did.
/// </summary>
internal sealed class IntegrityReview(ToheDbContext db)
{
    public const int PageSize = 50;

    private const int RecentSize = 10;

    private static readonly TrustLevel[] Counted = [TrustLevel.Reported, TrustLevel.Checked, TrustLevel.Verified];

    /// <summary>Held results after <paramref name="after"/>, oldest first: the page and the cursor of the next.</summary>
    public async Task<(IReadOnlyList<ReviewSummary> Results, long? Next)> HeldAsync(long? after, CancellationToken ct)
    {
        var held = await db.IntegrityResults.AsNoTracking()
            .Where(result => result.Level == TrustLevel.Held && (after == null || result.Id > after))
            .OrderBy(result => result.Id)
            .Take(PageSize)
            .ToListAsync(ct);
        return (await SummariesAsync(held, ct), held.Count == PageSize ? held[^1].Id : null);
    }

    public async Task<int> HeldCountAsync(CancellationToken ct) =>
        await db.IntegrityResults.CountAsync(result => result.Level == TrustLevel.Held, ct);

    /// <summary>
    /// Results a person decided about or the engine rejected, the latest such decision first, before decision
    /// <paramref name="before"/>: the page and the cursor of the next. Where an old decision is found again, to reopen it.
    /// </summary>
    public async Task<(IReadOnlyList<ReviewSummary> Results, long? Next)> DecidedAsync(long? before, CancellationToken ct)
    {
        var latest = await db.IntegrityDecisions.AsNoTracking()
            .Where(decision => decision.Actor != null || decision.To == TrustLevel.Rejected)
            .GroupBy(decision => decision.ResultId)
            .Select(group => new { ResultId = group.Key, Last = group.Max(decision => decision.Id) })
            .Where(entry => before == null || entry.Last < before)
            .OrderByDescending(entry => entry.Last)
            .Take(PageSize)
            .ToListAsync(ct);
        var ids = latest.Select(entry => entry.ResultId).ToList();
        var results = await db.IntegrityResults.AsNoTracking()
            .Where(result => ids.Contains(result.Id))
            .ToDictionaryAsync(result => result.Id, ct);
        return (await SummariesAsync([.. ids.Select(id => results[id])], ct), latest.Count == PageSize ? latest[^1].Last : null);
    }

    public async Task<ReviewItem?> FindAsync(long id, CancellationToken ct)
    {
        if (await db.IntegrityResults.AsNoTracking().FirstOrDefaultAsync(result => result.Id == id, ct) is not { } result)
        {
            return null;
        }

        var decisions = await db.IntegrityDecisions.AsNoTracking()
            .Where(decision => decision.ResultId == id)
            .OrderBy(decision => decision.Id)
            .ToListAsync(ct);
        var ranked = (await RankedOfAsync([id], ct)).GetValueOrDefault(id);
        var board = db.IntegrityResults.AsNoTracking().Where(other =>
            other.ProfileId == result.ProfileId && other.GameId == result.GameId && other.Board == result.Board
            && other.Id != result.Id);
        var counted = board.Where(other => other.Final && Counted.Contains(other.Level));
        var recent = await board
            .OrderByDescending(other => other.At)
            .ThenByDescending(other => other.Id)
            .Take(RecentSize)
            .Select(other => new { other.Id, other.Value, other.Level, other.At })
            .ToListAsync(ct);
        return new ReviewItem(
            Summary(result, decisions.LastOrDefault(), ranked),
            new ReviewHistory(
                await counted.MaxAsync(other => (double?)other.Value, ct),
                await counted.CountAsync(ct),
                [.. recent.Select(other => new RecentResult(other.Id, other.Value, NameOf(other.Level), other.At))]),
            ranked is null
                ? null
                : new RankedEvidence(
                    ranked.MoveCount,
                    Math.Round(((ranked.FinishedAt ?? ranked.StartedAt) - ranked.StartedAt).TotalSeconds, 1),
                    ranked.MinMsPerMove,
                    ranked.Claimed,
                    ranked.Replayed),
            [.. decisions.Select(decision => new DecisionView(
                decision.From is { } from ? NameOf(from) : null,
                NameOf(decision.To),
                decision.Reason,
                Parse(decision.Details),
                decision.RuleVersion,
                decision.Actor,
                decision.At))]);
    }

    /// <summary>The account a result belongs to, so nobody decides about their own.</summary>
    public async Task<Guid?> AccountOfAsync(long id, CancellationToken ct) =>
        await db.IntegrityResults.Where(result => result.Id == id).Select(result => (Guid?)result.AccountId).FirstOrDefaultAsync(ct);

    /// <summary>
    /// A person's decision, in the caller's transaction: the levels before and after, or null when the result is not in a
    /// state the decision applies to — only a held result is approved, a rejected one is not rejected again, and only a
    /// decided one is reopened. The result's row stays locked until the transaction ends, so two people deciding at once
    /// decide one after the other.
    /// </summary>
    public async Task<(TrustLevel From, TrustLevel To)?> DecideAsync(
        long id, ReviewDecision decision, string actor, string? note, DateTimeOffset at, CancellationToken ct)
    {
        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM integrity.results WHERE id = {id} FOR UPDATE", ct);
        if (await db.IntegrityResults.FirstOrDefaultAsync(result => result.Id == id, ct) is not { } result)
        {
            return null;
        }

        var ranked = (await RankedOfAsync([id], ct)).GetValueOrDefault(id);
        TrustLevel? next = decision switch
        {
            ReviewDecision.Approve when result.Level == TrustLevel.Held =>
                EvidenceOf(result, ranked) == "device" ? TrustLevel.Checked : TrustLevel.Verified,
            ReviewDecision.Reject when result.Level != TrustLevel.Rejected => TrustLevel.Rejected,
            ReviewDecision.Reopen when result.Level is TrustLevel.Rejected or TrustLevel.Checked or TrustLevel.Verified => TrustLevel.Held,
            _ => null,
        };
        if (next is not { } to)
        {
            return null;
        }

        var from = result.Level;
        result.Level = to;
        result.DecidedBy = actor;
        db.IntegrityDecisions.Add(new IntegrityDecision
        {
            ResultId = result.Id,
            From = from,
            To = to,
            Reason = decision switch
            {
                ReviewDecision.Approve => "approved",
                ReviewDecision.Reject => "rejected",
                _ => "reopened",
            },
            Details = string.IsNullOrWhiteSpace(note) ? null : JsonSerializer.Serialize(new { note = note.Trim() }, JsonSerializerOptions.Web),
            // A person decided, not a rule: the result keeps the version that judged it last.
            RuleVersion = result.RuleVersion,
            Actor = actor,
            At = at,
        });
        return (from, to);
    }

    private async Task<IReadOnlyList<ReviewSummary>> SummariesAsync(IReadOnlyList<IntegrityResult> results, CancellationToken ct)
    {
        var ids = results.Select(result => result.Id).ToList();
        var last = (await db.IntegrityDecisions.AsNoTracking()
                .Where(decision => ids.Contains(decision.ResultId))
                .ToListAsync(ct))
            .GroupBy(decision => decision.ResultId)
            .ToDictionary(group => group.Key, group => group.MaxBy(decision => decision.Id)!);
        var ranked = await RankedOfAsync(ids, ct);
        return [.. results.Select(result => Summary(result, last.GetValueOrDefault(result.Id), ranked.GetValueOrDefault(result.Id)))];
    }

    /// <summary>The ranked runs behind these results, without their moves.</summary>
    private async Task<Dictionary<long, RankedFacts>> RankedOfAsync(IReadOnlyList<long> resultIds, CancellationToken ct) =>
        await db.RankedRuns.AsNoTracking()
            .Where(run => run.ResultId != null && resultIds.Contains(run.ResultId.Value))
            .Select(run => new RankedFacts(
                run.ResultId!.Value, run.MoveCount, run.StartedAt, run.FinishedAt, run.MinMsPerMove, run.Claimed, run.Replayed))
            .ToDictionaryAsync(run => run.ResultId, ct);

    private static ReviewSummary Summary(IntegrityResult result, IntegrityDecision? last, RankedFacts? ranked) => new(
        result.Id,
        result.Kind == ResultKind.Hand ? "hand" : "run",
        result.ProfileId,
        result.GameId,
        result.Board,
        result.Value,
        result.At,
        NameOf(result.Level),
        last?.Reason ?? "",
        last?.At ?? result.At,
        last?.Actor,
        EvidenceOf(result, ranked));

    private static string EvidenceOf(IntegrityResult result, RankedFacts? ranked) =>
        result.Kind == ResultKind.Hand ? "refereed"
        : ranked is { Replayed: { } replayed } && replayed == ranked.Claimed ? "replayed"
        : "device";

    private static string NameOf(TrustLevel level) => level.ToString().ToLowerInvariant();

    private static JsonElement? Parse(string? json)
    {
        if (json is null)
        {
            return null;
        }

        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }

    private sealed record RankedFacts(
        long ResultId, int MoveCount, DateTimeOffset StartedAt, DateTimeOffset? FinishedAt, int MinMsPerMove, double? Claimed, double? Replayed);
}
