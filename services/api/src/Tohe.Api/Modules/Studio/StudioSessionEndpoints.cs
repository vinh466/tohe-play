using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Admin;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Platform;
using CodeCheck = Tohe.Api.Modules.Admin.CodeCheck;

namespace Tohe.Api.Modules.Studio;

/// <summary>What the Studio's app needs before anyone signs in.</summary>
/// <param name="HubUrl">The hub's public URL (<c>App:PublicUrl</c>), for the app's links to it — "Quên mật khẩu?";
/// none when unset.</param>
/// <param name="ApiVersion">The build of the API that runs.</param>
public sealed record StudioConfig(string? HubUrl, string ApiVersion);

/// <summary>The account signed in to the Studio, its studio role and what the role may do.</summary>
/// <param name="Role"><c>contributor</c> or <c>reviewer</c>.</param>
/// <param name="Permissions">What the role may do: <c>studio.read</c>, <c>studio.contribute</c>, <c>studio.review</c>.</param>
/// <param name="TwoFactorEnabled">The account has an authenticator: what step-up asks for.</param>
/// <param name="OpenUntil">The Studio session ends then: twelve hours after signing in.</param>
/// <param name="SecureUntil">Step-up is open in this Studio session until then.</param>
public sealed record StudioMeView(
    Guid AccountId,
    string DisplayName,
    string? Email,
    string Role,
    IReadOnlyList<string> Permissions,
    bool TwoFactorEnabled,
    DateTimeOffset OpenUntil,
    DateTimeOffset? SecureUntil);

/// <param name="Email">The account's email.</param>
/// <param name="Code">Six digits from the authenticator app: always for a reviewer, and for anyone with two-factor
/// authentication on.</param>
/// <param name="RecoveryCode">Or one of the recovery codes, once.</param>
public sealed record StudioSignInRequest(
    [Required(AllowEmptyStrings = true)] string Email,
    [Required(AllowEmptyStrings = true), StringLength(128)] string Password,
    string? Code = null,
    string? RecoveryCode = null);

/// <summary>Step-up in the Studio's session: a fresh code from the authenticator.</summary>
/// <param name="Code">Six digits from the authenticator app.</param>
public sealed record StudioStepUpRequest(string? Code = null);

/// <summary>
/// The Studio's own sign-in (ADR 0051), a copy of the console's: the email, the password and — for a reviewer always,
/// for a contributor with two-factor authentication on — a code from the authenticator or a recovery code. Only an
/// account with a studio role gets a Studio session; for everyone else the answer is the one a wrong password gets, so
/// the Studio tells nobody who holds a role. The checks of the players' sign-in apply — the lockout, suspension — and
/// the Studio refuses an account waiting to be deleted rather than keeping it. Signing out ends the Studio's session
/// only.
/// </summary>
internal static class StudioSessionEndpoints
{
    public static void Map(RouteGroupBuilder studio)
    {
        studio.MapGet("/config", (IOptions<AppOptions> app) => TypedResults.Ok(new StudioConfig(
                app.Value.PublicUrl?.GetLeftPart(UriPartial.Authority),
                PlatformModule.VersionOf(app.Value))))
            .AllowAnonymous()
            .WithName("GetStudioConfig")
            .WithSummary("What the Studio's app needs before anyone signs in: the hub's address and the API's version.");

        // "Nobody signed in" is a normal state of the Studio, not an error: 204 rather than 401, as the console's /me.
        studio.MapGet("/session", MeAsync)
            .AllowAnonymous()
            .WithName("GetStudioSession")
            .WithSummary("The account signed in to the Studio: its studio role, what the role may do, and its session; 204 when nobody is.");

        studio.MapPost("/session", SignInAsync)
            .AllowAnonymous()
            .RequireRateLimiting(IdentityModule.SignInRateLimit)
            .WithName("SignInToStudio")
            .WithSummary("Sign in to the Studio: email, password, and a code when two-factor authentication is on; sets the Studio's own session cookie for twelve hours.");

        studio.MapDelete("/session", async (StudioSessionWriter session, HttpContext http) =>
            {
                await session.SignOutAsync(http);
                return TypedResults.NoContent();
            })
            .AllowAnonymous()
            .WithName("SignOutOfStudio")
            .WithSummary("End the Studio's session on this browser; the hub's and the console's stay.");

        var signedIn = studio.MapGroup("").RequireStudioSession();
        signedIn.MapPost("/session/step-up", StepUpAsync)
            .RequireStudioPermission(StudioPermissions.Review)
            .RequireRateLimiting(IdentityModule.GateRateLimit)
            .WithName("StepUpInStudio")
            .WithSummary("A fresh code from the authenticator opens step-up for review actions in this Studio session for 10 minutes.");
    }

