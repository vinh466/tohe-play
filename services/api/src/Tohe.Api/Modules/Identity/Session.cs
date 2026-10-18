using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;

namespace Tohe.Api.Modules.Identity;

/// <summary>
/// The device session is the Identity cookie plus two claims of our own: the profile currently playing and
/// until when profile management is unlocked (the parent gate). Changing either re-issues the cookie.
/// </summary>
public static class SessionClaims
{
    public const string Profile = "tohe:profile";
    public const string ParentUntil = "tohe:parent_until";

    public static readonly TimeSpan ParentGateDuration = TimeSpan.FromMinutes(10);

    public static Guid? ProfileId(ClaimsPrincipal user) =>
        Guid.TryParse(user.FindFirstValue(Profile), out var id) ? id : null;

    public static DateTimeOffset? ParentUnlockedUntil(ClaimsPrincipal user) =>
        long.TryParse(user.FindFirstValue(ParentUntil), CultureInfo.InvariantCulture, out var seconds)
            ? DateTimeOffset.FromUnixTimeSeconds(seconds)
            : null;

    public static bool IsParentUnlocked(ClaimsPrincipal user, DateTimeOffset now) =>
        ParentUnlockedUntil(user) is { } until && until > now;

    public static Guid? AccountId(ClaimsPrincipal user) =>
        Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
}

/// <summary>Re-issues the session cookie with the given session claims.</summary>
public sealed class SessionWriter(SignInManager<Account> signIn)
{
    public Task WriteAsync(Account account, Guid? profileId, DateTimeOffset? parentUntil)
    {
        var claims = new List<Claim>();
        if (profileId is { } profile)
        {
            claims.Add(new Claim(SessionClaims.Profile, profile.ToString()));
        }

        if (parentUntil is { } until)
        {
            claims.Add(new Claim(SessionClaims.ParentUntil, until.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture)));
        }

        return signIn.SignInWithClaimsAsync(account, new AuthenticationProperties { IsPersistent = true }, claims);
    }
}
