using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Email;

namespace Tohe.Api.Modules.Identity;

/// <param name="Pin">Required when the profile has a PIN.</param>
public sealed record SelectProfileRequest(Guid ProfileId, [StringLength(4)] string? Pin = null);

/// <param name="Pin">The account's six-digit manage PIN.</param>
public sealed record ParentGateRequest([Required(AllowEmptyStrings = true)] string Pin);

/// <param name="Password">The account's password; an account without one asks for a code by email instead.</param>
public sealed record StepUpRequest([Required(AllowEmptyStrings = true)] string Password);

internal static class SessionEndpoints
{
    public static void Map(IEndpointRouteBuilder api)
    {
        var session = api.MapGroup("/session").WithTags("Identity").RequireAuthorization();

        session.MapPut("/profile", SelectProfileAsync)
            .RequireRateLimiting(IdentityModule.GateRateLimit)
            .WithName("SelectProfile")
            .WithSummary("Choose who plays on this device. Locks the parent gate.");

        session.MapDelete("/profile", async (HttpContext http, UserManager<Account> users, SessionWriter writer, MeQueries me, CancellationToken ct) =>
            {
                var account = await users.GetUserAsync(http.User);
                if (account is null)
                {
                    return Results.Unauthorized();
                }

                var state = new DeviceSession(null);
                await writer.WriteAsync(account, state);
                return Results.Ok(await me.LoadAsync(account.Id, state, ct));
            })
            .Produces<MeView>()
            .WithName("ClearProfile")
            .WithSummary("Back to the profile picker.");

        session.MapPost("/parent-gate", UnlockParentGateAsync)
            .RequireRateLimiting(IdentityModule.GateRateLimit)
            .WithName("UnlockParentGate")
            .WithSummary("The manage PIN opens profile management on this device for 10 minutes (step-up level 1).");

        session.MapPost("/step-up", StepUpAsync)
            .RequireRateLimiting(IdentityModule.GateRateLimit)
            .WithName("StepUp")
            .WithSummary("The password opens account security, and profile management, for 10 minutes (level 2).");

        session.MapPost("/step-up/code", StepUpCodeAsync)
            .RequireRateLimiting(IdentityModule.SignInRateLimit)
            .WithName("StepUpCode")
            .WithSummary("A code to the account's email, for stepping up without the password.");

        session.MapPost("/step-up/confirm", StepUpConfirmAsync)
            .RequireRateLimiting(IdentityModule.CodeRateLimit)
            .WithName("ConfirmStepUp")
            .WithSummary("The code opens account security, and profile management, for 10 minutes (level 2).");

        session.MapDelete("/parent-gate", async (HttpContext http, UserManager<Account> users, SessionWriter writer, MeQueries me, CancellationToken ct) =>
            {
                var account = await users.GetUserAsync(http.User);
                if (account is null)
                {
                    return Results.Unauthorized();
                }

                var state = new DeviceSession(SessionClaims.ProfileId(http.User));
                await writer.WriteAsync(account, state);
                return Results.Ok(await me.LoadAsync(account.Id, state, ct));
            })
            .Produces<MeView>()
            .WithName("LockParentGate")
            .WithSummary("Lock profile management again.");
    }

    private static async Task<Results<Ok<MeView>, NotFound, ProblemHttpResult, UnauthorizedHttpResult>> SelectProfileAsync(
        SelectProfileRequest request,
        HttpContext http,
        UserManager<Account> users,
        ToheDbContext db,
        SessionWriter writer,
        MeQueries me,
        CancellationToken ct)
    {
        var account = await users.GetUserAsync(http.User);
        if (account is null)
        {
            return TypedResults.Unauthorized();
        }

        var profile = await db.Profiles.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == request.ProfileId && p.AccountId == account.Id, ct);
        if (profile is null)
        {
            return TypedResults.NotFound();
        }

        if (profile.PinHash is { } pinHash)
        {
            if (string.IsNullOrEmpty(request.Pin))
            {
                return Problems.Of(StatusCodes.Status403Forbidden, "pin_required", "This profile has a PIN");
            }

            if (Pins.Verify(profile, pinHash, request.Pin) == PasswordVerificationResult.Failed)
            {
                return Problems.Of(StatusCodes.Status403Forbidden, "pin_invalid", "Wrong PIN");
            }
        }

