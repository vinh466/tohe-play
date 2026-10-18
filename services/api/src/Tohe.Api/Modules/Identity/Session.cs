using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Identity;

namespace Tohe.Api.Modules.Identity;

/// <summary>
/// The device session is the Identity cookie plus claims of our own: the profile currently playing, until when profile
/// management is open (step-up level 1, the parent gate), until when account security is open (level 2, ADR 0025), and
/// until when the admin console is open — two-factor authentication passed on this device (ADR 0027). Changing any
/// re-issues the cookie.
/// </summary>
public static class SessionClaims
{
    public const string Profile = "tohe:profile";
    public const string ParentUntil = "tohe:parent_until";
    public const string SecureUntil = "tohe:secure_until";
    public const string AdminUntil = "tohe:admin_until";

    /// <summary>The session claims kept when Identity rebuilds the principal from the database.</summary>
    public static readonly string[] All = [Profile, ParentUntil, SecureUntil, AdminUntil];

    /// <summary>How long either level of step-up stays open on the device.</summary>
    public static readonly TimeSpan ParentGateDuration = TimeSpan.FromMinutes(10);

    /// <summary>How long the admin console stays open on a device after its two-factor check: a working day.</summary>
    public static readonly TimeSpan AdminDuration = TimeSpan.FromHours(12);

    public static Guid? ProfileId(ClaimsPrincipal user) =>
        Guid.TryParse(user.FindFirstValue(Profile), out var id) ? id : null;

    public static DateTimeOffset? ParentUnlockedUntil(ClaimsPrincipal user) => Time(user, ParentUntil);

    public static DateTimeOffset? SecureUnlockedUntil(ClaimsPrincipal user) => Time(user, SecureUntil);

    public static DateTimeOffset? AdminOpenUntil(ClaimsPrincipal user) => Time(user, AdminUntil);

    public static bool IsParentUnlocked(ClaimsPrincipal user, DateTimeOffset now) =>
        ParentUnlockedUntil(user) is { } until && until > now;

    public static bool IsSecure(ClaimsPrincipal user, DateTimeOffset now) =>
        SecureUnlockedUntil(user) is { } until && until > now;

    public static bool IsAdminOpen(ClaimsPrincipal user, DateTimeOffset now) =>
        AdminOpenUntil(user) is { } until && until > now;

    public static Guid? AccountId(ClaimsPrincipal user) =>
        Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    private static DateTimeOffset? Time(ClaimsPrincipal user, string claim) =>
        long.TryParse(user.FindFirstValue(claim), CultureInfo.InvariantCulture, out var seconds)
            ? DateTimeOffset.FromUnixTimeSeconds(seconds)
            : null;
}

/// <summary>What a device's session carries besides who signed in.</summary>
/// <param name="ProfileId">The profile playing on the device.</param>
/// <param name="ParentUntil">Profile management (step-up level 1) is open until then.</param>
/// <param name="SecureUntil">Account security (step-up level 2) is open until then.</param>
/// <param name="AdminUntil">The admin console is open until then (ADR 0027). Like both levels, choosing who plays or
/// locking the page closes it.</param>
public sealed record DeviceSession(
    Guid? ProfileId, DateTimeOffset? ParentUntil = null, DateTimeOffset? SecureUntil = null, DateTimeOffset? AdminUntil = null)
{
    public static DeviceSession Of(ClaimsPrincipal user) => new(
        SessionClaims.ProfileId(user),
        SessionClaims.ParentUnlockedUntil(user),
        SessionClaims.SecureUnlockedUntil(user),
        SessionClaims.AdminOpenUntil(user));
}

/// <summary>
/// Re-issues the session cookie with the given session claims. Never for a suspended account (ADR 0027) nor one waiting
/// to be deleted (ADR 0034): the cookie would carry the security stamp that ended its sessions, and a session it still
/// holds would outlive that by renewing itself before the session check.
/// </summary>
internal sealed class SessionWriter(SignInManager<Account> signIn, AccountDeletion deletion)
{
    /// <summary>
    /// A sign-in — by password, provider or a reset — proved it is the account's owner: an account waiting to be
    /// deleted stays (design §3.14), then the session starts.
    /// </summary>
    public async Task SignInAsync(Account account, DeviceSession session, CancellationToken ct)
    {
        if (!await deletion.KeepAsync(account, ct))
        {
            throw new AccountDeletingException();
        }

        await WriteAsync(account, session);
    }

    public Task WriteAsync(Account account, DeviceSession session)
    {
        if (account.SuspendedAt is not null)
        {
            throw new AccountSuspendedException();
        }

        if (account.DeleteAfter is not null)
        {
            throw new AccountDeletingException();
        }

        var claims = new List<Claim>();
        if (session.ProfileId is { } profile)
        {
            claims.Add(new Claim(SessionClaims.Profile, profile.ToString()));
        }

        if (session.ParentUntil is { } parentUntil)
        {
            claims.Add(new Claim(SessionClaims.ParentUntil, Seconds(parentUntil)));
        }

        if (session.SecureUntil is { } secureUntil)
        {
            claims.Add(new Claim(SessionClaims.SecureUntil, Seconds(secureUntil)));
        }

        if (session.AdminUntil is { } adminUntil)
        {
            claims.Add(new Claim(SessionClaims.AdminUntil, Seconds(adminUntil)));
        }

        return signIn.SignInWithClaimsAsync(account, new AuthenticationProperties { IsPersistent = true }, claims);
    }

    private static string Seconds(DateTimeOffset at) => at.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture);
}

/// <summary>A session was about to be written for a suspended account; see <see cref="SessionWriter"/>.</summary>
public sealed class AccountSuspendedException() : InvalidOperationException("The account is suspended");

/// <summary>
/// A session was about to be written for an account waiting to be deleted, from a session it held before (or for one
/// deleted at that very moment); see <see cref="SessionWriter"/>.
/// </summary>
public sealed class AccountDeletingException() : InvalidOperationException("The account is being deleted");

/// <summary>
/// The answer to <see cref="AccountSuspendedException"/> — the one a sign-in gets — and to
/// <see cref="AccountDeletingException"/>, a session that ended: the session on this browser ends now rather than at
/// the next session check.
/// </summary>
internal sealed class SessionRefusedHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext http, Exception exception, CancellationToken ct)
    {
        var problem = exception switch
        {
            AccountSuspendedException => Problems.AccountSuspended(),
            AccountDeletingException => Problems.SessionEnded(),
            _ => null,
        };
        if (problem is null)
        {
            return false;
        }

        await http.SignOutAsync(IdentityConstants.ApplicationScheme);
        await problem.ExecuteAsync(http);
        return true;
    }
}
