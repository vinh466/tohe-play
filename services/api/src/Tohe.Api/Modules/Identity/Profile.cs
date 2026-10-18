using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Tohe.Api.Modules.Identity;

public enum ProfileKind
{
    Adult,
    Child,
}

/// <summary>
/// A player. An account owns up to <see cref="ProfileOptions.MaxProfilesPerAccount"/> of them — its first one is
/// created with it — and everything a player does (saves, scores, seats at a table) belongs to a profile (ADR 0023).
/// A child is not a kind of account, only a profile with restrictions: an age band, and no play with other accounts
/// unless the account's owner allows it.
/// </summary>
public sealed class Profile
{
    public Guid Id { get; set; }

    /// <summary>The account that owns this profile and manages it behind the parent gate.</summary>
    public Guid AccountId { get; set; }

    /// <summary>
    /// The profile's public identifier, 12 digits shown as <c>1234 5678 9012</c>: never changes, never reused, the
    /// last digit a Damm check digit (<see cref="ProfileIds"/>). What people share to find each other (ADR 0023).
    /// </summary>
    public required string PublicId { get; set; }

    /// <summary>Chosen freely and not unique (<see cref="ProfileNames"/>): the public ID tells profiles apart.</summary>
    public required string Name { get; set; }

    /// <summary>One of <see cref="ProfileOptions.Avatars"/>.</summary>
    public required string Avatar { get; set; }

    public ProfileKind Kind { get; set; }

    /// <summary>One of <see cref="ProfileOptions.AgeBands"/> for children; null for adults.</summary>
    public string? AgeBand { get; set; }

    /// <summary>Hash of an optional 4-digit PIN that must be entered to play as this profile.</summary>
    public string? PinHash { get; set; }

    /// <summary>
    /// The account's owner lets this child play online with other accounts (ADR 0016). Off by default; adults always may.
    /// </summary>
    public bool PlayWithOthers { get; set; }

    /// <summary>
    /// On the public boards — a community's and the server's (ADR 0029). On for adults; off for children until the
    /// account's owner turns it on, saying they asked the child (D-06).
    /// </summary>
    public bool OnPublicBoards { get; set; }

    /// <summary>When the account's owner said they asked the child, turning <see cref="OnPublicBoards"/> on.</summary>
    public DateTimeOffset? AskedChildAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>
/// One name a profile had, from when (D-17): written by a database trigger on every new profile and every rename, by its
/// owner or by a moderator, so moderation sees what a profile was called. Deleted with the profile.
/// </summary>
public sealed class ProfileName
{
    public long Id { get; set; }

    public Guid ProfileId { get; set; }

    public required string Name { get; set; }

    public DateTimeOffset At { get; set; }
}

internal sealed class ProfileNameConfiguration : IEntityTypeConfiguration<ProfileName>
{
    public void Configure(EntityTypeBuilder<ProfileName> builder)
    {
        builder.ToTable("profile_names", "identity");
        builder.Property(name => name.Name).HasMaxLength(200);
        builder.HasIndex(name => new { name.ProfileId, name.At });
        builder.HasOne<Profile>()
            .WithMany()
            .HasForeignKey(name => name.ProfileId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class ProfileConfiguration : IEntityTypeConfiguration<Profile>
{
    public void Configure(EntityTypeBuilder<Profile> builder)
    {
        builder.ToTable("profiles", "identity");
        builder.Property(profile => profile.PublicId).HasMaxLength(ProfileIds.Length).IsFixedLength();
        builder.HasIndex(profile => profile.PublicId).IsUnique();
        // Room for 24 visible characters even when each is a long emoji sequence (ProfileNames.MaxLength).
        builder.Property(profile => profile.Name).HasMaxLength(200);
        builder.Property(profile => profile.Avatar).HasMaxLength(16);
        builder.Property(profile => profile.Kind).HasConversion<string>().HasMaxLength(10);
        builder.Property(profile => profile.AgeBand).HasMaxLength(8);
        builder.Property(profile => profile.PlayWithOthers).HasDefaultValue(false);
        builder.HasIndex(profile => new { profile.AccountId, profile.CreatedAt });
        builder.HasOne<Account>()
            .WithMany()
            .HasForeignKey(profile => profile.AccountId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
