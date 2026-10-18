using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OAuth;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;

namespace Tohe.Api.Modules.Identity;

/// <summary>One sign-in provider of the deployment (ADR 0026): it exists only with its secrets.</summary>
public sealed class ExternalProviderOptions
{
    public string? ClientId { get; set; }

    public string? ClientSecret { get; set; }

    /// <summary>The generic OpenID Connect provider only: its issuer, e.g. <c>https://auth.example.org</c>.</summary>
    public string? Authority { get; set; }

    /// <summary>The generic OpenID Connect provider only: the name on its button.</summary>
    public string? DisplayName { get; set; }

    /// <summary>The generic OpenID Connect provider only: off just for a test issuer on plain HTTP.</summary>
    public bool RequireHttpsMetadata { get; set; } = true;

    internal bool HasSecrets => !string.IsNullOrWhiteSpace(ClientId) && !string.IsNullOrWhiteSpace(ClientSecret);
}

public sealed class AuthOptions
{
    public const string Section = "Auth";

    public ProvidersOptions Providers { get; set; } = new();
}

public sealed class ProvidersOptions
{
    public ExternalProviderOptions Google { get; set; } = new();

    public ExternalProviderOptions GitHub { get; set; } = new();

    public ExternalProviderOptions Oidc { get; set; } = new();
}

/// <summary>A provider the hub offers a button for.</summary>
/// <param name="Id">Its scheme and the last segment of its paths: <c>google</c>, <c>github</c>, <c>oidc</c>.</param>
/// <param name="Name">The name on the button.</param>
public sealed record ExternalProvider(string Id, string Name);

/// <summary>The providers this deployment configured, in the order the hub shows them.</summary>
public sealed class ExternalProviderCatalog(IReadOnlyList<ExternalProvider> providers)
{
    public IReadOnlyList<ExternalProvider> Providers { get; } = providers;

    public ExternalProvider? Find(string id) =>
        Providers.FirstOrDefault(p => string.Equals(p.Id, id, StringComparison.Ordinal));
}

/// <summary>
/// Google and any OpenID Connect issuer through the OpenID Connect handler, GitHub through the OAuth handler (ADR 0026).
/// Every one returns to <c>/api/auth/external/{id}/callback</c> as a GET — the hub's same-origin guard refuses
/// cross-site POSTs to <c>/api</c>, so OpenID Connect answers in the query, not by form post — and lands in Identity's
/// external cookie, which <see cref="ExternalEndpoints"/> reads once and clears.
/// </summary>
internal static class ExternalProviders
{
    public const string Google = "google";
    public const string GitHub = "github";
    public const string Oidc = "oidc";

    /// <summary>The claims every provider is reduced to.</summary>
    public const string SubjectClaim = "sub";

    public const string EmailClaim = "email";
    public const string EmailVerifiedClaim = "email_verified";

    public static ExternalProviderCatalog Add(AuthenticationBuilder authentication, IConfiguration configuration)
    {
        var options = configuration.GetSection(AuthOptions.Section).Get<AuthOptions>() ?? new AuthOptions();
        var providers = new List<ExternalProvider>();

        if (options.Providers.Google.HasSecrets)
        {
            authentication.AddOpenIdConnect(Google, "Google", o => OpenIdConnect(o, Google, "https://accounts.google.com", options.Providers.Google));
            providers.Add(new ExternalProvider(Google, "Google"));
        }

        if (options.Providers.GitHub.HasSecrets)
        {
            authentication.AddOAuth(GitHub, "GitHub", o => GitHubOAuth(o, options.Providers.GitHub));
            providers.Add(new ExternalProvider(GitHub, "GitHub"));
        }

        var oidc = options.Providers.Oidc;
        if (oidc.HasSecrets && Uri.TryCreate(oidc.Authority, UriKind.Absolute, out var authority))
        {
            var name = string.IsNullOrWhiteSpace(oidc.DisplayName) ? "OpenID" : oidc.DisplayName.Trim();
            authentication.AddOpenIdConnect(Oidc, name, o => OpenIdConnect(o, Oidc, authority.AbsoluteUri, oidc));
            providers.Add(new ExternalProvider(Oidc, name));
        }

        return new ExternalProviderCatalog(providers);
    }

