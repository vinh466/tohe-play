using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Tohe.Api.Modules.Registry;

/// <summary>A game known to the platform, indexed from the games origin's catalog.json.</summary>
public sealed class Game
{
    public required string Id { get; set; }
    public required string Version { get; set; }
    /// <summary>The standard name (ADR 0048): English, or a proper name such as <c>Tiến Lên</c>.</summary>
    public required string Name { get; set; }
    /// <summary>The name per language tag, as JSON (ADR 0048): <c>{"vi":"Ghép Khối"}</c>; <c>{}</c> without any.</summary>
    public string Names { get; set; } = "{}";
    /// <summary>The standard description, in the language of the standard name.</summary>
    public string Description { get; set; } = "";
    /// <summary>The description per language tag, as JSON (ADR 0048); <c>{}</c> without any.</summary>
    public string Descriptions { get; set; } = "{}";
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
    /// <summary>The manifest's <c>ranked</c> block (ADR 0030) as JSON, for games whose runs the server replays.</summary>
    public string? Ranked { get; set; }
    /// <summary>What opening the game asks for (ADR 0045): <c>any</c> (the default), <c>named</c> or <c>account</c>.</summary>
    public string IdentityPlay { get; set; } = GameLevels.Any;
    /// <summary>The least a table of the game asks for (ADR 0045): <c>named</c> or <c>account</c>; null without rooms.</summary>
    public string? IdentityRooms { get; set; }
    /// <summary>The kinds of entry the build opens itself (ADR 0045): <c>share</c>, or none.</summary>
    public string[] Entries { get; set; } = [];
    /// <summary>False once the game disappears from the catalog; kept so saves and scores stay valid.</summary>
    public bool Listed { get; set; } = true;
    public DateTimeOffset FirstSeenAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary>
/// A game's identity levels and entry kinds (ADR 0043, 0045), as the manifest names them: <c>any</c> &lt; <c>named</c>
/// &lt; <c>account</c>.
/// </summary>
public static class GameLevels
{
    public const string Any = "any";
    public const string Named = "named";
    public const string Account = "account";

    /// <summary>The one entry kind today: a share link's payload.</summary>
    public const string ShareEntry = "share";

    private static readonly string[] Order = [Any, Named, Account];

    public static bool IsLevel(string? level) => level is Any or Named or Account;

    /// <summary>The highest of the levels given; unknown ones count as nothing.</summary>
    public static string Highest(params string?[] levels) =>
        levels.Where(IsLevel).OrderByDescending(level => Array.IndexOf(Order, level)).FirstOrDefault() ?? Any;
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
        builder.Property(game => game.Names).HasColumnType("jsonb").HasDefaultValueSql("'{}'::jsonb");
        builder.Property(game => game.Descriptions).HasColumnType("jsonb").HasDefaultValueSql("'{}'::jsonb");
        builder.Property(game => game.Path).HasMaxLength(200);
        builder.Property(game => game.Entry).HasMaxLength(200);
        builder.Property(game => game.Icon).HasMaxLength(200);
        builder.Property(game => game.Orientation).HasMaxLength(20);
        builder.Property(game => game.Rooms).HasColumnType("jsonb");
        builder.Property(game => game.Ranked).HasColumnType("jsonb");
        builder.Property(game => game.IdentityPlay).HasMaxLength(8).HasDefaultValue(GameLevels.Any);
        builder.Property(game => game.IdentityRooms).HasMaxLength(8);
        builder.Property(game => game.Entries).HasDefaultValueSql("'{}'::text[]");
    }
}
