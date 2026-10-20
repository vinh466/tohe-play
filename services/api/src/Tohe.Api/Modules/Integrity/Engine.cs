using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Registry;

namespace Tohe.Api.Modules.Integrity;

/// <summary>A run as the device reported it; the same client id again is the same run, grown (ADR 0014).</summary>
public sealed record RunClaim(Guid ClientId, string GameId, string Board, double Value, bool Final, DateTimeOffset DeviceAt);

/// <summary>A seat of a finished hand: a person, with a profile and an account, or a bot, with neither.</summary>
/// <param name="Place">0 for first.</param>
public sealed record HandSeat(int Seat, Guid? ProfileId, Guid? AccountId, int Place, int Points);

/// <summary>
/// What Progress and Rooms hand the engine (ADR 0029). It adds to the caller's unit of work — results and decisions are
/// saved with what the caller saves, or not at all.
/// </summary>
public interface IResults
{
    /// <summary>Runs of one profile, in the order they came; each is decided once it is final.</summary>
    Task SubmitRunsAsync(Guid profileId, Guid accountId, IReadOnlyList<RunClaim> runs, CancellationToken ct);

    /// <summary>
    /// Runs a device profile played before it was brought into an account (ADR 0043), sent with that request: decided as
    /// any run, marked <see cref="IntegrityResult.DeviceEarned"/>, and in no public board's audience. Only that channel
    /// calls this.
    /// </summary>
    Task SubmitDeviceRunsAsync(Guid profileId, Guid accountId, IReadOnlyList<RunClaim> runs, CancellationToken ct);

    /// <summary>A hand the server refereed: verified for every person at the table.</summary>
    void SubmitHand(string gameId, Guid roomId, int hand, IReadOnlyList<HandSeat> seats, DateTimeOffset at);
}

/// <summary>
/// Decides how far each result can be trusted (ADR 0029), conservatively: only hard proof rejects, anything else that
/// looks wrong is held for a person, and a level a person set is never changed by the engine.
/// </summary>
internal sealed class IntegrityEngine(ToheDbContext db, IRegistryGames registry, TimeProvider clock) : IResults
{
    /// <summary>The board of a room game's hands.</summary>
    public const string HandsBoard = "hands";

    /// <summary>The rules below. A stricter or looser rule is a new version; decided results keep theirs.</summary>
    public const int RuleVersion = 1;

    /// <summary><c>PersonalJump</c>: a best this many times the profile's own best so far…</summary>
    public const double JumpFactor = 5;

    /// <summary>…once the profile has at least this many runs on the board: a beginner's first runs climb fast.</summary>
    public const int JumpHistory = 10;

    /// <summary><c>Rate</c>: more runs of a game than a person finishes in <see cref="RateWindow"/>.</summary>
    public const int RateLimit = 60;

    public static readonly TimeSpan RateWindow = TimeSpan.FromMinutes(10);

    private static readonly TrustLevel[] Counted = [TrustLevel.Reported, TrustLevel.Checked, TrustLevel.Verified];

    private readonly Dictionary<string, bool> _games = new(StringComparer.Ordinal);

    public static string RunSource(Guid profileId, Guid clientId) => $"run:{profileId:N}:{clientId:N}";

    /// <summary>
    /// Left to people: held or rejected, or decided by a person. The engine judges it no more, and a report of it again
    /// changes nothing — its value stays the one a person looks at, or looked at (ADR 0029).
    /// </summary>
    private static bool Settled(IntegrityResult result) =>
        result.DecidedBy is not null || result.Level is TrustLevel.Held or TrustLevel.Rejected;

    public Task SubmitRunsAsync(Guid profileId, Guid accountId, IReadOnlyList<RunClaim> runs, CancellationToken ct) =>
        SubmitAsync(profileId, accountId, runs, deviceEarned: false, ct);

    public Task SubmitDeviceRunsAsync(Guid profileId, Guid accountId, IReadOnlyList<RunClaim> runs, CancellationToken ct) =>
        SubmitAsync(profileId, accountId, runs, deviceEarned: true, ct);

