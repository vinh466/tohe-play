using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Tohe.Api.Modules.Integrity;

/// <summary>How far a result can be trusted, from its evidence — never from who sent it (ADR 0029).</summary>
public enum TrustLevel
{
    /// <summary>Only the device's number.</summary>
    Reported,

    /// <summary>Passed the plausibility rules.</summary>
    Checked,

    /// <summary>The server refereed it, or reproduced it.</summary>
    Verified,

    /// <summary>A signal fired: it waits for a person, and its player sees it is being looked at.</summary>
    Held,

    /// <summary>Hard proof that it is false, or a person decided.</summary>
    Rejected,
}

public enum ResultKind
{
    /// <summary>A one-player run's score, as the device reported it.</summary>
    Run,

    /// <summary>A seat's outcome of a hand the server refereed (ADR 0016).</summary>
    Hand,
}

/// <summary>A result a profile claims: a run's score, or its outcome of a finished hand.</summary>
public sealed class IntegrityResult
{
    public long Id { get; set; }

    public ResultKind Kind { get; set; }

    public Guid ProfileId { get; set; }

    public Guid AccountId { get; set; }

    public required string GameId { get; set; }

    /// <summary>A run's board; <see cref="IntegrityEngine.HandsBoard"/> for hands.</summary>
    public required string Board { get; set; }

    /// <summary>A run's score; a hand's points.</summary>
    public double Value { get; set; }

    /// <summary>A hand's place, 0 for first.</summary>
    public int? Place { get; set; }

    /// <summary>Where it came from, unique: <c>run:{profile}:{clientId}</c>, <c>hand:{room}:{hand}:{seat}</c>.</summary>
    public required string Source { get; set; }

    /// <summary>False while a long run goes on (ADR 0014): it is decided when it ends.</summary>
    public bool Final { get; set; }

    public TrustLevel Level { get; set; }

    /// <summary>False: the account's board only — a hand with fewer than two people at the table (D-11).</summary>
    public bool Public { get; set; } = true;

    /// <summary>Server time of its current value: the week it counts in, and who got there first.</summary>
    public DateTimeOffset At { get; set; }

    /// <summary>When the device says it happened: the player's own history, never a board.</summary>
    public DateTimeOffset? DeviceAt { get; set; }

    /// <summary>The version of the rules that decided its level.</summary>
    public int RuleVersion { get; set; }

    /// <summary>Who decided its level, when a person did (E3): the engine never overrules them.</summary>
    public string? DecidedBy { get; set; }
}

/// <summary>One change of a result's level, and why. Append-only: a trigger refuses to change or delete one.</summary>
public sealed class IntegrityDecision
{
    public long Id { get; set; }

    public long ResultId { get; set; }

    /// <summary>Set when the result is new, so both are saved together.</summary>
    public IntegrityResult? Result { get; set; }

    /// <summary>Null for a result's first level.</summary>
    public TrustLevel? From { get; set; }

    public TrustLevel To { get; set; }

    /// <summary>Why, as a code: <c>checked</c>, <c>refereed</c>, <c>personal_jump</c>, <c>rate</c>, <c>unknown_game</c>…</summary>
    public required string Reason { get; set; }

    /// <summary>What the signals saw, JSON.</summary>
    public string? Details { get; set; }

    public int RuleVersion { get; set; }

    /// <summary>Null for the engine; the person who decided otherwise.</summary>
    public string? Actor { get; set; }

    public DateTimeOffset At { get; set; }
}

internal sealed class IntegrityResultConfiguration : IEntityTypeConfiguration<IntegrityResult>
{
    public void Configure(EntityTypeBuilder<IntegrityResult> builder)
    {
        builder.ToTable("results", "integrity");
        // Named apart from rooms.results, whose key and index would otherwise share these names.
        builder.HasKey(result => result.Id).HasName("pk_integrity_results");
        builder.Property(result => result.Kind).HasConversion<string>().HasMaxLength(8);
        builder.Property(result => result.GameId).HasMaxLength(40);
        builder.Property(result => result.Board).HasMaxLength(40);
        builder.Property(result => result.Source).HasMaxLength(80);
        builder.Property(result => result.Level).HasConversion<string>().HasMaxLength(10);
        builder.Property(result => result.DecidedBy).HasMaxLength(320);
        builder.HasIndex(result => result.Source).IsUnique();
        // The account's board, a profile's history on a board, and how fast a profile sends results.
        builder.HasIndex(result => new { result.AccountId, result.GameId, result.Board, result.At });
        builder.HasIndex(result => new { result.ProfileId, result.GameId, result.Board, result.Value });
        builder.HasIndex(result => new { result.ProfileId, result.GameId, result.At })
            .HasDatabaseName("ix_integrity_results_profile_id_game_id_at");
        // Public boards: a game's board over a period.
        builder.HasIndex(result => new { result.GameId, result.Board, result.At })
            .HasDatabaseName("ix_integrity_results_game_id_board_at");
    }
}

internal sealed class IntegrityDecisionConfiguration : IEntityTypeConfiguration<IntegrityDecision>
{
    public void Configure(EntityTypeBuilder<IntegrityDecision> builder)
    {
        builder.ToTable("decisions", "integrity");
        builder.Property(decision => decision.From).HasConversion<string>().HasMaxLength(10);
        builder.Property(decision => decision.To).HasConversion<string>().HasMaxLength(10);
        builder.Property(decision => decision.Reason).HasMaxLength(40);
        builder.Property(decision => decision.Details).HasColumnType("jsonb");
        builder.Property(decision => decision.Actor).HasMaxLength(320);
        builder.HasIndex(decision => decision.ResultId);
        builder.HasOne(decision => decision.Result).WithMany().HasForeignKey(decision => decision.ResultId).OnDelete(DeleteBehavior.Restrict);
    }
}
