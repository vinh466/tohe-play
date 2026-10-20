using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Tohe.Api.Modules.Rooms;

/// <summary>Who may sit at a table (ADR 0016, 0043): its creator chooses.</summary>
public enum RoomEntry
{
    /// <summary>"Ai có link cũng vào": anyone with a name others see — a device profile on the server too. The default.</summary>
    Named,

    /// <summary>"Chỉ tài khoản": profiles of accounts only.</summary>
    Account,

    /// <summary>"Chỉ hồ sơ trong tài khoản tôi": the host's account's own profiles.</summary>
    Own,
}

/// <summary>The names of <see cref="RoomEntry"/> in the API: <c>named</c>, <c>account</c>, <c>own</c>.</summary>
public static class RoomEntries
{
    public static string NameOf(RoomEntry entry) => entry switch
    {
        RoomEntry.Named => "named",
        RoomEntry.Account => "account",
        _ => "own",
    };

    public static bool TryParse(string? name, out RoomEntry entry)
    {
        entry = name switch
        {
            "named" => RoomEntry.Named,
            "account" => RoomEntry.Account,
            "own" => RoomEntry.Own,
            _ => (RoomEntry)(-1),
        };
        return Enum.IsDefined(entry);
    }
}

public enum RoomStatus
{
    /// <summary>Players gather; the host starts.</summary>
    Waiting,

    /// <summary>A hand is being played.</summary>
    Playing,

    /// <summary>A hand is over; the next one starts when everyone is ready or after a countdown.</summary>
    Between,

    Closed,
}

/// <summary>
/// A table for one game (ADR 0016). The hand in progress is not stored as a state: it is rebuilt from the hand's
/// seed, options and carry by replaying <see cref="RoomAction"/>s through the game's rules module.
/// </summary>
public sealed class Room
{
    public Guid Id { get; set; }

    /// <summary>6 digits, unique among open rooms.</summary>
    public required string Code { get; set; }

    public required string GameId { get; set; }

    /// <summary>The build the room plays: its rules module referees every hand, whatever is deployed later.</summary>
    public required string GameVersion { get; set; }

    /// <summary>The rules module's path on the games origin, e.g. <c>tien-len/0.2.0/rules.js</c>.</summary>
    public required string RulesPath { get; set; }

    public Guid HostProfileId { get; set; }

    /// <summary>The host's account; null while a device profile hosts (ADR 0043).</summary>
    public Guid? HostAccountId { get; set; }

    /// <summary>Listed in the lobby; otherwise joined with the code or the link only.</summary>
    public bool IsPublic { get; set; }

    /// <summary>Who may sit: anyone named, accounts only, or the host's account's own profiles (ADR 0043).</summary>
    public RoomEntry Entry { get; set; }

    /// <summary>The host closed the door: nobody new may join.</summary>
    public bool Locked { get; set; }

    /// <summary>Seats at the table.</summary>
    public int Seats { get; set; }

    /// <summary>Empty seats get a bot when a hand starts.</summary>
    public bool BotsFill { get; set; }

    /// <summary>One of the game's bot levels, or null if it has none.</summary>
    public string? BotLevel { get; set; }

    /// <summary>A bot plays for a player whose phone is gone longer than the grace period.</summary>
    public bool BotsTakeOver { get; set; }

    /// <summary>Seconds per turn for a person; 0 for no timer.</summary>
    public int TurnSeconds { get; set; }

    /// <summary>People may watch the table without a seat (they see only what is public).</summary>
    public bool AllowSpectators { get; set; }

    /// <summary>The game's options (house rules), JSON by option id.</summary>
    public string Options { get; set; } = "{}";

    /// <summary>The seats, JSON: see <see cref="SeatRecord"/>.</summary>
    public string SeatList { get; set; } = "[]";

    public RoomStatus Status { get; set; }

    /// <summary>Hands started so far; the current hand's number while one is played.</summary>
    public int Hand { get; set; }

    /// <summary>Seed of the current (or last) hand, from a cryptographic generator, never sent to phones.</summary>
    public int Seed { get; set; }

