using System.Text;
using System.Text.RegularExpressions;
using SkiaSharp;
using Tohe.Api.Modules.Studio;

namespace Tohe.Api.Tests;

/// <summary>
/// The Studio's checks (ADR 0051, docs/architecture/asset-studio.md#checks) on the corpus of good and bad files in
/// Fixtures/studio: every code has a passing and a failing case, and each bad case fails that one code alone. Pure: no
/// database, no storage.
/// </summary>
public sealed partial class StudioChecksTests
{
    /// <summary>The corpus's limits: small, so its files stay small.</summary>
    private static readonly StudioCheckLimits Limits = new(MaxFileBytes: 4096, MaxPackBytes: 8192, MaxPixels: 1024 * 1024);

    private static readonly StudioStyle Pixel = new()
    {
        Id = "pixel",
        Name = "Pixel",
        Status = StyleStatus.Approved,
        TileSize = 16,
        View = "top-down",
        Palette = ["#000000", "#ffffff", "#aa5533", "#33aa55"],
    };

    private static readonly StudioStyle Painted = new() { Id = "painted", Name = "Painted", Status = StyleStatus.Approved, View = "side" };

    private static readonly AssetWang TwoTiles = new([["g", "g", "g", "g"], ["g", "g", "g", "g"]]);

    /// <summary>A file of the corpus, the asset that names it, its style, and the one code it fails (none: it passes).</summary>
    private sealed record FileCase(string File, string Kind, AssetFrames? Frames, AssetWang? Wang, StudioStyle Style, string? Code);

    private static readonly Dictionary<string, FileCase> FileCases = new[]
    {
        new FileCase("good-16.png", "image", null, null, Pixel, null),
        new FileCase("good-16.webp", "image", null, null, Pixel, null),
        new FileCase("good-meta.png", "image", null, null, Pixel, null),
        new FileCase("good-meta.webp", "image", null, null, Pixel, null),
        new FileCase("good-sheet-64x16.png", "spritesheet", new AssetFrames(16, 16, 4), null, Pixel, null),
        new FileCase("good-wang-32x16.png", "tileset", null, TwoTiles, Pixel, null),
        new FileCase("good-painted-20x30.png", "image", null, null, Painted, null),
        new FileCase("bad-format.gif", "image", null, null, Pixel, "format_not_allowed"),
        new FileCase("bad-magic.png", "image", null, null, Pixel, "magic_mismatch"),
        new FileCase("bad-pixels-1040.png", "image", null, null, Pixel, "too_many_pixels"),
        new FileCase("bad-large-128.png", "image", null, null, Pixel, "too_large"),
        new FileCase("bad-size-20x16.png", "image", null, null, Pixel, "size_not_tile_multiple"),
        new FileCase("bad-sheet-48x16.png", "spritesheet", new AssetFrames(16, 16, 4), null, Pixel, "frames_mismatch"),
        new FileCase("bad-colour-16.png", "image", null, null, Pixel, "colour_not_in_palette"),
        new FileCase("bad-alpha-16.png", "image", null, null, Pixel, "alpha_not_binary"),
        new FileCase("bad-wang-32x16.png", "tileset", null, TwoTiles, Pixel, "tile_edges_differ"),
    }.ToDictionary(found => found.File);

    public static TheoryData<string> Files => [.. FileCases.Keys];

    [Theory]
    [MemberData(nameof(Files))]
    public void A_file_of_the_corpus_passes_or_fails_its_one_code(string name)
    {
        var found = FileCases[name];
        var asset = Asset("crops/carrot", found.Kind, Path.GetExtension(name)[1..], frames: found.Frames, wang: found.Wang);
        var result = StudioFileChecks.Check(Fixture(name), asset.Ext, [asset], found.Style, Limits);
        Assert.Equal(found.Code is null ? [] : [found.Code], result.Problems.Select(problem => problem.Code));
        Assert.All(result.Problems, problem => Assert.Equal("crops/carrot", problem.Asset));
    }

