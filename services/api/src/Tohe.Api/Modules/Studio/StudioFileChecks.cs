using System.Buffers.Binary;
using System.Globalization;
using System.Text;
using SkiaSharp;

namespace Tohe.Api.Modules.Studio;

/// <summary>
/// The checks of one file (docs/architecture/asset-studio.md#checks), with SkiaSharp. Files: PNG or WebP, the bytes
/// what the extension says, not animated, within the limits of bytes and pixels — read from the header before decoding
/// — and their metadata stripped. Pictures: sizes in multiples of the style's tile, a sprite sheet's grid as its frames
/// say, every opaque pixel in the style's palette and alpha only 0 or 255 when it has one, a Wang tileset's meeting
/// edges the same. A file is about every asset that names it; a problem of the file names the first of them.
/// </summary>
internal static class StudioFileChecks
{
    public static readonly IReadOnlyList<string> Formats = ["png", "webp"];

    private static readonly byte[] PngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    /// <summary>
    /// The PNG chunks a file keeps: the picture's own and those that say how to show its colours. Text, EXIF, time and
    /// anything else are metadata and go.
    /// </summary>
    private static readonly HashSet<string> PngKept = new(StringComparer.Ordinal)
    {
        "IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB", "iCCP", "sBIT", "cICP", "mDCV", "cLLI",
    };

    /// <summary>The WebP chunks a file keeps; EXIF, XMP and anything else go.</summary>
    private static readonly HashSet<string> WebpKept = new(StringComparer.Ordinal) { "VP8 ", "VP8L", "VP8X", "ALPH", "ICCP" };

    private enum Stripping
    {
        Done,
        Malformed,
        Animated,
    }

    public static StudioFileResult Check(byte[] content, string ext, IReadOnlyList<StudioAsset> assets, StudioStyle? style, StudioCheckLimits limits)
    {
        var about = assets.Select(asset => asset.AssetId).Order(StringComparer.Ordinal).FirstOrDefault();
        StudioFileResult Refused(string code, string message) => new([new(about, code, message)], content, null, null);

        if (!Formats.Contains(ext))
        {
            return Refused("format_not_allowed", $"A .{ext} file: the Studio takes PNG and WebP pictures");
        }

        if (content.LongLength > limits.MaxFileBytes)
        {
            return Refused("too_large", $"The file holds {content.LongLength} bytes; at most {limits.MaxFileBytes}");
        }

        if (Sniff(content) is var found && found != ext)
        {
            return Refused("magic_mismatch", $"Its bytes are {found ?? "not a picture the Studio knows"}, not {ext}");
        }

        var (stripping, stripped) = ext == "png" ? StripPng(content) : StripWebp(content);
        switch (stripping)
        {
            case Stripping.Malformed:
                return Refused("magic_mismatch", $"Its bytes are not a whole {ext} file");
            case Stripping.Animated:
                return Refused("format_not_allowed", "An animated picture: a sprite sheet with frames holds an animation");
        }

        using var data = SKData.CreateCopy(stripped);
        using var codec = SKCodec.Create(data);
        var expected = ext == "png" ? SKEncodedImageFormat.Png : SKEncodedImageFormat.Webp;
        if (codec is null || codec.EncodedFormat != expected)
        {
            return Refused("magic_mismatch", $"Its bytes are not a {ext} picture that can be read");
        }

        if (codec.FrameCount > 1)
        {
            return Refused("format_not_allowed", "An animated picture: a sprite sheet with frames holds an animation");
        }

        var (width, height) = (codec.Info.Width, codec.Info.Height);
        if ((long)width * height > limits.MaxPixels)
        {
            return Refused("too_many_pixels", $"It is {width}×{height}, {(long)width * height} pixels; at most {limits.MaxPixels}");
        }

        // Unpremultiplied RGBA, and no colour space: the values in the file, never converted.
        var info = new SKImageInfo(width, height, SKColorType.Rgba8888, SKAlphaType.Unpremul);
        using var bitmap = new SKBitmap(info);
        if (codec.GetPixels(info, bitmap.GetPixels()) != SKCodecResult.Success)
        {
            return Refused("magic_mismatch", $"Its {ext} data cannot be decoded");
        }

        var pixels = new Pixels(bitmap.GetPixelSpan().ToArray(), width, height);
        var problems = new List<StudioCheckProblem>();
        if (style?.TileSize is { } tile && (width % tile != 0 || height % tile != 0))
        {
            problems.Add(new(about, "size_not_tile_multiple", $"It is {width}×{height}; the style's tile is {tile} pixels, so both must be multiples of {tile}"));
        }

        if (style?.Palette is { } palette)
        {
            Palette(problems, about, pixels, palette);
        }

        foreach (var asset in assets)
        {
            if (asset.Kind == "spritesheet")
            {
                Frames(problems, asset, width, height);
            }

            if (asset.Kind == "tileset" && asset.Wang is { } wang)
            {
                Wang(problems, asset, wang, style, pixels);
            }
        }

        return new(problems, stripped, width, height);
    }

