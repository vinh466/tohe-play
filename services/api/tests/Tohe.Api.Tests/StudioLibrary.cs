using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Tohe.Api.Modules.Studio;

namespace Tohe.Api.Tests;

/// <summary>
/// A throwaway SeaweedFS (Apache-2.0) with its S3 gateway and one bucket, as the dev stack runs it: the Studio's object
/// storage in tests (ADR 0051), never a shared one.
/// </summary>
public sealed class SeaweedFs : IAsyncLifetime
{
    public const string Image = "chrislusf/seaweedfs:4.48";
    public const string Bucket = "tohe-studio";
    public const string AccessKey = "tohe";
    public const string SecretKey = "tohe-test-only";

    private readonly IContainer _container = new ContainerBuilder(Image)
        .WithEnvironment("AWS_ACCESS_KEY_ID", AccessKey)
        .WithEnvironment("AWS_SECRET_ACCESS_KEY", SecretKey)
        .WithCommand("mini", "-dir=/data", $"-bucket={Bucket}", "-admin.ui=false")
        .WithPortBinding(8333, assignRandomHostPort: true)
        .WithWaitStrategy(Wait.ForUnixContainer().UntilMessageIsLogged($"created bucket {Bucket}"))
        .Build();

    private AmazonS3Client? _client;

    public string ServiceUrl => $"http://{_container.Hostname}:{_container.GetMappedPublicPort(8333)}";

    /// <summary>The bucket, read and written as the API does, to see what it left there.</summary>
    public AmazonS3Client Client => _client ??= new AmazonS3Client(
        new BasicAWSCredentials(AccessKey, SecretKey),
        new AmazonS3Config
        {
            ServiceURL = ServiceUrl,
            ForcePathStyle = true,
            AuthenticationRegion = "auto",
            RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED,
            ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED,
        });

    public async ValueTask InitializeAsync() => await _container.StartAsync();

    public async ValueTask DisposeAsync()
    {
        _client?.Dispose();
        await _container.DisposeAsync();
    }

    /// <summary>The object's bytes, or null when there is none.</summary>
    public async Task<byte[]?> ReadAsync(string key)
    {
        try
        {
            using var response = await Client.GetObjectAsync(Bucket, key, TestContext.Current.CancellationToken);
            using var bytes = new MemoryStream();
            await response.ResponseStream.CopyToAsync(bytes, TestContext.Current.CancellationToken);
            return bytes.ToArray();
        }
        catch (AmazonS3Exception e) when (e.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task PutAsync(string key, byte[] content)
    {
        using var stream = new MemoryStream(content);
        await Client.PutObjectAsync(new PutObjectRequest { BucketName = Bucket, Key = key, InputStream = stream }, TestContext.Current.CancellationToken);
    }

    /// <summary>Every key under a prefix.</summary>
    public async Task<IReadOnlyList<string>> KeysAsync(string prefix)
    {
        var response = await Client.ListObjectsV2Async(new ListObjectsV2Request { BucketName = Bucket, Prefix = prefix }, TestContext.Current.CancellationToken);
        return [.. (response.S3Objects ?? []).Select(entry => entry.Key)];
    }
}

/// <summary>The Studio's library as tests drive it: the API with storage, files, drafts and their review.</summary>
internal static class StudioLibrary
{
    public const string PublicBaseUrl = "https://assets.example.test";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    /// <summary>A file to upload: its bytes and its sha256.</summary>
    public sealed record TestFile(byte[] Bytes, string Sha256)
    {
        public long Length => Bytes.LongLength;
    }

    /// <summary>The API with the Studio's storage on <paramref name="storage"/>, and any other setting given.</summary>
    public static WebApplicationFactory<Program> WithStorage(
        ApiFactory factory, SeaweedFs storage, IReadOnlyDictionary<string, string>? settings = null) =>
        factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Studio:Storage:ServiceUrl", storage.ServiceUrl);
            builder.UseSetting("Studio:Storage:Bucket", SeaweedFs.Bucket);
            builder.UseSetting("Studio:Storage:AccessKey", SeaweedFs.AccessKey);
            builder.UseSetting("Studio:Storage:SecretKey", SeaweedFs.SecretKey);
            builder.UseSetting("Studio:Storage:PublicBaseUrl", PublicBaseUrl);
            foreach (var (key, value) in settings ?? new Dictionary<string, string>())
            {
                builder.UseSetting(key, value);
            }
        });

