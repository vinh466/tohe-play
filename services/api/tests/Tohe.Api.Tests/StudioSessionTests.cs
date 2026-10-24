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
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Studio;

namespace Tohe.Api.Tests;

/// <summary>
/// The Studio's own sign-in and session (ADR 0051): an email, a password and — for a reviewer always, for anyone with
/// two-factor authentication on — a code, for an account with a studio role; the same refusal for everyone else. Its
/// cookie is of its own, SameSite=Strict, twelve hours, and holds apart from the players' and the console's sessions both
/// ways. The role is read again on every request, permissions decide, and review actions ask for a fresh code.
/// </summary>
public sealed class StudioSessionTests(ApiFactory factory) : IClassFixture<ApiFactory>, IAsyncDisposable
{
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    private readonly WebApplicationFactory<Program> _app = Studio.WithProbe(factory);

    public ValueTask DisposeAsync() => _app.DisposeAsync();

    [Fact]
    public async Task A_contributor_signs_in_with_the_password_and_gets_a_cookie_of_its_own_strict_for_twelve_hours()
    {
        var member = await Studio.NewAsync(factory, StudioRole.Contributor, twoFactor: false);
        var signedIn = await factory.CreateClient().PostAsJsonAsync(Url("/api/studio/session"), Studio.SignIn(member), Ct);
        Assert.Equal(HttpStatusCode.OK, signedIn.StatusCode);
        var me = (await signedIn.Content.ReadFromJsonAsync<StudioMeView>(Ct))!;
        Assert.Equal((member.AccountId, "contributor", false), (me.AccountId, me.Role, me.TwoFactorEnabled));
        Assert.Equal([StudioPermissions.Read, StudioPermissions.Contribute], me.Permissions);
        Assert.Null(me.SecureUntil);

        var cookie = Assert.Single(SetCookies(signedIn));
        Assert.Equal(StudioSession.CookieName, cookie.Name.ToString());
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
    public async Task On_https_the_cookie_is_secure_and_locked_to_its_host()
    {
        await using var app = factory.WithWebHostBuilder(builder => builder
            .UseSetting("App:PublicUrl", "https://tohe.example.test"));
        var member = await Studio.NewAsync(factory, StudioRole.Contributor, twoFactor: false);
        var signedIn = await app.CreateClient().PostAsJsonAsync(Url("/api/studio/session"), Studio.SignIn(member), Ct);
        Assert.Equal(HttpStatusCode.OK, signedIn.StatusCode);

        var cookie = Assert.Single(SetCookies(signedIn));
        Assert.Equal(StudioSession.SecureCookieName, cookie.Name.ToString());
        Assert.Equal(
            (true, true, Microsoft.Net.Http.Headers.SameSiteMode.Strict, "/", 0),
            (cookie.Secure, cookie.HttpOnly, cookie.SameSite, cookie.Path.ToString(), cookie.Domain.Length));
    }

    [Fact]
    public async Task A_reviewer_signs_in_with_a_code_and_a_contributor_with_two_factor_on_gives_one_too()
    {
        var reviewer = await Studio.NewAsync(factory, StudioRole.Reviewer, twoFactor: true);
        var signedIn = await factory.CreateClient().PostAsJsonAsync(Url("/api/studio/session"), Studio.SignIn(reviewer), Ct);
        Assert.Equal(HttpStatusCode.OK, signedIn.StatusCode);
        var me = (await signedIn.Content.ReadFromJsonAsync<StudioMeView>(Ct))!;
        Assert.Equal(("reviewer", true), (me.Role, me.TwoFactorEnabled));
        Assert.Equal([StudioPermissions.Read, StudioPermissions.Contribute, StudioPermissions.Review], me.Permissions);

        var contributor = await Studio.NewAsync(factory, StudioRole.Contributor, twoFactor: true);
        var noCode = await factory.CreateClient().PostAsJsonAsync(
            Url("/api/studio/session"), new { email = contributor.Email, password = Accounts.Password }, Ct);
        Assert.Equal((HttpStatusCode.Unauthorized, "invalid_credentials"), (noCode.StatusCode, await CodeOfAsync(noCode)));
        Assert.Equal(HttpStatusCode.OK, (await factory.CreateClient().PostAsJsonAsync(Url("/api/studio/session"), Studio.SignIn(contributor), Ct)).StatusCode);

        // A recovery code stands for a code, once.
        var recovery = (await Studio.RecoveryCodesAsync(factory, reviewer.AccountId))[0];
        var body = new { email = reviewer.Email, password = Accounts.Password, recoveryCode = recovery };
        Assert.Equal(HttpStatusCode.OK, (await factory.CreateClient().PostAsJsonAsync(Url("/api/studio/session"), body, Ct)).StatusCode);
        var again = await factory.CreateClient().PostAsJsonAsync(Url("/api/studio/session"), body, Ct);
        Assert.Equal("invalid_credentials", await CodeOfAsync(again));
    }

    [Fact]
    public async Task Everyone_without_the_studio_gets_the_answer_a_wrong_password_gets()
    {
        var reviewer = await Studio.NewAsync(factory, StudioRole.Reviewer, twoFactor: true);
        var contributor = await Studio.NewAsync(factory, StudioRole.Contributor, twoFactor: false);
        var noAuthenticator = await Studio.NewAsync(factory, StudioRole.Reviewer, twoFactor: false);
        var player = await Studio.NewAsync(factory, role: null, twoFactor: false);
        // An operator of the platform: a platform role and an authenticator, but no studio role.
        var owner = await Admins.NewAsync(factory, "owner");
        var code = Studio.Code(reviewer, step: -1);

        var refusals = new List<(HttpStatusCode, string?)>();
        foreach (var body in (object[])[
            new { email = reviewer.Email, password = "sai-mat-khau", code },                       // wrong password
            new { email = reviewer.Email, password = Accounts.Password, code = "000000" },          // wrong code
            new { email = reviewer.Email, password = Accounts.Password },                           // a reviewer gives no code
            new { email = contributor.Email, password = "sai-mat-khau" },                           // wrong password, no 2FA
            new { email = noAuthenticator.Email, password = Accounts.Password, code },              // a reviewer without an authenticator
            new { email = player.Email, password = Accounts.Password },                             // a player: no studio role
            new { email = owner.Email, password = Accounts.Password, code = Totp.Code(owner.Key, DateTimeOffset.UtcNow.AddSeconds(60)) }, // a platform owner, no studio role
            new { email = Accounts.NewEmail(), password = Accounts.Password, code },                // nobody
        ])
        {
            var refused = await factory.CreateClient().PostAsJsonAsync(Url("/api/studio/session"), body, Ct);
            refusals.Add((refused.StatusCode, await CodeOfAsync(refused)));
            Assert.Empty(SetCookies(refused));
        }

        Assert.All(refusals, refusal => Assert.Equal((HttpStatusCode.Unauthorized, "invalid_credentials"), refusal));
        // The right code still works after them.
        Assert.Equal(HttpStatusCode.OK, (await factory.CreateClient().PostAsJsonAsync(Url("/api/studio/session"), Studio.SignIn(reviewer, step: 1), Ct)).StatusCode);
    }

    [Fact]
    public async Task The_password_of_an_account_that_may_not_sign_in_is_never_checked()
    {
        var player = await Studio.NewAsync(factory, role: null, twoFactor: false);
        var noAuthenticator = await Studio.NewAsync(factory, StudioRole.Reviewer, twoFactor: false);
        await SetFailuresAsync([player.AccountId, noAuthenticator.AccountId], 3);

        foreach (var email in (string[])[player.Email, noAuthenticator.Email])
        {
            foreach (var password in (string[])[Accounts.Password, "sai-mat-khau"])
            {
                var refused = await factory.CreateClient().PostAsJsonAsync(
                    Url("/api/studio/session"), new { email, password, code = "123456" }, Ct);
                Assert.Equal((HttpStatusCode.Unauthorized, "invalid_credentials"), (refused.StatusCode, await CodeOfAsync(refused)));
            }
        }

        await using var scope = factory.Services.CreateAsyncScope();
        var counts = await scope.ServiceProvider.GetRequiredService<ToheDbContext>().Users.AsNoTracking()
            .Where(a => a.Id == player.AccountId || a.Id == noAuthenticator.AccountId)
            .Select(a => a.AccessFailedCount)
            .ToListAsync(Ct);
        Assert.Equal([3, 3], counts);
    }

    [Fact]
    public async Task Suspended_and_deleting_accounts_are_told_only_after_the_proof()
    {
        var suspended = await Studio.NewAsync(factory, StudioRole.Reviewer, twoFactor: true);
        var deleting = await Studio.NewAsync(factory, StudioRole.Contributor, twoFactor: false);
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
            await db.Users.Where(a => a.Id == suspended.AccountId)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.SuspendedAt, DateTimeOffset.UtcNow), Ct);
            await db.Users.Where(a => a.Id == deleting.AccountId)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.DeleteAfter, DateTimeOffset.UtcNow.AddDays(7)), Ct);
        }

        var wrong = await factory.CreateClient().PostAsJsonAsync(
            Url("/api/studio/session"), new { email = suspended.Email, password = Accounts.Password, code = "000000" }, Ct);
        Assert.Equal("invalid_credentials", await CodeOfAsync(wrong));
        var refused = await factory.CreateClient().PostAsJsonAsync(Url("/api/studio/session"), Studio.SignIn(suspended), Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "account_suspended"), (refused.StatusCode, await CodeOfAsync(refused)));

        var waiting = await factory.CreateClient().PostAsJsonAsync(Url("/api/studio/session"), Studio.SignIn(deleting), Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "account_deleting"), (waiting.StatusCode, await CodeOfAsync(waiting)));
        Assert.Empty(SetCookies(waiting));
    }

    [Fact]
    public async Task The_players_and_the_consoles_sessions_count_for_nothing_here_and_the_studios_nowhere_else()
    {
        var owner = await Admins.NewAsync(factory, "owner");
        await Studio.GrantAsync(factory, owner.AccountId, StudioRole.Reviewer);
        var member = new Studio.Member(owner.Email, owner.AccountId, owner.Key);
        var hub = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        var playerCookie = Cookie(await hub.PostAsJsonAsync(Url("/api/auth/login"), new { email = owner.Email, password = Accounts.Password }, Ct), ".AspNetCore.Identity.Application", "tohe.session");
        var consoleSignIn = await Admins.ConsoleClient(factory).PostAsJsonAsync(Url("/api/admin/session"), Admins.SignIn(owner.Email, owner.Key, step: 2), Ct);
        var consoleCookie = Cookie(consoleSignIn, "tohe.console");
        var studioCookie = Cookie(await hub.PostAsJsonAsync(Url("/api/studio/session"), Studio.SignIn(member, step: -1), Ct), StudioSession.CookieName);

        // On localhost and UAT the browser sends every cookie to every port: each counts only where it belongs.
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(hub, HttpMethod.Get, "/api/studio/session", studioCookie)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await SendAsync(hub, HttpMethod.Get, "/api/studio/session", playerCookie)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await SendAsync(hub, HttpMethod.Get, "/api/studio/session", consoleCookie)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await SendAsync(hub, HttpMethod.Post, "/api/studio/session/step-up", playerCookie)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await SendAsync(hub, HttpMethod.Get, "/api/auth/me", studioCookie)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await SendAsync(hub, HttpMethod.Post, "/api/session/step-up", studioCookie)).StatusCode);
        var console = Admins.ConsoleClient(factory, followRedirects: true);
        Assert.Equal(HttpStatusCode.NoContent, (await SendAsync(console, HttpMethod.Get, "/api/admin/me", studioCookie)).StatusCode);

        // Sealed for its own scheme: the console's cookie under the Studio's name opens nothing.
        var forged = $"{StudioSession.CookieName}={consoleCookie[(consoleCookie.IndexOf('=', StringComparison.Ordinal) + 1)..]}";
        Assert.Equal(HttpStatusCode.NoContent, (await SendAsync(hub, HttpMethod.Get, "/api/studio/session", forged)).StatusCode);

        // The console's host answers nothing but the console's routes.
        Assert.Equal(HttpStatusCode.NotFound, (await SendAsync(console, HttpMethod.Get, "/api/studio/session", studioCookie)).StatusCode);
    }

    [Fact]
    public async Task Taking_the_role_away_ends_the_session_at_the_next_request_and_a_new_role_holds_at_once()
    {
        var member = await Studio.NewAsync(factory, StudioRole.Reviewer, twoFactor: true);
        var studio = await Studio.SignInAsync(_app, member);
        Assert.Equal("reviewer", await studio.GetFromJsonAsync<string>(Url(Studio.ProbeRead), Ct));

        await SetRoleAsync(member.AccountId, StudioRole.Contributor);
        var me = (await studio.GetFromJsonAsync<StudioMeView>(Url("/api/studio/session"), Ct))!;
        Assert.Equal(("contributor", 2), (me.Role, me.Permissions.Count));
        Assert.Equal("studio_required", await CodeOfAsync(await studio.PostAsync(Url(Studio.ProbeReview), null, Ct)));

        await SetRoleAsync(member.AccountId, role: null);
        Assert.Equal(HttpStatusCode.Unauthorized, (await studio.GetAsync(Url(Studio.ProbeRead), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await studio.GetAsync(Url("/api/studio/session"), Ct)).StatusCode);
        // Ended, not paused: the role given back does not bring this session back.
        await SetRoleAsync(member.AccountId, StudioRole.Reviewer);
        Assert.Equal(HttpStatusCode.Unauthorized, (await studio.GetAsync(Url(Studio.ProbeRead), Ct)).StatusCode);
    }

    [Fact]
    public async Task A_new_security_stamp_ends_the_studio_session_at_once()
    {
        var member = await Studio.NewAsync(factory, StudioRole.Contributor, twoFactor: false);
        var studio = await Studio.SignInAsync(_app, member);
        Assert.Equal(HttpStatusCode.OK, (await studio.GetAsync(Url(Studio.ProbeRead), Ct)).StatusCode);
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<Account>>();
            await users.UpdateSecurityStampAsync((await users.FindByIdAsync(member.AccountId.ToString()))!);
        }

        Assert.Equal(HttpStatusCode.Unauthorized, (await studio.GetAsync(Url(Studio.ProbeRead), Ct)).StatusCode);
    }

    [Fact]
    public async Task Each_endpoint_opens_to_the_permission_it_declares_and_review_needs_a_fresh_code()
    {
        var contributor = await Studio.NewAsync(factory, StudioRole.Contributor, twoFactor: false);
        var reviewer = await Studio.NewAsync(factory, StudioRole.Reviewer, twoFactor: true);
        var contributing = await Studio.SignInAsync(_app, contributor);
        var reviewing = await Studio.SignInAsync(_app, reviewer);

        Assert.Equal(HttpStatusCode.OK, (await contributing.PostAsync(Url(Studio.ProbeContribute), null, Ct)).StatusCode);
        Assert.Equal("studio_required", await CodeOfAsync(await contributing.PostAsync(Url(Studio.ProbeReview), null, Ct)));
        Assert.Equal("studio_required", await CodeOfAsync(await contributing.PostAsJsonAsync(Url("/api/studio/session/step-up"), new { code = "123456" }, Ct)));
        // An endpoint that names no permission is open to nobody.
        Assert.Equal("studio_required", await CodeOfAsync(await reviewing.GetAsync(Url(Studio.ProbeUndeclared), Ct)));
        // Without a Studio session: 401.
        Assert.Equal(HttpStatusCode.Unauthorized, (await _app.CreateClient().PostAsync(Url(Studio.ProbeContribute), null, Ct)).StatusCode);

        var before = (await reviewing.GetFromJsonAsync<StudioMeView>(Url("/api/studio/session"), Ct))!;
        Assert.Equal("step_up_required", await CodeOfAsync(await reviewing.PostAsync(Url(Studio.ProbeReview), null, Ct)));
        // The password opens nothing here: a fresh second factor does.
        var password = await reviewing.PostAsJsonAsync(Url("/api/studio/session/step-up"), new { password = Accounts.Password }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, password.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await reviewing.PostAsJsonAsync(Url("/api/studio/session/step-up"), new { code = "000000" }, Ct)).StatusCode);
        // The code that signed in does not work again.
        var used = await reviewing.PostAsJsonAsync(Url("/api/studio/session/step-up"), new { code = Studio.Code(reviewer) }, Ct);
        Assert.Equal("code_used", await FieldAsync(used, "code"));

        var stepped = await reviewing.PostAsJsonAsync(Url("/api/studio/session/step-up"), new { code = Studio.Code(reviewer, step: 1) }, Ct);
        Assert.Equal(HttpStatusCode.OK, stepped.StatusCode);
        var after = (await stepped.Content.ReadFromJsonAsync<StudioMeView>(Ct))!;
        Assert.InRange(after.SecureUntil!.Value, DateTimeOffset.UtcNow.AddMinutes(9), DateTimeOffset.UtcNow.AddMinutes(10));
        Assert.Equal(before.OpenUntil, after.OpenUntil);
        Assert.Equal(before.OpenUntil.ToUnixTimeSeconds(), Assert.Single(SetCookies(stepped)).Expires!.Value.ToUnixTimeSeconds());
        Assert.Equal(HttpStatusCode.OK, (await reviewing.PostAsync(Url(Studio.ProbeReview), null, Ct)).StatusCode);
    }

    [Fact]
    public async Task Signing_out_of_the_studio_leaves_the_hub_signed_in()
    {
        var member = await Studio.NewAsync(factory, StudioRole.Contributor, twoFactor: false);
        var hub = factory.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await hub.PostAsJsonAsync(Url("/api/auth/login"), new { email = member.Email, password = Accounts.Password }, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await hub.PostAsJsonAsync(Url("/api/studio/session"), Studio.SignIn(member), Ct)).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await hub.DeleteAsync(Url("/api/studio/session"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await hub.GetAsync(Url("/api/studio/session"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await hub.GetAsync(Url("/api/auth/me"), Ct)).StatusCode);
    }

    [Fact]
    public void The_sign_in_counts_in_the_sign_in_bucket_and_step_up_in_the_gates_and_each_endpoint_declares_a_permission()
    {
        var endpoints = factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .Where(endpoint => endpoint.RoutePattern.RawText?.StartsWith("/api/studio", StringComparison.Ordinal) == true)
            .ToList();
        string? Bucket(string name) => endpoints
            .Single(endpoint => endpoint.Metadata.GetMetadata<IEndpointNameMetadata>()?.EndpointName == name)
            .Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName;
        Assert.Equal(IdentityModule.SignInRateLimit, Bucket("SignInToStudio"));
        Assert.Equal(IdentityModule.GateRateLimit, Bucket("StepUpInStudio"));

        var open = endpoints.Where(endpoint => endpoint.Metadata.GetMetadata<StudioPermission>() is null).ToList();
        Assert.Equal(
            ["GetStudioConfig", "GetStudioSession", "SignInToStudio", "SignOutOfStudio"],
            open.Select(endpoint => endpoint.Metadata.GetMetadata<IEndpointNameMetadata>()?.EndpointName).Order(StringComparer.Ordinal));
        Assert.All(open, endpoint => Assert.NotNull(endpoint.Metadata.GetMetadata<Microsoft.AspNetCore.Authorization.IAllowAnonymous>()));
    }

    // ------------------------------------------------------------------ helpers

    private async Task SetRoleAsync(Guid accountId, StudioRole? role)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        if (role is { } given)
        {
            if (await db.StudioMembers.Where(m => m.AccountId == accountId).ExecuteUpdateAsync(s => s.SetProperty(m => m.Role, given), Ct) == 0)
            {
                await Studio.GrantAsync(factory, accountId, given);
            }
        }
        else
        {
            await db.StudioMembers.Where(m => m.AccountId == accountId).ExecuteDeleteAsync(Ct);
        }
    }

    private async Task SetFailuresAsync(Guid[] accounts, int count)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<ToheDbContext>().Users.Where(a => accounts.Contains(a.Id))
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.AccessFailedCount, count), Ct);
    }

    private static IList<SetCookieHeaderValue> SetCookies(HttpResponseMessage response) =>
        response.Headers.TryGetValues("Set-Cookie", out var values)
            ? [.. SetCookieHeaderValue.ParseList([.. values]).Where(cookie => cookie.Value.Length > 0)]
            : [];

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
            request.Content = JsonContent.Create(new { password = Accounts.Password, code = "123456" });
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

    private static async Task<string?> FieldAsync(HttpResponseMessage response, string field)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.GetProperty("errors").GetProperty(field)[0].GetString();
    }

    private static Uri Url(string path) => new(path, UriKind.Relative);
}
