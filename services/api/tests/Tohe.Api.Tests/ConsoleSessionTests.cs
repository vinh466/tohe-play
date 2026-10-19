using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Net.Http.Headers;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Admin;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Tests;

/// <summary>
/// The console's own sign-in and session (ADR 0042): an email, a password and a code from the authenticator, on the
/// console's host, for an account with a platform role and two-factor authentication on — the same refusal for
/// everyone else. Its cookie is of its own, SameSite=Strict, twelve hours, and holds apart from the players' session
/// both ways.
/// </summary>
public sealed class ConsoleSessionTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    [Fact]
    public async Task Signing_in_sets_a_cookie_of_its_own_strict_and_for_twelve_hours()
    {
        var (email, key, _) = await OperatorAsync("moderator");
        var console = Admins.ConsoleClient(factory);
        var signedIn = await console.PostAsJsonAsync(Url("/api/admin/session"), Admins.SignIn(email, key), Ct);
        Assert.Equal(HttpStatusCode.OK, signedIn.StatusCode);
        var me = (await signedIn.Content.ReadFromJsonAsync<AdminMeView>(Ct))!;
        Assert.Equal("moderator", me.Role);

        var cookie = Assert.Single(SetCookies(signedIn));
        Assert.Equal(ConsoleSession.CookieName, cookie.Name.ToString());
        Assert.True(cookie.HttpOnly);
        Assert.Equal(Microsoft.Net.Http.Headers.SameSiteMode.Strict, cookie.SameSite);
        Assert.Equal("/", cookie.Path.ToString());
        Assert.True(cookie.Domain.Length == 0, "no Domain attribute");
        // Over plain HTTP — development, UAT — the cookie cannot be Secure.
        Assert.False(cookie.Secure);
        Assert.InRange(cookie.Expires!.Value, DateTimeOffset.UtcNow.AddHours(11.9), DateTimeOffset.UtcNow.AddHours(12));
        Assert.Equal(cookie.Expires!.Value.ToUnixTimeSeconds(), me.OpenUntil.ToUnixTimeSeconds());
    }

    [Fact]
    public async Task On_https_the_cookie_is_secure_and_locked_to_the_consoles_host()
    {
        await using var app = factory.WithWebHostBuilder(builder => builder
            .UseSetting("App:PublicUrl", "https://tohe.example.test")
            .UseSetting("App:ConsoleUrl", "https://console.example.test"));
        var (email, key, _) = await OperatorAsync("viewer", app);
        var console = app.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("http://console.example.test") });
        var signedIn = await console.PostAsJsonAsync(Url("/api/admin/session"), Admins.SignIn(email, key), Ct);
        Assert.Equal(HttpStatusCode.OK, signedIn.StatusCode);

        var cookie = Assert.Single(SetCookies(signedIn));
        Assert.Equal(ConsoleSession.SecureCookieName, cookie.Name.ToString());
        Assert.Equal(
            (true, true, Microsoft.Net.Http.Headers.SameSiteMode.Strict, "/", 0),
            (cookie.Secure, cookie.HttpOnly, cookie.SameSite, cookie.Path.ToString(), cookie.Domain.Length));
    }

    [Fact]
    public async Task Everyone_without_a_console_gets_the_answer_a_wrong_password_gets()
    {
        var (email, key, _) = await OperatorAsync("admin");
        var player = Accounts.NewEmail();
        await Accounts.SignUpAsync(factory, factory.CreateClient(), "Người chơi", player);
        var roleOnly = Accounts.NewEmail();
        await Accounts.SignUpAsync(factory, factory.CreateClient(), "Có vai trò", roleOnly);
        Assert.Equal(0, (await Admins.CommandAsync(factory, "admin", "grant", roleOnly, "--role", "owner")).Exit);
        var code = Totp.Code(key, DateTimeOffset.UtcNow.AddSeconds(-30));

        var refusals = new List<(HttpStatusCode, string?)>();
        foreach (var body in (object[])[
            new { email, password = "sai-mat-khau", code },                       // wrong password
            new { email, password = Accounts.Password, code = "000000" },          // wrong code
            new { email, password = Accounts.Password },                           // no code at all
            new { email = player, password = Accounts.Password, code },            // a player: no role
            new { email = roleOnly, password = Accounts.Password, code },          // a role, no authenticator
            new { email = Accounts.NewEmail(), password = Accounts.Password, code }, // nobody
        ])
        {
            var refused = await Admins.ConsoleClient(factory).PostAsJsonAsync(Url("/api/admin/session"), body, Ct);
            refusals.Add((refused.StatusCode, await CodeOfAsync(refused)));
            Assert.Empty(SetCookies(refused));
        }

        Assert.All(refusals, refusal => Assert.Equal((HttpStatusCode.Unauthorized, "invalid_credentials"), refusal));
        // The right code still works after them.
        Assert.Equal(HttpStatusCode.OK, (await Admins.ConsoleClient(factory).PostAsJsonAsync(Url("/api/admin/session"), Admins.SignIn(email, key), Ct)).StatusCode);
    }

    [Fact]
    public async Task A_players_password_is_never_checked_and_its_lockout_stays_untouched()
    {
        var player = Accounts.NewEmail();
        var playerId = (await Accounts.SignUpAsync(factory, factory.CreateClient(), "Người chơi", player)).Account.Id;
        var roleOnly = Accounts.NewEmail();
        var roleOnlyId = (await Accounts.SignUpAsync(factory, factory.CreateClient(), "Có vai trò", roleOnly)).Account.Id;
        Assert.Equal(0, (await Admins.CommandAsync(factory, "admin", "grant", roleOnly, "--role", "owner")).Exit);
        // A count a right password would reset and a wrong one raise, were either checked.
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            await scope.ServiceProvider.GetRequiredService<ToheDbContext>().Users.Where(a => a.Id == playerId || a.Id == roleOnlyId)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.AccessFailedCount, 3), Ct);
        }

        foreach (var email in (string[])[player, roleOnly])
        {
            foreach (var password in (string[])[Accounts.Password, "sai-mat-khau"])
            {
                var refused = await Admins.ConsoleClient(factory).PostAsJsonAsync(
                    Url("/api/admin/session"), new { email, password, code = "123456" }, Ct);
                Assert.Equal((HttpStatusCode.Unauthorized, "invalid_credentials"), (refused.StatusCode, await CodeOfAsync(refused)));
            }
        }

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var counts = await scope.ServiceProvider.GetRequiredService<ToheDbContext>().Users.AsNoTracking()
                .Where(a => a.Id == playerId || a.Id == roleOnlyId)
                .Select(a => a.AccessFailedCount)
                .ToListAsync(Ct);
            Assert.Equal([3, 3], counts);
        }
    }

    [Fact]
    public async Task Suspended_and_deleting_accounts_do_not_get_in()
    {
        var owner = await Admins.NewAsync(factory, "owner");

        var (suspended, suspendedKey, suspendedId) = await OperatorAsync("moderator");
        await owner.Client.PostAsJsonAsync(Url($"/api/admin/users/{suspendedId}/suspend"), new { reason = "Thử" }, Ct);
        var refused = await Admins.ConsoleClient(factory).PostAsJsonAsync(Url("/api/admin/session"), Admins.SignIn(suspended, suspendedKey), Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "account_suspended"), (refused.StatusCode, await CodeOfAsync(refused)));
        // Told only to whoever knows the password and the code.
        var wrong = await Admins.ConsoleClient(factory).PostAsJsonAsync(
            Url("/api/admin/session"), new { email = suspended, password = "sai-mat-khau", code = "000000" }, Ct);
        Assert.Equal("invalid_credentials", await CodeOfAsync(wrong));

        var (deleting, deletingKey, deletingId) = await OperatorAsync("moderator");
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            await scope.ServiceProvider.GetRequiredService<ToheDbContext>().Users.Where(a => a.Id == deletingId)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.DeleteAfter, DateTimeOffset.UtcNow.AddDays(7)), Ct);
        }

        var waiting = await Admins.ConsoleClient(factory).PostAsJsonAsync(Url("/api/admin/session"), Admins.SignIn(deleting, deletingKey), Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "account_deleting"), (waiting.StatusCode, await CodeOfAsync(waiting)));
    }

    [Fact]
    public async Task The_players_session_is_refused_in_the_console_and_the_consoles_everywhere_else()
    {
        var (email, key, _) = await OperatorAsync("owner");
        var hub = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        var playerCookie = Cookie(await hub.PostAsJsonAsync(Url("/api/auth/login"), new { email, password = Accounts.Password }, Ct), ".AspNetCore.Identity.Application", "tohe.session");
        var console = Admins.ConsoleClient(factory);
        var signedIn = await console.PostAsJsonAsync(Url("/api/admin/session"), Admins.SignIn(email, key), Ct);
        var consoleCookie = Cookie(signedIn, ConsoleSession.CookieName);

        // On localhost and UAT the browser sends both cookies to both hosts: each counts only where it belongs.
        var bare = Admins.ConsoleClient(factory);
        Assert.Equal(HttpStatusCode.NoContent, (await SendAsync(bare, HttpMethod.Get, "/api/admin/me", playerCookie)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await SendAsync(bare, HttpMethod.Get, "/api/admin/overview", playerCookie)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(bare, HttpMethod.Get, "/api/admin/me", consoleCookie)).StatusCode);

        var player = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        Assert.Equal(HttpStatusCode.NoContent, (await SendAsync(player, HttpMethod.Get, "/api/auth/me", consoleCookie)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await SendAsync(player, HttpMethod.Get, "/api/account/two-factor", consoleCookie)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await SendAsync(player, HttpMethod.Post, "/api/session/step-up", consoleCookie)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(player, HttpMethod.Get, "/api/auth/me", playerCookie)).StatusCode);

        // And by host: the console's routes answer on its host alone, and nothing else answers there.
        Assert.Equal(HttpStatusCode.NotFound, (await SendAsync(player, HttpMethod.Get, "/api/admin/me", consoleCookie)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await SendAsync(bare, HttpMethod.Get, "/api/auth/me", playerCookie)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bare.GetAsync(Url("/api/health"), Ct)).StatusCode);

        // A forwarded host is not the console's host: the API reads the Host header alone.
        var forwarded = new HttpRequestMessage(HttpMethod.Get, Url("/api/admin/overview"));
        forwarded.Headers.Add("X-Forwarded-Host", Admins.ConsoleUrl.Authority);
        forwarded.Headers.Add("Cookie", consoleCookie);
        Assert.Equal(HttpStatusCode.NotFound, (await player.SendAsync(forwarded, Ct)).StatusCode);
    }

    [Fact]
    public async Task The_consoles_origin_is_accepted_only_for_the_consoles_routes()
    {
        var (email, key, _) = await OperatorAsync("viewer");
        var console = Admins.ConsoleClient(factory);
        var hubOrigin = new HttpRequestMessage(HttpMethod.Post, Url("/api/admin/session")) { Content = JsonContent.Create(Admins.SignIn(email, key)) };
        hubOrigin.Headers.Add("Origin", "http://localhost");
        Assert.Equal("cross_origin", await CodeOfAsync(await console.SendAsync(hubOrigin, Ct)));
        var own = new HttpRequestMessage(HttpMethod.Post, Url("/api/admin/session")) { Content = JsonContent.Create(Admins.SignIn(email, key)) };
        own.Headers.Add("Origin", Admins.ConsoleUrl.GetLeftPart(UriPartial.Authority));
        own.Headers.Add("Sec-Fetch-Site", "same-origin");
        Assert.Equal(HttpStatusCode.OK, (await console.SendAsync(own, Ct)).StatusCode);

        var fromConsole = new HttpRequestMessage(HttpMethod.Post, Url("/api/auth/login")) { Content = JsonContent.Create(new { email, password = Accounts.Password }) };
        fromConsole.Headers.Add("Origin", Admins.ConsoleUrl.GetLeftPart(UriPartial.Authority));
        Assert.Equal("cross_origin", await CodeOfAsync(await factory.CreateClient().SendAsync(fromConsole, Ct)));
    }

    [Fact]
    public async Task Step_up_level_2_opens_inside_the_console_session_and_keeps_its_end()
    {
        var owner = await Admins.NewAsync(factory, "owner");
        var player = await Accounts.SignUpAsync(factory, factory.CreateClient(), "Người chơi");
        var console = await Admins.SignInAsync(factory, owner.Email, owner.Key, step: 2);
        var before = (await console.GetFromJsonAsync<AdminMeView>(Url("/api/admin/me"), Ct))!;
        Assert.Null(before.SecureUntil);
        Assert.Equal("step_up_required", await CodeOfAsync(await SignOutPlayerAsync(console, player.Account.Id)));

        // The hub's step-up opens nothing here: it lives in the players' session.
        await Accounts.StepUpAsync(owner.Player);
        Assert.Equal("step_up_required", await CodeOfAsync(await SignOutPlayerAsync(console, player.Account.Id)));

        Assert.Equal("password_invalid", await CodeOfAsync(await console.PostAsJsonAsync(Url("/api/admin/session/step-up"), new { password = "sai-mat-khau" }, Ct)));
        var wrongCode = await console.PostAsJsonAsync(Url("/api/admin/session/step-up"), new { code = "000000" }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, wrongCode.StatusCode);

        // A code from the authenticator does it as well as the password.
        var stepped = await console.PostAsJsonAsync(Url("/api/admin/session/step-up"), new { code = Totp.Code(owner.Key, DateTimeOffset.UtcNow.AddSeconds(-30)) }, Ct);
        var after = (await stepped.Content.ReadFromJsonAsync<AdminMeView>(Ct))!;
        Assert.InRange(after.SecureUntil!.Value, DateTimeOffset.UtcNow.AddMinutes(9), DateTimeOffset.UtcNow.AddMinutes(10));
        Assert.Equal(before.OpenUntil, after.OpenUntil);
        Assert.Equal(before.OpenUntil.ToUnixTimeSeconds(), Assert.Single(SetCookies(stepped)).Expires!.Value.ToUnixTimeSeconds());
        Assert.Equal(HttpStatusCode.OK, (await SignOutPlayerAsync(console, player.Account.Id)).StatusCode);
    }

    [Fact]
    public async Task Signing_out_of_one_leaves_the_other_signed_in()
    {
        var admin = await Admins.NewAsync(factory, "viewer");
        Assert.Equal(HttpStatusCode.NoContent, (await admin.Client.DeleteAsync(Url("/api/admin/session"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.Client.GetAsync(Url("/api/admin/me"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.Player.GetAsync(Url("/api/auth/me"), Ct)).StatusCode);

        var console = await Admins.SignInAsync(factory, admin.Email, admin.Key, step: 2);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.Player.PostAsync(Url("/api/auth/logout"), null, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.Player.GetAsync(Url("/api/auth/me"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await console.GetAsync(Url("/api/admin/me"), Ct)).StatusCode);
    }

    [Fact]
    public async Task A_new_security_stamp_ends_the_console_session_at_once()
    {
        var admin = await Admins.NewAsync(factory, "admin");
        var owner = await Admins.NewAsync(factory, "owner");
        Assert.Equal(HttpStatusCode.OK, (await admin.Client.GetAsync(Url("/api/admin/me"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await owner.Client.PostAsync(Url($"/api/admin/users/{admin.AccountId}/sign-out"), null, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await admin.Client.GetAsync(Url("/api/admin/overview"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.Client.GetAsync(Url("/api/admin/me"), Ct)).StatusCode);
    }

    [Fact]
    public void The_sign_in_counts_in_the_sign_in_bucket_and_step_up_in_the_gates()
    {
        var endpoints = factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>().ToList();
        string? Bucket(string name) => endpoints
            .Single(endpoint => endpoint.Metadata.GetMetadata<IEndpointNameMetadata>()?.EndpointName == name)
            .Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName;
        Assert.Equal(IdentityModule.SignInRateLimit, Bucket("SignInToConsole"));
        Assert.Equal(IdentityModule.GateRateLimit, Bucket("StepUpInConsole"));
        Assert.Equal(IdentityModule.GateRateLimit, Bucket("ClaimAdminSetup"));
        Assert.Equal(IdentityModule.CodeRateLimit, Bucket("EnableTwoFactor"));
    }

    // ------------------------------------------------------------------ helpers

    /// <summary>An account with a role and an authenticator, signed in nowhere.</summary>
    private async Task<(string Email, string Key, Guid AccountId)> OperatorAsync(string role, WebApplicationFactory<Program>? app = null)
    {
        var email = Accounts.NewEmail();
        // Over HTTPS when the deployment is: its session cookie is Secure then.
        var player = app is null
            ? factory.CreateClient()
            : app.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });
        var me = await Accounts.SignUpAsync(factory, player, "Người vận hành", email);
        Assert.Equal(0, (await Admins.CommandAsync(factory, "admin", "grant", email, "--role", role)).Exit);
        return (email, await Admins.EnrolAsync(player), me.Account.Id);
    }

    private static Task<HttpResponseMessage> SignOutPlayerAsync(HttpClient console, Guid accountId) =>
        console.PostAsync(Url($"/api/admin/users/{accountId}/sign-out"), null, Ct);

    private static IList<SetCookieHeaderValue> SetCookies(HttpResponseMessage response) =>
        response.Headers.TryGetValues("Set-Cookie", out var values) ? SetCookieHeaderValue.ParseList([.. values]) : [];

    /// <summary>The cookie of one of these names that the response set, as a request sends it back.</summary>
    private static string Cookie(HttpResponseMessage response, params string[] names)
    {
        var cookie = SetCookies(response).Single(c => names.Contains(c.Name.ToString()));
        return $"{cookie.Name}={cookie.Value}";
    }

    private static Task<HttpResponseMessage> SendAsync(HttpClient client, HttpMethod method, string path, string cookie)
    {
        var request = new HttpRequestMessage(method, Url(path));
        request.Headers.Add("Cookie", cookie);
        if (method == HttpMethod.Post)
        {
            request.Content = JsonContent.Create(new { password = Accounts.Password });
        }

        return client.SendAsync(request, Ct);
    }

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