    private async Task SubmitAsync(
        Guid profileId, Guid accountId, IReadOnlyList<RunClaim> runs, bool deviceEarned, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var sources = runs.Select(run => RunSource(profileId, run.ClientId)).Distinct().ToList();
        var known = await db.IntegrityResults
            .Where(result => sources.Contains(result.Source))
            .ToDictionaryAsync(result => result.Source, ct);
        // Runs of this request: the database cannot count them yet.
        var batch = new List<IntegrityResult>();
        foreach (var run in runs)
        {
            var source = RunSource(profileId, run.ClientId);
            var isNew = !known.TryGetValue(source, out var result);
            if (result is not null && deviceEarned)
            {
                // Touched by a device profile's upload: off public boards from now on, whatever else changes.
                result.DeviceEarned = true;
            }

            if (result is null)
            {
                result = new IntegrityResult
                {
                    Kind = ResultKind.Run,
                    ProfileId = profileId,
                    AccountId = accountId,
                    GameId = run.GameId,
                    Board = run.Board,
                    Value = run.Value,
                    Source = source,
                    Final = run.Final,
                    Level = TrustLevel.Reported,
                    At = now,
                    DeviceAt = run.DeviceAt,
                    RuleVersion = RuleVersion,
                    DeviceEarned = deviceEarned,
                };
                db.IntegrityResults.Add(result);
                known[source] = result;
            }
            else if (!Settled(result) && (run.Value > result.Value || (run.Final && !result.Final)))
            {
                // A long run grows, then ends; its value only rises (ADR 0014).
                if (run.Value > result.Value)
                {
                    result.Value = run.Value;
                    result.At = now;
                    result.DeviceAt = run.DeviceAt;
                }

                result.Final |= run.Final;
            }
            else
            {
                continue;
            }

            if (!batch.Contains(result))
            {
                batch.Add(result);
            }

            if (!result.Final)
            {
                if (isNew)
                {
                    Log(result, null, TrustLevel.Reported, "in_progress", null, now);
                }

                continue;
            }

            // A person's decision stands, and only a person releases what the engine held: automation only hides.
            if (!Settled(result))
            {
                var (level, reason, details) = await JudgeRunAsync(result, batch, now, TrustLevel.Checked, deviceRun: deviceEarned, ct);
                Move(result, isNew ? null : result.Level, level, reason, details, now, isNew);
            }
        }
    }

    public void SubmitHand(string gameId, Guid roomId, int hand, IReadOnlyList<HandSeat> seats, DateTimeOffset at)
    {
        // RoomVerifier: the server dealt and refereed the hand. With fewer than two people it is not comparable (D-11).
        var people = seats.Count(seat => seat.ProfileId is not null);
        var details = people < 2 ? new { people } : null;
        foreach (var seat in seats)
        {
            if (seat is not { ProfileId: { } profileId, AccountId: { } accountId })
            {
                continue;
            }

            var result = new IntegrityResult
            {
                Kind = ResultKind.Hand,
                ProfileId = profileId,
                AccountId = accountId,
                GameId = gameId,
                Board = HandsBoard,
                Value = seat.Points,
                Place = seat.Place,
                Source = $"hand:{roomId:N}:{hand}:{seat.Seat}",
                Final = true,
                Level = TrustLevel.Verified,
                Public = people >= 2,
                At = at,
                RuleVersion = RuleVersion,
            };
            db.IntegrityResults.Add(result);
            Log(result, null, TrustLevel.Verified, "refereed", details, at);
        }
    }

    /// <summary>
    /// A ranked run the server replayed to the score it claimed (ADR 0030): verified, unless a signal fires as for any
    /// run — a replay proves the moves are legal, not that a person played them. Added to the caller's unit of work.
    /// </summary>
    public async Task<IntegrityResult> AddReplayedAsync(RankedRun ranked, double score, DateTimeOffset at, CancellationToken ct)
    {
        var result = AddRanked(ranked, score, at);
        var (level, reason, details) = await JudgeRunAsync(result, [result], at, TrustLevel.Verified, deviceRun: false, ct);
        result.Level = level;
        Log(result, null, level, reason, details, at);
        return result;
    }

    /// <summary>A ranked run its replay refused — hard proof (rejected), or not like a person (held) — and why.</summary>
    public IntegrityResult AddRefused(RankedRun ranked, double score, TrustLevel level, string reason, object details, DateTimeOffset at)
    {
        var result = AddRanked(ranked, score, at);
        result.Level = level;
        Log(result, null, level, reason, details, at);
        return result;
    }

    private IntegrityResult AddRanked(RankedRun ranked, double score, DateTimeOffset at)
    {
        var result = new IntegrityResult
        {
            Kind = ResultKind.Run,
            ProfileId = ranked.ProfileId,
            AccountId = ranked.AccountId,
            GameId = ranked.GameId,
            Board = ranked.Board,
            Value = score,
            Source = $"ranked:{ranked.Id:N}",
            Final = true,
            Level = TrustLevel.Reported,
            At = at,
            RuleVersion = RuleVersion,
        };
        db.IntegrityResults.Add(result);
        return result;
    }

