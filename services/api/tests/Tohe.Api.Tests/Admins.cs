using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Tohe.Api.Modules.Admin;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Tests;

/// <summary>The admin console's people, as tests need them (ADR 0027).</summary>
internal static class Admins
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    /// <param name="Key">The authenticator key, to make more codes.</param>
    public sealed record Admin(HttpClient Client, string Email, string Key, Guid AccountId);

    /// <summary>
    /// A new account holding <paramref name="role"/> through the command, two-factor authentication on: the console is
    /// open on the returned client, and step-up level 2 too.
    /// </summary>
    public static async Task<Admin> NewAsync(
        ApiFactory factory, string role, WebApplicationFactory<Program>? app = null, bool followRedirects = true)
    {
        var email = Accounts.NewEmail();
        var client = (app ?? factory).CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = followRedirects });
        var me = await Accounts.SignUpAsync(factory, client, "Cô Ba", email);
        Assert.Equal(0, (await CommandAsync(factory, "admin", "grant", email, "--role", role)).Exit);
        return new Admin(client, email, await EnrolAsync(client), me.Account.Id);
    }

    /// <summary>Step-up level 2, a new authenticator key, and its first code: two-factor authentication on.</summary>
    public static async Task<string> EnrolAsync(HttpClient client)
    {
        await Accounts.StepUpAsync(client);
        var setup = await client.PostAsync(Url("/api/admin/two-factor/setup"), null, Ct);
        var key = (await setup.Content.ReadFromJsonAsync<AuthenticatorSetupView>(Ct))!.SharedKey;
        var enabled = await client.PostAsJsonAsync(Url("/api/admin/two-factor/enable"), new { code = Totp.Code(key, DateTimeOffset.UtcNow) }, Ct);
        Assert.Equal(HttpStatusCode.OK, enabled.StatusCode);
        Assert.Equal(10, (await enabled.Content.ReadFromJsonAsync<RecoveryCodesView>(Ct))!.Codes.Count);
        return key;
    }

    /// <summary>The same account on another device.</summary>
    public static async Task<HttpClient> SignInAsync(WebApplicationFactory<Program> app, string email)
    {
        var client = app.CreateClient();
        var signedIn = await client.PostAsJsonAsync(Url("/api/auth/login"), new { email, password = Accounts.Password }, Ct);
        Assert.Equal(HttpStatusCode.OK, signedIn.StatusCode);
        return client;
    }

    /// <summary><c>dotnet Tohe.Api.dll admin …</c>, as inside the API's container.</summary>
    public static async Task<(int Exit, string Output)> CommandAsync(ApiFactory factory, params string[] args)
    {
        using var output = new StringWriter();
        using var error = new StringWriter();
        var exit = await AdminCommand.RunAsync(factory.Services, args, output, error);
        return (exit, output.ToString() + error);
    }

    private static Uri Url(string path) => new(path, UriKind.Relative);
}
