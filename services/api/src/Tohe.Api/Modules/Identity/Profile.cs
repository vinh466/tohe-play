using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Tohe.Api.Modules.Identity;

public enum ProfileKind
{
    Adult,
    Child,
}

/// <summary>Who may ask a profile to a table by its public ID (ADR 0033).</summary>
public enum InviteScope
{
    /// <summary>Anyone who has the ID: adults, unless they choose otherwise.</summary>
    Anyone,

    /// <summary>Someone the profile sat at a finished hand with.</summary>
    PlayedWith,

    /// <summary>Only the account's other profiles: always so for a child.</summary>
    Account,
}

/// <summary>The names of <see cref="InviteScope"/> in the API: <c>anyone</c>, <c>played-with</c>, <c>account</c>.</summary>
public static class InviteScopes
{
    public static string NameOf(InviteScope scope) => scope switch
    {
        InviteScope.Anyone => "anyone",
        InviteScope.PlayedWith => "played-with",
        _ => "account",
    };

    public static bool TryParse(string? name, out InviteScope scope)
    {
        scope = name switch
        {
            "anyone" => InviteScope.Anyone,
            "played-with" => InviteScope.PlayedWith,
            "account" => InviteScope.Account,
            _ => (InviteScope)(-1),
        };
        return Enum.IsDefined(scope);
    }
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

    /// <summary>
    /// The account that owns this profile and manages it behind the parent gate; null for a device profile on the server
    /// (ADR 0043), which belongs to <see cref="DeviceId"/> instead. Exactly one of the two is set.
    /// </summary>
    public Guid? AccountId { get; set; }

    /// <summary>
    /// The device a device profile on the server belongs to (ADR 0043): only that device's key acts for it. Null for an
    /// account's profile; cleared when the device profile is brought into an account, keeping its id.
    /// </summary>
    public Guid? DeviceId { get; set; }

    /// <summary>
    /// The profile's public identifier, 12 digits shown as <c>1234 5678 9012</c>: never changes, never reused, the
    /// last digit a Damm check digit (<see cref="ProfileIds"/>). What people share to find each other (ADR 0023). A
    /// device profile has none until it is brought into an account (ADR 0043).
    /// </summary>
    public string? PublicId { get; set; }

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

    /// <summary>A moderator hid it from public boards (ADR 0029): its owner's switch does not bring it back.</summary>
    public DateTimeOffset? HiddenFromBoardsAt { get; set; }

    /// <summary>
    /// Who may ask it to a table by its public ID (ADR 0033): anyone for an adult unless its owner chooses otherwise; a
    /// child only within its account, and its ID is not found from outside.
    /// </summary>
    public InviteScope Invites { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>
    /// When the profile came from a device (ADR 0043): anything it reports as reached up to then was earned as a device
    /// profile, whichever way it arrives, and stays off public boards. Null for a profile made in the account.
    /// </summary>
    public DateTimeOffset? DeviceUntil { get; set; }

    /// <summary>
    /// A device profile on the server (ADR 0043): the version of the terms its player accepted — with the line "16 or
    /// older, or a parent allowed it" — when its data first reached the server, or since. Null for an account's profile,
    /// whose account keeps the terms.
    /// </summary>
    public string? TermsVersion { get; set; }

    /// <summary>When the device profile's player accepted <see cref="TermsVersion"/>.</summary>
    public DateTimeOffset? TermsAcceptedAt { get; set; }

    /// <summary>
    /// A device profile on the server: when it last did something there. Unused for 90 days, it is deleted there
    /// (<see cref="DeviceCleanup"/>); the copy on the device stays.
    /// </summary>
    public DateTimeOffset? LastUsedAt { get; set; }
}

/// <summary>Why a name is in a profile's name history.</summary>
public enum ProfileNameKind
{
    /// <summary>The profile was made with it, or renamed to it — by its owner or a moderator.</summary>
    Rename,

