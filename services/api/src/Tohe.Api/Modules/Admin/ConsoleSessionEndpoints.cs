using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Platform;

namespace Tohe.Api.Modules.Admin;

/// <summary>What the console needs before anyone signs in.</summary>
/// <param name="HubUrl">The hub's public URL (<c>App:PublicUrl</c>), for the console's links back to it; none when unset.</param>
public sealed record ConsoleConfig(string? HubUrl);

/// <param name="Email">The account's email.</param>
/// <param name="Code">Six digits from the authenticator app.</param>
/// <param name="RecoveryCode">Or one of the recovery codes, once.</param>
public sealed record ConsoleSignInRequest(
    [Required(AllowEmptyStrings = true)] string Email,
    [Required(AllowEmptyStrings = true), StringLength(128)] string Password,
    string? Code = null,
    string? RecoveryCode = null);

/// <summary>Step-up level 2 in the console's session: the password, or a code from the authenticator.</summary>
public sealed record ConsoleStepUpRequest(string? Password = null, string? Code = null);

/// <summary>
/// The console's own sign-in (ADR 0027, 0042): the email, the password and a code from the authenticator — or a
/// recovery code — on the console's host. Only an account with a platform role and two-factor authentication on gets a
/// console session; for everyone else the answer is the one a wrong password gets, so the console tells nobody which
/// accounts hold a role. The checks of the players' sign-in apply — the lockout, suspension — and the console refuses
/// an account waiting to be deleted rather than keeping it. Signing out ends the console's session only.
/// </summary>
internal static class ConsoleSessionEndpoints
{
    /// <summary>The endpoints open before a console session.</summary>
    public static void MapOpen(RouteGroupBuilder admin)
    {
        admin.MapGet("/config", Config)
            .AllowAnonymous()
            .WithName("GetConsoleConfig")
            .WithSummary("What the console needs before anyone signs in: the hub's address.");

        admin.MapPost("/session", SignInAsync)
            .AllowAnonymous()
            .RequireRateLimiting(IdentityModule.SignInRateLimit)
            .WithName("SignInToConsole")
            .WithSummary("Sign in to the console: email, password and a code; sets the console's own session cookie for twelve hours.");

        admin.MapDelete("/session", async (ConsoleSessionWriter session, HttpContext http) =>
            {
                await session.SignOutAsync(http);
                return TypedResults.NoContent();
            })
            .AllowAnonymous()
            .WithName("SignOutOfConsole")
            .WithSummary("End the console's session on this browser; the hub's session stays.");
    }

    /// <summary>The endpoints of a console session.</summary>
    public static void Map(RouteGroupBuilder admin)
    {
        admin.MapPost("/session/step-up", StepUpAsync)
            .RequirePermission(AdminPermissions.SignedIn)
            .RequireRateLimiting(IdentityModule.GateRateLimit)
            .WithName("StepUpInConsole")
            .WithSummary("The password, or a code from the authenticator, opens step-up level 2 in this console session for 10 minutes.");
    }

    private static Ok<ConsoleConfig> Config(IOptions<AppOptions> app) =>
        TypedResults.Ok(new ConsoleConfig(app.Value.PublicUrl?.GetLeftPart(UriPartial.Authority)));

    private static async Task<Results<Ok<AdminMeView>, ProblemHttpResult>> SignInAsync(
        ConsoleSignInRequest request,
        HttpContext http,
        PasswordSignIn passwords,
        UserManager<Account> users,
        PlatformRoles roles,
        ConsoleSessionWriter session,
        AdminAudit audit,
        ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        // The switch of the players' password sign-in (ADR 0028) does not apply: the console signs in with the
        // password, and switching it back on happens in the console. A player's password is never checked here: an
        // account without a role or an authenticator is checked as no account is — as long, the same answer, its
        // lockout untouched — so the console is no place to try the players' passwords.
        var found = await passwords.FindAsync(request.Email);
        var role = found is { TwoFactorEnabled: true } ? await roles.RoleOfAsync(found.Id, ct) : null;
        var account = role is null ? null : found;
        var check = await passwords.CheckPasswordAsync(account, request.Password);
        if (account is null || role is not { } held || check is not (PasswordCheck.Ok or PasswordCheck.Suspended))
        {
            return PasswordSignIn.Problem(check);
        }

        // Wrong codes count towards the lockout even when refused: the transaction commits either way, with an audit
        // entry only for a sign-in.
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var recovery = !string.IsNullOrWhiteSpace(request.RecoveryCode);
        var code = recovery
            ? await Authenticator.RedeemRecoveryCodeAsync(account, request.RecoveryCode!, users)
            : await Authenticator.CheckCodeAsync(account, request.Code, users, clock);
        if (code != CodeCheck.Ok)
        {
            await transaction.CommitAsync(ct);
            return code == CodeCheck.LockedOut ? Problems.LockedOut() : Problems.InvalidCredentials();
        }

        // Told only to whoever proved the account is theirs, as in the hub — so by now the proof is spent: the recovery
        // code is gone, the authenticator's code of this step used. On purpose: nothing is told before the proof
        // (docs/architecture/admin.md).
        if (check == PasswordCheck.Suspended)
        {
            await transaction.CommitAsync(ct);
            return Problems.AccountSuspended();
        }

        // Signing in to the hub keeps an account its owner asked to delete (ADR 0034); the console does not.
        if (account.DeleteAfter is not null)
        {
            await transaction.CommitAsync(ct);
            return Problems.Of(StatusCodes.Status403Forbidden, "account_deleting", "This account is waiting to be deleted; sign in to Tò He to keep it");
        }

        await users.ResetAccessFailedCountAsync(account);
        audit.Add(AdminActor.Of(account, http), AuditActions.ConsoleOpen, details: new { method = recovery ? "recovery-code" : "authenticator" });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        var until = await session.SignInAsync(http, account);
        return TypedResults.Ok(AdminEndpoints.MeView(account, held, until, secureUntil: null));
    }

    private static async Task<Results<Ok<AdminMeView>, UnauthorizedHttpResult, ValidationProblem, ProblemHttpResult>> StepUpAsync(
        ConsoleStepUpRequest request,
        HttpContext http,
        UserManager<Account> users,
        SignInManager<Account> signIn,
        ConsoleSessionWriter session,
        TimeProvider clock,
        CancellationToken ct)
    {
        var caller = AdminCaller.Of(http);
        if (await users.FindByIdAsync(caller.AccountId.ToString()) is not { } account
            || ConsoleSession.Until(http.User) is not { } until)
        {
            return TypedResults.Unauthorized();
        }

        if (!string.IsNullOrEmpty(request.Password))
        {
            var result = await signIn.CheckPasswordSignInAsync(account, request.Password, lockoutOnFailure: true);
            if (result.IsLockedOut)
            {
                return Problems.LockedOut();
            }

            if (!result.Succeeded)
            {
                return Problems.Of(StatusCodes.Status403Forbidden, "password_invalid", "Wrong password");
            }
        }
        else if (Authenticator.Problem(await Authenticator.CheckCodeAsync(account, request.Code, users, clock)) is { } wrong)
        {
            return wrong;
        }

        var secureUntil = clock.GetUtcNow() + SessionClaims.ParentGateDuration;
        await session.WriteAsync(http, account, until, secureUntil);
        return TypedResults.Ok(AdminEndpoints.MeView(account, caller.Role, until, secureUntil < until ? secureUntil : until));
    }
}
