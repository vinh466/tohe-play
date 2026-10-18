using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Admin;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Platform;

namespace Tohe.Api.Tests;

/// <summary>
/// Sign-in and registration at run time (ADR 0028): the console switches methods and the registration mode, two guards
/// keep a way in, and every way an account is made obeys the mode and counts its invite code. A database of its own:
/// the switches are the whole platform's.
/// </summary>
public sealed class SignInSettingsTests(ApiFactory factory) : IClassFixture<ApiFactory>, IAsyncDisposable
{
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    private readonly WebApplicationFactory<Program> _app = factory.WithWebHostBuilder(builder =>
        builder.ConfigureTestServices(services =>
        {
            services.AddAuthentication().AddRemoteScheme<FakeProviderOptions, FakeProviderHandler>("fake", "Fake", o =>
                o.SignInScheme = IdentityConstants.ExternalScheme);
            services.AddSingleton(new ExternalProviderCatalog([new ExternalProvider("fake", "Fake")]));
        }));

    public ValueTask DisposeAsync() => _app.DisposeAsync();

    [Fact]
    public async Task Switching_password_off_keeps_a_way_in_and_then_stops_it_for_everyone()
    {
        // No redirects followed: linking Fake goes out to the provider and back by hand.
        var owner = await Admins.NewAsync(factory, "owner", _app, followRedirects: false);
        var player = Accounts.NewEmail();
        await Accounts.SignUpAsync(factory, _app.CreateClient(), "Người chơi", player);

        Assert.Equal("settings_lockout_self", await CodeOfAsync(await SaveAsync(owner, new { methods = new { password = false } })));
        Assert.Equal("settings_last_method", await CodeOfAsync(await SaveAsync(owner, new { methods = new { password = false, fake = false } })));
        Assert.Contains("method_unknown", (await ErrorsAsync(await SaveAsync(owner, new { methods = new { google = false } })))["methods"]);

        // With Fake linked, the owner keeps a way in without the password.
        await LinkAsync(owner, Guid.NewGuid().ToString("N"));
        var saved = await SaveAsync(owner, new { methods = new { password = false } });
        var view = (await saved.Content.ReadFromJsonAsync<SignInSettingsView>(Ct))!;
        var password = Assert.Single(view.Methods, method => method.Id == SignInMethods.Password);
        Assert.False(password.On);
        Assert.True(password.OnlyWayIn >= 1, "the player has only a password");

        var config = (await _app.CreateClient().GetFromJsonAsync<ClientConfig>(Url("/api/config"), Ct))!;
        Assert.False(config.PasswordSignIn);
        var login = await _app.CreateClient().PostAsJsonAsync(Url("/api/auth/login"), new { email = player, password = Accounts.Password }, Ct);
        Assert.Equal("method_disabled", await CodeOfAsync(login));
        var signUp = await _app.CreateClient().PostAsJsonAsync(
            Url("/api/auth/register"),
            new { email = Accounts.NewEmail(), password = Accounts.Password, displayName = "Ai", acceptTerms = true, termsVersion = Accounts.TermsVersion },
            Ct);
        Assert.Equal("method_disabled", await CodeOfAsync(signUp));
        // A new password by email signs in, so it is no way in meanwhile either — whenever its code was asked for.
        var forgot = await _app.CreateClient().PostAsJsonAsync(Url("/api/auth/password/forgot"), new { email = player }, Ct);
        Assert.Equal("method_disabled", await CodeOfAsync(forgot));
        var reset = await _app.CreateClient().PostAsJsonAsync(
            Url("/api/auth/password/reset"), new { attemptId = Guid.NewGuid(), code = "123456", password = "mat-khau-moi-cua-bo" }, Ct);
        Assert.Equal("method_disabled", await CodeOfAsync(reset));

        Assert.Equal(HttpStatusCode.OK, (await SaveAsync(owner, new { methods = new { password = true } })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _app.CreateClient().PostAsJsonAsync(Url("/api/auth/login"), new { email = player, password = Accounts.Password }, Ct)).StatusCode);
    }

