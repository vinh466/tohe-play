using System.Text.Json;
using Jint;
using Jint.Native;
using Jint.Runtime;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Rooms;

namespace Tohe.Api.Modules.Integrity;

/// <summary>The engine's settings: <c>Integrity:*</c>.</summary>
public sealed class IntegrityOptions
{
    public const string Section = "Integrity";

    /// <summary>Replay ranked runs in the background (ADR 0030); tests switch it off and replay by hand.</summary>
    public bool Replays { get; set; } = true;

    /// <summary>How often the replays look for runs handed in.</summary>
    public TimeSpan ReplayInterval { get; set; } = TimeSpan.FromSeconds(5);
}

/// <summary>What a verify module's <c>replay</c> answered: a score, or why a move was not legal.</summary>
internal sealed record ReplayOutcome(double? Score, bool Over, string? Error);

/// <summary>
/// A game's verify module (ADR 0030) in Jint, one engine per replay: like a rules module (ADR 0016), its code comes
/// from the reviewed, immutable game builds, so the limits contain bugs, not attackers; <c>Math.random</c> and
/// <c>Date.now</c> throw.
/// </summary>
internal sealed class VerifyHost
{
    private readonly Engine _engine;
    private readonly JsValue _replay;

    public VerifyHost(string source, TimeSpan timeout)
    {
        _engine = new Engine(options => options
            .Strict()
            .TimeoutInterval(timeout)
            .LimitRecursion(512)
            .LimitMemory(2_000_000_000));
        _engine.Execute("""
            Math.random = function () { throw new Error('Math.random is not allowed in a verify module'); };
            Date.now = function () { throw new Error('Date.now is not allowed in a verify module'); };
            """);
        _engine.Modules.Add("verify", source);
        _engine.Modules.Add("bridge", """
            import { verify } from 'verify';
            export function replay(seed, moves) {
              const out = verify.replay({ seed, moves: JSON.parse(moves) });
              return JSON.stringify(out === undefined ? null : out);
            }
            """);
        _replay = _engine.Modules.Import("bridge").Get("replay");
    }

    public ReplayOutcome Replay(int seed, string moves)
    {
        string answer;
        try
        {
            answer = _engine.Invoke(_replay, seed, moves).AsString();
        }
        catch (Exception exception) when (exception is JavaScriptException or ExecutionCanceledException or TimeoutException
                                              or MemoryLimitExceededException or RecursionDepthOverflowException
                                              or StatementsCountOverflowException)
        {
            throw new VerifyException($"verify.replay failed: {exception.Message}", exception);
        }

        using var document = JsonDocument.Parse(answer);
        var root = document.RootElement;
        if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("error", out var error))
        {
            return new ReplayOutcome(null, false, error.ToString());
        }

        if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("score", out var score) && score.ValueKind == JsonValueKind.Number)
        {
            return new ReplayOutcome(score.GetDouble(), root.TryGetProperty("over", out var over) && over.ValueKind == JsonValueKind.True, null);
        }

        throw new VerifyException($"verify.replay answered neither a score nor an error: {answer[..Math.Min(answer.Length, 200)]}", null);
    }
}

internal sealed class VerifyException(string message, Exception? inner) : Exception(message, inner);

