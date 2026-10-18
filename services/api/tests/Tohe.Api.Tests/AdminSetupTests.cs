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
/// Setup mode (ADR 0027): a new deployment has no owner until someone brings the setup token, signed in with a
/// confirmed address — one of the allowed ones when the deployment names them — and then never again. A database
/// of its own: setup happens once.
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
    public async Task The_first_owner_claims_a_new_deployment_once_with_the_token_and_an_allowed_address()
    {
        var stranger = _app.CreateClient();
        await Accounts.SignUpAsync(factory, stranger, "Người lạ");
        Assert.Equal(new SetupView(Open: true, OnlySomeEmails: true), await stranger.GetFromJsonAsync<SetupView>(Url("/api/admin/setup"), Ct));
        Assert.Equal("setup_email_not_allowed", await CodeOfAsync(await ClaimAsync(stranger, Token)));

        var owner = _app.CreateClient();
        await Accounts.SignUpAsync(factory, owner, "Chủ", OwnerEmail);
        Assert.Equal("setup_token_invalid", await CodeOfAsync(await ClaimAsync(owner, "TOHE-0000")));

        // Typed as people type it: any case, spaces for the dash.
        var claimed = await ClaimAsync(owner, "tohe 1234");
        Assert.Equal(HttpStatusCode.OK, claimed.StatusCode);
        var me = (await claimed.Content.ReadFromJsonAsync<AdminMeView>(Ct))!;
        Assert.Equal(("owner", false), (me.Role, me.TwoFactorEnabled));

        // Once: setup is over for everyone, the owner included.
        var again = await ClaimAsync(owner, Token);
        Assert.Equal((HttpStatusCode.Conflict, "setup_closed"), (again.StatusCode, await CodeOfAsync(again)));
        Assert.False((await stranger.GetFromJsonAsync<SetupView>(Url("/api/admin/setup"), Ct))!.Open);

        // The owner still opens the console behind two-factor authentication, and the claim is in the audit log.
        Assert.Equal("two_factor_setup_required", await CodeOfAsync(await owner.GetAsync(Url("/api/admin/overview"), Ct)));
        await using var scope = factory.Services.CreateAsyncScope();
        var claim = await scope.ServiceProvider.GetRequiredService<ToheDbContext>().AuditLog
            .SingleAsync(entry => entry.Action == AuditActions.SetupClaim, Ct);
        Assert.Equal((OwnerEmail, OwnerEmail), (claim.Actor, claim.Target));
    }

    private static Task<HttpResponseMessage> ClaimAsync(HttpClient client, string token) =>
        client.PostAsJsonAsync(Url("/api/admin/setup/claim"), new { token }, Ct);

    private static async Task<string?> CodeOfAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    private static Uri Url(string path) => new(path, UriKind.Relative);
}
