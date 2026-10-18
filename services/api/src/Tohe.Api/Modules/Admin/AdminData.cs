using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Tohe.Api.Modules.Admin;

/// <summary>
/// One setting of the platform kept in the database (ADR 0027): when setup ended, and next the sign-in methods and the
/// registration mode the console switches at run time.
/// </summary>
public sealed class PlatformSetting
{
    public required string Key { get; set; }

    public required string Value { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary>One thing done in or for the admin console. Never changed nor deleted: a trigger refuses both.</summary>
public sealed class AuditEntry
{
    public long Id { get; set; }

    public DateTimeOffset At { get; set; }

    /// <summary>The account that acted; none for the command line.</summary>
    public Guid? ActorId { get; set; }

    /// <summary>Who acted, as shown: an email, an old username, or <c>command line</c>.</summary>
    public required string Actor { get; set; }

    /// <summary>What happened, e.g. <c>role.grant</c> (<see cref="AuditActions"/>).</summary>
    public required string Action { get; set; }

    /// <summary>What it happened to, e.g. the account given a role.</summary>
    public string? Target { get; set; }

    /// <summary>The rest, as JSON.</summary>
    public string? Details { get; set; }

    /// <summary>The client address it came from; none for the command line.</summary>
    public string? Address { get; set; }
}

internal sealed class PlatformSettingConfiguration : IEntityTypeConfiguration<PlatformSetting>
{
    public void Configure(EntityTypeBuilder<PlatformSetting> builder)
    {
        builder.ToTable("settings", "admin");
        builder.HasKey(setting => setting.Key);
        builder.Property(setting => setting.Key).HasMaxLength(64);
        builder.Property(setting => setting.Value).HasMaxLength(4000);
    }
}

internal sealed class AuditEntryConfiguration : IEntityTypeConfiguration<AuditEntry>
{
    public void Configure(EntityTypeBuilder<AuditEntry> builder)
    {
        builder.ToTable("audit_log", "admin");
        builder.Property(entry => entry.Actor).HasMaxLength(320);
        builder.Property(entry => entry.Action).HasMaxLength(64);
        builder.Property(entry => entry.Target).HasMaxLength(320);
        builder.Property(entry => entry.Details).HasColumnType("jsonb");
        builder.Property(entry => entry.Address).HasMaxLength(64);
        builder.HasIndex(entry => entry.At);
    }
}
