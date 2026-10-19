using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Tohe.Api.Modules.Admin;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Tests;

/// <summary>The console's people, as tests need them (ADR 0027, 0042).</summary>
internal static class Admins
{
    /// <summary>The console's host in tests (<c>App:ConsoleUrl</c>, set by <see cref="ApiFactory"/>).</summary>
    public static readonly Uri ConsoleUrl = new("http://console.tohe.test");

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    /// <param name="Client">Signed in to the console, on the console's host.</param>
    /// <param name="Player">Signed in to the hub, the same account.</param>
    /// <param name="Key">The authenticator key, to make more codes.</param>
    public sealed record Admin(HttpClient Client, HttpClient Player, string Email, string Key, Guid AccountId);

    /// <summary>
    /// A new account holding <paramref name="role"/> through the command, with an authenticator added in the hub: signed
    /// in to the console on the returned client, step-up level 2 open there too.
    /// </summary>
    public static async Task<Admin> NewAsync(
        ApiFactory factory, string role, WebApplicationFactory<Program>? app = null, bool followRedirects = true)
    {
        app ??= factory;
        var email = Accounts.NewEmail();
        var player = app.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = followRedirects });
        var me = await Accounts.SignUpAsync(factory, player, "Cô Ba", email);
        Assert.Equal(0, (await CommandAsync(factory, "admin", "grant", email, "--role", role)).Exit);
        var key = await EnrolAsync(player);
        var console = await SignInAsync(app, email, key, followRedirects: followRedirects);
        await StepUpAsync(console);
        return new Admin(console, player, email, key, me.Account.Id);
    }

    /// <summary>In the hub: step-up level 2, a new authenticator key, and its first code — two-factor authentication on.</summary>
    public static async Task<string> EnrolAsync(HttpClient player)
    {
        await Accounts.StepUpAsync(player);
        var setup = await player.PostAsync(Url("/api/account/two-factor/setup"), null, Ct);
        Assert.Equal(HttpStatusCode.OK, setup.StatusCode);
        var key = (await setup.Content.ReadFromJsonAsync<AuthenticatorSetupView>(Ct))!.SharedKey;
        var enabled = await player.PostAsJsonAsync(Url("/api/account/two-factor/enable"), new { code = Totp.Code(key, DateTimeOffset.UtcNow) }, Ct);
        Assert.Equal(HttpStatusCode.OK, enabled.StatusCode);
        Assert.Equal(10, (await enabled.Content.ReadFromJsonAsync<RecoveryCodesView>(Ct))!.Codes.Count);
        return key;
    }

    /// <summary>A browser on the console's host, signed in to nothing.</summary>
    public static HttpClient ConsoleClient(WebApplicationFactory<Program> app, bool followRedirects = true) =>
        app.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = ConsoleUrl, AllowAutoRedirect = followRedirects });

    /// <summary>
    /// The console's sign-in on a new browser. A code works once, so each sign-in takes the code of another 30 seconds
    /// (the authenticator's window is two steps either way): <paramref name="step"/> 1 by default, after the hub's
    /// enrolment used the current one.
    /// </summary>
    public static async Task<HttpClient> SignInAsync(
        WebApplicationFactory<Program> app, string email, string key, int step = 1, bool followRedirects = true)
    {
        var client = ConsoleClient(app, followRedirects);
        var signedIn = await client.PostAsJsonAsync(Url("/api/admin/session"), SignIn(email, key, step), Ct);
        Assert.Equal(HttpStatusCode.OK, signedIn.StatusCode);
        return client;
    }

    /// <summary>What the console's sign-in sends: the email, the password and the code of the given step.</summary>
    public static object SignIn(string email, string key, int step = 1) =>
        new { email, password = Accounts.Password, code = Totp.Code(key, DateTimeOffset.UtcNow.AddSeconds(30 * step)) };

    /// <summary>Step-up level 2 in the console session, with the password.</summary>
    public static async Task StepUpAsync(HttpClient console)
    {
        var response = await console.PostAsJsonAsync(Url("/api/admin/session/step-up"), new { password = Accounts.Password }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
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
