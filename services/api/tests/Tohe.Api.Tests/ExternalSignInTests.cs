using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Platform;

namespace Tohe.Api.Tests;

/// <summary>
/// Signing in with a provider and linking it (ADR 0026): a provider's identity is its subject; an address it vouches
/// for only finds the account it may belong to, whose owner proves it before the link.
/// </summary>
public sealed class ExternalSignInTests(ApiFactory factory) : IClassFixture<ApiFactory>, IAsyncDisposable
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
    public async Task New_with_a_provider_that_vouches_for_the_address_finishes_with_a_name_and_the_terms()
    {
        var browser = Browser();
        var email = Accounts.NewEmail();
        var subject = Subject();

        Assert.Equal("/sign-in/continue", await ComeBackAsync(browser, subject, email, verified: true));
        var pending = (await browser.GetFromJsonAsync<PendingSignInView>(Url("/api/auth/external/pending"), Ct))!;
        Assert.Equal(("Fake", "signup", email), (pending.Provider, pending.Step, pending.Email));

        var noTerms = await browser.PostAsJsonAsync(Url("/api/auth/external/pending/signup"), new { displayName = "Cáo Nhanh" }, Ct);
        Assert.Contains("terms_required", (await ErrorsAsync(noTerms))["acceptTerms"]);
        var done = await SignUpAsync(browser, "Cáo Nhanh");
        Assert.Equal((email, false), (done.Account.Email, done.Account.HasPassword));
        Assert.Equal(["fake"], done.Account.Logins);
        Assert.Equal(done.Profiles[0].Id, done.ActiveProfileId);

        // Next time the provider is enough.
        var later = Browser();
        Assert.Equal("/profiles?auto=true", await ComeBackAsync(later, subject, email, verified: true));
        Assert.Equal(done.Account.Id, (await later.GetFromJsonAsync<MeView>(Url("/api/auth/me"), Ct))!.Account.Id);
    }

    [Fact]
    public async Task An_address_that_has_an_account_is_linked_only_once_its_owner_proves_it()
    {
        var email = Accounts.NewEmail();
        var owner = await Accounts.SignUpAsync(factory, factory.CreateClient(), "Bố", email);
        await AgeAttemptsAsync(email);
        var browser = Browser();

        Assert.Equal("/sign-in/continue", await ComeBackAsync(browser, Subject(), email, verified: true));
        var pending = (await browser.GetFromJsonAsync<PendingSignInView>(Url("/api/auth/external/pending"), Ct))!;
        Assert.Equal(("link", IdentityEmails.Mask(email), true), (pending.Step, pending.Email, pending.HasPassword));

        var wrong = await browser.PostAsJsonAsync(Url("/api/auth/external/pending/link"), new { password = "sai-mat-khau" }, Ct);
        Assert.Equal("password_invalid", await CodeOfAsync(wrong));
        Assert.Equal(HttpStatusCode.Accepted, (await browser.PostAsync(Url("/api/auth/external/pending/link-code"), null, Ct)).StatusCode);
        var linked = await browser.PostAsJsonAsync(
            Url("/api/auth/external/pending/link"), new { code = await factory.CodeSentToAsync(email) }, Ct);

        var me = (await linked.Content.ReadFromJsonAsync<ExternalOutcome>(Ct))!.Me!;
        Assert.Equal(owner.Account.Id, me.Account.Id);
        Assert.Equal(["fake"], me.Account.Logins);
        Assert.Contains("liên kết", await factory.MailSentToAsync(email), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Without_a_vouched_address_a_code_proves_one_and_its_account_is_linked_at_once()
    {
        var email = Accounts.NewEmail();
        var owner = await Accounts.SignUpAsync(factory, factory.CreateClient(), "Bố", email);
        await AgeAttemptsAsync(email);
        var browser = Browser();

        Assert.Equal("/sign-in/continue", await ComeBackAsync(browser, Subject(), email: null, verified: false));
        Assert.Equal("email", (await browser.GetFromJsonAsync<PendingSignInView>(Url("/api/auth/external/pending"), Ct))!.Step);
        Assert.Equal(HttpStatusCode.Accepted, (await browser.PostAsJsonAsync(Url("/api/auth/external/pending/email"), new { email }, Ct)).StatusCode);

        var proven = await browser.PostAsJsonAsync(
            Url("/api/auth/external/pending/email/confirm"), new { code = await factory.CodeSentToAsync(email) }, Ct);

        // Our own code was the proof: no second one.
        var me = (await proven.Content.ReadFromJsonAsync<ExternalOutcome>(Ct))!.Me!;
        Assert.Equal(owner.Account.Id, me.Account.Id);
        Assert.Equal(["fake"], me.Account.Logins);
    }

    [Fact]
    public async Task An_address_the_provider_did_not_verify_is_proven_with_a_code_before_signing_up()
    {
        var browser = Browser();
        var email = Accounts.NewEmail();

        Assert.Equal("/sign-in/continue", await ComeBackAsync(browser, Subject(), email, verified: false));
        Assert.Equal("email", (await browser.GetFromJsonAsync<PendingSignInView>(Url("/api/auth/external/pending"), Ct))!.Step);
        await browser.PostAsJsonAsync(Url("/api/auth/external/pending/email"), new { email }, Ct);
        var proven = await browser.PostAsJsonAsync(
            Url("/api/auth/external/pending/email/confirm"), new { code = await factory.CodeSentToAsync(email) }, Ct);
        var next = (await proven.Content.ReadFromJsonAsync<ExternalOutcome>(Ct))!.Pending!;
        Assert.Equal(("signup", email), (next.Step, next.Email));

        Assert.Equal(email, (await SignUpAsync(browser, "Mèo Vui")).Account.Email);
    }

    [Fact]
    public async Task What_waits_is_bound_to_the_browser_that_came_back()
    {
        var browser = Browser();
        await ComeBackAsync(browser, Subject(), Accounts.NewEmail(), verified: true);

        var other = Browser();
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync(Url("/api/auth/external/pending"), Ct)).StatusCode);
        var stolen = await other.PostAsJsonAsync(
            Url("/api/auth/external/pending/signup"),
            new { displayName = "Kẻ lạ", acceptTerms = true, termsVersion = Accounts.TermsVersion },
            Ct);
        Assert.Equal("sign_in_expired", await CodeOfAsync(stolen));

        Assert.Equal(HttpStatusCode.NoContent, (await browser.DeleteAsync(Url("/api/auth/external/pending"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await browser.GetAsync(Url("/api/auth/external/pending"), Ct)).StatusCode);
    }

    [Fact]
    public async Task Linking_from_the_account_page_needs_step_up_and_a_subject_no_one_else_has()
    {
        var browser = Browser();
        await Accounts.SignUpAsync(factory, browser, "Bố");
        var subject = Subject();

        var tooSoon = await browser.GetAsync(Url("/api/auth/external/fake?intent=link"), Ct);
        Assert.Equal("/account?link_error=step_up_required", tooSoon.Headers.Location!.OriginalString);

        await Accounts.StepUpAsync(browser);
        Assert.Equal("/account?linked=fake", await ComeBackAsync(browser, subject, email: null, verified: false, intent: "?intent=link"));
        Assert.Equal(["fake"], (await browser.GetFromJsonAsync<MeView>(Url("/api/auth/me"), Ct))!.Account.Logins);

        var someoneElse = Browser();
        await Accounts.SignUpAsync(factory, someoneElse, "Người khác");
        await Accounts.StepUpAsync(someoneElse);
        Assert.Equal(
            "/account?link_error=provider_account_in_use",
            await ComeBackAsync(someoneElse, subject, email: null, verified: false, intent: "?intent=link"));
    }

    [Fact]
    public async Task Only_the_hub_itself_starts_a_link()
    {
        var browser = Browser();
        await Accounts.SignUpAsync(factory, browser, "Bố");
        await Accounts.StepUpAsync(browser);

        // Another site navigating a signed-in browser here — the session cookie comes along — links nothing.
        var fromElsewhere = await StartLinkAsync(browser, "cross-site");
        Assert.Equal("/account?link_error=cross_origin", fromElsewhere.OriginalString);
        Assert.StartsWith("https://provider.test/", (await StartLinkAsync(browser, "same-origin")).OriginalString, StringComparison.Ordinal);
    }

    [Fact]
    public async Task The_last_way_in_stays()
    {
        var browser = Browser();
        var email = Accounts.NewEmail();
        await ComeBackAsync(browser, Subject(), email, verified: true);
        await SignUpAsync(browser, "Bố");

        // No password: step-up level 2 comes by email.
        await AgeAttemptsAsync(email);
        var started = await browser.PostAsync(Url("/api/session/step-up/code"), null, Ct);
        var attempt = (await started.Content.ReadFromJsonAsync<AttemptView>(Ct))!.AttemptId;
        await browser.PostAsJsonAsync(Url("/api/session/step-up/confirm"), new { attemptId = attempt, code = await factory.CodeSentToAsync(email) }, Ct);

        var last = await browser.DeleteAsync(Url("/api/account/logins/fake"), Ct);
        Assert.Equal((HttpStatusCode.Conflict, "last_method"), (last.StatusCode, await CodeOfAsync(last)));

        Assert.Equal(HttpStatusCode.OK, (await browser.PutAsJsonAsync(Url("/api/account/password"), new { password = Accounts.Password }, Ct)).StatusCode);
        var unlinked = await browser.DeleteAsync(Url("/api/account/logins/fake"), Ct);
        Assert.Empty((await unlinked.Content.ReadFromJsonAsync<MeView>(Ct))!.Account.Logins);
        Assert.Contains("gỡ liên kết", await factory.MailSentToAsync(email), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Only_the_providers_the_deployment_configured_are_offered()
    {
        var config = (await _app.CreateClient().GetFromJsonAsync<ClientConfig>(Url("/api/config"), Ct))!;
        Assert.Equal([new ExternalProvider("fake", "Fake")], config.Providers);
        Assert.Empty((await factory.CreateClient().GetFromJsonAsync<ClientConfig>(Url("/api/config"), Ct))!.Providers);

        Assert.Equal(HttpStatusCode.NotFound, (await Browser().GetAsync(Url("/api/auth/external/google"), Ct)).StatusCode);
    }

    // ------------------------------------------------------------------ helpers

    /// <summary>A browser: keeps cookies, and lets the test follow the provider's redirects itself.</summary>
    private HttpClient Browser() => _app.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    private static string Subject() => Guid.NewGuid().ToString("N");

    /// <summary>Out to the provider and back with its answer; returns the hub page the API sends the browser to.</summary>
    private static async Task<string> ComeBackAsync(
        HttpClient browser, string subject, string? email, bool verified, string intent = "")
    {
        var start = await browser.GetAsync(Url("/api/auth/external/fake" + intent), Ct);
        Assert.Equal(HttpStatusCode.Redirect, start.StatusCode);
        var state = QueryHelpers.ParseQuery(start.Headers.Location!.Query)["state"].ToString();
        var answer = $"?state={state}&sub={Uri.EscapeDataString(subject)}&email={Uri.EscapeDataString(email ?? "")}" +
            $"&verified={(verified ? "true" : "false")}";
        var callback = await browser.GetAsync(Url("/api/auth/external/fake/callback" + answer), Ct);
        Assert.Equal(HttpStatusCode.Redirect, callback.StatusCode);
        var done = await browser.GetAsync(callback.Headers.Location, Ct);
        Assert.Equal(HttpStatusCode.Redirect, done.StatusCode);
        return done.Headers.Location!.OriginalString;
    }

    private static async Task<Uri> StartLinkAsync(HttpClient browser, string fetchSite)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, Url("/api/auth/external/fake?intent=link"));
        request.Headers.Add("Sec-Fetch-Site", fetchSite);
        using var response = await browser.SendAsync(request, Ct);
        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        return response.Headers.Location!;
    }

    private static async Task<MeView> SignUpAsync(HttpClient browser, string displayName)
    {
        var response = await browser.PostAsJsonAsync(
            Url("/api/auth/external/pending/signup"),
            new { displayName, acceptTerms = true, termsVersion = Accounts.TermsVersion },
            Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ExternalOutcome>(Ct))!.Me!;
    }

    /// <summary>Moves the address's attempts two minutes back, past the minute between codes.</summary>
    private async Task AgeAttemptsAsync(string email)
    {
        using var scope = factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<ToheDbContext>().AuthAttempts
            .Where(a => a.NormalizedEmail == email.ToUpperInvariant())
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.CreatedAt, DateTimeOffset.UtcNow.AddMinutes(-2)), Ct);
    }

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