/// <summary>
/// Replays the ranked runs handed in (ADR 0030), oldest first, with the verify module of the build that started each,
/// and records each as a result in the engine: the same score is verified — unless a signal fires — another score or a
/// move that is not legal is rejected, a run faster than a person is held.
/// </summary>
internal sealed partial class RankedReplays(
    ToheDbContext db, RulesSource modules, IntegrityEngine engine, TimeProvider clock, ILogger<RankedReplays> logger)
{
    private const int Batch = 10;

    /// <summary>Replays that could not run before a run is held for a person.</summary>
    public const int MaxAttempts = 5;

    public static readonly TimeSpan Timeout = TimeSpan.FromSeconds(10);

    public async Task<int> RunAsync(CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var stale = now - RankedRuns.Lifetime;
        await db.RankedRuns
            .Where(run => run.State == RankedRunState.Open && run.StartedAt < stale)
            .ExecuteUpdateAsync(s => s.SetProperty(run => run.State, RankedRunState.Closed), ct);

        var runs = await db.RankedRuns
            .Where(run => run.State == RankedRunState.Submitted)
            .OrderBy(run => run.FinishedAt)
            .Take(Batch)
            .ToListAsync(ct);
        foreach (var run in runs)
        {
            await ReplayAsync(run, ct);
        }

        return runs.Count;
    }

    private async Task ReplayAsync(RankedRun run, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var finished = run.FinishedAt ?? now;
        string source;
        try
        {
            source = await modules.GetAsync($"{run.GamePath}{run.Verify}", ct);
        }
        catch (HttpRequestException error)
        {
            run.Attempts++;
            LogUnreachable(run.Id, run.Attempts, error);
            if (run.Attempts >= MaxAttempts)
            {
                Decide(run, engine.AddRefused(run, run.Claimed ?? 0, TrustLevel.Held, "replay_unavailable", new { attempts = run.Attempts }, finished));
            }

            await db.SaveChangesAsync(ct);
            return;
        }

        ReplayOutcome outcome;
        try
        {
            outcome = new VerifyHost(source, Timeout).Replay(run.Seed, run.Moves ?? "[]");
        }
        catch (VerifyException error)
        {
            // The module broke on the run: no proof either way, so a person looks.
            Decide(run, engine.AddRefused(run, run.Claimed ?? 0, TrustLevel.Held, "replay_failed", new { error = error.Message }, finished));
            await db.SaveChangesAsync(ct);
            return;
        }

        var claimed = run.Claimed ?? 0;
        var seconds = (finished - run.StartedAt).TotalSeconds;
        var needed = run.MoveCount * run.MinMsPerMove / 1000.0;
        run.Replayed = outcome.Score;
        IntegrityResult result;
        if (outcome.Error is { } illegal)
        {
            result = engine.AddRefused(run, claimed, TrustLevel.Rejected, "illegal_move", new { error = illegal }, finished);
        }
        else if (outcome.Score != claimed)
        {
            result = engine.AddRefused(run, claimed, TrustLevel.Rejected, "replay_mismatch", new { claimed, replayed = outcome.Score }, finished);
        }
        else if (seconds < needed)
        {
            result = engine.AddRefused(
                run, claimed, TrustLevel.Held, "too_fast", new { moves = run.MoveCount, seconds = Math.Round(seconds, 1), needed }, finished);
        }
        else
        {
            result = await engine.AddReplayedAsync(run, claimed, finished, ct);
        }

        Decide(run, result);
        await db.SaveChangesAsync(ct);
    }

    private static void Decide(RankedRun run, IntegrityResult result)
    {
        run.State = RankedRunState.Decided;
        run.Result = result;
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Ranked run {Id}: its verify module is out of reach (attempt {Attempts})")]
    private partial void LogUnreachable(Guid id, int attempts, Exception error);
}

/// <summary>Runs <see cref="RankedReplays"/> every <see cref="IntegrityOptions.ReplayInterval"/>.</summary>
internal sealed partial class RankedReplayWorker(
    IServiceScopeFactory scopes,
    IOptions<IntegrityOptions> options,
    BackgroundWork work,
    ILogger<RankedReplayWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(options.Value.ReplayInterval);
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<RankedReplays>().RunAsync(stoppingToken);
                work.Succeeded(BackgroundWork.RankedReplays);
            }
            catch (Exception error) when (error is not OperationCanceledException)
            {
                work.Failed(BackgroundWork.RankedReplays, error);
                LogFailed(error);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Ranked replays failed; next try at the next interval")]
    private partial void LogFailed(Exception error);
}