    public static StudioMeView MeView(Account account, StudioRole role, DateTimeOffset until, DateTimeOffset? secureUntil) => new(
        account.Id,
        account.DisplayName,
        account.Email,
        StudioRoles.NameOf(role),
        StudioPermissions.Of(role),
        account.TwoFactorEnabled,
        until,
        secureUntil);

    private static async Task<Results<Ok<StudioMeView>, NoContent>> MeAsync(HttpContext http, TimeProvider clock)
    {
        if (await StudioAccess.CallerAsync(http) is not var (account, role) || StudioSession.Until(http.User) is not { } until)
        {
            return TypedResults.NoContent();
        }

        var secure = SessionClaims.IsSecure(http.User, clock.GetUtcNow()) ? SessionClaims.SecureUnlockedUntil(http.User) : null;
        return TypedResults.Ok(MeView(account, role, until, secure));
    }

    private static async Task<Results<Ok<StudioMeView>, ProblemHttpResult>> SignInAsync(
        StudioSignInRequest request,
        HttpContext http,
        PasswordSignIn passwords,
        UserManager<Account> users,
        StudioRoles roles,
        StudioSessionWriter session,
        ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        // As the console: the switch of the players' password sign-in (ADR 0028) does not apply, and the password of an
        // account that may not sign in here is never checked — it is checked as no account is, as long, the same
        // answer, its lockout untouched — so the Studio is no place to try the players' passwords.
        var found = await passwords.FindAsync(request.Email);
        var role = found is null ? null : await roles.RoleOfAsync(found.Id, ct);
        var account = role is { } some && StudioRoles.MayHoldSession(some, found!) ? found : null;
        var check = await passwords.CheckPasswordAsync(account, request.Password);
        if (account is null || role is not { } held || check is not (PasswordCheck.Ok or PasswordCheck.Suspended))
        {
            return PasswordSignIn.Problem(check);
        }

        // Wrong codes count towards the lockout even when refused: the transaction commits either way.
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        if (account.TwoFactorEnabled)
        {
            var code = string.IsNullOrWhiteSpace(request.RecoveryCode)
                ? await Authenticator.CheckCodeAsync(account, request.Code, users, clock)
                : await Authenticator.RedeemRecoveryCodeAsync(account, request.RecoveryCode, users);
            if (code != CodeCheck.Ok)
            {
                await transaction.CommitAsync(ct);
                return code == CodeCheck.LockedOut ? Problems.LockedOut() : Problems.InvalidCredentials();
            }
        }

        // Told only to whoever proved the account is theirs, as in the console: by now the proof is spent.
        if (check == PasswordCheck.Suspended)
        {
            await transaction.CommitAsync(ct);
            return Problems.AccountSuspended();
        }

        // Signing in to the hub keeps an account its owner asked to delete (ADR 0034); the Studio does not.
        if (account.DeleteAfter is not null)
        {
            await transaction.CommitAsync(ct);
            return Problems.Of(StatusCodes.Status403Forbidden, "account_deleting", "This account is waiting to be deleted; sign in to Tò He to keep it");
        }

        await users.ResetAccessFailedCountAsync(account);
        await transaction.CommitAsync(ct);
        var until = await session.SignInAsync(http, account);
        return TypedResults.Ok(MeView(account, held, until, secureUntil: null));
    }

    private static async Task<Results<Ok<StudioMeView>, UnauthorizedHttpResult, ValidationProblem, ProblemHttpResult>> StepUpAsync(
        StudioStepUpRequest request,
        HttpContext http,
        UserManager<Account> users,
        StudioSessionWriter session,
        TimeProvider clock)
    {
        var caller = StudioCaller.Of(http);
        if (await users.FindByIdAsync(caller.AccountId.ToString()) is not { } account
            || StudioSession.Until(http.User) is not { } until)
        {
            return TypedResults.Unauthorized();
        }

        // A fresh second factor, never the password: a reviewer always has an authenticator.
        if (Authenticator.Problem(await Authenticator.CheckCodeAsync(account, request.Code, users, clock)) is { } wrong)
        {
            return wrong;
        }

        var secureUntil = clock.GetUtcNow() + SessionClaims.ParentGateDuration;
        if (!await session.WriteAsync(http, account, until, secureUntil))
        {
            return TypedResults.Unauthorized();
        }

        return TypedResults.Ok(MeView(account, caller.Role, until, secureUntil < until ? secureUntil : until));
    }
}
