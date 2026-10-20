using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Platform;

namespace Tohe.Api.Modules.Identity;

/// <summary>
/// A browser, or an installed app, that keeps device profiles on the server (ADR 0043): one key for up to five of them,
/// in a cookie. The server keeps only the key's hash and when it was made and last seen — nothing about the person.
/// </summary>
public sealed class Device
{
    public Guid Id { get; set; }

    /// <summary>SHA-256 of the 32-byte key the device holds in its cookie; the key itself is never stored.</summary>
    public required byte[] KeyHash { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>When its key was last used. Unseen for 90 days, the device and its profiles are deleted.</summary>
    public DateTimeOffset LastSeenAt { get; set; }
}

internal sealed class DeviceConfiguration : IEntityTypeConfiguration<Device>
{
    public void Configure(EntityTypeBuilder<Device> builder)
    {
        builder.ToTable("devices", "identity");
        builder.Property(device => device.KeyHash).HasMaxLength(32);
        builder.HasIndex(device => device.KeyHash).IsUnique();
        builder.HasIndex(device => device.LastSeenAt);
    }
}

/// <summary>
/// The device key (ADR 0043): a cookie of its own, and an authentication scheme of its own that authenticates the
/// device-profile endpoints and a device profile's actions at tables — never an account's endpoints. Which device profile
/// acts is named by the request (<see cref="ProfileHeader"/>, or <see cref="ProfileQuery"/> on the rooms hub's
/// connection), and only a profile of the device whose key came is ever found for it.
/// </summary>
public static class DeviceKey
{
    public const string Scheme = "Tohe.Device";

    /// <summary>
    /// The players' scheme at tables: the device key when the request names a device profile, the account's session
    /// otherwise — never both, so neither credential ever acts for the other's profiles.
    /// </summary>
    public const string PlayerScheme = "Tohe.Player";

    /// <summary>The cookie's name over plain HTTP (development, UAT), as the players' session.</summary>
    public const string CookieName = "tohe.device";

    /// <summary>The cookie's name behind an HTTPS hub: Secure, and locked to the hub's host.</summary>
    public const string SecureCookieName = "__Host-tohe.device";

    /// <summary>The claim holding the device's id.</summary>
    public const string DeviceClaim = "tohe:device";

    /// <summary>The header naming the device profile that acts.</summary>
    public const string ProfileHeader = "X-Tohe-Device-Profile";

    /// <summary>The header carrying the version of the terms the hub shows, which the device profile must have accepted.</summary>
    public const string TermsHeader = "X-Tohe-Terms";

    /// <summary>The same two on the rooms hub's connection, where a browser cannot set headers.</summary>
    public const string ProfileQuery = "deviceProfile";

    public const string TermsQuery = "terms";

    /// <summary>Unused this long, the key expires on the device and the device is deleted on the server.</summary>
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(90);

    /// <summary>How often a key in use is renewed — its cookie, and when the device was last seen.</summary>
    public static readonly TimeSpan RenewAfter = TimeSpan.FromHours(1);

    /// <summary>The authenticated device, or null when the principal is not a device's.</summary>
    public static Guid? DeviceOf(ClaimsPrincipal user) =>
        user.Identity is { IsAuthenticated: true, AuthenticationType: Scheme }
        && Guid.TryParse(user.FindFirstValue(DeviceClaim), out var id)
            ? id
            : null;

    /// <summary>The device profile the request names, by header or (the rooms hub) in the query.</summary>
    public static Guid? NamedProfile(HttpContext http) =>
        Guid.TryParse(Named(http, ProfileHeader, ProfileQuery), out var id) ? id : null;

    /// <summary>The version of the terms the hub shows, as the request says it.</summary>
    public static string? Terms(HttpContext http) => Named(http, TermsHeader, TermsQuery);

    /// <summary>True when the request acts as a device profile: the players' scheme then reads the device key.</summary>
    public static bool NamesDeviceProfile(HttpContext http) => Named(http, ProfileHeader, ProfileQuery) is not null;

