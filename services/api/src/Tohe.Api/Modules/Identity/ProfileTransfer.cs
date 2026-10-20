using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Tohe.Api.Infrastructure;

namespace Tohe.Api.Modules.Identity;

/// <summary>Where a transfer code is (ADR 0043).</summary>
public enum TransferState
{
    /// <summary>Made, and waiting for a new device.</summary>
    Open,

    /// <summary>A new device typed its six digits: the old device is asked.</summary>
    Asked,

    /// <summary>The profile moved to the new device.</summary>
    Done,

    /// <summary>The old device said no.</summary>
    Declined,
}

/// <summary>
/// A transfer code (ADR 0043, step I2b): moves one device profile on the server, with its saves and scores, from the
/// device that made it to the one that redeems it — at once with the secret of its QR code, or with its six digits once
/// the old device says yes. Used once; ten minutes to redeem and confirm, ten more for the new device to read the
/// answer; one per profile. Only hashes of the digits and the secret are kept.
/// </summary>
public sealed class ProfileTransfer
{
    public Guid Id { get; set; }

    /// <summary>The device profile it moves, and only that one.</summary>
    public Guid ProfileId { get; set; }

    /// <summary>The device that made it — the profile's device then.</summary>
    public Guid FromDeviceId { get; set; }

    /// <summary>The device that redeemed it: asked, or done.</summary>
    public Guid? ToDeviceId { get; set; }

    /// <summary>SHA-256 of its id and the six digits (<see cref="TransferCodes.HashCode"/>); cleared once they are typed.</summary>
    public string? CodeHash { get; set; }

    /// <summary>SHA-256 of the secret the QR code carries.</summary>
    public required byte[] SecretHash { get; set; }

    /// <summary>The device profile's saves and scores (<see cref="DeviceProfileData"/> as JSON), sent with the code.</summary>
    public required string Data { get; set; }

    public TransferState State { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>Until when it can be redeemed, and an asked one confirmed.</summary>
    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset? DoneAt { get; set; }

    /// <summary>Kept until then, so the new device can read its answer again.</summary>
    public DateTimeOffset KeepUntil => ExpiresAt + TransferCodes.Grace;
}

/// <summary>
/// A device profile moved away from this device with a transfer code (ADR 0043): the old device hears it on its next
/// request naming the profile, and keeps what it played there since as a new device profile. Kept 90 days, or until the
/// device is deleted.
/// </summary>
public sealed class ProfileMove
{
    public Guid DeviceId { get; set; }

    public Guid ProfileId { get; set; }

    public DateTimeOffset MovedAt { get; set; }
}

/// <summary>
/// The old id of a device profile merged into <see cref="ProfileId"/> (ADR 0043, step I2b): what still names it —
/// a replay, a result, an invitation by id — finds the profile it went into. Never taken again; retired with its profile.
/// </summary>
public sealed class ProfileAlias
{
    public Guid OldId { get; set; }

    public Guid ProfileId { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

internal sealed class ProfileTransferConfiguration : IEntityTypeConfiguration<ProfileTransfer>
{
    public void Configure(EntityTypeBuilder<ProfileTransfer> builder)
    {
        builder.ToTable("profile_transfers", "identity");
        builder.Ignore(transfer => transfer.KeepUntil);
        builder.Property(transfer => transfer.CodeHash).HasMaxLength(64).IsFixedLength();
        builder.Property(transfer => transfer.SecretHash).HasMaxLength(32);
        builder.Property(transfer => transfer.Data).HasColumnType("jsonb");
        builder.Property(transfer => transfer.State).HasConversion<string>().HasMaxLength(10);
        // One per profile: a new code replaces the one before.
        builder.HasIndex(transfer => transfer.ProfileId).IsUnique();
        builder.HasIndex(transfer => transfer.SecretHash).IsUnique();
        builder.HasIndex(transfer => transfer.ExpiresAt);
        builder.HasOne<Profile>()
            .WithMany()
            .HasForeignKey(transfer => transfer.ProfileId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<Device>()
            .WithMany()
            .HasForeignKey(transfer => transfer.FromDeviceId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<Device>()
            .WithMany()
            .HasForeignKey(transfer => transfer.ToDeviceId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class ProfileMoveConfiguration : IEntityTypeConfiguration<ProfileMove>
{
    public void Configure(EntityTypeBuilder<ProfileMove> builder)
    {
        builder.ToTable("profile_moves", "identity");
        builder.HasKey(move => new { move.DeviceId, move.ProfileId });
        builder.HasIndex(move => move.MovedAt);
        // Only a note for the device: the profile may be deleted, or brought into an account, since.
        builder.HasOne<Device>()
            .WithMany()
            .HasForeignKey(move => move.DeviceId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class ProfileAliasConfiguration : IEntityTypeConfiguration<ProfileAlias>
{
    public void Configure(EntityTypeBuilder<ProfileAlias> builder)
    {
        builder.ToTable("profile_aliases", "identity");
        builder.HasKey(alias => alias.OldId);
        builder.Property(alias => alias.OldId).ValueGeneratedNever();
        builder.HasIndex(alias => alias.ProfileId);
        // Retired with the profile it names (AccountDeletion), then gone with it.
        builder.HasOne<Profile>()
            .WithMany()
            .HasForeignKey(alias => alias.ProfileId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

/// <summary>A transfer code's numbers and hashes (ADR 0043).</summary>
public static class TransferCodes
{
    /// <summary>How long a code can be redeemed, and an asked one confirmed.</summary>
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);

    /// <summary>How long after that the new device can read its answer again.</summary>
    public static readonly TimeSpan Grace = TimeSpan.FromMinutes(10);

    /// <summary>The QR code's secret: 32 random bytes.</summary>
    public const int SecretBytes = 32;

    /// <summary>A moved-away note is kept this long — as long as a device unseen is.</summary>
    public static readonly TimeSpan MovesKept = TimeSpan.FromDays(90);

    public static string NewCode() =>
        RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6", CultureInfo.InvariantCulture);

    /// <summary>As the one-time codes by email: SHA-256 of the transfer's id and the digits, as hex.</summary>
    public static string HashCode(Guid transferId, string code) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes($"{transferId:N}:{code}")));

    /// <summary>Compares in constant time.</summary>
    public static bool Matches(ProfileTransferCode transfer, string code) =>
        CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(HashCode(transfer.Id, code)), Encoding.ASCII.GetBytes(transfer.CodeHash));

    public static byte[] HashSecret(byte[] secret) => SHA256.HashData(secret);

    /// <summary>The six digits as typed, spaces and dashes ignored; null when they are not six digits.</summary>
    public static string? Digits(string? typed)
    {
        if (typed is null)
        {
            return null;
        }

        var digits = new string([.. typed.Where(c => c is not (' ' or '-'))]);
        return digits.Length == 6 && digits.All(char.IsAsciiDigit) ? digits : null;
    }
}

/// <summary>A live code's id and hash, read to find the one six typed digits belong to.</summary>
public sealed record ProfileTransferCode(Guid Id, string CodeHash);

/// <summary>
/// Wrong six-digit transfer codes for the whole server in the last hour (ADR 0043,
/// <c>Identity:TransferCodeMissesPerHour</c>): past the limit, six-digit codes are refused until the hour has room.
/// </summary>
internal sealed class TransferMisses(TimeProvider clock) : HourlyAllowance(clock)
{
    /// <summary>The whole server counts as one.</summary>
    private static readonly Guid Everyone = Guid.Empty;

    public bool Exhausted(int limit) => !HasRoom(Everyone, limit);

    public void Count(int limit) => TryTake(Everyone, limit);
}