        // Choosing who plays always locks management: a parent who unlocked it and then hands the device to a
        // child must not leave it open.
        var state = new DeviceSession(profile.Id);
        await writer.WriteAsync(account, state);
        return TypedResults.Ok((await me.LoadAsync(account.Id, state, ct))!);
    }

    private static async Task<Results<Ok<MeView>, ProblemHttpResult, UnauthorizedHttpResult>> UnlockParentGateAsync(
        ParentGateRequest request,
        HttpContext http,
        UserManager<Account> users,
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

        // No manage PIN yet: setting one needs level 2 first (ADR 0025).
        if (account.ManagePinHash is null)
        {
            return Problems.Of(StatusCodes.Status409Conflict, "manage_pin_not_set", "Set a manage PIN first");
        }

        var now = clock.GetUtcNow();
        if (account.ManagePinLockedUntil > now)
        {
            return Problems.LockedOut();
        }

        if (!ManagePins.Verify(account, request.Pin))
        {
            // Counted in the database, so wrong PINs typed at the same moment all count; the fifth locks the PIN.
            await db.Users.Where(a => a.Id == account.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.ManagePinFailures, a => a.ManagePinFailures + 1), ct);
            var lockUntil = now + ManagePins.LockFor;
            var locked = await db.Users
                .Where(a => a.Id == account.Id && a.ManagePinFailures >= ManagePins.Tries)
                .ExecuteUpdateAsync(
                    s => s.SetProperty(a => a.ManagePinFailures, 0).SetProperty(a => a.ManagePinLockedUntil, lockUntil),
                    ct);
            return locked > 0 ? Problems.LockedOut() : Problems.Of(StatusCodes.Status403Forbidden, "pin_invalid", "Wrong PIN");
        }

        await db.Users.Where(a => a.Id == account.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.ManagePinFailures, 0), ct);
        var state = DeviceSession.Of(http.User) with { ParentUntil = now + SessionClaims.ParentGateDuration };
        await writer.WriteAsync(account, state);
        return TypedResults.Ok((await me.LoadAsync(account.Id, state, ct))!);
    }

    private static async Task<Results<Ok<MeView>, ProblemHttpResult, UnauthorizedHttpResult>> StepUpAsync(
        StepUpRequest request,
        HttpContext http,
        UserManager<Account> users,
        SignInManager<Account> signIn,
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

        if (account.PasswordHash is null)
        {
            return Problems.Of(StatusCodes.Status409Conflict, "password_not_set", "This account steps up with a code by email");
        }

        var result = await signIn.CheckPasswordSignInAsync(account, request.Password, lockoutOnFailure: true);
        if (result.IsLockedOut)
        {
            return Problems.LockedOut();
        }

        if (!result.Succeeded)
        {
            return Problems.Of(StatusCodes.Status403Forbidden, "password_invalid", "Wrong password");
        }

        return TypedResults.Ok(await SecureAsync(account, http, writer, me, clock, ct));
    }

    private static async Task<Results<Accepted<AttemptView>, ProblemHttpResult, UnauthorizedHttpResult>> StepUpCodeAsync(
        HttpContext http,
        UserManager<Account> users,
        Attempts attempts,
        IEmailOutbox outbox,
        ToheDbContext db,
        CancellationToken ct)
    {
        var account = await users.GetUserAsync(http.User);
        if (account is null)
        {
            return TypedResults.Unauthorized();
        }

        if (account.Email is not { } email)
        {
            return Problems.Of(StatusCodes.Status409Conflict, "email_required", "Add an email to the account first");
        }

        if (!outbox.Enabled)
        {
            return Problems.EmailUnavailable();
        }

        if (await attempts.RefusalAsync(attempts.Normalize(email), ct) is { } refusal)
        {
            return Problems.TooManyCodes(refusal);
        }

        var (attempt, code) = await attempts.StartAsync(AttemptPurpose.StepUp, email, decoy: false, ct, accountId: account.Id);
        outbox.Add(IdentityEmails.StepUpCode(email, code!));
        await db.SaveChangesAsync(ct);
        return TypedResults.Accepted((string?)null, new AttemptView(attempt.Id));
    }

    private static async Task<Results<Ok<MeView>, ProblemHttpResult, UnauthorizedHttpResult>> StepUpConfirmAsync(
        ConfirmCodeRequest request,
        HttpContext http,
        UserManager<Account> users,
        Attempts attempts,
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

        var check = await attempts.CheckAsync(request.AttemptId, AttemptPurpose.StepUp, request.Code, account.Id, ct);
        if (check.Problem is { } problem)
        {
            return problem;
        }

        if (!await attempts.UseAsync(check.Attempt!, ct))
        {
            return Problems.AttemptClosed();
        }

        return TypedResults.Ok(await SecureAsync(account, http, writer, me, clock, ct));
    }

    /// <summary>Level 2 also opens level 1: whoever proved the account is theirs may manage its profiles.</summary>
    private static async Task<MeView> SecureAsync(
        Account account, HttpContext http, SessionWriter writer, MeQueries me, TimeProvider clock, CancellationToken ct)
    {
        var until = clock.GetUtcNow() + SessionClaims.ParentGateDuration;
        var state = DeviceSession.Of(http.User) with { ParentUntil = until, SecureUntil = until };
        await writer.WriteAsync(account, state);
        return (await me.LoadAsync(account.Id, state, ct))!;
    }
}

/// <summary>Profile PINs are hashed like passwords.</summary>
internal static class Pins
{
    private static readonly PasswordHasher<Profile> Hasher = new();

    public static string Hash(Profile profile, string pin) => Hasher.HashPassword(profile, pin);

    public static PasswordVerificationResult Verify(Profile profile, string hash, string pin) =>
        Hasher.VerifyHashedPassword(profile, hash, pin);
}