    [Fact]
    public void Every_file_code_has_a_passing_and_a_failing_file()
    {
        string[] codes =
        [
            "format_not_allowed", "magic_mismatch", "too_many_pixels", "too_large", "size_not_tile_multiple",
            "frames_mismatch", "colour_not_in_palette", "alpha_not_binary", "tile_edges_differ",
        ];
        Assert.Equal(codes.Order(), FileCases.Values.Select(found => found.Code).OfType<string>().Order());
        Assert.Contains(FileCases.Values, found => found.Code is null);
    }

    [Fact]
    public void A_good_file_of_the_corpus_reads_its_size_and_stays_as_it_is()
    {
        var bytes = Fixture("good-sheet-64x16.png");
        var result = StudioFileChecks.Check(bytes, "png", [Asset("sheet", "spritesheet", frames: new AssetFrames(16, 16, 4))], Pixel, Limits);
        Assert.Same(bytes, result.Content);
        Assert.Equal((64, 16), (result.Width, result.Height));
    }

    [Theory]
    [InlineData(16, 16, 1, true)]
    [InlineData(16, 16, 3, true)]
    [InlineData(32, 16, 2, true)]
    [InlineData(16, 16, 5, false)]
    [InlineData(20, 16, 3, false)]
    [InlineData(16, 8, 4, false)]
    public void A_sprite_sheet_grid_must_hold_its_frames_with_no_empty_row(int width, int height, int count, bool ok)
    {
        // 64×16: four frames of 16×16 in one row.
        var asset = Asset("sheet", "spritesheet", frames: new AssetFrames(width, height, count));
        var result = StudioFileChecks.Check(Fixture("good-sheet-64x16.png"), "png", [asset], Pixel, Limits);
        Assert.Equal(ok ? [] : ["frames_mismatch"], result.Problems.Select(problem => problem.Code));
    }

    [Fact]
    public void A_sprite_sheet_without_frames_fails()
    {
        var result = StudioFileChecks.Check(Fixture("good-sheet-64x16.png"), "png", [Asset("sheet", "spritesheet")], Pixel, Limits);
        Assert.Equal(["frames_mismatch"], result.Problems.Select(problem => problem.Code));
    }

    [Fact]
    public void Edges_with_other_labels_need_not_meet()
    {
        // The second tile's west edge differs; labelled apart from every east edge, nothing must meet it.
        var wang = new AssetWang([["g", "g", "g", "g"], ["g", "g", "g", "w"]]);
        var result = StudioFileChecks.Check(Fixture("bad-wang-32x16.png"), "png", [Asset("tiles", "tileset", wang: wang)], Pixel, Limits);
        Assert.Empty(result.Problems);
    }

    [Fact]
    public void A_png_loses_its_text_chunks_and_its_pixels_stay()
    {
        var original = Fixture("good-meta.png");
        var result = StudioFileChecks.Check(original, "png", [Asset("tree")], Pixel, Limits);

        Assert.Empty(result.Problems);
        Assert.NotEqual(original, result.Content);
        Assert.Equal(["IHDR", "IDAT", "IEND"], PngChunks(result.Content));
        Assert.Contains("tEXt", PngChunks(original));
        Assert.Equal(Pixels(Fixture("good-16.png")), Pixels(result.Content));
    }

    [Fact]
    public void Bytes_after_the_end_of_a_png_go()
    {
        var clean = Fixture("good-16.png");
        var result = StudioFileChecks.Check([.. clean, .. "<?php echo 1; ?>"u8], "png", [Asset("tree")], Pixel, Limits);
        Assert.Empty(result.Problems);
        Assert.Equal(clean, result.Content);
    }

    [Fact]
    public void A_webp_loses_its_exif_and_xmp_and_its_flags_say_so()
    {
        var original = Fixture("good-meta.webp");
        var result = StudioFileChecks.Check(original, "webp", [Asset("tree", ext: "webp")], Pixel, Limits);

        Assert.Empty(result.Problems);
        Assert.Equal(["VP8X", "VP8L"], WebpChunks(original).Where(chunk => chunk is "VP8X" or "VP8L"));
        Assert.Contains("EXIF", WebpChunks(original));
        Assert.Equal(["VP8X", "VP8L"], WebpChunks(result.Content));
        Assert.Equal(0, result.Content[20] & 0x0C);
        Assert.Equal(result.Content.Length - 8, BitConverter.ToInt32(result.Content, 4));
        Assert.Equal(Pixels(Fixture("good-16.webp")), Pixels(result.Content));
    }

