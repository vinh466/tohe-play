using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Platform;

namespace Tohe.Api.Modules.Studio;

/// <summary>
/// The Studio's session (ADR 0051): a cookie of its own, issued by the Studio's own sign-in — the email, the password,
/// and a code from the authenticator when two-factor authentication is on — a copy of the console's
/// (<see cref="ConsoleSession"/>). The API's Studio routes authenticate with this scheme alone, and nothing else does,
/// so a player's or the console's session counts for nothing in the Studio and the other way round, even where browsers
/// share cookies between hosts that differ by port (localhost, UAT). Its scheme of its own gives it a data-protection
/// purpose of its own: a cookie sealed for another scheme does not open here. It lasts twelve hours from the sign-in,
/// never longer: re-issuing it — after step-up — keeps its end. It ends early when the account's security stamp
/// changes.
/// </summary>
public static class StudioSession
{
    public const string Scheme = "Tohe.Studio";

    /// <summary>The cookie's name over plain HTTP (development, UAT).</summary>
    public const string CookieName = "tohe.studio";

    /// <summary>The cookie's name on an HTTPS deployment: Secure, and locked to the host that set it.</summary>
    public const string SecureCookieName = "__Host-tohe.studio";

    /// <summary>The claim holding when the session ends, in Unix seconds.</summary>
    public const string UntilClaim = "tohe:studio_until";

    /// <summary>A working day, from the sign-in; no sliding.</summary>
    public static readonly TimeSpan Lifetime = TimeSpan.FromHours(12);

    /// <summary>The Studio's session, and nothing else, authenticates the Studio's routes.</summary>
    internal static readonly AuthorizationPolicy Policy =
        new AuthorizationPolicyBuilder(Scheme).RequireAuthenticatedUser().Build();

    /// <summary>When the Studio session of <paramref name="user"/> ends.</summary>
    public static DateTimeOffset? Until(ClaimsPrincipal user) => SessionClaims.Time(user, UntilClaim);

    internal static void Add(IServiceCollection services)
    {
        services.AddAuthentication().AddCookie(Scheme, options =>
        {
            options.Cookie.Name = CookieName;
            options.Cookie.HttpOnly = true;
            // Strict: the Studio is never reached from a link elsewhere with its session.
            options.Cookie.SameSite = SameSiteMode.Strict;
            options.Cookie.Path = "/";
            options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
            options.ExpireTimeSpan = Lifetime;
            options.SlidingExpiration = false;
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
            // On every request, as the console's: a new password, a suspension, "sign out everywhere" or two-factor
            // authentication turned off give the account a new security stamp, which ends the Studio's session at once.
            options.Events.OnValidatePrincipal = async context =>
            {
                var signIn = context.HttpContext.RequestServices.GetRequiredService<SignInManager<Account>>();
                if (context.Principal is null || await signIn.ValidateSecurityStampAsync(context.Principal) is null)
                {
                    context.RejectPrincipal();
                    await context.HttpContext.SignOutAsync(Scheme);
                }
            };
        });

        // On an HTTPS deployment the cookie is always Secure, and the __Host- prefix forbids a Domain attribute, so no
        // other host of the domain can set or shadow it. The Studio has no address of its own in the configuration yet
        // (the Studio's app brings it); a deployment is HTTPS or not as a whole, so the hub's address tells.
        services.AddOptions<CookieAuthenticationOptions>(Scheme)
            .Configure<IOptions<AppOptions>>((options, app) =>
            {
                if (app.Value.PublicUrl?.Scheme == Uri.UriSchemeHttps)
                {
                    options.Cookie.Name = SecureCookieName;
                    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                }
            });
        services.AddScoped<StudioSessionWriter>();
    }
}

/// <summary>Starts, re-issues and ends the Studio's session.</summary>
internal sealed class StudioSessionWriter(SignInManager<Account> signIn, TimeProvider clock)
{
    /// <summary>A sign-in to the Studio: twelve hours from now.</summary>
    public async Task<DateTimeOffset> SignInAsync(HttpContext http, Account account)
    {
        var until = clock.GetUtcNow() + StudioSession.Lifetime;
        await WriteAsync(http, account, until, secureUntil: null);
        return until;
    }

    /// <summary>
    /// The same session again — after step-up — ending when it was to end. Never for a suspended account nor one
    /// waiting to be deleted: the callers refuse those first, and here the Studio's session ends instead, so the
    /// Identity module's answer to a refused session — which ends the players' — is never reached from the Studio.
    /// </summary>
    public async Task<bool> WriteAsync(HttpContext http, Account account, DateTimeOffset until, DateTimeOffset? secureUntil)
    {
        if (account.SuspendedAt is not null || account.DeleteAfter is not null)
        {
            await SignOutAsync(http);
            return false;
        }

        var principal = await signIn.CreateUserPrincipalAsync(account);
        var identity = (ClaimsIdentity)principal.Identity!;
        identity.AddClaim(new Claim(StudioSession.UntilClaim, SessionWriter.Seconds(until)));
        if (secureUntil is { } secure)
        {
            identity.AddClaim(new Claim(SessionClaims.SecureUntil, SessionWriter.Seconds(secure < until ? secure : until)));
        }

        await http.SignInAsync(
            StudioSession.Scheme,
            principal,
            new AuthenticationProperties { IsPersistent = true, ExpiresUtc = until, AllowRefresh = false });
        return true;
    }

    public Task SignOutAsync(HttpContext http) => http.SignOutAsync(StudioSession.Scheme);
}
