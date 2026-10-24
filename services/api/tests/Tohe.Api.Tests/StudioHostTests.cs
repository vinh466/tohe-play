using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Net.Http.Headers;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Studio;

namespace Tohe.Api.Tests;

/// <summary>
/// The Studio on a host of its own (ADR 0051), the console's shape: with <c>App:StudioUrl</c> set, the Studio's routes
/// answer on its host alone and nothing else of the API answers there, the Studio's origin reaches only them, and the
/// Studio's address decides its cookie's name. Unset — production until the Studio's DNS exists — the routes answer on
/// any host but the console's, as before the app. A session refused on a Studio route ends the Studio's, never the
/// player's. <c>GET /api/studio/config</c> tells the app the hub's address before anyone signs in.
/// </summary>
public sealed class StudioHostTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    /// <summary>The Studio's host in these tests.</summary>
    private static readonly Uri StudioUrl = new("http://studio.tohe.test");

    private static string StudioOrigin => StudioUrl.GetLeftPart(UriPartial.Authority);

    /// <summary>The API with the Studio's address set, the hub's too.</summary>
    private WebApplicationFactory<Program> WithStudioHost(string publicUrl = "http://localhost", string? studioUrl = null) =>
        factory.WithWebHostBuilder(builder => builder
            .UseSetting("App:PublicUrl", publicUrl)
            .UseSetting("App:StudioUrl", studioUrl ?? StudioUrl.ToString()));

    private static HttpClient StudioClient(WebApplicationFactory<Program> app, Uri? studioUrl = null) =>
        app.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = studioUrl ?? StudioUrl });

    [Fact]
    public async Task With_a_studio_url_the_studios_routes_answer_on_its_host_alone_and_nothing_else_does()
    {
        await using var app = WithStudioHost();
        var studio = StudioClient(app);
        var hub = app.CreateClient();
        var console = Admins.ConsoleClient(app);

        Assert.Equal(HttpStatusCode.NoContent, (await studio.GetAsync(Url("/api/studio/session"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await studio.GetAsync(Url("/api/studio/packs"), Ct)).StatusCode);
        // The hub's and the console's hosts answer the Studio's routes 404 …
        Assert.Equal(HttpStatusCode.NotFound, (await hub.GetAsync(Url("/api/studio/session"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await hub.GetAsync(Url("/api/studio/config"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await console.GetAsync(Url("/api/studio/session"), Ct)).StatusCode);
        // … and the Studio's host every other route: the players', the console's, the platform's.
        Assert.Equal(HttpStatusCode.NotFound, (await studio.GetAsync(Url("/api/auth/me"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await studio.GetAsync(Url("/api/admin/me"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await studio.GetAsync(Url("/api/health"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await studio.GetAsync(Url("/api/config"), Ct)).StatusCode);
        // The hub's own routes still answer there.
        Assert.Equal(HttpStatusCode.NoContent, (await hub.GetAsync(Url("/api/auth/me"), Ct)).StatusCode);

        // A forwarded host is not the Studio's host: the API reads the Host header alone.
        var forwarded = new HttpRequestMessage(HttpMethod.Get, Url("/api/studio/session"));
        forwarded.Headers.Add("X-Forwarded-Host", StudioUrl.Authority);
        Assert.Equal(HttpStatusCode.NotFound, (await hub.SendAsync(forwarded, Ct)).StatusCode);

        // Signing in works on the Studio's host, and the session holds there.
        var member = await Studio.NewAsync(factory, StudioRole.Contributor, twoFactor: false);
        var signedIn = await studio.PostAsJsonAsync(Url("/api/studio/session"), Studio.SignIn(member), Ct);
        Assert.Equal(HttpStatusCode.OK, signedIn.StatusCode);
        Assert.Equal(StudioSession.CookieName, Assert.Single(SetCookies(signedIn)).Name.ToString());
        Assert.Equal(HttpStatusCode.OK, (await studio.GetAsync(Url("/api/studio/session"), Ct)).StatusCode);
    }

    [Fact]
    public async Task Without_a_studio_url_the_studios_routes_answer_on_any_host_but_the_consoles()
    {
        var hub = factory.CreateClient();
        Assert.Equal(HttpStatusCode.NoContent, (await hub.GetAsync(Url("/api/studio/session"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await hub.GetAsync(Url("/api/studio/config"), Ct)).StatusCode);
        var elsewhere = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = StudioUrl });
        Assert.Equal(HttpStatusCode.NoContent, (await elsewhere.GetAsync(Url("/api/studio/session"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Admins.ConsoleClient(factory).GetAsync(Url("/api/studio/session"), Ct)).StatusCode);

        // A browser's sign-in from the hub's origin goes through, as before the Studio's app.
        var member = await Studio.NewAsync(factory, StudioRole.Contributor, twoFactor: false);
        var fromHub = new HttpRequestMessage(HttpMethod.Post, Url("/api/studio/session")) { Content = JsonContent.Create(Studio.SignIn(member)) };
        fromHub.Headers.Add("Origin", "http://localhost");
        fromHub.Headers.Add("Sec-Fetch-Site", "same-origin");
        Assert.Equal(HttpStatusCode.OK, (await factory.CreateClient().SendAsync(fromHub, Ct)).StatusCode);
    }

    [Fact]
    public async Task The_studios_origin_is_accepted_only_for_the_studios_routes_and_they_only_from_it()
    {
        await using var app = WithStudioHost();
        var member = await Studio.NewAsync(factory, StudioRole.Contributor, twoFactor: false);
        var studio = StudioClient(app);

        var hubOrigin = new HttpRequestMessage(HttpMethod.Post, Url("/api/studio/session")) { Content = JsonContent.Create(Studio.SignIn(member)) };
        hubOrigin.Headers.Add("Origin", "http://localhost");
        Assert.Equal("cross_origin", await CodeOfAsync(await studio.SendAsync(hubOrigin, Ct)));
        var consoleOrigin = new HttpRequestMessage(HttpMethod.Post, Url("/api/studio/session")) { Content = JsonContent.Create(Studio.SignIn(member)) };
        consoleOrigin.Headers.Add("Origin", Admins.ConsoleUrl.GetLeftPart(UriPartial.Authority));
        Assert.Equal("cross_origin", await CodeOfAsync(await studio.SendAsync(consoleOrigin, Ct)));

        var own = new HttpRequestMessage(HttpMethod.Post, Url("/api/studio/session")) { Content = JsonContent.Create(Studio.SignIn(member)) };
        own.Headers.Add("Origin", StudioOrigin);
        own.Headers.Add("Sec-Fetch-Site", "same-origin");
        Assert.Equal(HttpStatusCode.OK, (await studio.SendAsync(own, Ct)).StatusCode);

        // The Studio's origin reaches nothing else: neither the players' routes nor the console's.
        var toHub = new HttpRequestMessage(HttpMethod.Post, Url("/api/auth/login")) { Content = JsonContent.Create(new { email = member.Email, password = Accounts.Password }) };
        toHub.Headers.Add("Origin", StudioOrigin);
        Assert.Equal("cross_origin", await CodeOfAsync(await app.CreateClient().SendAsync(toHub, Ct)));
        var toConsole = new HttpRequestMessage(HttpMethod.Post, Url("/api/admin/session")) { Content = JsonContent.Create(new { email = member.Email, password = Accounts.Password }) };
        toConsole.Headers.Add("Origin", StudioOrigin);
        Assert.Equal("cross_origin", await CodeOfAsync(await Admins.ConsoleClient(app).SendAsync(toConsole, Ct)));
    }

    [Fact]
    public async Task The_studios_address_decides_its_cookie_not_the_hubs()
    {
        // An HTTPS Studio beside a plain-HTTP hub: Secure, and locked to the Studio's host.
        await using (var https = WithStudioHost("http://tohe.example.test", "https://studio.example.test"))
        {
            var member = await Studio.NewAsync(factory, StudioRole.Contributor, twoFactor: false);
            var signedIn = await StudioClient(https, new Uri("http://studio.example.test"))
                .PostAsJsonAsync(Url("/api/studio/session"), Studio.SignIn(member), Ct);
            Assert.Equal(HttpStatusCode.OK, signedIn.StatusCode);
            var cookie = Assert.Single(SetCookies(signedIn));
            Assert.Equal(StudioSession.SecureCookieName, cookie.Name.ToString());
            Assert.Equal(
                (true, true, Microsoft.Net.Http.Headers.SameSiteMode.Strict, "/", 0),
                (cookie.Secure, cookie.HttpOnly, cookie.SameSite, cookie.Path.ToString(), cookie.Domain.Length));
        }

        // A plain-HTTP Studio beside an HTTPS hub (UAT's shape, turned round): the plain name, not Secure.
        await using var http = WithStudioHost("https://tohe.example.test", "http://studio.example.test");
        var other = await Studio.NewAsync(factory, StudioRole.Contributor, twoFactor: false);
        var plain = await StudioClient(http, new Uri("http://studio.example.test"))
            .PostAsJsonAsync(Url("/api/studio/session"), Studio.SignIn(other), Ct);
        Assert.Equal(HttpStatusCode.OK, plain.StatusCode);
        var plainCookie = Assert.Single(SetCookies(plain));
        Assert.Equal((StudioSession.CookieName, false), (plainCookie.Name.ToString(), plainCookie.Secure));
    }

    [Theory]
    [InlineData("https://studio.example.test/studio")]
    [InlineData("studio.example.test")]
    [InlineData("ftp://studio.example.test")]
    // A host of its own (ADR 0051): never the hub's, the console's (ApiFactory: Admins.ConsoleUrl) nor the games'.
    [InlineData("https://tohe.example.test")]
    [InlineData("http://console.tohe.test")]
    [InlineData("https://games.example.test")]
    public void A_studio_url_that_is_not_an_origin_of_its_own_stops_the_api_from_starting(string studioUrl)
    {
        using var misconfigured = factory.WithWebHostBuilder(builder => builder
            .UseSetting("App:PublicUrl", "https://tohe.example.test")
            .UseSetting("App:StudioUrl", studioUrl));

        var error = Assert.ThrowsAny<Exception>(() => misconfigured.CreateClient());

        Assert.Contains("App:StudioUrl", error.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task The_config_tells_the_hubs_address_and_the_apis_version_before_anyone_signs_in()
    {
        await using var app = WithStudioHost("https://tohe.example.test/");
        var config = (await StudioClient(app).GetFromJsonAsync<StudioConfig>(Url("/api/studio/config"), Ct))!;
        Assert.Equal("https://tohe.example.test", config.HubUrl);
        Assert.False(string.IsNullOrEmpty(config.ApiVersion));

        // No hub address configured: none told.
        var bare = (await factory.CreateClient().GetFromJsonAsync<StudioConfig>(Url("/api/studio/config"), Ct))!;
        Assert.Null(bare.HubUrl);
    }

    [Theory]
    [InlineData("/api/studio/probe/refused", StudioSession.CookieName, "tohe.session")]
    [InlineData("/api/probe/refused", "tohe.session", StudioSession.CookieName)]
    public async Task A_session_refused_on_a_studio_route_ends_the_studios_session_never_the_players(
        string path, string ended, string kept)
    {
        await using var app = factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.AddSingleton<IStartupFilter, RefusingStartup>()));

        var refused = await app.CreateClient().GetAsync(Url(path), Ct);

        Assert.Equal((HttpStatusCode.Forbidden, "account_suspended"), (refused.StatusCode, await CodeOfAsync(refused)));
        var cleared = SetCookieHeaderValue.ParseList([.. refused.Headers.GetValues("Set-Cookie")]);
        var cookie = Assert.Single(cleared, c => c.Name.ToString() == ended);
        Assert.True(cookie.Expires < DateTimeOffset.UtcNow, "the cookie is cleared");
        Assert.DoesNotContain(cleared, c => c.Name.ToString() == kept);
    }

    /// <summary>
    /// After the app's own pipeline — inside its exception handler — a request no endpoint answered under
    /// <c>/…/probe/refused</c> meets a suspended account, as a session about to be written for one would.
    /// </summary>
    private sealed class RefusingStartup : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            next(app);
            app.Use((HttpContext context, RequestDelegate _) =>
                context.Request.Path.Value?.EndsWith("/probe/refused", StringComparison.Ordinal) == true
                    ? throw new AccountSuspendedException()
                    : Task.CompletedTask);
        };
    }

    private static IList<SetCookieHeaderValue> SetCookies(HttpResponseMessage response) =>
        response.Headers.TryGetValues("Set-Cookie", out var values)
            ? [.. SetCookieHeaderValue.ParseList([.. values]).Where(cookie => cookie.Value.Length > 0)]
            : [];

    private static async Task<string?> CodeOfAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync(Ct);
        if (body.Length == 0)
        {
            return null;
        }

        using var json = JsonDocument.Parse(body);
        return json.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    private static Uri Url(string path) => new(path, UriKind.Relative);
}
