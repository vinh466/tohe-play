using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Tohe.Api.Modules.Progress;

/// <summary>
/// The latest save of one game for one profile (ADR 0005). The last write to reach the server wins; the version it
/// replaced is kept in <see cref="PreviousData"/> so one conflict can be undone.
/// </summary>
public sealed class SavedGame
{
    public Guid ProfileId { get; set; }

    public required string GameId { get; set; }

    /// <summary>The game's own JSON (at most 64 KB, the Game Contract's limit).</summary>
    public required string Data { get; set; }

    /// <summary>Server time of the last write; devices compare it to know whether they are behind.</summary>
    public DateTimeOffset UpdatedAt { get; set; }

    public string? PreviousData { get; set; }

    public DateTimeOffset? PreviousUpdatedAt { get; set; }
}

/// <summary>
/// One run, recorded by the device that played it. A long run is reported as it grows under one
/// <see cref="ClientId"/> and stays one row; <see cref="Final"/> turns true when it ends (ADR 0014).
/// </summary>
public sealed class ScoreEntry
{
    public long Id { get; set; }

    public Guid ProfileId { get; set; }

    public required string GameId { get; set; }

    public required string Board { get; set; }

    public double Value { get; set; }

    /// <summary>When the run ended, by the device's clock.</summary>
    public DateTimeOffset AchievedAt { get; set; }

    public DateTimeOffset RecordedAt { get; set; }

    /// <summary>Chosen by the device, so a score sent twice (retry after a lost response) is stored once.</summary>
    public Guid ClientId { get; set; }

    /// <summary>False while the run goes on.</summary>
    public bool Final { get; set; } = true;

    /// <summary>
    /// Earned by a device profile: it came with the request that brought one into an account (ADR 0043). Set by that
    /// channel only, never cleared.
    /// </summary>
    public bool DeviceEarned { get; set; }
}

internal sealed class SavedGameConfiguration : IEntityTypeConfiguration<SavedGame>
{
    public void Configure(EntityTypeBuilder<SavedGame> builder)
    {
        builder.ToTable("saves", "progress");
        builder.HasKey(save => new { save.ProfileId, save.GameId });
        builder.Property(save => save.GameId).HasMaxLength(40);
        builder.Property(save => save.Data).HasColumnType("jsonb");
        builder.Property(save => save.PreviousData).HasColumnType("jsonb");
    }
}

internal sealed class ScoreEntryConfiguration : IEntityTypeConfiguration<ScoreEntry>
{
    public void Configure(EntityTypeBuilder<ScoreEntry> builder)
    {
        builder.ToTable("scores", "progress");
        builder.Property(score => score.GameId).HasMaxLength(40);
        builder.Property(score => score.Board).HasMaxLength(40);
        builder.Property(score => score.Final).HasDefaultValue(true);
        builder.HasIndex(score => new { score.ProfileId, score.ClientId }).IsUnique();
        builder.HasIndex(score => new { score.GameId, score.Board, score.ProfileId });
    }
}