    private static string? Named(HttpContext http, string header, string query)
    {
        if (http.Request.Headers.TryGetValue(header, out var value) && !string.IsNullOrEmpty(value))
        {
            return value.ToString();
        }

        // Only the rooms hub's connection names one in its address: a WebSocket cannot carry headers.
        return http.Request.Path.StartsWithSegments("/api/rooms/hub", StringComparison.Ordinal)
            && http.Request.Query.TryGetValue(query, out var fromQuery) && !string.IsNullOrEmpty(fromQuery)
                ? fromQuery.ToString()
                : null;
    }

    /// <summary>SHA-256 of a key.</summary>
    public static byte[] Hash(byte[] key) => SHA256.HashData(key);

    internal static void Add(AuthenticationBuilder authentication)
    {
        authentication.AddScheme<AuthenticationSchemeOptions, DeviceKeyHandler>(Scheme, _ => { });
        authentication.AddPolicyScheme(PlayerScheme, "A player at a table", options =>
            options.ForwardDefaultSelector = http => NamesDeviceProfile(http) ? Scheme : IdentityConstants.ApplicationScheme);
    }

    /// <summary>The cookie's name and whether it is Secure, as for the players' session (ADR 0021).</summary>
    internal static (string Name, bool Secure) CookieFor(HttpContext http, AppOptions app) =>
        app.PublicUrl?.Scheme == Uri.UriSchemeHttps ? (SecureCookieName, true) : (CookieName, http.Request.IsHttps);

    /// <summary>Writes the key's cookie: HttpOnly, SameSite=Lax, Path=/, 90 days from now.</summary>
    internal static void Write(HttpContext http, AppOptions app, string key, DateTimeOffset now)
    {
        var (name, secure) = CookieFor(http, app);
        http.Response.Cookies.Append(name, key, new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Lax,
            Path = "/",
            Expires = now + Lifetime,
            IsEssential = true,
        });
    }
}

/// <summary>
/// Authenticates the device key: the cookie's key, hashed, finds the device. Renews the cookie and the device's
/// last-seen time at most once an hour, so a device in use never expires.
/// </summary>
internal sealed class DeviceKeyHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    ToheDbContext db,
    IOptions<AppOptions> app,
    TimeProvider clock) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var (name, _) = DeviceKey.CookieFor(Context, app.Value);
        if (!Request.Cookies.TryGetValue(name, out var value) || string.IsNullOrEmpty(value))
        {
            return AuthenticateResult.NoResult();
        }

        byte[] key;
        try
        {
            key = WebEncoders.Base64UrlDecode(value);
        }
        catch (FormatException)
        {
            return AuthenticateResult.Fail("Not a device key");
        }

        if (key.Length != DeviceKeys.KeyBytes)
        {
            return AuthenticateResult.Fail("Not a device key");
        }

        var hash = DeviceKey.Hash(key);
        var device = await db.Devices.AsNoTracking()
            .Where(d => d.KeyHash == hash)
            .Select(d => new { d.Id, d.LastSeenAt })
            .FirstOrDefaultAsync(Context.RequestAborted);
        if (device is null)
        {
            return AuthenticateResult.Fail("Unknown device");
        }

        var now = clock.GetUtcNow();
        if (now - device.LastSeenAt > DeviceKey.RenewAfter)
        {
            await db.Devices.Where(d => d.Id == device.Id)
                .ExecuteUpdateAsync(set => set.SetProperty(d => d.LastSeenAt, now), Context.RequestAborted);
            if (!Response.HasStarted)
            {
                DeviceKey.Write(Context, app.Value, value, now);
            }
        }

        var identity = new ClaimsIdentity([new Claim(DeviceKey.DeviceClaim, device.Id.ToString())], DeviceKey.Scheme);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), DeviceKey.Scheme));
    }

    protected override Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    }

    protected override Task HandleForbiddenAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    }
}
