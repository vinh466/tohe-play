using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Tohe.Api.Modules.Telemetry;

/// <summary>
/// One page load of the hub on one device: the context its events share. Technical data only; the device id is
/// random, renewed every 30 days by the hub, and tied to no account, profile or household.
/// </summary>
public sealed class TelemetrySession
{
    public long Id { get; set; }

    public Guid DeviceId { get; set; }

    public Guid ClientSessionId { get; set; }

    public DateTimeOffset FirstSeenAt { get; set; }

    public DateTimeOffset LastSeenAt { get; set; }

    public required string HubVersion { get; set; }

    /// <summary>Reduced from the User-Agent header, which is not stored.</summary>
    public required string Os { get; set; }

    public required string OsVersion { get; set; }

    public required string Browser { get; set; }

    public required string BrowserVersion { get; set; }

    /// <summary><c>phone</c>, <c>tablet</c> or <c>desktop</c>.</summary>
    public required string DeviceClass { get; set; }

    /// <summary>CSS pixels, rounded to 50.</summary>
    public int ViewportWidth { get; set; }

    public int ViewportHeight { get; set; }

    public double PixelRatio { get; set; }

    public int? Cores { get; set; }

    /// <summary>Only Chromium browsers tell (navigator.deviceMemory).</summary>
    public double? MemoryGb { get; set; }

    /// <summary><c>browser</c> or <c>standalone</c> (installed app).</summary>
    public required string DisplayMode { get; set; }

    public required string Theme { get; set; }

    public required string Locale { get; set; }
}

/// <summary>One event: an error, a count, a metric or a frame summary.</summary>
public sealed class TelemetryRecord
{
    public long Id { get; set; }

    public long SessionId { get; set; }

    public TelemetrySession Session { get; set; } = null!;

    public DateTimeOffset ReceivedAt { get; set; }

    /// <summary><c>game</c> or <c>hub</c>.</summary>
    public required string Source { get; set; }

    public string? GameId { get; set; }

    public string? GameVersion { get; set; }

    /// <summary><c>error</c>, <c>count</c>, <c>metric</c> or <c>frames</c>.</summary>
    public required string Kind { get; set; }

    public string? Name { get; set; }

    /// <summary>Groups errors that differ only in numbers; computed here, not by the device.</summary>
    public string? Fingerprint { get; set; }

    public string? Message { get; set; }

    public string? Stack { get; set; }

    public int Count { get; set; } = 1;

    public double? Value { get; set; }

    /// <summary>Frames per duration bucket: ≤ 17, 25, 33, 50, 100 ms, then slower.</summary>
    public int[]? Buckets { get; set; }

    public double? SlowestMs { get; set; }

    public double? StepP50Ms { get; set; }

    public double? StepP95Ms { get; set; }

    public string? Renderer { get; set; }
}

/// <summary>Events of one UTC day added up per game version, platform and event, kept a year.</summary>
public sealed class TelemetryDay
{
    public long Id { get; set; }

    public DateOnly Day { get; set; }

    public required string Source { get; set; }

    public string? GameId { get; set; }

    public string? GameVersion { get; set; }

    public required string Os { get; set; }

    public required string Browser { get; set; }

    public required string DeviceClass { get; set; }

    public required string Kind { get; set; }

    public string? Name { get; set; }

    public string? Fingerprint { get; set; }

    public string? Message { get; set; }

    public string? Stack { get; set; }

    public int Sessions { get; set; }

    public int Devices { get; set; }

    /// <summary>Sum of the events' counts.</summary>
    public long Total { get; set; }

    public double? ValueP50 { get; set; }

    public double? ValueP95 { get; set; }

    public double? ValueMax { get; set; }

    public long[]? Buckets { get; set; }

    public double? SlowestMax { get; set; }
}

/// <summary>A day already rolled up into <see cref="TelemetryDay"/> rows.</summary>
public sealed class TelemetryRollup
{
    public DateOnly Day { get; set; }

    public DateTimeOffset DoneAt { get; set; }
}

internal sealed class TelemetrySessionConfiguration : IEntityTypeConfiguration<TelemetrySession>
{
    public void Configure(EntityTypeBuilder<TelemetrySession> builder)
    {
        builder.ToTable("sessions", "telemetry");
        builder.HasIndex(session => new { session.DeviceId, session.ClientSessionId }).IsUnique();
        builder.HasIndex(session => session.LastSeenAt);
        builder.Property(session => session.HubVersion).HasMaxLength(40);
        builder.Property(session => session.Os).HasMaxLength(20);
        builder.Property(session => session.OsVersion).HasMaxLength(20);
        builder.Property(session => session.Browser).HasMaxLength(30);
        builder.Property(session => session.BrowserVersion).HasMaxLength(20);
        builder.Property(session => session.DeviceClass).HasMaxLength(10);
        builder.Property(session => session.DisplayMode).HasMaxLength(12);
        builder.Property(session => session.Theme).HasMaxLength(5);
        builder.Property(session => session.Locale).HasMaxLength(5);
    }
}

internal sealed class TelemetryRecordConfiguration : IEntityTypeConfiguration<TelemetryRecord>
{
    public void Configure(EntityTypeBuilder<TelemetryRecord> builder)
    {
        builder.ToTable("events", "telemetry");
        builder.HasOne(record => record.Session)
            .WithMany()
            .HasForeignKey(record => record.SessionId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(record => record.ReceivedAt);
        builder.HasIndex(record => new { record.Kind, record.Fingerprint });
        builder.Property(record => record.Source).HasMaxLength(4);
        builder.Property(record => record.GameId).HasMaxLength(40);
        builder.Property(record => record.GameVersion).HasMaxLength(20);
        builder.Property(record => record.Kind).HasMaxLength(6);
        builder.Property(record => record.Name).HasMaxLength(64);
        builder.Property(record => record.Fingerprint).HasMaxLength(400);
        builder.Property(record => record.Message).HasMaxLength(300);
        builder.Property(record => record.Stack).HasMaxLength(1000);
        builder.Property(record => record.Renderer).HasMaxLength(6);
    }
}

internal sealed class TelemetryDayConfiguration : IEntityTypeConfiguration<TelemetryDay>
{
    public void Configure(EntityTypeBuilder<TelemetryDay> builder)
    {
        builder.ToTable("daily", "telemetry");
        builder.HasIndex(day => new { day.Day, day.GameId });
        builder.HasIndex(day => new { day.Kind, day.Fingerprint });
        builder.Property(day => day.Source).HasMaxLength(4);
        builder.Property(day => day.GameId).HasMaxLength(40);
        builder.Property(day => day.GameVersion).HasMaxLength(20);
        builder.Property(day => day.Os).HasMaxLength(20);
        builder.Property(day => day.Browser).HasMaxLength(30);
        builder.Property(day => day.DeviceClass).HasMaxLength(10);
        builder.Property(day => day.Kind).HasMaxLength(6);
        builder.Property(day => day.Name).HasMaxLength(64);
        builder.Property(day => day.Fingerprint).HasMaxLength(400);
        builder.Property(day => day.Message).HasMaxLength(300);
        builder.Property(day => day.Stack).HasMaxLength(1000);
    }
}

internal sealed class TelemetryRollupConfiguration : IEntityTypeConfiguration<TelemetryRollup>
{
    public void Configure(EntityTypeBuilder<TelemetryRollup> builder)
    {
        builder.ToTable("rollups", "telemetry");
        builder.HasKey(rollup => rollup.Day);
    }
}
