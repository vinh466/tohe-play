using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Email;

namespace Tohe.Api.Modules.Identity;

/// <param name="Email">The new sign-in email; a code goes there.</param>
/// <param name="Password">The account's password, when the parent gate is not open on this device — just after signing
/// in, for an account that adds its first email.</param>
public sealed record ChangeEmailRequest([Required(AllowEmptyStrings = true)] string Email, string? Password = null);

/// <summary>
/// The account's sign-in email (ADR 0024): changed — or added, by an account from before email sign-in — only with a
/// code sent to the new address, and only by someone who just proved the password.
/// </summary>
internal static class AccountEmailEndpoints
{
    public static void Map(IEndpointRouteBuilder api)
    {
        var email = api.MapGroup("/account/email").WithTags("Identity").RequireAuthorization();

        email.MapPost("/", StartAsync)
            .RequireRateLimiting(IdentityModule.SignInRateLimit)
            .WithName("ChangeEmail")
            .WithSummary("A code goes to the new email. Needs the parent gate, or the password with the request.");

        email.MapPost("/confirm", ConfirmAsync)
            .RequireRateLimiting(IdentityModule.CodeRateLimit)
            .WithName("ConfirmEmailChange")
            .WithSummary("The code makes the new email the one that signs in; every other session ends.");
    }

    private static async Task<Results<Accepted<AttemptView>, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> StartAsync(
        ChangeEmailRequest request,
        HttpContext http,
        UserManager<Account> users,
        SignInManager<Account> signIn,
        Attempts attempts,
        IEmailOutbox outbox,
        ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        var account = await users.GetUserAsync(http.User);
        if (account is null)
        {
            return TypedResults.Unauthorized();
        }

        // Whoever holds the sign-in email holds the account: a device left signed in is not enough to move it.
        if (!SessionClaims.IsParentUnlocked(http.User, clock.GetUtcNow()))
        {
            if (string.IsNullOrEmpty(request.Password))
            {
                return Problems.ParentGateRequired();
            }

            var proof = await signIn.CheckPasswordSignInAsync(account, request.Password, lockoutOnFailure: true);
            if (proof.IsLockedOut)
            {
                return Problems.LockedOut();
            }

            if (!proof.Succeeded)
            {
                return Problems.Of(StatusCodes.Status403Forbidden, "password_invalid", "Wrong password");
            }
        }

        if (!outbox.Enabled)
        {
            return Problems.EmailUnavailable();
        }

        if (Attempts.ParseEmail(request.Email) is not { } email)
        {
            return Problems.Field("email", "email_invalid");
        }

        var normalized = attempts.Normalize(email);
        if (normalized == account.NormalizedEmail)
        {
            return Problems.Field("email", "email_unchanged");
        }

        if (await attempts.RefusalAsync(normalized, ct) is { } refusal)
        {
            return Problems.TooManyCodes(refusal);
        }

        // An address another account signs in with gets a decoy: nothing changes, and nothing is learned.
        var taken = await db.Users.AnyAsync(a => a.NormalizedEmail == normalized, ct);
        var (attempt, code) = await attempts.StartAsync(AttemptPurpose.ChangeEmail, email, decoy: taken, ct, accountId: account.Id);
        outbox.Add(code is null
            ? IdentityEmails.EmailTaken(email)
            : IdentityEmails.EmailCode(email, code, attempts.Link($"/account/email?attempt={attempt.Id}&code={code}")));
        await db.SaveChangesAsync(ct);
        return TypedResults.Accepted((string?)null, new AttemptView(attempt.Id));
    }

    private static async Task<Results<Ok<MeView>, ProblemHttpResult, UnauthorizedHttpResult>> ConfirmAsync(
        ConfirmCodeRequest request,
        HttpContext http,
        UserManager<Account> users,
        Attempts attempts,
        IEmailOutbox outbox,
        ToheDbContext db,
        SessionWriter session,
        MeQueries me,
        CancellationToken ct)
    {
        var account = await users.GetUserAsync(http.User);
        if (account is null)
        {
            return TypedResults.Unauthorized();
        }

        var check = await attempts.CheckAsync(request.AttemptId, AttemptPurpose.ChangeEmail, request.Code, account.Id, ct);
        if (check.Problem is { } problem)
        {
            return problem;
        }

        var attempt = check.Attempt!;
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        if (!await attempts.UseAsync(attempt, ct)
            || await db.Users.AnyAsync(a => a.NormalizedEmail == attempt.NormalizedEmail, ct))
        {
            return Problems.AttemptClosed();
        }

        var previous = account.Email;
        account.Email = attempt.Email;
        account.EmailConfirmed = true;
        await users.UpdateNormalizedEmailAsync(account);
        try
        {
            // Saves the account; the new stamp ends its other sessions.
            await users.UpdateSecurityStampAsync(account);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Problems.AttemptClosed();
        }

        if (previous is not null && outbox.Enabled)
        {
            outbox.Add(IdentityEmails.EmailChanged(previous, attempt.Email));
        }

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        // This device carries on as it was, with a cookie that carries the new stamp.
        var profileId = SessionClaims.ProfileId(http.User);
        var parentUntil = SessionClaims.ParentUnlockedUntil(http.User);
        await session.WriteAsync(account, profileId, parentUntil);
        return TypedResults.Ok((await me.LoadAsync(account.Id, profileId, parentUntil, ct))!);
    }
}