    [Fact]
    public async Task A_provider_switched_off_is_not_offered_and_does_not_sign_in()
    {
        var owner = await Admins.NewAsync(factory, "owner", _app);
        // A sign-in with Fake that waits for proof to join the account with its address…
        var email = Accounts.NewEmail();
        await Accounts.SignUpAsync(factory, _app.CreateClient(), "Người chơi", email);
        var browser = NoRedirects();
        Assert.Equal("/sign-in/continue", await FakeProvider.ComeBackAsync(browser, Guid.NewGuid().ToString("N"), email, verified: true));

        Assert.Equal(HttpStatusCode.OK, (await SaveAsync(owner, new { methods = new { fake = false } })).StatusCode);

        Assert.Empty((await _app.CreateClient().GetFromJsonAsync<ClientConfig>(Url("/api/config"), Ct))!.Providers);
        var start = await NoRedirects().GetAsync(Url("/api/auth/external/fake"), Ct);
        Assert.Equal("/welcome?external=disabled", start.Headers.Location!.OriginalString);
        // …links nothing and signs nobody in once Fake is off.
        var link = await browser.PostAsJsonAsync(Url("/api/auth/external/pending/link"), new { password = Accounts.Password }, Ct);
        Assert.Equal("method_disabled", await CodeOfAsync(link));
        Assert.Equal(HttpStatusCode.NoContent, (await browser.GetAsync(Url("/api/auth/me"), Ct)).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await SaveAsync(owner, new { methods = new { fake = true } })).StatusCode);
        Assert.Single((await _app.CreateClient().GetFromJsonAsync<ClientConfig>(Url("/api/config"), Ct))!.Providers);
    }

    [Fact]
    public async Task Registration_closed_or_by_invite_holds_for_every_way_an_account_is_made()
    {
        var owner = await Admins.NewAsync(factory, "owner", _app);
        var communities = await (await owner.Client.PostAsJsonAsync(Url("/api/admin/communities"), new { name = "Bạn Cờ" }, Ct))
            .Content.ReadFromJsonAsync<List<CommunityView>>(Ct);
        var community = Assert.Single(communities!, c => c.Name == "Bạn Cờ");
        Assert.Equal("community_exists", await CodeOfAsync(await owner.Client.PostAsJsonAsync(Url("/api/admin/communities"), new { name = "Bạn Cờ" }, Ct)));
        await owner.Client.PostAsJsonAsync(Url($"/api/admin/communities/{community.Id}/codes"), new { code = "banco 2026", maxUses = 1 }, Ct);
        var made = await (await owner.Client.PostAsJsonAsync(Url($"/api/admin/communities/{community.Id}/codes"), new { }, Ct))
            .Content.ReadFromJsonAsync<List<CommunityView>>(Ct);
        var generated = Assert.Single(made!, c => c.Id == community.Id).Codes.Single(code => code.Code != "BANCO2026").Code;
        Assert.Matches("^[0-9A-Z]{4}-[0-9A-Z]{4}$", generated);

        // Closed: nobody new, by email or with a provider.
        await SaveAsync(owner, new { registration = "closed" });
        Assert.Equal("closed", (await _app.CreateClient().GetFromJsonAsync<ClientConfig>(Url("/api/config"), Ct))!.Registration);
        Assert.Equal("registration_closed", await CodeOfAsync(await StartSignUpAsync(Accounts.NewEmail(), inviteCode: null)));
        var pending = NoRedirects();
        await FakeProvider.ComeBackAsync(pending, Guid.NewGuid().ToString("N"), Accounts.NewEmail(), verified: true);
        Assert.Equal("registration_closed", await CodeOfAsync(await FinishProviderSignUpAsync(pending, inviteCode: null)));

        // By invite: a code is needed, and it must be good.
        await SaveAsync(owner, new { registration = "invite" });
        Assert.Contains("invite_required", (await ErrorsAsync(await StartSignUpAsync(Accounts.NewEmail(), null)))["inviteCode"]);
        Assert.Contains("invite_invalid", (await ErrorsAsync(await StartSignUpAsync(Accounts.NewEmail(), "NOPE-1234")))["inviteCode"]);

        // One use left, two people at once: both may start; the code counts only one account.
        var first = Accounts.NewEmail();
        var second = Accounts.NewEmail();
        var firstAttempt = await AttemptOfAsync(await StartSignUpAsync(first, "BANCO2026"));
        var secondAttempt = await AttemptOfAsync(await StartSignUpAsync(second, "banco2026"));
        var joined = await ConfirmAsync(first, firstAttempt);
        Assert.Equal(HttpStatusCode.OK, joined.StatusCode);
        Assert.Equal("invite_invalid", await CodeOfAsync(await ConfirmAsync(second, secondAttempt)));
        var me = (await joined.Content.ReadFromJsonAsync<MeView>(Ct))!;
        var detail = (await owner.Client.GetFromJsonAsync<AccountDetail>(Url($"/api/admin/users/{me.Account.Id}"), Ct))!;
        Assert.Equal("Bạn Cờ", detail.Community);

        // A provider's sign-up needs the code too, and counts it.
        var withProvider = NoRedirects();
        await FakeProvider.ComeBackAsync(withProvider, Guid.NewGuid().ToString("N"), Accounts.NewEmail(), verified: true);
        Assert.Contains("invite_required", (await ErrorsAsync(await FinishProviderSignUpAsync(withProvider, null)))["inviteCode"]);
        Assert.Equal(HttpStatusCode.OK, (await FinishProviderSignUpAsync(withProvider, generated)).StatusCode);

        // Revoked: no more.
        await owner.Client.DeleteAsync(Url($"/api/admin/invite-codes/{generated}"), Ct);
        Assert.Contains("invite_invalid", (await ErrorsAsync(await StartSignUpAsync(Accounts.NewEmail(), generated)))["inviteCode"]);
        var list = (await owner.Client.GetFromJsonAsync<List<CommunityView>>(Url("/api/admin/communities"), Ct))!;
        var mine = Assert.Single(list, c => c.Id == community.Id);
        Assert.Equal(2, mine.Members);
        Assert.All(mine.Codes, code => Assert.False(code.Usable));

        // Open again: a code is welcome but not needed. Closed before its code comes back, a sign-up makes nothing.
        await SaveAsync(owner, new { registration = "open" });
        var late = Accounts.NewEmail();
        var lateAttempt = await AttemptOfAsync(await StartSignUpAsync(late, null));
        await SaveAsync(owner, new { registration = "closed" });
        Assert.Equal("registration_closed", await CodeOfAsync(await ConfirmAsync(late, lateAttempt)));
        await SaveAsync(owner, new { registration = "open" });
        Assert.Equal(HttpStatusCode.OK, (await ConfirmAsync(late, lateAttempt)).StatusCode);

        await using var scope = factory.Services.CreateAsyncScope();
        var actions = await scope.ServiceProvider.GetRequiredService<ToheDbContext>().AuditLog
            .Where(entry => entry.Actor == owner.Email).Select(entry => entry.Action).ToListAsync(Ct);
        Assert.Contains(AuditActions.SettingsChange, actions);
        Assert.Contains(AuditActions.CommunityCreate, actions);
        Assert.Contains(AuditActions.InviteCreate, actions);
        Assert.Contains(AuditActions.InviteRevoke, actions);
    }

    [Fact]
    public async Task Only_owners_and_admins_switch_and_never_without_step_up()
    {
        var viewer = await Admins.NewAsync(factory, "viewer", _app);
        Assert.Equal("admin_required", await CodeOfAsync(await SaveAsync(viewer, new { registration = "closed" })));
        var view = (await viewer.Client.GetFromJsonAsync<SignInSettingsView>(Url("/api/admin/settings"), Ct))!;
        Assert.Contains(view.Methods, method => method.Id == "google" && !method.Configured && !method.On);

        var admin = await Admins.NewAsync(factory, "admin", _app);
        var laptop = await Admins.SignInAsync(_app, admin.Email);
        await laptop.PostAsJsonAsync(Url("/api/admin/two-factor/verify"), new { code = Totp.Code(admin.Key, DateTimeOffset.UtcNow.AddSeconds(30)) }, Ct);
        Assert.Equal("step_up_required", await CodeOfAsync(await laptop.PutAsJsonAsync(Url("/api/admin/settings"), new { registration = "closed" }, Ct)));
    }

    // ------------------------------------------------------------------ helpers

    private Task<HttpResponseMessage> SaveAsync(Admins.Admin admin, object body) =>
        admin.Client.PutAsJsonAsync(Url("/api/admin/settings"), body, Ct);

    private HttpClient NoRedirects() => _app.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    /// <summary>Links Fake to the admin's account through the account page's flow (step-up is open).</summary>
    private async Task LinkAsync(Admins.Admin admin, string subject)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, Url("/api/auth/external/fake?intent=link"));
        var start = await admin.Client.SendAsync(request, Ct);
        Assert.Equal(HttpStatusCode.Redirect, start.StatusCode);
        var state = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(start.Headers.Location!.Query)["state"].ToString();
        var callback = await admin.Client.GetAsync(Url($"/api/auth/external/fake/callback?state={state}&sub={subject}&email=&verified=false"), Ct);
        var done = await admin.Client.GetAsync(callback.Headers.Location, Ct);
        Assert.Equal("/account?linked=fake", done.Headers.Location!.OriginalString);
    }

    private Task<HttpResponseMessage> StartSignUpAsync(string email, string? inviteCode) =>
        _app.CreateClient().PostAsJsonAsync(
            Url("/api/auth/register"),
            new { email, password = Accounts.Password, displayName = "Người mới", acceptTerms = true, termsVersion = Accounts.TermsVersion, inviteCode },
            Ct);

    private static async Task<Guid> AttemptOfAsync(HttpResponseMessage started)
    {
        Assert.Equal(HttpStatusCode.Accepted, started.StatusCode);
        return (await started.Content.ReadFromJsonAsync<AttemptView>(Ct))!.AttemptId;
    }

    private async Task<HttpResponseMessage> ConfirmAsync(string email, Guid attempt) =>
        await _app.CreateClient().PostAsJsonAsync(
            Url("/api/auth/register/confirm"), new { attemptId = attempt, code = await factory.CodeSentToAsync(email) }, Ct);

    private static Task<HttpResponseMessage> FinishProviderSignUpAsync(HttpClient browser, string? inviteCode) =>
        browser.PostAsJsonAsync(
            Url("/api/auth/external/pending/signup"),
            new { displayName = "Cáo", acceptTerms = true, termsVersion = Accounts.TermsVersion, inviteCode },
            Ct);

    private static async Task<string?> CodeOfAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    private static async Task<Dictionary<string, string[]>> ErrorsAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.GetProperty("errors").Deserialize<Dictionary<string, string[]>>()!;
    }

    private static Uri Url(string path) => new(path, UriKind.Relative);
}
