using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Admin;

/// <summary>Two-factor authentication on this account, and until when this console session lasts.</summary>
/// <param name="OpenUntil">The console session ends then: twelve hours after signing in.</param>
public sealed record TwoFactorView(bool Enabled, DateTimeOffset? OpenUntil, int RecoveryCodesLeft);

/// <summary>Whether the account has an authenticator for the console, as the hub shows it.</summary>
/// <param name="Enabled">On: the account signs in to the console with a code from it.</param>
public sealed record AccountTwoFactorView(bool Enabled);

/// <summary>A new authenticator key: typed in, or read from the QR code of <see cref="Uri"/>.</summary>
/// <param name="SharedKey">The key in groups of four, as people type it.</param>
/// <param name="Uri">An <c>otpauth://totp/…</c> URI for authenticator apps.</param>
public sealed record AuthenticatorSetupView(string SharedKey, string Uri);

/// <summary>Codes that stand for a code from the authenticator once each, when it is lost; shown this once.</summary>
public sealed record RecoveryCodesView(IReadOnlyList<string> Codes);

/// <param name="Code">Six digits from the authenticator app.</param>
public sealed record TwoFactorCodeRequest(string? Code = null);

/// <summary>
/// The console's two-factor authentication (ADR 0027, 0042): an authenticator app (TOTP). An account with a platform
/// role adds one in the hub, behind step-up level 2 — the console's sign-in needs it, so it cannot be added there —
/// and then signs in to the console with its code, or a recovery code. In the console it gets new recovery codes or
/// turns it off, which ends every session of the account, the console's included.
/// </summary>
internal static class TwoFactorEndpoints
{
    private const int RecoveryCodes = 10;

    /// <summary>The console's side, behind its session.</summary>
    public static void MapConsole(RouteGroupBuilder admin)
    {
        admin.MapGet("/two-factor", GetAsync)
            .RequirePermission(AdminPermissions.Read)
            .WithName("GetAdminTwoFactor")
            .WithSummary("Whether two-factor authentication is on, until when this console session lasts, recovery codes left.");

        admin.MapPost("/two-factor/recovery-codes", NewRecoveryCodesAsync)
            .RequirePermission(AdminPermissions.Read)
            .RequireStepUp()
            .WithName("NewAdminRecoveryCodes")
            .WithSummary("New recovery codes in place of the old ones (needs step-up level 2).");

        admin.MapDelete("/two-factor", DisableAsync)
            .RequirePermission(AdminPermissions.Read)
            .RequireStepUp()
            .WithName("DisableAdminTwoFactor")
            .WithSummary("Turn two-factor authentication off: every session of the account ends, this one too (needs step-up level 2).");
    }

    /// <summary>The hub's side, behind the players' session: adding the authenticator the console's sign-in asks for.</summary>
    public static void MapAccount(IEndpointRouteBuilder api)
    {
        var account = api.MapGroup("/account/two-factor").WithTags("Console").RequireAuthorization();

        account.MapGet("", GetForAccountAsync)
            .WithName("GetAccountTwoFactor")
            .WithSummary("Whether the account has an authenticator for the console (accounts with a platform role).");

        account.MapPost("/setup", SetUpAsync)
            .WithName("SetUpAuthenticator")
            .WithSummary("A new authenticator key for the console, while two-factor authentication is off (a platform role, step-up level 2).");

        account.MapPost("/enable", EnableAsync)
            .RequireRateLimiting(IdentityModule.CodeRateLimit)
            .WithName("EnableTwoFactor")
            .WithSummary("A code from the new key turns two-factor authentication on; recovery codes once (a platform role, step-up level 2).");
    }

    // ------------------------------------------------------------------ the console

    private static async Task<Results<Ok<TwoFactorView>, UnauthorizedHttpResult>> GetAsync(HttpContext http, UserManager<Account> users)
    {
        if (await users.FindByIdAsync(AdminCaller.Of(http).AccountId.ToString()) is not { } account)
        {
            return TypedResults.Unauthorized();
        }

        return TypedResults.Ok(new TwoFactorView(
            account.TwoFactorEnabled, ConsoleSession.Until(http.User), await users.CountRecoveryCodesAsync(account)));
    }

