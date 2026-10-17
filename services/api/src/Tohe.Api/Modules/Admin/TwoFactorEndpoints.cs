using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Admin;

/// <summary>Two-factor authentication on this account, and until when the console stays open on this device.</summary>
public sealed record TwoFactorView(bool Enabled, DateTimeOffset? OpenUntil, int RecoveryCodesLeft);

/// <summary>A new authenticator key: typed in, or read from the QR code of <see cref="Uri"/>.</summary>
/// <param name="SharedKey">The key in groups of four, as people type it.</param>
/// <param name="Uri">An <c>otpauth://totp/…</c> URI for authenticator apps.</param>
public sealed record AuthenticatorSetupView(string SharedKey, string Uri);

/// <summary>Codes that open the console once each when the authenticator is lost; shown this once.</summary>
public sealed record RecoveryCodesView(IReadOnlyList<string> Codes);

/// <param name="Code">Six digits from the authenticator app.</param>
/// <param name="RecoveryCode">Or one of the recovery codes.</param>
public sealed record TwoFactorCodeRequest(string? Code = null, string? RecoveryCode = null);

/// <summary>
/// The admin console's two-factor authentication (ADR 0027): an authenticator app (TOTP) set up behind step-up level 2,
/// then a code — or a recovery code — on each device, which opens the console there for a working day. Turning it on
/// leaves other sessions alone; turning it off ends them.
/// </summary>
internal static class TwoFactorEndpoints
{
    private const int RecoveryCodes = 10;
    private const string TokenProvider = "Tohe";
    private const string LastCodeToken = "last-authenticator-code";

    /// <summary>How long a code that worked may not work again: the authenticator's window, with room to spare.</summary>
    private static readonly TimeSpan Replay = TimeSpan.FromMinutes(3);

    public static void Map(RouteGroupBuilder admin)
    {
        admin.MapGet("/two-factor", GetAsync)
            .RequirePermission(AdminPermissions.Read)
            .WithoutTwoFactor()
            .WithName("GetAdminTwoFactor")
            .WithSummary("Whether two-factor authentication is on, until when the console is open here, recovery codes left.");

        admin.MapPost("/two-factor/setup", SetUpAsync)
            .RequirePermission(AdminPermissions.Read)
            .WithoutTwoFactor()
            .RequireStepUp()
            .WithName("SetUpAdminAuthenticator")
            .WithSummary("A new authenticator key, while two-factor authentication is off (needs step-up level 2).");

        admin.MapPost("/two-factor/enable", EnableAsync)
            .RequirePermission(AdminPermissions.Read)
            .WithoutTwoFactor()
            .RequireStepUp()
            .RequireRateLimiting(IdentityModule.CodeRateLimit)
            .WithName("EnableAdminTwoFactor")
            .WithSummary("A code from the new key turns two-factor authentication on and opens the console; recovery codes once.");

        admin.MapPost("/two-factor/verify", VerifyAsync)
            .RequirePermission(AdminPermissions.Read)
            .WithoutTwoFactor()
            .RequireRateLimiting(IdentityModule.CodeRateLimit)
            .WithName("VerifyAdminTwoFactor")
            .WithSummary("A code, or a recovery code, opens the console on this device for twelve hours.");

        admin.MapPost("/two-factor/recovery-codes", NewRecoveryCodesAsync)
            .RequirePermission(AdminPermissions.Read)
            .RequireStepUp()
            .WithName("NewAdminRecoveryCodes")
            .WithSummary("New recovery codes in place of the old ones (needs step-up level 2).");

        admin.MapDelete("/two-factor", DisableAsync)
            .RequirePermission(AdminPermissions.Read)
            .RequireStepUp()
            .WithName("DisableAdminTwoFactor")
            .WithSummary("Turn two-factor authentication off: the console closes on every device (needs step-up level 2).");
    }

    private static async Task<Results<Ok<TwoFactorView>, UnauthorizedHttpResult>> GetAsync(
        HttpContext http, UserManager<Account> users, TimeProvider clock)
    {
        if (await users.GetUserAsync(http.User) is not { } account)
        {
            return TypedResults.Unauthorized();
        }

        return TypedResults.Ok(await ViewAsync(account, http, users, clock.GetUtcNow()));
    }

