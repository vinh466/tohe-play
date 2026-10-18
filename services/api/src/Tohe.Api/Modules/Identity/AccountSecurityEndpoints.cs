using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Email;

namespace Tohe.Api.Modules.Identity;

/// <param name="Pin">Six digits.</param>
public sealed record ManagePinRequest([Required(AllowEmptyStrings = true)] string Pin);

/// <param name="Password">The new password, at least 8 characters.</param>
public sealed record PasswordRequest([Required(AllowEmptyStrings = true), StringLength(128)] string Password);

/// <param name="Version">The version of the terms and privacy notice the hub showed.</param>
public sealed record TermsRequest([Required(AllowEmptyStrings = true)] string Version);

/// <summary>
/// What protects the account (ADR 0025): its manage PIN and its password change only within step-up level 2 on this
/// device; the terms are accepted again when they change.
/// </summary>
internal static class AccountSecurityEndpoints
{
    public static void Map(IEndpointRouteBuilder api)
    {
        var account = api.MapGroup("/account").WithTags("Identity").RequireAuthorization();

        account.MapPut("/manage-pin", SetManagePinAsync)
            .WithName("SetManagePin")
            .WithSummary("Set or change the manage PIN (needs step-up level 2); opens profile management.");

        account.MapPut("/password", SetPasswordAsync)
            .WithName("SetPassword")
            .WithSummary("Set or change the password (needs step-up level 2); every other session ends.");

        account.MapPost("/terms", AcceptTermsAsync)
            .WithName("AcceptTerms")
            .WithSummary("Accept the terms and privacy notice in the version the hub shows.");

        account.MapDelete("/", DeleteAccountAsync)
            .WithName("DeleteAccount")
            .WithSummary("Delete the account (needs step-up level 2): it stops now, and goes for good after seven days unless someone signs in to it.");
    }

    /// <summary>
    /// The owner asks to delete the account (ADR 0034, design §3.14): every session ends — this one too — its profiles
    /// leave boards and tables, and it goes for good after the wait, with everything of its profiles.
    /// </summary>
    private static async Task<Results<Ok<AccountDeletionView>, ProblemHttpResult, UnauthorizedHttpResult>> DeleteAccountAsync(
        HttpContext http,
        UserManager<Account> users,
        SignInManager<Account> signIn,
        AccountDeletion deletion,
        TimeProvider clock,
        CancellationToken ct)
    {
        var account = await users.GetUserAsync(http.User);
        if (account is null)
        {
            return TypedResults.Unauthorized();
        }

        if (!SessionClaims.IsSecure(http.User, clock.GetUtcNow()))
        {
            return Problems.StepUpRequired();
        }

        var deleteAfter = account.DeleteAfter ?? await deletion.RequestAsync(account, ct);
        await signIn.SignOutAsync();
        return TypedResults.Ok(new AccountDeletionView(deleteAfter));
    }

    private static async Task<Results<Ok<MeView>, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> SetManagePinAsync(
        ManagePinRequest request,
        HttpContext http,
        UserManager<Account> users,
        SessionWriter writer,
        MeQueries me,
        TimeProvider clock,
        CancellationToken ct)
    {
        var account = await users.GetUserAsync(http.User);
        if (account is null)
        {
            return TypedResults.Unauthorized();
        }

        var now = clock.GetUtcNow();
        if (!SessionClaims.IsSecure(http.User, now))
        {
            return Problems.StepUpRequired();
        }

        if (!ManagePins.IsPin(request.Pin))
        {
            return Problems.Field("pin", "manage_pin_invalid");
        }

        account.ManagePinHash = ManagePins.Hash(account, request.Pin);
        account.ManagePinFailures = 0;
        account.ManagePinLockedUntil = null;
        await users.UpdateAsync(account);

        var state = DeviceSession.Of(http.User) with { ParentUntil = now + SessionClaims.ParentGateDuration };
        await writer.WriteAsync(account, state);
        return TypedResults.Ok((await me.LoadAsync(account.Id, state, ct))!);
    }

    private static async Task<Results<Ok<MeView>, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> SetPasswordAsync(
        PasswordRequest request,
        HttpContext http,
        UserManager<Account> users,
        IEmailOutbox outbox,
        ToheDbContext db,
        SessionWriter writer,
        MeQueries me,
        TimeProvider clock,
        CancellationToken ct)
    {
        var account = await users.GetUserAsync(http.User);
        if (account is null)
        {
            return TypedResults.Unauthorized();
        }

        if (!SessionClaims.IsSecure(http.User, clock.GetUtcNow()))
        {
            return Problems.StepUpRequired();
        }

        if (await AuthEndpoints.PasswordProblemAsync(users, request.Password) is { } weak)
        {
            return weak;
        }

        // A new password and a new security stamp: every other session of the account ends.
        account.PasswordHash = users.PasswordHasher.HashPassword(account, request.Password);
        await users.UpdateSecurityStampAsync(account);
        if (outbox.Enabled && account.Email is { } email)
        {
            outbox.Add(IdentityEmails.PasswordChanged(email));
            await db.SaveChangesAsync(ct);
        }

        // This device carries on as it was, with a cookie that carries the new stamp.
        var state = DeviceSession.Of(http.User);
        await writer.WriteAsync(account, state);
        return TypedResults.Ok((await me.LoadAsync(account.Id, state, ct))!);
    }

    private static async Task<Results<Ok<MeView>, ValidationProblem, UnauthorizedHttpResult>> AcceptTermsAsync(
        TermsRequest request,
        HttpContext http,
        UserManager<Account> users,
        MeQueries me,
        TimeProvider clock,
        CancellationToken ct)
    {
        var account = await users.GetUserAsync(http.User);
        if (account is null)
        {
            return TypedResults.Unauthorized();
        }

        if (!Consent.IsVersion(request.Version))
        {
            return Problems.Field("version", "terms_required");
        }

        account.TermsVersion = request.Version;
        account.TermsAcceptedAt = clock.GetUtcNow();
        await users.UpdateAsync(account);
        return TypedResults.Ok((await me.LoadAsync(account.Id, DeviceSession.Of(http.User), ct))!);
    }
}
