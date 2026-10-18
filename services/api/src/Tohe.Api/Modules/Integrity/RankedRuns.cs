using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Registry;

namespace Tohe.Api.Modules.Integrity;

public enum RankedRunState
{
    /// <summary>Dealt: the game plays it.</summary>
    Open,

    /// <summary>Handed in: it waits for its replay.</summary>
    Submitted,

    /// <summary>Replayed and decided: its result is in the engine.</summary>
    Decided,

    /// <summary>Never handed in: a newer run of the same game closed it, or it grew too old.</summary>
    Closed,
}

/// <summary>A ranked run (ADR 0030): the seed the server dealt, the build that plays it, the moves handed in.</summary>
public sealed class RankedRun
{
    public Guid Id { get; set; }

    public Guid ProfileId { get; set; }

    public Guid AccountId { get; set; }

    public required string GameId { get; set; }

    /// <summary>The build that started it, e.g. <c>merge-block/1.9.0/</c>: its verify module replays the run.</summary>
    public required string GamePath { get; set; }

    /// <summary>The verify module's path in that build.</summary>
    public required string Verify { get; set; }

    public required string Board { get; set; }

    public int MinMsPerMove { get; set; }

    public int MaxMoves { get; set; }

    public int Seed { get; set; }

    public RankedRunState State { get; set; }

    public DateTimeOffset StartedAt { get; set; }

    public DateTimeOffset? FinishedAt { get; set; }

    /// <summary>The moves handed in, a JSON array.</summary>
    public string? Moves { get; set; }

    public int MoveCount { get; set; }

    /// <summary>The score the game said it reached.</summary>
    public double? Claimed { get; set; }

    /// <summary>The score its replay reached.</summary>
    public double? Replayed { get; set; }

    /// <summary>Replays that could not run (the module out of reach): after a few, the run is held for a person.</summary>
    public int Attempts { get; set; }

    /// <summary>Its result in the engine, once decided.</summary>
    public long? ResultId { get; set; }

    public IntegrityResult? Result { get; set; }
}

internal sealed class RankedRunConfiguration : IEntityTypeConfiguration<RankedRun>
{
    public void Configure(EntityTypeBuilder<RankedRun> builder)
    {
        builder.ToTable("ranked_runs", "integrity");
        builder.Property(run => run.GameId).HasMaxLength(40);
        builder.Property(run => run.GamePath).HasMaxLength(200);
        builder.Property(run => run.Verify).HasMaxLength(200);
        builder.Property(run => run.Board).HasMaxLength(40);
        builder.Property(run => run.State).HasConversion<string>().HasMaxLength(10);
        builder.Property(run => run.Moves).HasColumnType("jsonb");
        builder.HasIndex(run => new { run.ProfileId, run.GameId, run.State });
        builder.HasIndex(run => new { run.State, run.FinishedAt });
        builder.HasOne(run => run.Result).WithMany().HasForeignKey(run => run.ResultId).OnDelete(DeleteBehavior.Restrict);
    }
}

/// <param name="Run">The run's id: the game hands its moves in under it.</param>
/// <param name="Seed">The seed to play the run from.</param>
public sealed record RankedRunView(string Run, int Seed);

public sealed record StartRankedRunRequest([Required, StringLength(40)] string GameId);

/// <param name="Moves">The moves, in order: a JSON array, at most the game's <c>ranked.maxMoves</c>.</param>
/// <param name="Score">The score the game says it reached.</param>
public sealed record FinishRankedRunRequest(JsonElement Moves, double Score);

/// <summary>Opens ranked runs and takes their moves in (ADR 0030); <see cref="RankedReplays"/> replays them.</summary>
internal sealed class RankedRuns(ToheDbContext db, TimeProvider clock)
{
    /// <summary>A run left open this long is closed: nobody plays one run for a month.</summary>
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(30);

    /// <summary>Runs a profile may start in a minute: a game asks once per new game.</summary>
    public const int StartsPerMinute = 20;

    /// <summary>A new run of <paramref name="game"/>, or null when the profile started too many just now.</summary>
    public async Task<RankedRun?> StartAsync(ActiveProfile profile, RegistryGame game, GameRanked ranked, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var minuteAgo = now.AddMinutes(-1);
        if (await db.RankedRuns.CountAsync(run => run.ProfileId == profile.Id && run.StartedAt > minuteAgo, ct) >= StartsPerMinute)
        {
            return null;
        }

        // One open run per profile and game: a new one closes the last, so nobody picks the best of many seeds.
        await db.RankedRuns
            .Where(run => run.ProfileId == profile.Id && run.GameId == game.Id && run.State == RankedRunState.Open)
            .ExecuteUpdateAsync(s => s.SetProperty(run => run.State, RankedRunState.Closed), ct);
        var started = new RankedRun
        {
            Id = Guid.CreateVersion7(now),
            ProfileId = profile.Id,
            AccountId = profile.AccountId,
            GameId = game.Id,
            GamePath = game.Path,
            Verify = ranked.Verify,
            Board = ranked.Board,
            MinMsPerMove = ranked.MinMsPerMove,
            MaxMoves = ranked.MaxMoves,
            Seed = RandomNumberGenerator.GetInt32(int.MaxValue),
            State = RankedRunState.Open,
            StartedAt = now,
        };
        db.RankedRuns.Add(started);
        await db.SaveChangesAsync(ct);
        return started;
    }

    /// <summary>Takes a run's moves in for its replay; null when taken, or the reason it is not.</summary>
    public async Task<string?> FinishAsync(Guid profileId, Guid id, JsonElement moves, double score, CancellationToken ct)
    {
        var run = await db.RankedRuns.FirstOrDefaultAsync(run => run.Id == id && run.ProfileId == profileId, ct);
        if (run is null)
        {
            return "not_found";
        }

        if (moves.ValueKind != JsonValueKind.Array)
        {
            return "moves_invalid";
        }

        if (!double.IsFinite(score))
        {
            return "score_invalid";
        }

        if (moves.GetArrayLength() > run.MaxMoves)
        {
            return "too_many_moves";
        }

        var given = moves.GetRawText();
        if (run.State is RankedRunState.Submitted or RankedRunState.Decided)
        {
            // The hub sends again when an answer was lost: the same moves are taken once.
            return run.Claimed == score && JsonElement.DeepEquals(JsonDocument.Parse(run.Moves ?? "[]").RootElement, moves)
                ? null
                : "run_finished";
        }

        var now = clock.GetUtcNow();
        if (run.State == RankedRunState.Closed || run.StartedAt + Lifetime < now)
        {
            return "run_closed";
        }

        run.Moves = given;
        run.MoveCount = moves.GetArrayLength();
        run.Claimed = score;
        run.FinishedAt = now;
        run.State = RankedRunState.Submitted;
        await db.SaveChangesAsync(ct);
        return null;
    }
}