    /// <summary>What the bytes are, by their magic: <c>png</c>, <c>webp</c>, another name, or null.</summary>
    public static string? Sniff(ReadOnlySpan<byte> content)
    {
        if (content.StartsWith(PngSignature))
        {
            return "png";
        }

        if (content.Length >= 12 && content[..4].SequenceEqual("RIFF"u8) && content[8..12].SequenceEqual("WEBP"u8))
        {
            return "webp";
        }

        if (content.StartsWith("GIF8"u8))
        {
            return "gif";
        }

        return content.StartsWith((ReadOnlySpan<byte>)[0xFF, 0xD8, 0xFF]) ? "jpg" : null;
    }

    private static void Palette(List<StudioCheckProblem> problems, string? about, Pixels pixels, IReadOnlyList<string> palette)
    {
        var colours = palette.Select(colour => int.Parse(colour.AsSpan(1), NumberStyles.HexNumber, CultureInfo.InvariantCulture)).ToHashSet();
        var (offColour, partial) = (0, 0);
        (int X, int Y)? firstOff = null;
        (int X, int Y)? firstPartial = null;
        for (var y = 0; y < pixels.Height; y++)
        {
            for (var x = 0; x < pixels.Width; x++)
            {
                var (r, g, b, a) = pixels.At(x, y);
                if (a is not 0 and not 255)
                {
                    partial++;
                    firstPartial ??= (x, y);
                }
                else if (a == 255 && !colours.Contains((r << 16) | (g << 8) | b))
                {
                    offColour++;
                    firstOff ??= (x, y);
                }
            }
        }

        if (firstOff is { } off)
        {
            var (r, g, b, _) = pixels.At(off.X, off.Y);
            problems.Add(new(about, "colour_not_in_palette", $"{offColour} opaque pixels are not in the style's palette, the first at ({off.X}, {off.Y}): #{r:x2}{g:x2}{b:x2}"));
        }

        if (firstPartial is { } at)
        {
            problems.Add(new(about, "alpha_not_binary", $"{partial} pixels are partly transparent, the first at ({at.X}, {at.Y}): the style's alpha is 0 or 255 only"));
        }
    }

    /// <summary>A sprite sheet's grid: its frames fit it exactly, and its last row is not empty.</summary>
    private static void Frames(List<StudioCheckProblem> problems, StudioAsset asset, int width, int height)
    {
        if (asset.Frames is not { } frames)
        {
            problems.Add(new(asset.AssetId, "frames_mismatch", "A sprite sheet names its frames: their width, height and count"));
            return;
        }

        if (width % frames.Width != 0 || height % frames.Height != 0)
        {
            problems.Add(new(asset.AssetId, "frames_mismatch", $"It is {width}×{height}: not a grid of {frames.Width}×{frames.Height} frames"));
            return;
        }

        var (columns, rows) = (width / frames.Width, height / frames.Height);
        if (frames.Count > columns * rows || frames.Count <= columns * (rows - 1))
        {
            problems.Add(new(asset.AssetId, "frames_mismatch", $"Its grid of {columns}×{rows} frames does not hold {frames.Count}: at most {columns * rows}, and its last row not empty"));
        }
    }

    /// <summary>
    /// A Wang tileset: tiles the size of its frames (or of the style's tile), and every pair of edges with the same label —
    /// east with west, south with north — the same outermost pixels.
    /// </summary>
    private static void Wang(List<StudioCheckProblem> problems, StudioAsset asset, AssetWang wang, StudioStyle? style, Pixels pixels)
    {
        var size = asset.Frames is { } frames ? (frames.Width, frames.Height) : style?.TileSize is { } tile ? (tile, tile) : ((int, int)?)null;
        if (size is not var (tileWidth, tileHeight)
            || pixels.Width % tileWidth != 0
            || pixels.Height % tileHeight != 0
            || wang.Tiles.Length > (pixels.Width / tileWidth) * (pixels.Height / tileHeight))
        {
            problems.Add(new(asset.AssetId, "frames_mismatch", $"Its {wang.Tiles.Length} Wang tiles do not fit a grid of its frames' size, or of its style's tile"));
            return;
        }

        var columns = pixels.Width / tileWidth;
        string Edge(int tile, int side)
        {
            var (left, top) = (tile % columns * tileWidth, tile / columns * tileHeight);
            var edge = new StringBuilder();
            var length = side is 0 or 2 ? tileWidth : tileHeight;
            for (var i = 0; i < length; i++)
            {
                var (x, y) = side switch
                {
                    0 => (left + i, top),
                    1 => (left + tileWidth - 1, top + i),
                    2 => (left + i, top + tileHeight - 1),
                    _ => (left, top + i),
                };
                var (r, g, b, a) = pixels.At(x, y);
                edge.Append(CultureInfo.InvariantCulture, $"{r:x2}{g:x2}{b:x2}{a:x2}");
            }

            return edge.ToString();
        }

        // East meets west, south meets north: per label, every such edge holds the same pixels.
        foreach (var (one, other, axis) in new[] { (1, 3, "east and west"), (2, 0, "south and north") })
        {
            var labels = wang.Tiles.Select(tile => tile[one]).Concat(wang.Tiles.Select(tile => tile[other])).Distinct(StringComparer.Ordinal);
            foreach (var label in labels)
            {
                var edges = Enumerable.Range(0, wang.Tiles.Length)
                    .SelectMany(tile => new[] { (Tile: tile, Side: one), (Tile: tile, Side: other) })
                    .Where(edge => wang.Tiles[edge.Tile][edge.Side] == label)
                    .Select(edge => (edge.Tile, Pixels: Edge(edge.Tile, edge.Side)))
                    .ToList();
                if (edges.FirstOrDefault(edge => edge.Pixels != edges[0].Pixels) is { Pixels: not null } differs)
                {
                    problems.Add(new(asset.AssetId, "tile_edges_differ", $"Its {axis} edges labelled {label} do not meet: tile {differs.Tile} differs from tile {edges[0].Tile}"));
                }
            }
        }
    }

