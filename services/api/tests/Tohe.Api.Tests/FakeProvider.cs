using System.Collections.Concurrent;
using System.Net;
using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Tohe.Api.Tests;

/// <summary>
/// A sign-in provider for tests (ADR 0026): its "login page" is the test itself, which comes back to the callback with
/// whatever subject and email it wants to check, through the same remote-authentication machinery the real providers
/// use (state, correlation cookie, Identity's external cookie).
/// </summary>
/// <summary>The browser's round trip through the fake provider.</summary>
internal static class FakeProvider
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    /// <summary>Out to the provider and back with its answer; returns the hub page the API sends the browser to.</summary>
    public static async Task<string> ComeBackAsync(
        HttpClient browser, string subject, string? email, bool verified, string intent = "")
    {
        var start = await browser.GetAsync(Url("/api/auth/external/fake" + intent), Ct);
        Assert.Equal(HttpStatusCode.Redirect, start.StatusCode);
        var state = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(start.Headers.Location!.Query)["state"].ToString();
        var answer = $"?state={state}&sub={Uri.EscapeDataString(subject)}&email={Uri.EscapeDataString(email ?? "")}" +
            $"&verified={(verified ? "true" : "false")}";
        var callback = await browser.GetAsync(Url("/api/auth/external/fake/callback" + answer), Ct);
        Assert.Equal(HttpStatusCode.Redirect, callback.StatusCode);
        var done = await browser.GetAsync(callback.Headers.Location, Ct);
        Assert.Equal(HttpStatusCode.Redirect, done.StatusCode);
        return done.Headers.Location!.OriginalString;
    }

    private static Uri Url(string path) => new(path, UriKind.Relative);
}

public sealed class FakeProviderOptions : RemoteAuthenticationOptions
{
    public FakeProviderOptions()
    {
        CallbackPath = "/api/auth/external/fake/callback";
        // TestServer speaks plain HTTP; a Secure correlation cookie would never come back.
        CorrelationCookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        CorrelationCookie.SameSite = SameSiteMode.Lax;
    }
}

public sealed class FakeProviderHandler(IOptionsMonitor<FakeProviderOptions> options, ILoggerFactory logger, UrlEncoder encoder)
    : RemoteAuthenticationHandler<FakeProviderOptions>(options, logger, encoder)
{
    private static readonly ConcurrentDictionary<string, AuthenticationProperties> States = new();

    protected override Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        GenerateCorrelationId(properties);
        var state = Guid.NewGuid().ToString("N");
        States[state] = properties;
        Response.Redirect($"https://provider.test/authorize?state={state}");
        return Task.CompletedTask;
    }

    protected override Task<HandleRequestResult> HandleRemoteAuthenticateAsync()
    {
        if (!States.TryRemove(Request.Query["state"].ToString(), out var properties))
        {
            return Task.FromResult(HandleRequestResult.Fail("unknown state"));
        }

        if (!ValidateCorrelationId(properties))
        {
            return Task.FromResult(HandleRequestResult.Fail("correlation failed"));
        }

        var claims = new List<Claim> { new("sub", Request.Query["sub"].ToString()) };
        if (Request.Query["email"].ToString() is { Length: > 0 } email)
        {
            claims.Add(new Claim("email", email));
        }

        if (Request.Query["verified"] == "true")
        {
            claims.Add(new Claim("email_verified", "true"));
        }

        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, Scheme.Name));
        return Task.FromResult(HandleRequestResult.Success(new AuthenticationTicket(principal, properties, Scheme.Name)));
    }
}
