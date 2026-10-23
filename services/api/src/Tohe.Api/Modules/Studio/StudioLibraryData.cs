using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Tohe.Api.Modules.Studio;

/// <summary>
/// A style's status: a draft its creator changes, approved by a reviewer — then it never changes — or rejected, with a
/// reason, until its creator changes it and it is a draft again.
/// </summary>
public enum StyleStatus
{
    Draft,
    Approved,
    Rejected,
}

/// <summary>Where a pack version is in its life (docs/architecture/asset-studio.md#a-versions-life).</summary>
public enum PackVersionStatus
{
    /// <summary>Its creator changes it.</summary>
    Draft,

    /// <summary>Waiting for a reviewer; nobody changes it.</summary>
    Submitted,

    /// <summary>Published: its files by hash and its manifest are in the library.</summary>
    Approved,

    /// <summary>Refused, with a reason; a fix is a new draft.</summary>
    Rejected,

    /// <summary>Still published, but a game should not pin it anew.</summary>
    Deprecated,

    /// <summary>Its manifest and files deleted, by the owner, with a reason.</summary>
    Withdrawn,
}

/// <summary>
/// An art bible (ADR 0051): palette, tile size, view, outline and sample pictures. A draft belongs to who made it — an
/// agent or an account — and only they change it.
/// </summary>
public sealed class StudioStyle
{
    public const int MaxName = 80;

    public const int MaxOutline = 500;

    public const int MaxReason = 1000;

    public required string Id { get; set; }

    public required string Name { get; set; }

    public StyleStatus Status { get; set; }

    /// <summary>The tile's side in pixels, for a tiled style.</summary>
    public int? TileSize { get; set; }

    /// <summary><c>top-down</c>, <c>side</c>, <c>isometric</c> or <c>other</c>.</summary>
    public required string View { get; set; }

    /// <summary>The colours, <c>#rrggbb</c>; null for a painted style.</summary>
    public string[]? Palette { get; set; }

    /// <summary>A note on the outline, e.g. "1 px, darker than the fill".</summary>
    public string? Outline { get; set; }

    public Guid? CreatedByAgent { get; set; }

    public Guid? CreatedByAccount { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>Changed by every change and every review: a review of a style changed meanwhile is refused.</summary>
    public DateTimeOffset UpdatedAt { get; set; }

    /// <summary>The reviewer who approved or rejected it last.</summary>
    public Guid? ReviewedBy { get; set; }

    public DateTimeOffset? ReviewedAt { get; set; }

    /// <summary>Why it was rejected last; kept when its creator changes it again.</summary>
    public string? Reason { get; set; }
}

/// <summary>A sample picture of a style, kept privately under <c>styles/&lt;styleId&gt;/</c>.</summary>
public sealed class StudioStyleSample
{
    public required string StyleId { get; set; }

    public required string Sha256 { get; set; }

    public required string Ext { get; set; }

    public long Bytes { get; set; }

    /// <summary>When its file arrived; null until then.</summary>
    public DateTimeOffset? UploadedAt { get; set; }
}

/// <summary>A pack (ADR 0051): assets in one style for one purpose, released together under semver.</summary>
public sealed class StudioPack
{
    public const int MaxDescription = 500;

    public required string Id { get; set; }

    public required string StyleId { get; set; }

    public string? Description { get; set; }

    public Guid? CreatedByAgent { get; set; }