    /// <summary>The colour of every opaque pixel of <see cref="NewFile"/>: in the palette of every style the tests make.</summary>
    public const string Colour = "#aa5533";

    /// <summary>
    /// A new PNG that passes the checks of the tests' styles: random pixels, each <see cref="Colour"/> or transparent, so
    /// unique — tests never share a blob unless they mean to. Stored without compression and without metadata, so every
    /// file of one size has the same length and the upload keeps it as it is.
    /// </summary>
    public static TestFile NewFile(int width = 16, int height = 16) => Of(Png(width, height, (_, _) =>
        RandomNumberGenerator.GetInt32(2) == 0 ? (0xaa, 0x55, 0x33, 0xff) : (0, 0, 0, 0)));

    /// <summary>A file of random bytes, not a picture.</summary>
    public static TestFile NewBytes(int length) => Of(RandomNumberGenerator.GetBytes(length));

    public static TestFile Of(byte[] bytes) => new(bytes, Convert.ToHexStringLower(SHA256.HashData(bytes)));

    /// <summary>A PNG of 8-bit RGBA, its pixels from <paramref name="pixel"/>, with no chunk but IHDR, IDAT and IEND.</summary>
    public static byte[] Png(int width, int height, Func<int, int, (int R, int G, int B, int A)> pixel)
    {
        var raw = new byte[height * ((width * 4) + 1)];
        for (var y = 0; y < height; y++)
        {
            for (var x = 0; x < width; x++)
            {
                var (r, g, b, a) = pixel(x, y);
                var at = (y * ((width * 4) + 1)) + 1 + (x * 4);
                (raw[at], raw[at + 1], raw[at + 2], raw[at + 3]) = ((byte)r, (byte)g, (byte)b, (byte)a);
            }
        }

        using var data = new MemoryStream();
        using (var zlib = new System.IO.Compression.ZLibStream(data, System.IO.Compression.CompressionLevel.NoCompression, leaveOpen: true))
        {
            zlib.Write(raw);
        }

        var header = new byte[13];
        System.Buffers.Binary.BinaryPrimitives.WriteInt32BigEndian(header, width);
        System.Buffers.Binary.BinaryPrimitives.WriteInt32BigEndian(header.AsSpan(4), height);
        (header[8], header[9]) = (8, 6);
        using var png = new MemoryStream();
        png.Write([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        Chunk(png, "IHDR", header);
        Chunk(png, "IDAT", data.ToArray());
        Chunk(png, "IEND", []);
        return png.ToArray();
    }

    private static void Chunk(Stream png, string type, byte[] data)
    {
        var length = new byte[4];
        System.Buffers.Binary.BinaryPrimitives.WriteInt32BigEndian(length, data.Length);
        png.Write(length);
        var body = System.Text.Encoding.ASCII.GetBytes(type).Concat(data).ToArray();
        png.Write(body);
        var crc = new byte[4];
        System.Buffers.Binary.BinaryPrimitives.WriteUInt32BigEndian(crc, Crc32(body));
        png.Write(crc);
    }

    private static uint Crc32(byte[] bytes)
    {
        var crc = 0xFFFFFFFFu;
        foreach (var b in bytes)
        {
            crc ^= b;
            for (var bit = 0; bit < 8; bit++)
            {
                crc = (crc & 1) != 0 ? (crc >> 1) ^ 0xEDB88320u : crc >> 1;
            }
        }

        return ~crc;
    }

    /// <summary>A client calling with an agent's token.</summary>
    public static HttpClient AgentClient(WebApplicationFactory<Program> app, string token)
    {
        var client = app.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    /// <summary>A new pack id, unique to the test.</summary>
    public static string NewId(string prefix) => $"{prefix}-{Guid.NewGuid():N}"[..Math.Min(40, prefix.Length + 13)];

    /// <summary>A style draft with no samples, made by <paramref name="client"/>; its id.</summary>
    public static async Task<string> NewStyleAsync(HttpClient client)
    {
        var id = NewId("style");
        var made = await client.PostAsJsonAsync(Url("/api/studio/styles"), new { id, name = "Đất nung", tileSize = 16, view = "top-down", palette = new[] { "#aa5533", "#ffeecc" } }, Ct);
        Assert.Equal(HttpStatusCode.OK, made.StatusCode);
        return id;
    }

    /// <summary>The metadata of one asset of a file; its size in pixels is the upload's to read.</summary>
    public static object Asset(string id, TestFile file, string licence = "CC0-1.0", string? attribution = null, string kind = "image", object? source = null, string ext = "png") => new
    {
        id,
        kind,
        sha256 = file.Sha256,
        ext,
        bytes = file.Length,
        tags = new[] { "test" },
        licence,
        attribution,
        source = source ?? new { type = "code", script = "draw.ts" },
    };

    /// <summary>A reviewer approves a style.</summary>
    public static async Task ApproveStyleAsync(HttpClient reviewer, string styleId)
    {
        var approved = await reviewer.PostAsync(Url($"/api/studio/styles/{styleId}/approve"), null, Ct);
        Assert.Equal(HttpStatusCode.OK, approved.StatusCode);
    }

    public static async Task<HttpResponseMessage> CreateDraftAsync(HttpClient client, string packId, string version, string? styleId, params object[] assets) =>
        await client.PostAsJsonAsync(Url("/api/studio/drafts"), new { packId, version, styleId, description = "Rau củ trong vườn", assets }, Ct);

    /// <summary>A draft made, its files uploaded: its id.</summary>
    public static async Task<PackVersionView> DraftAsync(HttpClient client, string packId, string version, string? styleId, params (string Id, TestFile File)[] assets)
    {
        var made = await CreateDraftAsync(client, packId, version, styleId, [.. assets.Select(asset => Asset(asset.Id, asset.File))]);
        Assert.Equal(HttpStatusCode.OK, made.StatusCode);
        var draft = (await made.Content.ReadFromJsonAsync<PackVersionView>(Ct))!;
        foreach (var file in assets.Select(asset => asset.File).DistinctBy(file => file.Sha256))
        {
            Assert.Equal(HttpStatusCode.OK, (await UploadAsync(client, draft.Id, file)).StatusCode);
        }

        return draft;
    }

    /// <summary>A draft made, uploaded and submitted.</summary>
    public static async Task<PackVersionView> SubmittedAsync(HttpClient client, string packId, string version, string? styleId, params (string Id, TestFile File)[] assets)
    {
        var draft = await DraftAsync(client, packId, version, styleId, assets);
        var submitted = await client.PostAsync(Url($"/api/studio/drafts/{draft.Id}/submit"), null, Ct);
        Assert.Equal(HttpStatusCode.OK, submitted.StatusCode);
        return (await submitted.Content.ReadFromJsonAsync<PackVersionView>(Ct))!;
    }

    public static async Task<HttpResponseMessage> UploadAsync(HttpClient client, Guid versionId, TestFile file, byte[]? body = null)
    {
        using var content = new ByteArrayContent(body ?? file.Bytes);
        content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        return await client.PutAsync(Url($"/api/studio/drafts/{versionId}/files/{file.Sha256}"), content, Ct);
    }

    /// <summary>A reviewer signed in to the Studio with step-up open.</summary>
    public static async Task<HttpClient> ReviewerAsync(WebApplicationFactory<Program> app, ApiFactory factory)
    {
        var reviewer = await Studio.NewAsync(factory, StudioRole.Reviewer, twoFactor: true);
        var client = await Studio.SignInAsync(app, reviewer, step: 0);
        var stepUp = await client.PostAsJsonAsync(Url("/api/studio/session/step-up"), new { code = Studio.Code(reviewer, step: 1) }, Ct);
        Assert.Equal(HttpStatusCode.OK, stepUp.StatusCode);
        return client;
    }

    public static async Task<HttpResponseMessage> ReviewAsync(HttpClient client, Guid versionId, string action, object? body = null) =>
        await client.PostAsJsonAsync(Url($"/api/studio/versions/{versionId}/{action}"), body ?? new { }, Ct);

    public static async Task<PackVersionView> ApprovedAsync(HttpClient reviewer, Guid versionId)
    {
        var approved = await ReviewAsync(reviewer, versionId, "approve");
        Assert.Equal(HttpStatusCode.OK, approved.StatusCode);
        return (await approved.Content.ReadFromJsonAsync<PackVersionView>(Ct))!;
    }

    public static Uri Url(string path) => new(path, UriKind.Relative);
}