    private static async Task<Results<Ok<AuthenticatorSetupView>, UnauthorizedHttpResult, ProblemHttpResult>> SetUpAsync(
        HttpContext http, UserManager<Account> users, IUserStore<Account> store, CancellationToken ct)
    {
        if (await users.GetUserAsync(http.User) is not { } account)
        {
            return TypedResults.Unauthorized();
        }

        if (account.TwoFactorEnabled)
        {
            return Enabled();
        }

        // Straight to the store: Identity's reset would also end every other session, for a key nobody uses yet.
        await ((IUserAuthenticatorKeyStore<Account>)store).SetAuthenticatorKeyAsync(account, users.GenerateNewAuthenticatorKey(), ct);
        await users.UpdateAsync(account);
        var key = (await users.GetAuthenticatorKeyAsync(account))!;
        var label = Uri.EscapeDataString($"Tò He:{account.Email ?? account.UserName}");
        var uri = $"otpauth://totp/{label}?secret={key}&issuer={Uri.EscapeDataString("Tò He")}&digits=6&period=30";
        return TypedResults.Ok(new AuthenticatorSetupView(Grouped(key), uri));
    }

    private static async Task<Results<Ok<RecoveryCodesView>, UnauthorizedHttpResult, ValidationProblem, ProblemHttpResult>> EnableAsync(
        TwoFactorCodeRequest request,
        HttpContext http,
        UserManager<Account> users,
        IUserStore<Account> store,
        SessionWriter session,
        AdminAudit audit,
        ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        if (await users.GetUserAsync(http.User) is not { } account)
        {
            return TypedResults.Unauthorized();
        }

        if (account.TwoFactorEnabled)
        {
            return Enabled();
        }

        if (await users.GetAuthenticatorKeyAsync(account) is null)
        {
            return Problems.Of(StatusCodes.Status409Conflict, "authenticator_not_set_up", "Ask for an authenticator key first");
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        if (await CheckCodeAsync(account, request.Code, users, clock) is { } refused)
        {
            await transaction.CommitAsync(ct);
            return refused;
        }

        // Turning it on makes the account safer: other sessions stay (Identity's setter would end them).
        await ((IUserTwoFactorStore<Account>)store).SetTwoFactorEnabledAsync(account, true, ct);
        await users.UpdateAsync(account);
        var codes = (await users.GenerateNewTwoFactorRecoveryCodesAsync(account, RecoveryCodes))!.ToList();
        audit.Add(AdminActor.Of(account, http), AuditActions.TwoFactorEnable);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        await OpenAsync(account, http, session, clock);
        return TypedResults.Ok(new RecoveryCodesView(codes));
    }

    private static async Task<Results<Ok<TwoFactorView>, UnauthorizedHttpResult, ValidationProblem, ProblemHttpResult>> VerifyAsync(
        TwoFactorCodeRequest request,
        HttpContext http,
        UserManager<Account> users,
        SessionWriter session,
        AdminAudit audit,
        ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        if (await users.GetUserAsync(http.User) is not { } account)
        {
            return TypedResults.Unauthorized();
        }

        if (!account.TwoFactorEnabled)
        {
            return Problems.Of(StatusCodes.Status409Conflict, "two_factor_setup_required", "Two-factor authentication is off");
        }

        // Wrong tries count even when refused: the transaction commits either way, with an audit entry only for success.
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        string method;
        if (!string.IsNullOrWhiteSpace(request.RecoveryCode))
        {
            if (await users.IsLockedOutAsync(account))
            {
                return Problems.Field("recoveryCode", "locked_out");
            }

            if (!(await users.RedeemTwoFactorRecoveryCodeAsync(account, request.RecoveryCode.Trim())).Succeeded)
            {
                await users.AccessFailedAsync(account);
                await transaction.CommitAsync(ct);
                return Problems.Field("recoveryCode", "code_invalid");
            }

            method = "recovery-code";
        }
        else
        {
            if (await CheckCodeAsync(account, request.Code, users, clock) is { } refused)
            {
                await transaction.CommitAsync(ct);
                return refused;
            }

            method = "authenticator";
        }

        await users.ResetAccessFailedCountAsync(account);
        audit.Add(AdminActor.Of(account, http), AuditActions.ConsoleOpen, details: new { method });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        var until = await OpenAsync(account, http, session, clock);
        return TypedResults.Ok(new TwoFactorView(true, until, await users.CountRecoveryCodesAsync(account)));
    }

    private static async Task<Results<Ok<RecoveryCodesView>, UnauthorizedHttpResult>> NewRecoveryCodesAsync(
        HttpContext http, UserManager<Account> users, AdminAudit audit, ToheDbContext db, CancellationToken ct)
    {
        if (await users.GetUserAsync(http.User) is not { } account)
        {
            return TypedResults.Unauthorized();
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var codes = (await users.GenerateNewTwoFactorRecoveryCodesAsync(account, RecoveryCodes))!.ToList();
        audit.Add(AdminActor.Of(account, http), AuditActions.RecoveryCodesNew);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return TypedResults.Ok(new RecoveryCodesView(codes));
    }

    private static async Task<Results<Ok<TwoFactorView>, UnauthorizedHttpResult>> DisableAsync(
        HttpContext http,
        UserManager<Account> users,
        IUserStore<Account> store,
        SessionWriter session,
        AdminAudit audit,
        ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        if (await users.GetUserAsync(http.User) is not { } account)
        {
            return TypedResults.Unauthorized();
        }

        // Turning it off is the opposite: a new security stamp ends every other session, a new key retires the old.
        await using (var transaction = await db.Database.BeginTransactionAsync(ct))
        {
            await users.SetTwoFactorEnabledAsync(account, false);
            await users.ResetAuthenticatorKeyAsync(account);
            await ((IUserTwoFactorRecoveryCodeStore<Account>)store).ReplaceCodesAsync(account, [], ct);
            await users.UpdateAsync(account);
            audit.Add(AdminActor.Of(account, http), AuditActions.TwoFactorDisable);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }

        // This device carries on, with the new stamp and the console closed.
        await session.WriteAsync(account, DeviceSession.Of(http.User) with { AdminUntil = null });
        return TypedResults.Ok(new TwoFactorView(false, null, 0));
    }

    // ------------------------------------------------------------------ helpers

    /// <summary>
    /// A code from the authenticator, refused when it is wrong, when the account is locked out — wrong codes count
    /// towards Identity's lockout like wrong passwords — or when it already worked a moment ago.
    /// </summary>
    private static async Task<ValidationProblem?> CheckCodeAsync(Account account, string? code, UserManager<Account> users, TimeProvider clock)
    {
        var digits = string.Concat((code ?? "").Where(char.IsAsciiDigit));
        if (digits.Length != 6)
        {
            return Problems.Field("code", "code_invalid");
        }

        if (await users.IsLockedOutAsync(account))
        {
            return Problems.Field("code", "locked_out");
        }

        var now = clock.GetUtcNow();
        var fingerprint = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{account.Id}:{digits}")));
        if (await users.GetAuthenticationTokenAsync(account, TokenProvider, LastCodeToken) is { } last
            && last.Split(' ') is [var used, var at]
            && used == fingerprint
            && long.TryParse(at, out var seconds)
            && now - DateTimeOffset.FromUnixTimeSeconds(seconds) < Replay)
        {
            return Problems.Field("code", "code_used");
        }

        if (!await users.VerifyTwoFactorTokenAsync(account, users.Options.Tokens.AuthenticatorTokenProvider, digits))
        {
            await users.AccessFailedAsync(account);
            return Problems.Field("code", "code_invalid");
        }

        await users.SetAuthenticationTokenAsync(account, TokenProvider, LastCodeToken, $"{fingerprint} {now.ToUnixTimeSeconds()}");
        return null;
    }

    /// <summary>Opens the console on this device; the cookie is issued again, carrying a new security stamp if any.</summary>
    private static async Task<DateTimeOffset> OpenAsync(Account account, HttpContext http, SessionWriter session, TimeProvider clock)
    {
        var until = clock.GetUtcNow() + SessionClaims.AdminDuration;
        await session.WriteAsync(account, DeviceSession.Of(http.User) with { AdminUntil = until });
        return until;
    }

    private static async Task<TwoFactorView> ViewAsync(Account account, HttpContext http, UserManager<Account> users, DateTimeOffset now) =>
        new(
            account.TwoFactorEnabled,
            SessionClaims.IsAdminOpen(http.User, now) ? SessionClaims.AdminOpenUntil(http.User) : null,
            account.TwoFactorEnabled ? await users.CountRecoveryCodesAsync(account) : 0);

    private static string Grouped(string key) =>
        string.Join(' ', Enumerable.Range(0, (key.Length + 3) / 4).Select(i => key.Substring(i * 4, Math.Min(4, key.Length - (i * 4)))));

    private static ProblemHttpResult Enabled() =>
        Problems.Of(StatusCodes.Status409Conflict, "two_factor_enabled", "Two-factor authentication is on already");
}
