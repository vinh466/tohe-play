using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Admin;

namespace Tohe.Api.Tests;

/// <summary>
/// Setup mode (ADR 0027), on the console's page <c>/setup</c> (ADR 0042): a new deployment has no owner until someone
/// brings the setup token with the email and password of an account with a confirmed address — one of the allowed ones
/// when the deployment names them — and then never again. No console session starts: the owner adds an authenticator in
/// the hub first. A database of its own: setup happens once.
/// </summary>
public sealed class AdminSetupTests(ApiFactory factory) : IClassFixture<ApiFactory>, IAsyncDisposable
{
    private const string Token = "TOHE-1234";
    private const string OwnerEmail = "chu@tohe.test";

    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    private readonly WebApplicationFactory<Program> _app = factory.WithWebHostBuilder(builder => builder
        .UseSetting("Admin:SetupToken", Token)
        .UseSetting("Admin:BootstrapEmails:0", OwnerEmail));

    public ValueTask DisposeAsync() => _app.DisposeAsync();

    [Fact]
    public async Task The_first_owner_claims_a_new_deployment_once_on_the_console_with_the_token_and_an_allowed_address()
    {
        var console = Admins.ConsoleClient(_app);
        var stranger = Accounts.NewEmail();
        await Accounts.SignUpAsync(factory, _app.CreateClient(), "Người lạ", stranger);
        Assert.Equal(new SetupView(Open: true, OnlySomeEmails: true), await console.GetFromJsonAsync<SetupView>(Url("/api/admin/setup"), Ct));
        // Only on the console's host.
        Assert.Equal(HttpStatusCode.NotFound, (await _app.CreateClient().GetAsync(Url("/api/admin/setup"), Ct)).StatusCode);
        Assert.Equal("setup_email_not_allowed", await CodeOfAsync(await ClaimAsync(console, Token, stranger)));

        await Accounts.SignUpAsync(factory, _app.CreateClient(), "Chủ", OwnerEmail);
        Assert.Equal("setup_token_invalid", await CodeOfAsync(await ClaimAsync(console, "TOHE-0000", OwnerEmail)));
        Assert.Equal("invalid_credentials", await CodeOfAsync(await ClaimAsync(console, Token, OwnerEmail, "sai-mat-khau")));

        // Typed as people type it: any case, spaces for the dash. Two-factor authentication is not asked yet.
        var claimed = await ClaimAsync(console, "tohe 1234", OwnerEmail);
        Assert.Equal(HttpStatusCode.NoContent, claimed.StatusCode);

        // Once: setup is over for everyone, the owner included.
        var again = await ClaimAsync(console, Token, OwnerEmail);
        Assert.Equal((HttpStatusCode.Conflict, "setup_closed"), (again.StatusCode, await CodeOfAsync(again)));
        Assert.False((await console.GetFromJsonAsync<SetupView>(Url("/api/admin/setup"), Ct))!.Open);

        // The claim opened no console session: the owner adds an authenticator in the hub, then signs in.
        Assert.Equal(HttpStatusCode.NoContent, (await console.GetAsync(Url("/api/admin/me"), Ct)).StatusCode);
        var hub = await SignInToHubAsync(OwnerEmail);
        var key = await Admins.EnrolAsync(hub);
        var owner = await Admins.SignInAsync(_app, OwnerEmail, key);
        Assert.Equal("owner", (await owner.GetFromJsonAsync<AdminMeView>(Url("/api/admin/me"), Ct))!.Role);

        await using var scope = factory.Services.CreateAsyncScope();
        var claim = await scope.ServiceProvider.GetRequiredService<ToheDbContext>().AuditLog
            .SingleAsync(entry => entry.Action == AuditActions.SetupClaim, Ct);
        Assert.Equal((OwnerEmail, OwnerEmail), (claim.Actor, claim.Target));
    }

    private async Task<HttpClient> SignInToHubAsync(string email)
    {
        var client = _app.CreateClient();
        var signedIn = await client.PostAsJsonAsync(Url("/api/auth/login"), new { email, password = Accounts.Password }, Ct);
        Assert.Equal(HttpStatusCode.OK, signedIn.StatusCode);
        return client;
    }

    private static Task<HttpResponseMessage> ClaimAsync(HttpClient console, string token, string email, string password = Accounts.Password) =>
        console.PostAsJsonAsync(Url("/api/admin/setup/claim"), new { token, email, password }, Ct);

    private static async Task<string?> CodeOfAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    private static Uri Url(string path) => new(path, UriKind.Relative);
}
