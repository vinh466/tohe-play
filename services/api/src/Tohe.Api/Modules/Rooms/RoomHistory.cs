using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Tohe.Api.Modules.Rooms;

/// <summary>
/// A finished hand: everything a replay needs besides its actions (in <see cref="RoomAction"/>), and who sat where.
/// Stored when the hand ends, so it outlives its room; the seed is only ever shown once the hand is over.
/// </summary>
public sealed class RoomHand
{
    public long Id { get; set; }

    public Guid RoomId { get; set; }

    public required string GameId { get; set; }

    /// <summary>The build that refereed it: its rules module replays it.</summary>
    public required string GameVersion { get; set; }

    public int Hand { get; set; }

    public int Seed { get; set; }

    /// <summary>The room's game options for this hand, JSON.</summary>
    public required string Options { get; set; }

    /// <summary>The carry the hand started with, JSON or null.</summary>
    public string? Carry { get; set; }

    /// <summary>Who sat at each of the rules module's seats, JSON: see <see cref="SeatRecord"/>.</summary>
    public required string Seats { get; set; }

    /// <summary>The rules module's result of the hand, JSON.</summary>
    public required string Result { get; set; }

    public DateTimeOffset FinishedAt { get; set; }
}

/// <summary>One seat's outcome of a finished hand: what statistics and leaderboards add up.</summary>
public sealed class RoomResult
{
    public long Id { get; set; }

    public Guid RoomId { get; set; }

    public required string GameId { get; set; }

    public int Hand { get; set; }

    /// <summary>The rules module's seat.</summary>
    public int Seat { get; set; }

    /// <summary>The person in the seat; null for a bot.</summary>
    public Guid? ProfileId { get; set; }

    public Guid? AccountId { get; set; }

    /// <summary>0 for the winner.</summary>
    public int Place { get; set; }

    public int Points { get; set; }

    public DateTimeOffset At { get; set; }
}

internal sealed class RoomHandConfiguration : IEntityTypeConfiguration<RoomHand>
{
    public void Configure(EntityTypeBuilder<RoomHand> builder)
    {
        builder.ToTable("hands", "rooms");
        builder.Property(hand => hand.GameId).HasMaxLength(40);
        builder.Property(hand => hand.GameVersion).HasMaxLength(64);
        builder.Property(hand => hand.Options).HasColumnType("jsonb");
        builder.Property(hand => hand.Carry).HasColumnType("jsonb");
        builder.Property(hand => hand.Seats).HasColumnType("jsonb");
        builder.Property(hand => hand.Result).HasColumnType("jsonb");
        builder.HasIndex(hand => new { hand.RoomId, hand.Hand }).IsUnique();
        builder.HasOne<Room>().WithMany().HasForeignKey(hand => hand.RoomId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class RoomResultConfiguration : IEntityTypeConfiguration<RoomResult>
{
    public void Configure(EntityTypeBuilder<RoomResult> builder)
    {
        builder.ToTable("results", "rooms");
        builder.Property(result => result.GameId).HasMaxLength(40);
        builder.HasIndex(result => new { result.ProfileId, result.GameId, result.At });
        // Who sat at a hand: "played with" for invitations by ID (ADR 0033).
        builder.HasIndex(result => new { result.RoomId, result.Hand }).HasDatabaseName("ix_rooms_results_room_id_hand");
        builder.HasIndex(result => new { result.AccountId, result.GameId, result.At });
        builder.HasOne<Room>().WithMany().HasForeignKey(result => result.RoomId).OnDelete(DeleteBehavior.Cascade);
    }
}