    private static async Task<Results<Ok<RecoveryCodesView>, UnauthorizedHttpResult>> NewRecoveryCodesAsync(
        HttpContext http, UserManager<Account> users, AdminAudit audit, ToheDbContext db, CancellationToken ct)
    {
        if (await users.FindByIdAsync(AdminCaller.Of(http).AccountId.ToString()) is not { } account)
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

    private static async Task<Results<NoContent, UnauthorizedHttpResult>> DisableAsync(
        HttpContext http,
        UserManager<Account> users,
        IUserStore<Account> store,
        ConsoleSessionWriter session,
        AdminAudit audit,
        ToheDbContext db,
        CancellationToken ct)
    {
        if (await users.FindByIdAsync(AdminCaller.Of(http).AccountId.ToString()) is not { } account)
        {
            return TypedResults.Unauthorized();
        }

        // A new security stamp ends every session of the account, and a new key retires the old one. Without it the
        // console's sign-in refuses the account until an authenticator is added again in the hub.
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

        await session.SignOutAsync(http);
        return TypedResults.NoContent();
    }

    // ------------------------------------------------------------------ the hub

    private static async Task<Results<Ok<AccountTwoFactorView>, UnauthorizedHttpResult, ProblemHttpResult>> GetForAccountAsync(
        HttpContext http, UserManager<Account> users, PlatformRoles roles, CancellationToken ct)
    {
        if (await users.GetUserAsync(http.User) is not { } account)
        {
            return TypedResults.Unauthorized();
        }

        if (await roles.RoleOfAsync(account.Id, ct) is null)
        {
            return NoRole();
        }

        return TypedResults.Ok(new AccountTwoFactorView(account.TwoFactorEnabled));
    }

    private static async Task<Results<Ok<AuthenticatorSetupView>, UnauthorizedHttpResult, ProblemHttpResult>> SetUpAsync(
        HttpContext http,
        UserManager<Account> users,
        IUserStore<Account> store,
        PlatformRoles roles,
        TimeProvider clock,
        CancellationToken ct)
    {
        if (await users.GetUserAsync(http.User) is not { } account)
        {
            return TypedResults.Unauthorized();
        }

        if (await EnrolmentRefusalAsync(account, http, roles, clock, ct) is { } refused)
        {
            return refused;
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
        PlatformRoles roles,
        AdminAudit audit,
        ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        if (await users.GetUserAsync(http.User) is not { } account)
        {
            return TypedResults.Unauthorized();
        }

        if (await EnrolmentRefusalAsync(account, http, roles, clock, ct) is { } refused)
        {
            return refused;
        }

        if (await users.GetAuthenticatorKeyAsync(account) is null)
        {
            return Problems.Of(StatusCodes.Status409Conflict, "authenticator_not_set_up", "Ask for an authenticator key first");
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        if (Authenticator.Problem(await Authenticator.CheckCodeAsync(account, request.Code, users, clock)) is { } wrong)
        {
            await transaction.CommitAsync(ct);
            return wrong;
        }

        // Turning it on makes the account safer: other sessions stay (Identity's setter would end them).
        await ((IUserTwoFactorStore<Account>)store).SetTwoFactorEnabledAsync(account, true, ct);
        await users.UpdateAsync(account);
        var codes = (await users.GenerateNewTwoFactorRecoveryCodesAsync(account, RecoveryCodes))!.ToList();
        audit.Add(AdminActor.Of(account, http), AuditActions.TwoFactorEnable);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return TypedResults.Ok(new RecoveryCodesView(codes));
    }

    /// <summary>
    /// Only an account with a platform role adds an authenticator — players do not sign in with one — while it has none
    /// yet, within step-up level 2 on this device (ADR 0025).
    /// </summary>
    private static async Task<ProblemHttpResult?> EnrolmentRefusalAsync(
        Account account, HttpContext http, PlatformRoles roles, TimeProvider clock, CancellationToken ct)
    {
        if (await roles.RoleOfAsync(account.Id, ct) is null)
        {
            return NoRole();
        }

        if (account.TwoFactorEnabled)
        {
            return Problems.Of(StatusCodes.Status409Conflict, "two_factor_enabled", "Two-factor authentication is on already");
        }

        return SessionClaims.IsSecure(http.User, clock.GetUtcNow()) ? null : Problems.StepUpRequired();
    }

    private static ProblemHttpResult NoRole() =>
        Problems.Of(StatusCodes.Status403Forbidden, "admin_required", "Only an account with a platform role uses an authenticator");

    private static string Grouped(string key) =>
        string.Join(' ', Enumerable.Range(0, (key.Length + 3) / 4).Select(i => key.Substring(i * 4, Math.Min(4, key.Length - (i * 4)))));
}

/// <summary>What checking a code from the authenticator found.</summary>
internal enum CodeCheck
{
    Ok,

    /// <summary>Not six digits, or not the code of now.</summary>
    Invalid,

    /// <summary>The right code, which already worked a moment ago.</summary>
    Used,

    /// <summary>Too many wrong codes and passwords in a row (Identity's lockout).</summary>
    LockedOut,
}

/// <summary>Codes from the authenticator app and recovery codes (ADR 0027).</summary>
internal static class Authenticator
{
    private const string TokenProvider = "Tohe";
    private const string LastCodeToken = "last-authenticator-code";

    /// <summary>How long a code that worked may not work again: the authenticator's window, with room to spare.</summary>
    private static readonly TimeSpan Replay = TimeSpan.FromMinutes(3);

    /// <summary>
    /// A code from the authenticator, refused when it is wrong, when the account is locked out — wrong codes count
    /// towards Identity's lockout like wrong passwords — or when it already worked a moment ago, so one seen over a
    /// shoulder opens nothing elsewhere.
    /// </summary>
    public static async Task<CodeCheck> CheckCodeAsync(Account account, string? code, UserManager<Account> users, TimeProvider clock)
    {
        var digits = string.Concat((code ?? "").Where(char.IsAsciiDigit));
        if (digits.Length != 6)
        {
            return CodeCheck.Invalid;
        }

        if (await users.IsLockedOutAsync(account))
        {
            return CodeCheck.LockedOut;
        }

        var now = clock.GetUtcNow();
        var fingerprint = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{account.Id}:{digits}")));
        if (await users.GetAuthenticationTokenAsync(account, TokenProvider, LastCodeToken) is { } last
            && last.Split(' ') is [var used, var at]
            && used == fingerprint
            && long.TryParse(at, out var seconds)
            && now - DateTimeOffset.FromUnixTimeSeconds(seconds) < Replay)
        {
            return CodeCheck.Used;
        }

        if (!await users.VerifyTwoFactorTokenAsync(account, users.Options.Tokens.AuthenticatorTokenProvider, digits))
        {
            await users.AccessFailedAsync(account);
            return CodeCheck.Invalid;
        }

        await users.SetAuthenticationTokenAsync(account, TokenProvider, LastCodeToken, $"{fingerprint} {now.ToUnixTimeSeconds()}");
        return CodeCheck.Ok;
    }

    /// <summary>A recovery code, once; a wrong one counts towards the lockout.</summary>
    public static async Task<CodeCheck> RedeemRecoveryCodeAsync(Account account, string code, UserManager<Account> users)
    {
        if (await users.IsLockedOutAsync(account))
        {
            return CodeCheck.LockedOut;
        }

        if (!(await users.RedeemTwoFactorRecoveryCodeAsync(account, code.Trim())).Succeeded)
        {
            await users.AccessFailedAsync(account);
            return CodeCheck.Invalid;
        }

        return CodeCheck.Ok;
    }

    /// <summary>The answer on the <c>code</c> field: <c>code_invalid</c>, <c>code_used</c> or <c>locked_out</c>.</summary>
    public static ValidationProblem? Problem(CodeCheck check, string field = "code") => check switch
    {
        CodeCheck.Ok => null,
        CodeCheck.Used => Problems.Field(field, "code_used"),
        CodeCheck.LockedOut => Problems.Field(field, "locked_out"),
        _ => Problems.Field(field, "code_invalid"),
    };
}
