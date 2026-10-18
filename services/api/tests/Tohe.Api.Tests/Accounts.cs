using System.Net;
using System.Net.Http.Json;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Tests;

/// <summary>Signs people up the way the hub does (ADR 0024): an email, the code it receives, then an account.</summary>
internal static class Accounts
{
    public const string Password = "mat-khau-cua-bo";

    /// <summary>The version of the terms the hub shows, accepted at sign-up (ADR 0025).</summary>
    public const string TermsVersion = "2026-10-18";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public static string NewEmail() => $"{Guid.NewGuid():N}@tohe.test";

    /// <summary>Starts signing up; returns the attempt to send the code back with.</summary>
    public static async Task<Guid> StartSignUpAsync(HttpClient client, string email, string displayName = "Bố")
    {
        var started = await client.PostAsJsonAsync(
            Url("/api/auth/register"),
            new { email, password = Password, displayName, acceptTerms = true, termsVersion = TermsVersion },
            Ct);
        Assert.Equal(HttpStatusCode.Accepted, started.StatusCode);
        return (await started.Content.ReadFromJsonAsync<AttemptView>(Ct))!.AttemptId;
    }

    /// <summary>The whole sign-up; returns the answer that sets the session cookie.</summary>
    public static async Task<HttpResponseMessage> SignUpResponseAsync(
        ApiFactory factory, HttpClient client, string displayName, string? email = null)
    {
        email ??= NewEmail();
        var attempt = await StartSignUpAsync(client, email, displayName);
        var confirmed = await client.PostAsJsonAsync(
            Url("/api/auth/register/confirm"),
            new { attemptId = attempt, code = await factory.CodeSentToAsync(email) },
            Ct);
        Assert.Equal(HttpStatusCode.OK, confirmed.StatusCode);
        return confirmed;
    }

    /// <summary>Step-up level 2 with the password (ADR 0025): opens account security and profile management.</summary>
    public static async Task<MeView> StepUpAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync(Url("/api/session/step-up"), new { password = Password }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<MeView>(Ct))!;
    }

    /// <summary>A new account, signed in on <paramref name="client"/> and playing as its first profile.</summary>
    public static async Task<MeView> SignUpAsync(ApiFactory factory, HttpClient client, string displayName, string? email = null)
    {
        var confirmed = await SignUpResponseAsync(factory, client, displayName, email);
        return (await confirmed.Content.ReadFromJsonAsync<MeView>(Ct))!;
    }

    private static Uri Url(string path) => new(path, UriKind.Relative);
}