    public Guid? CreatedByAccount { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>
/// One version of a pack, from its draft to its review. A draft belongs to who made it — an agent or an account — and
/// only they change it; approved, it is published once and never changes.
/// </summary>
public sealed class StudioPackVersion
{
    public const int MaxReason = 1000;

    public Guid Id { get; set; }

    public required string PackId { get; set; }

    public required string Version { get; set; }

    public PackVersionStatus Status { get; set; }

    public Guid? CreatedByAgent { get; set; }

    public Guid? CreatedByAccount { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public DateTimeOffset? SubmittedAt { get; set; }

    /// <summary>The reviewer who approved or rejected it.</summary>
    public Guid? ReviewedBy { get; set; }

    public DateTimeOffset? ReviewedAt { get; set; }

    /// <summary>Why it was rejected.</summary>
    public string? Reason { get; set; }

    public Guid? DeprecatedBy { get; set; }

    public DateTimeOffset? DeprecatedAt { get; set; }

    public Guid? WithdrawnBy { get; set; }

    public DateTimeOffset? WithdrawnAt { get; set; }

    public string? WithdrawReason { get; set; }

    /// <summary>The sha256 of its manifest's bytes, once approved.</summary>
    public string? ManifestSha256 { get; set; }

    /// <summary>
    /// The reviewer allowed <c>CC-BY-SA-4.0</c> in this version when approving it (ADR 0051: the owner decides each case),
    /// for <see cref="ShareAlikeReason"/>.
    /// </summary>
    public bool ShareAlikeAllowed { get; set; }

    public string? ShareAlikeReason { get; set; }
}

/// <summary>A sprite sheet's frames: their size and how many.</summary>
public sealed record AssetFrames(int Width, int Height, int Count);

/// <summary>
/// A Wang tileset's edges: for each tile, in the order of its grid (left to right, then top to bottom), the label of its
/// north, east, south and west edge. Edges with the same label meet, so their outermost pixels must be the same.
/// </summary>
/// <param name="Tiles">Per tile, four labels: north, east, south, west.</param>
public sealed record AssetWang(string[][] Tiles);

/// <summary>One asset of a pack version: its metadata, and whether its file has arrived.</summary>
public sealed class StudioAsset
{
    public Guid VersionId { get; set; }

    public required string AssetId { get; set; }

    public required string Kind { get; set; }

    public required string Sha256 { get; set; }

    public required string Ext { get; set; }

    public long Bytes { get; set; }

    public int? Width { get; set; }

    public int? Height { get; set; }

    public AssetFrames? Frames { get; set; }

    /// <summary>A tileset's Wang edges, when it has them.</summary>
    public AssetWang? Wang { get; set; }

    public string[] Tags { get; set; } = [];

    /// <summary>An SPDX identifier.</summary>
    public required string Licence { get; set; }

    public string? Attribution { get; set; }

    /// <summary>Where it came from — a pack, an upload, an AI model, code — as JSON.</summary>
    public required string Source { get; set; }

    /// <summary>When its file arrived in <c>drafts/</c>; null until then.</summary>
    public DateTimeOffset? UploadedAt { get; set; }
}

/// <summary>
/// An AI vendor (ADR 0051): an <c>ai</c> source names one, and is accepted only once the owner has checked that its
/// terms allow commercial use and redistribution (<see cref="TermsCheckedAt"/>). Empty until the owner checks one.
/// </summary>
public sealed class StudioVendor
{
    /// <summary>What an <c>ai</c> source's <c>vendor</c> holds, e.g. <c>pixellab</c>.</summary>
    public required string Id { get; set; }

    public required string Name { get; set; }

    /// <summary>The terms that were read.</summary>
    public string? TermsUrl { get; set; }

    /// <summary>When the owner checked its terms; until then an <c>ai</c> source from it fails the checks.</summary>
    public DateTimeOffset? TermsCheckedAt { get; set; }

    public string? Note { get; set; }
}

/// <summary>One action in the Studio, with who did it: an agent or an account (none for the API's own clean-up).</summary>
public sealed class StudioAuditEntry
{
    public long Id { get; set; }

    public DateTimeOffset At { get; set; }

    public required string Action { get; set; }

    public Guid? AgentId { get; set; }

    public Guid? AccountId { get; set; }

    /// <summary>What it acted on: <c>farm-crops@1.0.0</c>, a style's id.</summary>
    public required string Target { get; set; }

    public Guid? VersionId { get; set; }

    /// <summary>JSON.</summary>
    public string? Details { get; set; }
}

internal static class StudioNames
{
    public static string Of(StyleStatus status) => status switch
    {
        StyleStatus.Approved => "approved",
        StyleStatus.Rejected => "rejected",
        _ => "draft",
    };

    public static StyleStatus StyleStatusOf(string name) => name switch
    {
        "approved" => StyleStatus.Approved,
        "rejected" => StyleStatus.Rejected,
        _ => StyleStatus.Draft,
    };

    public static string Of(PackVersionStatus status) => status switch
    {
        PackVersionStatus.Submitted => "submitted",
        PackVersionStatus.Approved => "approved",
        PackVersionStatus.Rejected => "rejected",
        PackVersionStatus.Deprecated => "deprecated",
        PackVersionStatus.Withdrawn => "withdrawn",
        _ => "draft",
    };

    public static PackVersionStatus VersionStatusOf(string name) => name switch
    {
        "submitted" => PackVersionStatus.Submitted,
        "approved" => PackVersionStatus.Approved,
        "rejected" => PackVersionStatus.Rejected,
        "deprecated" => PackVersionStatus.Deprecated,
        "withdrawn" => PackVersionStatus.Withdrawn,
        _ => PackVersionStatus.Draft,
    };
}

internal sealed class StudioStyleConfiguration : IEntityTypeConfiguration<StudioStyle>
{
    public void Configure(EntityTypeBuilder<StudioStyle> builder)
    {
        builder.ToTable("styles", "studio", table =>
        {
            table.HasCheckConstraint("ck_styles_status", "status IN ('draft', 'approved', 'rejected')");
            table.HasCheckConstraint("ck_styles_view", "view IN ('top-down', 'side', 'isometric', 'other')");
            table.HasCheckConstraint("ck_styles_creator", "(created_by_agent IS NULL) <> (created_by_account IS NULL)");
        });
        builder.HasKey(style => style.Id);
        builder.Property(style => style.Id).HasMaxLength(40);
        builder.Property(style => style.Name).HasMaxLength(StudioStyle.MaxName);
        builder.Property(style => style.Status)
            .HasConversion(status => StudioNames.Of(status), name => StudioNames.StyleStatusOf(name))
            .HasMaxLength(16);
        builder.Property(style => style.View).HasMaxLength(16);
        builder.Property(style => style.Outline).HasMaxLength(StudioStyle.MaxOutline);
        builder.Property(style => style.Reason).HasMaxLength(StudioStyle.MaxReason);
        // A review reads the style it judges: its creator changing it meanwhile, the review hears 409, and the other way.
        builder.Property(style => style.UpdatedAt).IsConcurrencyToken();
    }
}

internal sealed class StudioStyleSampleConfiguration : IEntityTypeConfiguration<StudioStyleSample>
{
    public void Configure(EntityTypeBuilder<StudioStyleSample> builder)
    {
        builder.ToTable("style_samples", "studio");
        builder.HasKey(sample => new { sample.StyleId, sample.Sha256 });
        builder.Property(sample => sample.Sha256).HasMaxLength(64);
        builder.Property(sample => sample.Ext).HasMaxLength(8);
        builder.HasOne<StudioStyle>().WithMany().HasForeignKey(sample => sample.StyleId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class StudioPackConfiguration : IEntityTypeConfiguration<StudioPack>
{
    public void Configure(EntityTypeBuilder<StudioPack> builder)
    {
        builder.ToTable("packs", "studio", table =>
            table.HasCheckConstraint("ck_packs_creator", "(created_by_agent IS NULL) <> (created_by_account IS NULL)"));
        builder.HasKey(pack => pack.Id);
        builder.Property(pack => pack.Id).HasMaxLength(40);
        builder.Property(pack => pack.Description).HasMaxLength(StudioPack.MaxDescription);
        builder.HasOne<StudioStyle>().WithMany().HasForeignKey(pack => pack.StyleId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class StudioPackVersionConfiguration : IEntityTypeConfiguration<StudioPackVersion>
{
    public void Configure(EntityTypeBuilder<StudioPackVersion> builder)
    {
        builder.ToTable("pack_versions", "studio", table =>
        {
            table.HasCheckConstraint(
                "ck_pack_versions_status",
                "status IN ('draft', 'submitted', 'approved', 'rejected', 'deprecated', 'withdrawn')");
            table.HasCheckConstraint("ck_pack_versions_creator", "(created_by_agent IS NULL) <> (created_by_account IS NULL)");
        });
        builder.HasKey(version => version.Id);
        builder.Property(version => version.PackId).HasMaxLength(40);
        builder.Property(version => version.Version).HasMaxLength(64);
        // A review reads the status it changes again in its UPDATE: two reviewers at once, the second hears 409.
        builder.Property(version => version.Status)
            .HasConversion(status => StudioNames.Of(status), name => StudioNames.VersionStatusOf(name))
            .HasMaxLength(16)
            .IsConcurrencyToken();
        builder.Property(version => version.Reason).HasMaxLength(StudioPackVersion.MaxReason);
        builder.Property(version => version.WithdrawReason).HasMaxLength(StudioPackVersion.MaxReason);
        builder.Property(version => version.ManifestSha256).HasMaxLength(64);
        builder.Property(version => version.ShareAlikeReason).HasMaxLength(StudioPackVersion.MaxReason);
        builder.HasOne<StudioPack>().WithMany().HasForeignKey(version => version.PackId).OnDelete(DeleteBehavior.Cascade);
        // One published version per number: whatever was ever approved keeps its number, withdrawn or not.
        builder.HasIndex(version => new { version.PackId, version.Version })
            .IsUnique()
            .HasFilter("status IN ('approved', 'deprecated', 'withdrawn')");
        builder.HasIndex(version => new { version.Status, version.CreatedAt });
        builder.HasIndex(version => version.CreatedByAgent);
        builder.HasIndex(version => version.CreatedByAccount);
    }
}

internal sealed class StudioAssetConfiguration : IEntityTypeConfiguration<StudioAsset>
{
    public void Configure(EntityTypeBuilder<StudioAsset> builder)
    {
        builder.ToTable("assets", "studio", table =>
            table.HasCheckConstraint(
                "ck_assets_kind",
                "kind IN ('image', 'spritesheet', 'tileset', 'audio', 'font', 'palette')"));
        builder.HasKey(asset => new { asset.VersionId, asset.AssetId });
        builder.Property(asset => asset.AssetId).HasMaxLength(100);
        builder.Property(asset => asset.Kind).HasMaxLength(16);
        builder.Property(asset => asset.Sha256).HasMaxLength(64);
        builder.Property(asset => asset.Ext).HasMaxLength(8);
        builder.Property(asset => asset.Licence).HasMaxLength(64);
        builder.Property(asset => asset.Attribution).HasMaxLength(1000);
        builder.Property(asset => asset.Source).HasColumnType("jsonb");
        builder.Property(asset => asset.Frames)
            .HasConversion(
                frames => frames == null ? null : JsonSerializer.Serialize(frames, JsonSerializerOptions.Web),
                json => json == null ? null : JsonSerializer.Deserialize<AssetFrames>(json, JsonSerializerOptions.Web))
            .HasColumnType("jsonb");
        builder.Property(asset => asset.Wang)
            .HasConversion(
                wang => wang == null ? null : JsonSerializer.Serialize(wang, JsonSerializerOptions.Web),
                json => json == null ? null : JsonSerializer.Deserialize<AssetWang>(json, JsonSerializerOptions.Web))
            .HasColumnType("jsonb");
        builder.HasOne<StudioPackVersion>().WithMany().HasForeignKey(asset => asset.VersionId).OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(asset => asset.Sha256);
    }
}

internal sealed class StudioVendorConfiguration : IEntityTypeConfiguration<StudioVendor>
{
    public void Configure(EntityTypeBuilder<StudioVendor> builder)
    {
        builder.ToTable("vendors", "studio");
        builder.HasKey(vendor => vendor.Id);
        builder.Property(vendor => vendor.Id).HasMaxLength(40);
        builder.Property(vendor => vendor.Name).HasMaxLength(80);
        builder.Property(vendor => vendor.TermsUrl).HasMaxLength(500);
        builder.Property(vendor => vendor.Note).HasMaxLength(1000);
    }
}

internal sealed class StudioAuditEntryConfiguration : IEntityTypeConfiguration<StudioAuditEntry>
{
    public void Configure(EntityTypeBuilder<StudioAuditEntry> builder)
    {
        builder.ToTable("audit", "studio");
        // The agents' audit is an `audit` table too, in its own schema: a name of its own for this one's key.
        builder.HasKey(entry => entry.Id).HasName("pk_studio_audit");
        builder.Property(entry => entry.Action).HasMaxLength(40);
        builder.Property(entry => entry.Target).HasMaxLength(120);
        builder.Property(entry => entry.Details).HasColumnType("jsonb");
        builder.HasIndex(entry => entry.At);
        builder.HasIndex(entry => entry.VersionId);
    }
}
