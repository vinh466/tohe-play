using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Tohe.Api.Modules.Platform;

namespace Tohe.Api.Modules.Identity;

/// <summary>
/// The console's session (ADR 0027, 0042): a cookie of its own, issued on the console's host by the console's own
/// sign-in — the email, the password and a code from the authenticator. An operator signed in as a player is not signed
/// in to the console, and the other way round: the API's console routes authenticate with this scheme alone, and
/// everything else with the players' session, so the two hold apart by scheme even where browsers share cookies
/// between the hosts (localhost and UAT, which differ by port). It lasts twelve hours from the sign-in, never longer:
/// re-issuing it — after step-up — keeps its end. It ends early when the account's security stamp changes.
/// </summary>
public static class ConsoleSession
{
    public const string Scheme = "Tohe.Console";

    /// <summary>The cookie's name over plain HTTP (development, UAT).</summary>
    public const string CookieName = "tohe.console";

    /// <summary>The cookie's name when the console's URL is HTTPS: Secure, and locked to the console's host.</summary>
    public const string SecureCookieName = "__Host-tohe.console";

    /// <summary>The claim holding when the session ends, in Unix seconds.</summary>
    public const string UntilClaim = "tohe:console_until";

    /// <summary>A working day, from the sign-in; no sliding.</summary>
    public static readonly TimeSpan Lifetime = TimeSpan.FromHours(12);

    /// <summary>When the console session of <paramref name="user"/> ends.</summary>
    public static DateTimeOffset? Until(ClaimsPrincipal user) => SessionClaims.Time(user, UntilClaim);

    internal static void Add(AuthenticationBuilder authentication, IServiceCollection services)
    {
        authentication.AddCookie(Scheme, options =>
        {
            options.Cookie.Name = CookieName;
            options.Cookie.HttpOnly = true;
            // Strict: the console is never reached from a link elsewhere with its session (ADR 0042).
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
            // On every request: a new password, a suspension, "sign out everywhere" or two-factor authentication
            // turned off give the account a new security stamp, which ends the console's session at once.
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

        // As the players' session (IdentityModule): on an HTTPS console the cookie is always Secure, and the __Host-
        // prefix forbids a Domain attribute, so no other host of the domain can set or shadow it.
        services.AddOptions<CookieAuthenticationOptions>(Scheme)
            .Configure<IOptions<AppOptions>>((options, app) =>
            {
                if (app.Value.ConsoleUrl?.Scheme == Uri.UriSchemeHttps)
                {
                    options.Cookie.Name = SecureCookieName;
                    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                }
            });
        services.AddScoped<ConsoleSessionWriter>();
    }
}

/// <summary>
/// Starts, re-issues and ends the console's session. Never for a suspended account nor one waiting to be deleted
/// (<see cref="SessionWriter.EnsureMayHoldSession"/>).
/// </summary>
internal sealed class ConsoleSessionWriter(SignInManager<Account> signIn, TimeProvider clock)
{
    /// <summary>A sign-in to the console: twelve hours from now.</summary>
    public async Task<DateTimeOffset> SignInAsync(HttpContext http, Account account)
    {
        var until = clock.GetUtcNow() + ConsoleSession.Lifetime;
        await WriteAsync(http, account, until, secureUntil: null);
        return until;
    }

    /// <summary>The same session again — after step-up level 2 — ending when it was to end.</summary>
    public async Task WriteAsync(HttpContext http, Account account, DateTimeOffset until, DateTimeOffset? secureUntil)
    {
        SessionWriter.EnsureMayHoldSession(account);
        var principal = await signIn.CreateUserPrincipalAsync(account);
        var identity = (ClaimsIdentity)principal.Identity!;
        identity.AddClaim(new Claim(ConsoleSession.UntilClaim, SessionWriter.Seconds(until)));
        if (secureUntil is { } secure)
        {
            identity.AddClaim(new Claim(SessionClaims.SecureUntil, SessionWriter.Seconds(secure < until ? secure : until)));
        }

        await http.SignInAsync(
            ConsoleSession.Scheme,
            principal,
            new AuthenticationProperties { IsPersistent = true, ExpiresUtc = until, AllowRefresh = false });
    }

    public Task SignOutAsync(HttpContext http) => http.SignOutAsync(ConsoleSession.Scheme);
}
