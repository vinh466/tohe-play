using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Tohe.Api.Modules.Identity;

/// <summary>A family: the adults (accounts) and the player profiles they manage.</summary>
public sealed class Household
{
    public Guid Id { get; set; }

    public required string Name { get; set; }

    /// <summary>Lets another adult register into this household; see <see cref="Invites"/>.</summary>
    public string? InviteCode { get; set; }

    public DateTimeOffset? InviteExpiresAt { get; set; }

    /// <summary>Devices of this household send technical telemetry (ADR 0015); a parent can turn it off.</summary>
    public bool TelemetryEnabled { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; }

    public List<Profile> Profiles { get; set; } = [];
}

public enum ProfileKind
{
    Adult,
    Child,
}

/// <summary>A player. Adults have one tied to their account; children only ever have profiles.</summary>
public sealed class Profile
{
    public Guid Id { get; set; }

    public Guid HouseholdId { get; set; }

    public required string Name { get; set; }

    /// <summary>One of <see cref="ProfileOptions.Avatars"/>.</summary>
    public required string Avatar { get; set; }

    public ProfileKind Kind { get; set; }

    /// <summary>One of <see cref="ProfileOptions.AgeBands"/> for children; null for adults.</summary>
    public string? AgeBand { get; set; }

    /// <summary>Hash of an optional 4-digit PIN that must be entered to play as this profile.</summary>
    public string? PinHash { get; set; }

    /// <summary>
    /// A parent lets this child play online with other households (ADR 0016). Off by default; adults always may.
    /// </summary>
    public bool PlayWithOthers { get; set; }

    /// <summary>The adult account this profile belongs to; null for children.</summary>
    public Guid? AccountId { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

internal sealed class HouseholdConfiguration : IEntityTypeConfiguration<Household>
{
    public void Configure(EntityTypeBuilder<Household> builder)
    {
        builder.ToTable("households", "households");
        builder.Property(household => household.Name).HasMaxLength(40);
        builder.Property(household => household.InviteCode).HasMaxLength(16);
        builder.HasIndex(household => household.InviteCode).IsUnique();
        builder.Property(household => household.TelemetryEnabled).HasDefaultValue(true);
        builder.HasMany(household => household.Profiles)
            .WithOne()
            .HasForeignKey(profile => profile.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class ProfileConfiguration : IEntityTypeConfiguration<Profile>
{
    public void Configure(EntityTypeBuilder<Profile> builder)
    {
        builder.ToTable("profiles", "households");
        builder.Property(profile => profile.Name).HasMaxLength(20);
        builder.Property(profile => profile.Avatar).HasMaxLength(16);
        builder.Property(profile => profile.Kind).HasConversion<string>().HasMaxLength(10);
        builder.Property(profile => profile.AgeBand).HasMaxLength(8);
        builder.Property(profile => profile.PlayWithOthers).HasDefaultValue(false);
        builder.HasIndex(profile => profile.AccountId).IsUnique();
    }
}
