using System.Net;
using System.Net.Http.Json;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Tests;

/// <summary>
/// The OpenID Connect handler as production configures it (ADR 0026), against a real issuer — navikt's
/// mock-oauth2-server in a container: discovery, the code in the query (never a cross-site POST to /api), PKCE, the
/// nonce, the ID token's signature and issuer, and the claims Tò He reads.
/// </summary>
public sealed class OpenIdConnectTests(ApiFactory factory) : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private const string Subject = "oidc-subject-1";

    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    private readonly string _email = Accounts.NewEmail();
    private IContainer _issuer = null!;
    private WebApplicationFactory<Program> _app = null!;

    public async ValueTask InitializeAsync()
    {
        var config = $$"""
            {
              "interactiveLogin": false,
              "tokenCallbacks": [
                {
                  "issuerId": "default",
                  "tokenExpiry": 120,
                  "requestMappings": [
                    {
                      "requestParam": "grant_type",
                      "match": "authorization_code",
                      "claims": { "sub": "{{Subject}}", "aud": "tohe", "email": "{{_email}}", "email_verified": true }
                    }
                  ]
                }
              ]
            }
            """;
        _issuer = new ContainerBuilder("ghcr.io/navikt/mock-oauth2-server:6.0.4")
            .WithEnvironment("JSON_CONFIG", config)
            .WithPortBinding(8080, assignRandomHostPort: true)
            .WithWaitStrategy(Wait.ForUnixContainer().UntilHttpRequestIsSucceeded(r => r.ForPort(8080).ForPath("/default/.well-known/openid-configuration")))
            .Build();
        await _issuer.StartAsync(Ct);

        var authority = $"http://localhost:{_issuer.GetMappedPublicPort(8080)}/default";
        _app = factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            services.AddAuthentication().AddOpenIdConnect(ExternalProviders.Oidc, "Mock", o =>
            {
                ExternalProviders.OpenIdConnect(o, ExternalProviders.Oidc, authority, new ExternalProviderOptions
                {
                    ClientId = "tohe",
                    ClientSecret = "secret",
                    RequireHttpsMetadata = false,
                });
                // TestServer speaks plain HTTP; production's cookies are Secure.
                o.NonceCookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
                o.CorrelationCookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
            });
            services.AddSingleton(new ExternalProviderCatalog([new ExternalProvider(ExternalProviders.Oidc, "Mock")]));
        }));
    }

    public async ValueTask DisposeAsync()
    {
        await _app.DisposeAsync();
        await _issuer.DisposeAsync();
    }

    [Fact]
    public async Task A_real_issuer_signs_someone_in_through_the_query_callback()
    {
        var browser = _app.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        using var internet = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false });

        var start = await browser.GetAsync(new Uri("/api/auth/external/oidc", UriKind.Relative), Ct);
        Assert.Equal(HttpStatusCode.Redirect, start.StatusCode);
        var authorize = start.Headers.Location!;
        // Query is the code flow's default, so the handler leaves response_mode out — never form_post.
        Assert.DoesNotContain("response_mode=form_post", authorize.Query, StringComparison.Ordinal);
        Assert.Contains("code_challenge=", authorize.Query, StringComparison.Ordinal);

        // The issuer answers at once (no login form) with a code, sent back in the query of a GET.
        var answer = await internet.GetAsync(authorize, Ct);
        Assert.Equal(HttpStatusCode.Found, answer.StatusCode);
        var callback = answer.Headers.Location!;
        Assert.Equal("/api/auth/external/oidc/callback", callback.AbsolutePath);

        var handled = await browser.GetAsync(new Uri(callback.PathAndQuery, UriKind.Relative), Ct);
        Assert.Equal(HttpStatusCode.Redirect, handled.StatusCode);
        var done = await browser.GetAsync(handled.Headers.Location, Ct);
        Assert.Equal("/account/sign-in/continue", done.Headers.Location!.OriginalString);

        // The issuer vouched for the address: sign-up only needs a name and the terms.
        var pending = (await browser.GetFromJsonAsync<PendingSignInView>(new Uri("/api/auth/external/pending", UriKind.Relative), Ct))!;
        Assert.Equal(("Mock", "signup", _email), (pending.Provider, pending.Step, pending.Email));
    }
}
