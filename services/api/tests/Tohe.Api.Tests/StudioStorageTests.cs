using System.Net;
using Amazon.Runtime;
using Microsoft.Extensions.Options;
using Tohe.Api.Modules.Studio;

namespace Tohe.Api.Tests;

/// <summary>
/// What the Studio's storage sends over the wire for an upload. Cloudflare R2, production's storage, refuses the streaming
/// SigV4 the AWS SDK signs an upload with by default; SeaweedFS, which the other tests run on over HTTP, takes it — so
/// only the requests themselves show the difference. No storage: the SDK's HTTP client answers here.
/// </summary>
public sealed class StudioStorageTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task An_upload_over_https_is_one_unsigned_payload_as_R2_takes_it()
    {
        var wire = new Wire();
        using var storage = Storage("https://account.r2.example.test", wire);

        await storage.PutAsync("drafts/one/file.png", "picture"u8.ToArray(), "image/png", published: false, Ct);

        var request = Assert.Single(wire.Requests);
        Assert.Equal(HttpMethod.Put, request.Method);
        Assert.Equal("/tohe-studio/drafts/one/file.png", request.Path);
        Assert.Equal("UNSIGNED-PAYLOAD", request.ContentSha256);
        Assert.DoesNotContain("aws-chunked", request.ContentEncoding);
        Assert.Null(request.Trailer);
        Assert.Equal("picture"u8.ToArray(), request.Body);
    }

    [Fact]
    public async Task An_upload_over_http_keeps_a_signed_payload_which_needs_no_tls()
    {
        var wire = new Wire();
        using var storage = Storage("http://seaweedfs.example.test:8333", wire);

        await storage.PutAsync("drafts/one/file.png", "picture"u8.ToArray(), "image/png", published: false, Ct);

        var request = Assert.Single(wire.Requests);
        Assert.NotEqual("UNSIGNED-PAYLOAD", request.ContentSha256);
    }

    private static S3StudioStorage Storage(string serviceUrl, Wire wire) => new(
        Options.Create(new StudioOptions
        {
            Storage = new StudioStorageOptions
            {
                ServiceUrl = serviceUrl,
                Bucket = "tohe-studio",
                AccessKey = "key",
                SecretKey = "secret",
            },
        }),
        wire);

    /// <summary>A request as the storage sent it.</summary>
    private sealed record Sent(
        HttpMethod Method, string Path, string? ContentSha256, IReadOnlyList<string> ContentEncoding, string? Trailer, byte[] Body);

    /// <summary>The SDK's HTTP client, answering every request with 200 and keeping what it was sent.</summary>
    private sealed class Wire : HttpClientFactory
    {
        public List<Sent> Requests { get; } = [];

        public override HttpClient CreateHttpClient(IClientConfig clientConfig) => new(new Handler(this));

        public override bool UseSDKHttpClientCaching(IClientConfig clientConfig) => false;

        public override bool DisposeHttpClientsAfterUse(IClientConfig clientConfig) => true;

        private sealed class Handler(Wire wire) : HttpMessageHandler
        {
            protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                var body = request.Content is null ? [] : await request.Content.ReadAsByteArrayAsync(cancellationToken);
                wire.Requests.Add(new Sent(
                    request.Method,
                    request.RequestUri!.AbsolutePath,
                    request.Headers.TryGetValues("x-amz-content-sha256", out var sha256) ? sha256.Single() : null,
                    [.. request.Content?.Headers.ContentEncoding ?? []],
                    request.Headers.TryGetValues("x-amz-trailer", out var trailer) ? trailer.Single() : null,
                    body));
                var response = new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent([]) };
                response.Headers.ETag = new System.Net.Http.Headers.EntityTagHeaderValue("\"etag\"");
                return response;
            }
        }
    }
}