    [Fact]
    public void A_file_without_metadata_is_kept_as_it_is()
    {
        var clean = Fixture("good-16.webp");
        Assert.Same(clean, StudioFileChecks.Check(clean, "webp", [Asset("tree", ext: "webp")], Pixel, Limits).Content);
    }

    // ------------------------------------------------------------------------------------------------------- metadata

    /// <summary>A version of the corpus's metadata: what is wrong with it, and the one code it fails (none: it passes).</summary>
    private sealed record VersionCase(string Name, Func<StudioVersionToCheck> Version, StudioCheckStage Stage, string? Code);

    private static readonly IReadOnlySet<string> CheckedVendors = new HashSet<string>(StringComparer.Ordinal) { "checked-ai" };

    private static readonly Dictionary<string, VersionCase> VersionCases = new[]
    {
        new VersionCase("code source, CC0", () => Version([Asset("a")]), StudioCheckStage.Approve, null),
        new VersionCase("pack source, CC-BY with credit", () => Version([Asset("a", licence: "CC-BY-4.0", attribution: "Cô Ba", source: PackSource)]), StudioCheckStage.Approve, null),
        new VersionCase("upload source", () => Version([Asset("a", source: """{"type":"upload","by":"Vinh"}""")]), StudioCheckStage.Approve, null),
        new VersionCase("ai source, checked vendor", () => Version([Asset("a", licence: "LicenseRef-Tohe-Internal", source: Ai("checked-ai"))]), StudioCheckStage.Approve, null),
        new VersionCase("CC-BY-SA on submitting", () => Version([Asset("a", licence: "CC-BY-SA-4.0", attribution: "Cô Ba")]), StudioCheckStage.Submit, null),
        new VersionCase("CC-BY-SA allowed by the reviewer", () => Version([Asset("a", licence: "CC-BY-SA-4.0", attribution: "Cô Ba")], shareAlike: true), StudioCheckStage.Approve, null),
        new VersionCase("one file for two assets, within the pack's bytes", () => Version([Asset("a", bytes: 5000), Asset("b", bytes: 5000)]), StudioCheckStage.Approve, null),
        new VersionCase("a draft style, on submitting", () => Version([Asset("a")], style: Draft), StudioCheckStage.Submit, null),
        new VersionCase("two assets one id", () => Version([Asset("a"), Asset("a")]), StudioCheckStage.Submit, "id_duplicate"),
        new VersionCase("no style", () => Version([Asset("a")], noStyle: true),StudioCheckStage.Submit, "style_unknown"),
        new VersionCase("a draft style, on approving", () => Version([Asset("a")], style: Draft), StudioCheckStage.Approve, "style_not_approved"),
        new VersionCase("pack source without a url", () => Version([Asset("a", source: """{"type":"pack","name":"Farm","author":"Cô Ba"}""")]), StudioCheckStage.Submit, "source_incomplete"),
        new VersionCase("pack source with a url that is not one", () => Version([Asset("a", source: """{"type":"pack","name":"Farm","url":"farm","author":"Cô Ba"}""")]), StudioCheckStage.Submit, "source_incomplete"),
        new VersionCase("ai source without a seed", () => Version([Asset("a", source: """{"type":"ai","vendor":"checked-ai","model":"m","prompt":"a carrot","date":"2026-10-24"}""")]), StudioCheckStage.Submit, "source_incomplete"),
        new VersionCase("code source without its script", () => Version([Asset("a", source: """{"type":"code"}""")]), StudioCheckStage.Submit, "source_incomplete"),
        new VersionCase("a source of no known type", () => Version([Asset("a", source: """{"type":"found"}""")]), StudioCheckStage.Submit, "source_incomplete"),
        new VersionCase("a non-commercial licence", () => Version([Asset("a", licence: "CC-BY-NC-4.0", attribution: "Cô Ba")]), StudioCheckStage.Submit, "licence_not_accepted"),
        new VersionCase("CC-BY-SA not allowed by the reviewer", () => Version([Asset("a", licence: "CC-BY-SA-4.0", attribution: "Cô Ba")]), StudioCheckStage.Approve, "licence_not_accepted"),
        new VersionCase("CC-BY without credit", () => Version([Asset("a", licence: "CC-BY-4.0")]), StudioCheckStage.Submit, "attribution_missing"),
        new VersionCase("ai source, vendor not checked", () => Version([Asset("a", licence: "LicenseRef-Tohe-Internal", source: Ai("pixellab"))]), StudioCheckStage.Submit, "vendor_not_checked"),
        new VersionCase("two files over the pack's bytes", () => Version([Asset("a", bytes: 5000), Asset("b", bytes: 5000, sha256: new string('b', 64))]), StudioCheckStage.Submit, "too_large"),
    }.ToDictionary(found => found.Name);