    /// <summary>The one configuration every OpenID Connect provider gets — Google and the generic one alike.</summary>
    internal static void OpenIdConnect(OpenIdConnectOptions o, string id, string authority, ExternalProviderOptions provider)
    {
        o.Authority = authority;
        o.ClientId = provider.ClientId;
        o.ClientSecret = provider.ClientSecret;
        o.RequireHttpsMetadata = provider.RequireHttpsMetadata;
        o.ResponseType = OpenIdConnectResponseType.Code;
        o.ResponseMode = OpenIdConnectResponseMode.Query;
        o.CallbackPath = $"/api/auth/external/{id}/callback";
        o.SignInScheme = IdentityConstants.ExternalScheme;
        o.Scope.Clear();
        o.Scope.Add("openid");
        o.Scope.Add("email");
        // Keep the protocol's own names (sub, email, email_verified); a provider that keeps the email out of its ID
        // token says it from the userinfo endpoint.
        o.MapInboundClaims = false;
        o.GetClaimsFromUserInfoEndpoint = true;
        o.ClaimActions.MapUniqueJsonKey(EmailVerifiedClaim, EmailVerifiedClaim);
        o.Events.OnRemoteFailure = BackToHub;
        o.Events.OnAccessDenied = BackToHub;
    }

    private static void GitHubOAuth(OAuthOptions o, ExternalProviderOptions provider)
    {
        o.ClientId = provider.ClientId!;
        o.ClientSecret = provider.ClientSecret!;
        o.CallbackPath = "/api/auth/external/github/callback";
        o.AuthorizationEndpoint = "https://github.com/login/oauth/authorize";
        o.TokenEndpoint = "https://github.com/login/oauth/access_token";
        o.UserInformationEndpoint = "https://api.github.com/user";
        o.Scope.Add("user:email");
        // GitHub takes PKCE (S256) since July 2025: a stolen code is useless without this browser's verifier.
        o.UsePkce = true;
        o.SignInScheme = IdentityConstants.ExternalScheme;
        o.Events.OnRemoteFailure = BackToHub;
        o.Events.OnAccessDenied = BackToHub;
        o.Events.OnCreatingTicket = async context =>
        {
            using var user = await GitHubJsonAsync(context, context.Options.UserInformationEndpoint);
            context.Identity!.AddClaim(new Claim(SubjectClaim, user.RootElement.GetProperty("id").GetRawText()));

            // Only the primary address, and only when GitHub verified it (D-03); otherwise Tò He asks for one.
            using var emails = await GitHubJsonAsync(context, "https://api.github.com/user/emails");
            foreach (var email in emails.RootElement.EnumerateArray())
            {
                if (email.GetProperty("primary").GetBoolean() && email.GetProperty("verified").GetBoolean())
                {
                    context.Identity.AddClaim(new Claim(EmailClaim, email.GetProperty("email").GetString()!));
                    context.Identity.AddClaim(new Claim(EmailVerifiedClaim, "true"));
                    break;
                }
            }
        };
    }

    private static async Task<JsonDocument> GitHubJsonAsync(OAuthCreatingTicketContext context, string url)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", context.AccessToken);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        request.Headers.UserAgent.Add(new ProductInfoHeaderValue("Tohe", "1"));
        using var response = await context.Backchannel.SendAsync(request, context.HttpContext.RequestAborted);
        response.EnsureSuccessStatusCode();
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync(context.HttpContext.RequestAborted));
    }

    /// <summary>Cancelled at the provider, or refused there: back to the hub's sign-in screen, which says so.</summary>
    private static Task BackToHub(HandleRequestContext<RemoteAuthenticationOptions> context)
    {
        context.Response.Redirect("/welcome?external=failed");
        context.HandleResponse();
        return Task.CompletedTask;
    }
}
