using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
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

/// <summary>Re-issues the session cookie with the given session claims.</summary>
public sealed class SessionWriter(SignInManager<Account> signIn)
{
    public Task WriteAsync(Account account, DeviceSession session)
    {
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