    public static TheoryData<string> Versions => [.. VersionCases.Keys];

    [Theory]
    [MemberData(nameof(Versions))]
    public void A_version_of_the_corpus_passes_or_fails_its_one_code(string name)
    {
        var found = VersionCases[name];
        var problems = StudioVersionChecks.Check(found.Version(), found.Stage, CheckedVendors, Limits);
        Assert.Equal(found.Code is null ? [] : [found.Code], problems.Select(problem => problem.Code).Distinct());
    }

    [Theory]
    [InlineData("1.0.1", new[] { "a" }, 16, null)]
    [InlineData("1.0.1", new[] { "a", "b" }, 16, "semver_too_small")]
    [InlineData("1.1.0", new[] { "a", "b" }, 16, null)]
    [InlineData("1.1.0", new[] { "b" }, 16, "semver_too_small")]
    [InlineData("2.0.0", new[] { "b" }, 16, null)]
    [InlineData("1.1.0", new[] { "a" }, 32, "semver_too_small")]
    [InlineData("2.0.0-beta.1", new[] { "a" }, 32, null)]
    public void Semver_against_the_version_approved_before(string version, string[] ids, int size, string? code)
    {
        var previous = new StudioPackVersion { PackId = "farm", Version = "1.0.0", Status = PackVersionStatus.Approved };
        var toCheck = Version([.. ids.Select(id => Asset(id, size: size))], version: version) with
        {
            Previous = previous,
            PreviousAssets = [Asset("a", size: 16)],
        };
        var problems = StudioVersionChecks.Check(toCheck, StudioCheckStage.Submit, CheckedVendors, Limits);
        Assert.Equal(code is null ? [] : [code], problems.Select(problem => problem.Code).Distinct());
    }

    [Fact]
    public void Every_metadata_code_has_a_passing_and_a_failing_case()
    {
        string[] codes =
        [
            "id_duplicate", "style_unknown", "style_not_approved", "source_incomplete", "licence_not_accepted",
            "attribution_missing", "vendor_not_checked", "too_large",
        ];
        Assert.Equal(codes.Order(), VersionCases.Values.Select(found => found.Code).OfType<string>().Distinct().Order());
    }

    // ------------------------------------------------------------------------------------------------------- licences

    [Fact]
    public void The_accepted_licences_are_the_contracts()
    {
        var source = File.ReadAllText(ContractAssets());
        Assert.Equal(Quoted(AcceptedList().Match(source)), StudioLicences.Accepted);
        Assert.Equal(Quoted(NoAttributionList().Match(source)), StudioLicences.NoAttribution);
    }

    private static List<string> Quoted(Match list)
    {
        Assert.True(list.Success, "the list was not found in packages/contract/src/assets.ts");
        return [.. QuotedString().Matches(list.Groups[1].Value).Select(found => found.Groups[1].Value)];
    }

