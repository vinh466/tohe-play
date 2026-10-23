using System.Net;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Options;

namespace Tohe.Api.Modules.Studio;

/// <summary>The Studio's settings, section <c>Studio</c> (docs/architecture/asset-studio.md#configuration).</summary>
public sealed class StudioOptions
{
    public const string Section = "Studio";

    /// <summary>The most bytes of one uploaded file.</summary>
    public long MaxFileBytes { get; set; } = 8 * 1024 * 1024;

    /// <summary>The most bytes of uploaded files one creator keeps in versions still <c>draft</c> or <c>submitted</c>.</summary>
    public long DraftQuotaBytes { get; set; } = 256L * 1024 * 1024;

    /// <summary>Remove, once a day, drafts not submitted within 30 days.</summary>
    public bool DraftCleanupEnabled { get; set; } = true;

    public StudioStorageOptions Storage { get; set; } = new();
}

/// <summary>
/// The object storage of the Studio's library, through the S3 API (ADR 0051): Cloudflare R2 in production, SeaweedFS
/// locally. Secrets come from configuration — the secret store in production — never from the repository.
/// </summary>
public sealed class StudioStorageOptions
{
    /// <summary>The S3 endpoint, e.g. <c>https://&lt;account&gt;.r2.cloudflarestorage.com</c>.</summary>
    public string? ServiceUrl { get; set; }

    public string? Bucket { get; set; }

    public string? AccessKey { get; set; }

    public string? SecretKey { get; set; }

    /// <summary>The registry's public address: what the build tool reads as <c>TOHE_ASSETS_REGISTRY</c>.</summary>
    public string? PublicBaseUrl { get; set; }

    /// <summary>Storage exists once the endpoint, the bucket and the credentials are set.</summary>
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(ServiceUrl)
        && !string.IsNullOrWhiteSpace(Bucket)
        && !string.IsNullOrWhiteSpace(AccessKey)
        && !string.IsNullOrWhiteSpace(SecretKey);
}

/// <summary>An object read from the storage: its bytes as a stream, and what it is.</summary>
internal sealed record StudioObject(Stream Content, long Length, string ContentType) : IAsyncDisposable
{
    public ValueTask DisposeAsync() => Content.DisposeAsync();
}

/// <summary>
/// The Studio's object storage, by key (<see cref="StudioKeys"/>). Behind an interface of the module's own, so the
/// library does not depend on one vendor's SDK.
/// </summary>
internal interface IStudioStorage
{
    /// <summary>Whether storage is configured: without it, every endpoint of the library answers 503.</summary>
    bool IsConfigured { get; }

    /// <summary>Writes an object, replacing one of the same key.</summary>
    Task PutAsync(string key, ReadOnlyMemory<byte> content, string contentType, bool published, CancellationToken ct);

    /// <summary>Copies an object to another key.</summary>
    Task CopyAsync(string from, string to, string contentType, bool published, CancellationToken ct);

    Task<bool> ExistsAsync(string key, CancellationToken ct);

    /// <summary>The object, or null when there is none.</summary>
    Task<StudioObject?> ReadAsync(string key, CancellationToken ct);

    /// <summary>Deletes the object; nothing happens when there is none.</summary>
    Task DeleteAsync(string key, CancellationToken ct);

    /// <summary>Every key under a prefix.</summary>
    Task<IReadOnlyList<string>> ListAsync(string prefix, CancellationToken ct);
}

/// <summary>
/// The layout of the bucket (docs/architecture/asset-studio.md#storage): drafts and style samples private;
/// <c>blobs/</c> and <c>packs/</c> the registry the build tool reads (docs/guides/use-assets-in-a-game.md).
/// </summary>
internal static class StudioKeys
{
    public static string DraftPrefix(Guid versionId) => $"drafts/{versionId:D}/";

    public static string Draft(Guid versionId, string sha256, string ext) => $"{DraftPrefix(versionId)}{sha256}.{ext}";

    public static string StylePrefix(string styleId) => $"styles/{styleId}/";

    public static string StyleSample(string styleId, string sha256, string ext) => $"{StylePrefix(styleId)}{sha256}.{ext}";

    public static string Blob(string sha256, string ext) => $"blobs/sha256/{sha256}.{ext}";

    public static string Manifest(string packId, string version) => $"packs/{packId}/{version}.json";

