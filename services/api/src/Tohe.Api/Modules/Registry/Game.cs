using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Tohe.Api.Modules.Registry;

/// <summary>A game known to the platform, indexed from the games origin's catalog.json.</summary>
public sealed class Game
{
    public required string Id { get; set; }
    public required string Version { get; set; }
    public required string Name { get; set; }
    public string Description { get; set; } = "";
    /// <summary>Path of the immutable build on the games origin, e.g. <c>hello/1.0.0/</c>.</summary>
    public required string Path { get; set; }
    public required string Entry { get; set; }
    public string? Icon { get; set; }
    public required string Orientation { get; set; }
    public string[] Capabilities { get; set; } = [];
    public string[] Tags { get; set; } = [];
    public int MinAge { get; set; }
    public int SizeKb { get; set; }
    /// <summary>The manifest's <c>rooms</c> block (ADR 0016) as JSON, for games played at a table; otherwise null.</summary>
    public string? Rooms { get; set; }
    /// <summary>False once the game disappears from the catalog; kept so saves and scores stay valid.</summary>
    public bool Listed { get; set; } = true;
    public DateTimeOffset FirstSeenAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

internal sealed class GameConfiguration : IEntityTypeConfiguration<Game>
{
    public void Configure(EntityTypeBuilder<Game> builder)
    {
        builder.ToTable("games", "registry");
        builder.HasKey(game => game.Id);
        builder.Property(game => game.Id).HasMaxLength(40);
        builder.Property(game => game.Version).HasMaxLength(40);
        builder.Property(game => game.Name).HasMaxLength(40);
        builder.Property(game => game.Description).HasMaxLength(200);
        builder.Property(game => game.Path).HasMaxLength(200);
        builder.Property(game => game.Entry).HasMaxLength(200);
        builder.Property(game => game.Icon).HasMaxLength(200);
        builder.Property(game => game.Orientation).HasMaxLength(20);
        builder.Property(game => game.Rooms).HasColumnType("jsonb");
    }
}
