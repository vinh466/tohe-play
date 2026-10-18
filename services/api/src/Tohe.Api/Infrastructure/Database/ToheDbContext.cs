using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Tohe.Api.Modules.Email;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Progress;
using Tohe.Api.Modules.Registry;
using Tohe.Api.Modules.Rooms;
using Tohe.Api.Modules.Telemetry;

namespace Tohe.Api.Infrastructure.Database;

/// <summary>
/// Single database for the modular monolith. Each module owns its tables (in its own PostgreSQL schema) and
/// configures them in its own <c>IEntityTypeConfiguration</c>; modules never query each other's tables directly.
/// ASP.NET Core Identity's account tables live in the <c>identity</c> schema.
/// </summary>
public sealed class ToheDbContext(DbContextOptions<ToheDbContext> options)
    : IdentityUserContext<Account, Guid>(options), IDataProtectionKeyContext
{
    public DbSet<Game> Games => Set<Game>();

    public DbSet<Profile> Profiles => Set<Profile>();

    public DbSet<AuthAttempt> AuthAttempts => Set<AuthAttempt>();

    public DbSet<SavedGame> SavedGames => Set<SavedGame>();

    public DbSet<ScoreEntry> Scores => Set<ScoreEntry>();

    public DbSet<TelemetrySession> TelemetrySessions => Set<TelemetrySession>();

    public DbSet<TelemetryRecord> TelemetryRecords => Set<TelemetryRecord>();

    public DbSet<TelemetryDay> TelemetryDays => Set<TelemetryDay>();

    public DbSet<TelemetryRollup> TelemetryRollups => Set<TelemetryRollup>();

    public DbSet<Room> Rooms => Set<Room>();

    public DbSet<RoomAction> RoomActions => Set<RoomAction>();

    public DbSet<RoomHand> RoomHands => Set<RoomHand>();

    public DbSet<RoomResult> RoomResults => Set<RoomResult>();

    public DbSet<OutboxEmail> EmailOutbox => Set<OutboxEmail>();

    /// <summary>Keys that encrypt session cookies; persisted so restarts and deploys keep people signed in.</summary>
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<DataProtectionKey>().ToTable("data_protection_keys", "platform");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ToheDbContext).Assembly);
    }
}