    /// <summary>
    /// The rules of version 1 for a final run: <c>Bounds</c> — a game the registry knows; then, only for a run that
    /// would move a board (a best of the week), <c>PersonalJump</c> and <c>Rate</c>. A run that passes gets
    /// <paramref name="passed"/>: checked for what a device reported, verified for what the server replayed.
    /// </summary>
    /// <param name="deviceRun">A device profile's run brought into an account (ADR 0043). It arrives with the others, long
    /// after it was played, so how fast they arrive says nothing of play: <c>Rate</c> does not look at it. A run played
    /// in the account is judged against the account's own runs only: a device profile's best neither hides it nor raises
    /// the bar of <c>PersonalJump</c>, and its runs count for no rate.</param>
    private async Task<(TrustLevel Level, string Reason, object? Details)> JudgeRunAsync(
        IntegrityResult run, List<IntegrityResult> batch, DateTimeOffset now, TrustLevel passed, bool deviceRun, CancellationToken ct)
    {
        var pass = (passed, passed == TrustLevel.Verified ? "replayed" : "checked", (object?)null);
        if (!_games.TryGetValue(run.GameId, out var knownGame))
        {
            _games[run.GameId] = knownGame = await registry.KnowsAsync(run.GameId, ct);
        }

        if (!knownGame)
        {
            return (TrustLevel.Rejected, "unknown_game", null);
        }

        var others = batch.Where(result => !ReferenceEquals(result, run)).Select(result => result.Source).ToList();
        var earlier = db.IntegrityResults.AsNoTracking().Where(result =>
            result.ProfileId == run.ProfileId && result.Kind == ResultKind.Run && result.GameId == run.GameId
            && result.Board == run.Board && result.Final && Counted.Contains(result.Level)
            && result.Source != run.Source && !others.Contains(result.Source)
            && (deviceRun || !result.DeviceEarned));
        var mine = batch.Where(result =>
            !ReferenceEquals(result, run) && result.Final && result.GameId == run.GameId && result.Board == run.Board
            && Counted.Contains(result.Level) && (deviceRun || !result.DeviceEarned)).ToList();

        var week = Weeks.StartOf(now);
        var weekBest = Max(await earlier.Where(result => result.At >= week).MaxAsync(result => (double?)result.Value, ct),
            mine.Where(result => result.At >= week).Select(result => (double?)result.Value).Max());
        if (weekBest is { } best && run.Value <= best)
        {
            // It moves no board: nothing more to look at.
            return pass;
        }

        var allBest = Max(await earlier.MaxAsync(result => (double?)result.Value, ct), mine.Select(result => (double?)result.Value).Max());
        var history = await earlier.CountAsync(ct) + mine.Count;
        if (history >= JumpHistory && allBest is > 0 && run.Value > allBest.Value * JumpFactor)
        {
            return (TrustLevel.Held, "personal_jump", new { previousBest = allBest, runs = history });
        }

        if (deviceRun)
        {
            return pass;
        }

        // A device profile's upload is not play: its runs count for no rate of the runs that follow.
        var since = now - RateWindow;
        var recent = await db.IntegrityResults.AsNoTracking().CountAsync(
            result => result.ProfileId == run.ProfileId && result.Kind == ResultKind.Run && result.GameId == run.GameId
                && result.At >= since && !result.DeviceEarned && !others.Contains(result.Source) && result.Source != run.Source,
            ct) + batch.Count(result => result.GameId == run.GameId && !result.DeviceEarned);
        if (recent > RateLimit)
        {
            return (TrustLevel.Held, "rate", new { runs = recent, minutes = RateWindow.TotalMinutes });
        }

        return pass;
    }

    private void Move(IntegrityResult result, TrustLevel? from, TrustLevel to, string reason, object? details, DateTimeOffset at, bool first)
    {
        if (!first && from == to)
        {
            return;
        }

        result.Level = to;
        result.RuleVersion = RuleVersion;
        Log(result, from, to, reason, details, at);
    }

    private void Log(IntegrityResult result, TrustLevel? from, TrustLevel to, string reason, object? details, DateTimeOffset at) =>
        db.IntegrityDecisions.Add(new IntegrityDecision
        {
            Result = result,
            From = from,
            To = to,
            Reason = reason,
            Details = details is null ? null : JsonSerializer.Serialize(details, JsonSerializerOptions.Web),
            RuleVersion = RuleVersion,
            At = at,
        });

    private static double? Max(double? a, double? b) => a is null ? b : b is null ? a : Math.Max(a.Value, b.Value);
}