    /// <summary>A device profile of that name was merged into this profile (ADR 0043); the profile kept its own name.</summary>
    Merged,
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

    /// <summary>A name it had, or one merged into it (ADR 0043): renames are limited, merges are not.</summary>
    public ProfileNameKind Kind { get; set; }
}

/// <summary>
/// The public ID of a deleted profile (ADR 0034): kept so it is never given to anyone else — someone who shared it
/// must never reach a stranger with it. Nothing else of the profile is kept.
/// </summary>
public sealed class RetiredProfileId
{
    public long Id { get; set; }

    /// <summary>The deleted profile's public ID; null for a device profile, which never had one (ADR 0043).</summary>
    public string? PublicId { get; set; }

    /// <summary>
    /// The deleted profile's id, so a device never brings it back as a device profile's id (ADR 0043). Null for profiles
    /// deleted before device profiles, whose ids were not kept.
    /// </summary>
    public Guid? ProfileId { get; set; }

    public DateTimeOffset RetiredAt { get; set; }
}

internal sealed class RetiredProfileIdConfiguration : IEntityTypeConfiguration<RetiredProfileId>
{
    public void Configure(EntityTypeBuilder<RetiredProfileId> builder)
    {
        builder.ToTable("retired_profile_ids", "identity");
        builder.HasKey(retired => retired.Id);
        builder.Property(retired => retired.PublicId).HasMaxLength(ProfileIds.Length).IsFixedLength();
        builder.HasIndex(retired => retired.PublicId).IsUnique();
        builder.HasIndex(retired => retired.ProfileId).IsUnique();
    }
}

internal sealed class ProfileNameConfiguration : IEntityTypeConfiguration<ProfileName>
{
    public void Configure(EntityTypeBuilder<ProfileName> builder)
    {
        builder.ToTable("profile_names", "identity");
        builder.Property(name => name.Name).HasMaxLength(200);
        // The trigger that keeps the history writes renames; a merge writes its own row.
        builder.Property(name => name.Kind).HasConversion<string>().HasMaxLength(8).HasDefaultValue(ProfileNameKind.Rename);
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
        // An account's profile, or a device's (ADR 0043) — exactly one — and a public ID exactly when it is an account's.
        builder.ToTable("profiles", "identity", table =>
        {
            table.HasCheckConstraint("ck_profiles_owner", "(account_id IS NULL) <> (device_id IS NULL)");
            table.HasCheckConstraint("ck_profiles_public_id", "(account_id IS NULL) = (public_id IS NULL)");
        });
        builder.Property(profile => profile.PublicId).HasMaxLength(ProfileIds.Length).IsFixedLength();
        builder.HasIndex(profile => profile.PublicId).IsUnique();
        // Room for 24 visible characters even when each is a long emoji sequence (ProfileNames.MaxLength).
        builder.Property(profile => profile.Name).HasMaxLength(200);
        builder.Property(profile => profile.Avatar).HasMaxLength(16);
        builder.Property(profile => profile.Kind).HasConversion<string>().HasMaxLength(10);
        builder.Property(profile => profile.Invites).HasConversion<string>().HasMaxLength(12);
        builder.Property(profile => profile.AgeBand).HasMaxLength(8);
        builder.Property(profile => profile.PlayWithOthers).HasDefaultValue(false);
        builder.Property(profile => profile.TermsVersion).HasMaxLength(32);
        builder.HasIndex(profile => new { profile.AccountId, profile.CreatedAt });
        builder.HasIndex(profile => profile.DeviceId);
        builder.HasOne<Account>()
            .WithMany()
            .HasForeignKey(profile => profile.AccountId)
            .OnDelete(DeleteBehavior.Cascade);
        // A device's profiles go through the deletion of ADR 0034 before the device does (DeviceCleanup): never by a
        // cascade, which would skip the modules' purge.
        builder.HasOne<Device>()
            .WithMany()
            .HasForeignKey(profile => profile.DeviceId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