    /// <summary>Room seats of the current hand, by the rules module's seat, JSON array.</summary>
    public string HandSeats { get; set; } = "[]";

    /// <summary>What the next hand needs from the last one (the rules module's <c>carry</c>), JSON.</summary>
    public string? Carry { get; set; }

    /// <summary>The carry the current (or last) hand started with: replaying the hand needs it.</summary>
    public string? HandCarry { get; set; }

    /// <summary>Points of each room seat over the room's hands, JSON array.</summary>
    public string Scores { get; set; } = "[]";

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public DateTimeOffset? ClosedAt { get; set; }
}

/// <summary>A seat as stored: a person, a bot, or empty.</summary>
/// <param name="AccountId">The person's account; null for a device profile (ADR 0043), a bot, or a deleted person.</param>
/// <param name="Auto">A bot that filled an empty seat; a person who joins between hands takes its place.</param>
/// <param name="Deleted">A person whose profile was deleted (ADR 0034): the seat stays in finished hands for the others
/// at the table, with nothing of them — a random id, no account, no name, no avatar.</param>
/// <param name="Kept">A child whose account's owner has not let it play with outsiders: it never sits with a device
/// profile (ADR 0043).</param>
public sealed record SeatRecord(
    Guid? ProfileId,
    Guid? AccountId,
    string? Name,
    string? Avatar,
    string? Bot,
    bool Auto = false,
    bool Deleted = false,
    bool Kept = false)
{
    public static readonly SeatRecord Empty = new(null, null, null, null, null);

    public bool IsEmpty => ProfileId is null && Bot is null;

    /// <summary>A device profile sits here (ADR 0043): a person without an account.</summary>
    public bool IsDeviceProfile() => ProfileId is not null && AccountId is null && Bot is null && !Deleted;
}

/// <summary>An accepted action of a hand, in order; replayed to rebuild the hand after a restart.</summary>
public sealed class RoomAction
{
    public long Id { get; set; }

    public Guid RoomId { get; set; }

    public int Hand { get; set; }

    /// <summary>The rules module's seat that acted.</summary>
    public int Seat { get; set; }

    public required string Action { get; set; }

    public DateTimeOffset At { get; set; }
}

internal sealed class RoomConfiguration : IEntityTypeConfiguration<Room>
{
    public void Configure(EntityTypeBuilder<Room> builder)
    {
        builder.ToTable("rooms", "rooms");
        builder.Property(room => room.Code).HasMaxLength(6).IsFixedLength();
        builder.Property(room => room.GameId).HasMaxLength(40);
        builder.Property(room => room.GameVersion).HasMaxLength(64);
        builder.Property(room => room.RulesPath).HasMaxLength(200);
        builder.Property(room => room.BotLevel).HasMaxLength(16);
        builder.Property(room => room.Status).HasConversion<string>().HasMaxLength(10);
        builder.Property(room => room.Entry).HasConversion<string>().HasMaxLength(8).HasDefaultValue(RoomEntry.Named);
        builder.Property(room => room.Options).HasColumnType("jsonb");
        builder.Property(room => room.SeatList).HasColumnType("jsonb");
        builder.Property(room => room.HandSeats).HasColumnType("jsonb");
        builder.Property(room => room.Carry).HasColumnType("jsonb");
        builder.Property(room => room.HandCarry).HasColumnType("jsonb");
        builder.Property(room => room.Scores).HasColumnType("jsonb");
        // A code is unique among open rooms only; a closed room's code can come back.
        builder.HasIndex(room => room.Code).IsUnique().HasFilter("closed_at IS NULL");
        builder.HasIndex(room => new { room.GameId, room.Status });
    }
}

internal sealed class RoomActionConfiguration : IEntityTypeConfiguration<RoomAction>
{
    public void Configure(EntityTypeBuilder<RoomAction> builder)
    {
        builder.ToTable("actions", "rooms");
        builder.Property(action => action.Action).HasColumnType("jsonb");
        builder.HasIndex(action => new { action.RoomId, action.Hand, action.Id });
        builder.HasOne<Room>().WithMany().HasForeignKey(action => action.RoomId).OnDelete(DeleteBehavior.Cascade);
    }
}
