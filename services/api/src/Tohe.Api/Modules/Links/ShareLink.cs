using System.Diagnostics.CodeAnalysis;
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Tohe.Api.Infrastructure;

namespace Tohe.Api.Modules.Links;

/// <summary>What a share link opens (ADR 0044).</summary>
public enum ShareLinkKind
{
    /// <summary>The game's menu: the only kind made in step I3.</summary>
    Game,

    /// <summary>
    /// A place inside the game, with a payload the game alone reads (ADR 0045): made on the game's request, only for a
    /// game whose current build takes share entries.
    /// </summary>
    Entry,
}

/// <summary>The least identity level a share link asks of whoever opens it (ADR 0043, 0044).</summary>
public enum LinkLevel
{
    Any,
    Named,
    Account,
}

/// <summary>
/// A share link (ADR 0044): an object on the server with a code people can type, made by a profile through the hub,
/// with an expiry, an optional maximum of uses, and revoking. Its counts are per day, in <see cref="ShareLinkDay"/>.
/// </summary>
public sealed class ShareLink
{
    public Guid Id { get; set; }

    /// <summary>Eight Crockford base32 characters (<see cref="LinkCodes"/>), unique among every link the server keeps.</summary>
    public required string Code { get; set; }

    public ShareLinkKind Kind { get; set; }

    /// <summary>The game it opens, as the registry listed it when the link was made.</summary>
    public required string GameId { get; set; }

    /// <summary>The game's version when the link was made, from the registry.</summary>
    public required string GameVersion { get; set; }

    public LinkLevel Level { get; set; }

    /// <summary>
    /// For an <see cref="ShareLinkKind.Entry"/> link, the game's payload as JSON (at most 2 KB as UTF-8, ADR 0045):
    /// untrusted, given to the game in <c>init.entry</c> and to nobody else — never in a preview nor in the console.
    /// </summary>
    public string? Payload { get; set; }

    /// <summary>
    /// The profile that made it: an account's or a device's on the server (ADR 0043). Merged into another profile, its
    /// links move there; deleted, they go with it.
    /// </summary>
    public Guid MakerProfileId { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }

    /// <summary>At most this many resolves that open the game; null for no limit.</summary>
    public int? MaxUses { get; set; }

    /// <summary>Resolves that opened the game.</summary>
    public int Uses { get; set; }

    /// <summary>When its maker, or the console, revoked it; a revoked link stays revoked.</summary>
    public DateTimeOffset? RevokedAt { get; set; }

    /// <summary>
    /// The language its maker's hub spoke when it made it (<c>vi</c> or <c>en</c>, ADR 0047): its preview card speaks it.
    /// The link itself carries no language — whoever opens it reads the app in their own.
    /// </summary>
    public string Language { get; set; } = Languages.Vietnamese;
}

/// <summary>A share link's counts on one UTC day (ADR 0044): totals only, never who.</summary>
public sealed class ShareLinkDay
{
    public Guid LinkId { get; set; }

    public DateOnly Day { get; set; }

    /// <summary>Resolves of the link while it was good.</summary>
    public int Opened { get; set; }

    /// <summary>Resolves that opened the game, each a use.</summary>
    public int Played { get; set; }

    /// <summary>Accounts made from the entry: the hub passed the code with the request that made the account.</summary>
    public int AccountsMade { get; set; }
}

/// <summary>
/// Share link codes (ADR 0044): eight characters of Crockford base32 — digits and upper-case letters without I, L, O and
/// U, 40 random bits. Typed codes are read case-insensitively, ignoring spaces and hyphens, with I and L read as 1 and O
/// as 0.
/// </summary>
public static class LinkCodes
{
    public const int Length = 8;

    public const string Alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

    public static string New() => new(RandomNumberGenerator.GetItems<char>(Alphabet, Length));

    /// <summary>The code in its canonical form, or false when it is not one.</summary>
    public static bool TryNormalize(string? input, [NotNullWhen(true)] out string? code)
    {
        code = null;
        if (input is null || input.Length > 4 * Length)
        {
            return false;
        }

        var chars = new List<char>(Length);
        foreach (var c in input)
        {
            if (c is ' ' or '-' or '\t')
            {
                continue;
            }

            var upper = char.ToUpperInvariant(c);
            var read = upper switch
            {
                'I' or 'L' => '1',
                'O' => '0',
                _ => upper,
            };
            if (!Alphabet.Contains(read, StringComparison.Ordinal) || chars.Count == Length)
            {
                return false;
            }

            chars.Add(read);
        }

        if (chars.Count != Length)
        {
            return false;
        }

        code = new string([.. chars]);
        return true;
    }
}

/// <summary>The names of the link's enums in the API: lower case, as the hub sends them.</summary>
public static class LinkNames
{
    /// <summary>The level of the API's name (<c>any</c>, <c>named</c>, <c>account</c>), as a game's manifest names it.</summary>
    public static LinkLevel LevelOf(string? name) => TryParseLevel(name, out var level) ? level : LinkLevel.Any;

    public static string Of(ShareLinkKind kind) => kind == ShareLinkKind.Game ? "game" : "entry";

    public static string Of(LinkLevel level) => level switch
    {
        LinkLevel.Any => "any",
        LinkLevel.Named => "named",
        _ => "account",
    };

    public static bool TryParseKind(string? name, out ShareLinkKind kind)
    {
        (var known, kind) = name switch
        {
            "game" => (true, ShareLinkKind.Game),
            "entry" => (true, ShareLinkKind.Entry),
            _ => (false, ShareLinkKind.Game),
        };
        return known;
    }

    public static bool TryParseLevel(string? name, out LinkLevel level)
    {
        (var known, level) = name switch
        {
            "any" => (true, LinkLevel.Any),
            "named" => (true, LinkLevel.Named),
            "account" => (true, LinkLevel.Account),
            _ => (false, LinkLevel.Any),
        };
        return known;
    }
}

internal sealed class ShareLinkConfiguration : IEntityTypeConfiguration<ShareLink>
{
    public void Configure(EntityTypeBuilder<ShareLink> builder)
    {
        builder.ToTable("share_links", "links");
        builder.Property(link => link.Code).HasMaxLength(LinkCodes.Length).IsFixedLength();
        builder.HasIndex(link => link.Code).IsUnique();
        builder.Property(link => link.Kind).HasConversion<string>().HasMaxLength(8);
        builder.Property(link => link.Level).HasConversion<string>().HasMaxLength(8);
        builder.Property(link => link.GameId).HasMaxLength(40);
        builder.Property(link => link.GameVersion).HasMaxLength(64);
        // Text, exactly as measured: jsonb would rewrite numbers (1e131071 grows to 131,072 digits) and refuse \u0000.
        builder.Property(link => link.Payload).HasColumnType("text");
        // Links made before makers' languages were kept were made in Vietnamese: the cards spoke nothing else.
        builder.Property(link => link.Language).HasMaxLength(Languages.MaxLength).HasDefaultValue(Languages.Vietnamese);
        // A maker's links, newest first, and its count of the day.
        builder.HasIndex(link => new { link.MakerProfileId, link.CreatedAt });
    }
}

internal sealed class ShareLinkDayConfiguration : IEntityTypeConfiguration<ShareLinkDay>
{
    public void Configure(EntityTypeBuilder<ShareLinkDay> builder)
    {
        builder.ToTable("share_link_days", "links");
        builder.HasKey(day => new { day.LinkId, day.Day });
        builder.HasOne<ShareLink>()
            .WithMany()
            .HasForeignKey(day => day.LinkId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