    /// <summary>
    /// What a file of this extension is served as. Nothing that runs script (SVG, HTML): those are bytes, served as
    /// <c>application/octet-stream</c>.
    /// </summary>
    public static string ContentType(string ext) => ext switch
    {
        "png" => "image/png",
        "webp" => "image/webp",
        "jpg" or "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "json" => "application/json",
        "ogg" => "audio/ogg",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "m4a" => "audio/mp4",
        "woff2" => "font/woff2",
        "woff" => "font/woff",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        _ => "application/octet-stream",
    };
}

/// <summary>
/// The storage over the S3 API with the AWS SDK: path-style addressing and checksums only where the API requires them,
/// so Cloudflare R2 and SeaweedFS answer alike. A published object is cached for a year: it never changes.
/// </summary>
internal sealed class S3StudioStorage(IOptions<StudioOptions> options) : IStudioStorage, IDisposable
{
    private const string PublishedCacheControl = "public, max-age=31536000, immutable";
    private const string PrivateCacheControl = "private, no-store";

    private readonly StudioStorageOptions _settings = options.Value.Storage;
    private readonly Lazy<AmazonS3Client> _client = new(() => Create(options.Value.Storage));

    public bool IsConfigured => _settings.IsConfigured;

    private string Bucket => _settings.Bucket!;

    public async Task PutAsync(string key, ReadOnlyMemory<byte> content, string contentType, bool published, CancellationToken ct)
    {
        using var stream = new MemoryStream(content.ToArray(), writable: false);
        var request = new PutObjectRequest
        {
            BucketName = Bucket,
            Key = key,
            InputStream = stream,
            ContentType = contentType,
            AutoCloseStream = false,
        };
        request.Headers.CacheControl = published ? PublishedCacheControl : PrivateCacheControl;
        await _client.Value.PutObjectAsync(request, ct);
    }

    public async Task CopyAsync(string from, string to, string contentType, bool published, CancellationToken ct)
    {
        var request = new CopyObjectRequest
        {
            SourceBucket = Bucket,
            SourceKey = from,
            DestinationBucket = Bucket,
            DestinationKey = to,
            ContentType = contentType,
            MetadataDirective = S3MetadataDirective.REPLACE,
        };
        request.Headers.CacheControl = published ? PublishedCacheControl : PrivateCacheControl;
        await _client.Value.CopyObjectAsync(request, ct);
    }

    public async Task<bool> ExistsAsync(string key, CancellationToken ct)
    {
        try
        {
            await _client.Value.GetObjectMetadataAsync(new GetObjectMetadataRequest { BucketName = Bucket, Key = key }, ct);
            return true;
        }
        catch (AmazonS3Exception e) when (e.StatusCode == HttpStatusCode.NotFound)
        {
            return false;
        }
    }

    public async Task<StudioObject?> ReadAsync(string key, CancellationToken ct)
    {
        try
        {
            var response = await _client.Value.GetObjectAsync(new GetObjectRequest { BucketName = Bucket, Key = key }, ct);
            return new StudioObject(response.ResponseStream, response.ContentLength, response.Headers.ContentType ?? "application/octet-stream");
        }
        catch (AmazonS3Exception e) when (e.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task DeleteAsync(string key, CancellationToken ct) =>
        await _client.Value.DeleteObjectAsync(new DeleteObjectRequest { BucketName = Bucket, Key = key }, ct);

    public async Task<IReadOnlyList<string>> ListAsync(string prefix, CancellationToken ct)
    {
        var keys = new List<string>();
        var request = new ListObjectsV2Request { BucketName = Bucket, Prefix = prefix };
        ListObjectsV2Response response;
        do
        {
            response = await _client.Value.ListObjectsV2Async(request, ct);
            keys.AddRange((response.S3Objects ?? []).Select(entry => entry.Key));
            request.ContinuationToken = response.NextContinuationToken;
        }
        while (response.IsTruncated == true);

        return keys;
    }

    public void Dispose()
    {
        if (_client.IsValueCreated)
        {
            _client.Value.Dispose();
        }
    }

    private static AmazonS3Client Create(StudioStorageOptions settings)
    {
        if (!settings.IsConfigured)
        {
            throw new InvalidOperationException("The Studio's storage is not configured (Studio:Storage:*)");
        }

        return new AmazonS3Client(
            new BasicAWSCredentials(settings.AccessKey, settings.SecretKey),
            new AmazonS3Config
            {
                ServiceURL = settings.ServiceUrl,
                ForcePathStyle = true,
                // R2 takes "auto"; SeaweedFS takes the region the signature names.
                AuthenticationRegion = "auto",
                // Newer SDKs add checksums R2 and SeaweedFS do not all take: only where S3 requires one.
                RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED,
                ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED,
            });
    }
}
