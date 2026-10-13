using Microsoft.EntityFrameworkCore;
using Tohe.Api.Modules.Registry;

namespace Tohe.Api.Infrastructure.Database;

/// <summary>
/// Single database for the modular monolith. Each module owns its tables and configures them in its own
/// <c>IEntityTypeConfiguration</c>; modules never query each other's tables directly.
/// </summary>
public sealed class ToheDbContext(DbContextOptions<ToheDbContext> options) : DbContext(options)
{
    public DbSet<Game> Games => Set<Game>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ToheDbContext).Assembly);
}
