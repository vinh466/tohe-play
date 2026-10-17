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

    /// <summary>Sign-in, registration, PIN and parent-gate requests allowed per client IP per minute.</summary>
    public int AuthRequestsPerMinute { get; set; } = 10;
}

/// <summary>Accounts, households, profiles and the device session (ADR 0004, ADR 0011).</summary>
internal static class IdentityModule
{
    public const string AuthRateLimit = "auth";

    public static WebApplicationBuilder AddIdentityModule(this WebApplicationBuilder builder)
    {
        var services = builder.Services;
        services.AddOptions<IdentityOptions>().BindConfiguration(IdentityOptions.Section);
        services.TryAddSingleton(TimeProvider.System);

        services.AddAuthentication(IdentityConstants.ApplicationScheme).AddIdentityCookies();
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
            .AddSignInManager();

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

        // Identity periodically rebuilds the principal from the database; keep the session claims across that.
        services.Configure<SecurityStampValidatorOptions>(options =>
            options.OnRefreshingPrincipal = context =>
            {
                var sessionClaims = context.CurrentPrincipal?.Claims
                    .Where(c => c.Type is SessionClaims.Profile or SessionClaims.ParentUntil)
                    .ToList() ?? [];
                context.NewPrincipal?.Identities.First().AddClaims(sessionClaims);
                return Task.CompletedTask;
            });

        var dataProtection = services.AddDataProtection().SetApplicationName("tohe");
        if (!BuildTime.IsGeneratingOpenApi)
        {
            dataProtection.PersistKeysToDbContext<ToheDbContext>();
        }

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy(AuthRateLimit, context =>
            {
                var limit = context.RequestServices.GetRequiredService<Microsoft.Extensions.Options.IOptions<IdentityOptions>>()
                    .Value.AuthRequestsPerMinute;
                return RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = limit, Window = TimeSpan.FromMinutes(1) });
            });
        });

        // The API is only reachable through the hub's reverse proxy (Caddy / Vite), which sets X-Forwarded-For.
        services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            options.KnownIPNetworks.Clear();
            options.KnownProxies.Clear();
        });

        services.AddScoped<SessionWriter>();
        services.AddScoped<MeQueries>();
        services.AddScoped<IActiveProfile, ActiveProfileReader>();
        services.AddScoped<IHouseholdProfiles, HouseholdProfilesReader>();
        return builder;
    }

    public static IEndpointRouteBuilder MapIdentityEndpoints(this IEndpointRouteBuilder api)
    {
        AuthEndpoints.Map(api);
        SessionEndpoints.Map(api);
        HouseholdEndpoints.Map(api);
        return api;
    }
}