    /// <summary>A PNG without its metadata: the same array when it had none.</summary>
    private static (Stripping, byte[]) StripPng(byte[] content)
    {
        var kept = new List<(int Start, int Length)>();
        var removed = false;
        var position = PngSignature.Length;
        var ended = false;
        while (position < content.Length)
        {
            if (position + 12 > content.Length)
            {
                return (Stripping.Malformed, content);
            }

            var length = BinaryPrimitives.ReadUInt32BigEndian(content.AsSpan(position));
            if (length > int.MaxValue - 12 || position + 12L + length > content.Length)
            {
                return (Stripping.Malformed, content);
            }

            var type = Encoding.ASCII.GetString(content, position + 4, 4);
            if (type is "acTL" or "fcTL" or "fdAT")
            {
                return (Stripping.Animated, content);
            }

            var size = 12 + (int)length;
            if (PngKept.Contains(type))
            {
                kept.Add((position, size));
            }
            else
            {
                removed = true;
            }

            position += size;
            if (type == "IEND")
            {
                ended = true;
                break;
            }
        }

        if (!ended)
        {
            return (Stripping.Malformed, content);
        }

        // Anything after the end goes too.
        if (!removed && position == content.Length)
        {
            return (Stripping.Done, content);
        }

        using var stripped = new MemoryStream();
        stripped.Write(PngSignature);
        foreach (var (start, length) in kept)
        {
            stripped.Write(content, start, length);
        }

        return (Stripping.Done, stripped.ToArray());
    }

    /// <summary>A WebP without its metadata: the same array when it had none.</summary>
    private static (Stripping, byte[]) StripWebp(byte[] content)
    {
        var riff = BinaryPrimitives.ReadUInt32LittleEndian(content.AsSpan(4));
        if (riff < 4 || 8L + riff > content.Length)
        {
            return (Stripping.Malformed, content);
        }

        var end = 8 + (int)riff;
        var kept = new List<(int Start, int Length, string Type)>();
        var removed = end != content.Length;
        var position = 12;
        while (position < end)
        {
            if (position + 8 > end)
            {
                return (Stripping.Malformed, content);
            }

            var type = Encoding.ASCII.GetString(content, position, 4);
            var length = BinaryPrimitives.ReadUInt32LittleEndian(content.AsSpan(position + 4));
            if (position + 8L + length > end)
            {
                return (Stripping.Malformed, content);
            }

            if (type is "ANIM" or "ANMF")
            {
                return (Stripping.Animated, content);
            }

            var size = 8 + (int)length;
            if (WebpKept.Contains(type))
            {
                kept.Add((position, size, type));
            }
            else
            {
                removed = true;
            }

            position += size + (int)(length & 1);
        }

        if (!removed)
        {
            return (Stripping.Done, content);
        }

        using var stripped = new MemoryStream();
        stripped.Write("RIFF\0\0\0\0WEBP"u8);
        foreach (var (start, length, type) in kept)
        {
            var chunk = content.AsSpan(start, length).ToArray();
            if (type == "VP8X" && chunk.Length > 8)
            {
                // The flags say no EXIF (0x08) and no XMP (0x04) any more.
                chunk[8] &= 0xF3;
            }

            stripped.Write(chunk);
            if ((length & 1) == 1)
            {
                stripped.WriteByte(0);
            }
        }

        var bytes = stripped.ToArray();
        BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(4), (uint)(bytes.Length - 8));
        return (Stripping.Done, bytes);
    }

    /// <summary>A decoded picture: unpremultiplied RGBA, row by row.</summary>
    private sealed record Pixels(byte[] Rgba, int Width, int Height)
    {
        public (byte R, byte G, byte B, byte A) At(int x, int y)
        {
            var at = ((y * Width) + x) * 4;
            return (Rgba[at], Rgba[at + 1], Rgba[at + 2], Rgba[at + 3]);
        }
    }
}
