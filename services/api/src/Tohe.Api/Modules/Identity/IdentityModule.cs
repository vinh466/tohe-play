using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Platform;

namespace Tohe.Api.Modules.Identity;

public sealed class IdentityOptions
{
    public const string Section = "Identity";

    /// <summary>
    /// Requests per client IP per minute in each of three buckets: signing in or asking for a code, typing a code back,
    /// and typing a PIN or the parent gate's password. Each guards a different secret, so one does not use up another.
    /// </summary>
    public int AuthRequestsPerMinute { get; set; } = 10;

    /// <summary>
    /// How often a session is checked against its account's security stamp, which a new password or email changes:
    /// "every other session ends" takes at most this long (ADR 0024).
    /// </summary>
    public TimeSpan SessionCheckInterval { get; set; } = TimeSpan.FromMinutes(5);
}

/// <summary>
/// Accounts, the profiles they own, signing in by email or with a provider, step-up, and the device session
/// (ADR 0011, 0023, 0024, 0025, 0026).
/// </summary>
internal static class IdentityModule
{
    /// <summary>Signing in, signing up, and asking for a code.</summary>
    public const string SignInRateLimit = "auth";

    /// <summary>Typing back a code from an email.</summary>
    public const string CodeRateLimit = "auth-code";

    /// <summary>A profile's PIN and the parent gate's password.</summary>
    public const string GateRateLimit = "auth-gate";

    public static WebApplicationBuilder AddIdentityModule(this WebApplicationBuilder builder)
    {
        var services = builder.Services;
        services.AddOptions<IdentityOptions>().BindConfiguration(IdentityOptions.Section);
        services.TryAddSingleton(TimeProvider.System);

        var authentication = services.AddAuthentication(IdentityConstants.ApplicationScheme);
        authentication.AddIdentityCookies();
        // Google, GitHub and an OpenID Connect issuer, each only when the deployment gave it secrets (ADR 0026).
        services.AddSingleton(ExternalProviders.Add(authentication, builder.Configuration));
        services.AddAuthorization();
        services.AddIdentityCore<Account>(options =>
            {
                options.User.RequireUniqueEmail = false;
                options.User.AllowedUserNameCharacters = "abcdefghijklmnopqrstuvwxyz0123456789._-";
                // Length beats composition rules (ADR 0011).
                options.Password.RequiredLength = 8;
                options.Password.RequireDigit = false;
                options.Password.RequireLowercase = false;
                options.Password.RequireUppercase = false;
                options.Password.RequireNonAlphanumeric = false;
                options.Password.RequiredUniqueChars = 1;
                options.Lockout.AllowedForNewUsers = true;
                options.Lockout.MaxFailedAccessAttempts = 10;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
            })
            .AddEntityFrameworkStores<ToheDbContext>()
            .AddSignInManager()
            // Authenticator apps (TOTP) for the admin console's two-factor authentication (ADR 0027).
            .AddTokenProvider<AuthenticatorTokenProvider<Account>>(TokenOptions.DefaultAuthenticatorProvider);

        services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.Name = "tohe.session";
            options.Cookie.HttpOnly = true;
            options.Cookie.SameSite = SameSiteMode.Lax;
            // Secure whenever the request is HTTPS — which App:PublicUrl decides behind a proxy (UsePublicUrl).
            // UAT is plain HTTP inside the VPN (ADR 0010).
            options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
            options.ExpireTimeSpan = TimeSpan.FromDays(90);
            options.SlidingExpiration = true;
            // An API answers with status codes, never with redirects to a login page.
            options.Events.OnRedirectToLogin = context =>
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            };
            options.Events.OnRedirectToAccessDenied = context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            };
        });

        // On an HTTPS deployment the cookie is always Secure and locked to the hub's host: the __Host- prefix forbids
        // a Domain attribute, so another subdomain of the same site (the games origin among them) can neither set nor
        // shadow it (ADR 0021).
        services.AddOptions<CookieAuthenticationOptions>(IdentityConstants.ApplicationScheme)
            .Configure<IOptions<AppOptions>>((options, app) =>
            {
                if (app.Value.PublicUrl?.Scheme == Uri.UriSchemeHttps)
                {
                    options.Cookie.Name = "__Host-tohe.session";
                    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                }
            });

        // Identity periodically checks the session against the account's security stamp and rebuilds the principal
        // from the database; keep the session claims across that.
        services.AddOptions<SecurityStampValidatorOptions>()
            .Configure<IOptions<IdentityOptions>>((options, identity) =>
            {
                options.ValidationInterval = identity.Value.SessionCheckInterval;
                options.OnRefreshingPrincipal = context =>
                {
                    var sessionClaims = context.CurrentPrincipal?.Claims
                        .Where(c => SessionClaims.All.Contains(c.Type))
                        .ToList() ?? [];
                    context.NewPrincipal?.Identities.First().AddClaims(sessionClaims);
                    return Task.CompletedTask;
                };
            });

        var dataProtection = services.AddDataProtection().SetApplicationName("tohe");
        if (!BuildTime.IsGeneratingOpenApi)
        {
            dataProtection.PersistKeysToDbContext<ToheDbContext>();
        }

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            foreach (var policy in (string[])[SignInRateLimit, CodeRateLimit, GateRateLimit])
            {
                options.AddPolicy(policy, context =>
                {
                    var limit = context.RequestServices.GetRequiredService<IOptions<IdentityOptions>>()
                        .Value.AuthRequestsPerMinute;
                    return RateLimitPartition.GetFixedWindowLimiter(
                        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                        _ => new FixedWindowRateLimiterOptions { PermitLimit = limit, Window = TimeSpan.FromMinutes(1) });
                });
            }
        });

        // The API is only reachable through the hub's reverse proxy (Caddy / Vite), which sets X-Forwarded-For.
        services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            options.KnownIPNetworks.Clear();
            options.KnownProxies.Clear();
        });

        services.AddScoped<SessionWriter>();
        services.AddScoped<Attempts>();
        services.AddScoped<MeQueries>();
        // Platform roles and the counts the admin console reads (ADR 0027).
        services.AddScoped<PlatformRoles>();
        services.AddScoped<IdentityFacts>();
        services.AddScoped<IActiveProfile, ActiveProfileReader>();
        services.AddScoped<IAccountProfiles, AccountProfilesReader>();
        return builder;
    }

    public static IEndpointRouteBuilder MapIdentityEndpoints(this IEndpointRouteBuilder api)
    {
        AuthEndpoints.Map(api);
        AccountEmailEndpoints.Map(api);
        AccountSecurityEndpoints.Map(api);
        ExternalEndpoints.Map(api);
        SessionEndpoints.Map(api);
        ProfileEndpoints.Map(api);
        return api;
    }
}