    /// <summary>The contract's assets.ts, found from the tests' folder up to the repository's root.</summary>
    private static string ContractAssets()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            var path = Path.Combine(directory.FullName, "packages", "contract", "src", "assets.ts");
            if (File.Exists(path))
            {
                return path;
            }
        }

        throw new FileNotFoundException("packages/contract/src/assets.ts above the tests' folder");
    }

    [GeneratedRegex(@"ACCEPTED_ASSET_LICENCES\s*=\s*\[(.*?)\]", RegexOptions.Singleline)]
    private static partial Regex AcceptedList();

    [GeneratedRegex(@"NO_ATTRIBUTION[^=]*=\s*\[(.*?)\]", RegexOptions.Singleline)]
    private static partial Regex NoAttributionList();

    [GeneratedRegex("'([^']+)'")]
    private static partial Regex QuotedString();

    // -------------------------------------------------------------------------------------------------------- helpers

    private const string PackSource = """{"type":"pack","name":"Farm","url":"https://example.test/farm","author":"Cô Ba"}""";

    private static readonly StudioStyle Draft = new() { Id = "pixel", Name = "Pixel", Status = StyleStatus.Draft, TileSize = 16, View = "top-down" };

    private static string Ai(string vendor) =>
        $$"""{"type":"ai","vendor":"{{vendor}}","model":"m-1","prompt":"a carrot","seed":42,"date":"2026-10-24"}""";

    private static StudioAsset Asset(
        string id,
        string kind = "image",
        string ext = "png",
        string licence = "CC0-1.0",
        string? attribution = null,
        string source = """{"type":"code","script":"draw.ts"}""",
        long bytes = 100,
        string? sha256 = null,
        int size = 16,
        AssetFrames? frames = null,
        AssetWang? wang = null) => new()
        {
            AssetId = id,
            Kind = kind,
            Sha256 = sha256 ?? new string('a', 64),
            Ext = ext,
            Bytes = bytes,
            Width = size,
            Height = size,
            Frames = frames,
            Wang = wang,
            Licence = licence,
            Attribution = attribution,
            Source = source,
        };

    private static StudioVersionToCheck Version(
        IReadOnlyList<StudioAsset> assets, StudioStyle? style = null, bool noStyle = false, bool shareAlike = false, string version = "1.0.0") =>
        new(
            new StudioPack { Id = "farm", StyleId = "pixel" },
            noStyle ? null : style ?? Pixel,
            new StudioPackVersion { PackId = "farm", Version = version, ShareAlikeAllowed = shareAlike },
            assets,
            null,
            []);

    private static byte[] Fixture(string name) => File.ReadAllBytes(Path.Combine(AppContext.BaseDirectory, "Fixtures", "studio", name));

    private static List<string> PngChunks(byte[] png)
    {
        var chunks = new List<string>();
        for (var at = 8; at + 8 <= png.Length;)
        {
            var length = System.Buffers.Binary.BinaryPrimitives.ReadInt32BigEndian(png.AsSpan(at));
            chunks.Add(Encoding.ASCII.GetString(png, at + 4, 4));
            at += 12 + length;
        }

        return chunks;
    }

    private static List<string> WebpChunks(byte[] webp)
    {
        var chunks = new List<string>();
        for (var at = 12; at + 8 <= webp.Length;)
        {
            var length = BitConverter.ToInt32(webp, at + 4);
            chunks.Add(Encoding.ASCII.GetString(webp, at, 4));
            at += 8 + length + (length & 1);
        }

        return chunks;
    }

    private static byte[] Pixels(byte[] file)
    {
        using var codec = SKCodec.Create(SKData.CreateCopy(file));
        var info = new SKImageInfo(codec.Info.Width, codec.Info.Height, SKColorType.Rgba8888, SKAlphaType.Unpremul);
        using var bitmap = new SKBitmap(info);
        Assert.Equal(SKCodecResult.Success, codec.GetPixels(info, bitmap.GetPixels()));
        return bitmap.GetPixelSpan().ToArray();
    }
}
