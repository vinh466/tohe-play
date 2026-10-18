using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Tohe.Api.Infrastructure;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Email;

namespace Tohe.Api.Modules.Identity;

/// <param name="Email">The address that will sign in. A code goes there; the account exists once it is typed back.</param>
/// <param name="Password">At least 8 characters (ADR 0011).</param>
/// <param name="DisplayName">The account's name, which also names its first profile (ADR 0023).</param>
/// <param name="AcceptTerms">"Tôi từ 16 tuổi trở lên và đồng ý Điều khoản và Chính sách quyền riêng tư" (ADR 0025).</param>
/// <param name="TermsVersion">The version of the documents the hub showed.</param>
/// <param name="Proof">The answer to a challenge from <c>GET /api/auth/challenge</c>, when the server asks for one
/// (<c>proofOfWork</c> in <c>/api/config</c>, ADR 0037).</param>
public sealed record SignUpRequest(
    [Required(AllowEmptyStrings = true)] string Email,
    [Required(AllowEmptyStrings = true), StringLength(128)] string Password,
    [Required(AllowEmptyStrings = true)] string DisplayName,
    bool AcceptTerms,
    string? TermsVersion,
    string? InviteCode = null,
    ProofOfWorkSolution? Proof = null);

/// <summary>A flow waiting for the code sent by email. The same answer whoever the address belongs to (ADR 0024).</summary>
/// <param name="AttemptId">Send it back with the code: a code opens only the attempt it was sent for.</param>
public sealed record AttemptView(Guid AttemptId);

/// <param name="Code">The six digits from the email; spaces are fine.</param>
public sealed record ConfirmCodeRequest(Guid AttemptId, [Required(AllowEmptyStrings = true)] string Code);

/// <param name="Email">The account's email — or, for an account from before email sign-in that has not added one yet,
/// its username.</param>
public sealed record LoginRequest(
    [Required(AllowEmptyStrings = true)] string Email,
    [Required(AllowEmptyStrings = true)] string Password);

/// <param name="Proof">The answer to a challenge from <c>GET /api/auth/challenge</c>, when the server asks for one
/// (<c>proofOfWork</c> in <c>/api/config</c>, ADR 0037).</param>
public sealed record ForgotPasswordRequest([Required(AllowEmptyStrings = true)] string Email, ProofOfWorkSolution? Proof = null);

/// <param name="Password">The new password, at least 8 characters.</param>
public sealed record ResetPasswordRequest(
    Guid AttemptId,
    [Required(AllowEmptyStrings = true)] string Code,
    [Required(AllowEmptyStrings = true), StringLength(128)] string Password);

/// <summary>Signing up, in and out by email (ADR 0011, 0024). Flows: docs/architecture/identity.md.</summary>
internal static class AuthEndpoints
{
    /// <summary>Checked against the password typed for an address with no account, so a miss takes as long as a wrong
    /// password and says nothing about who has an account.</summary>
    private static readonly string NoAccountHash =
        new PasswordHasher<Account>().HashPassword(new Account { DisplayName = "" }, "no account has this password");

    public static void Map(IEndpointRouteBuilder api)
    {
        var auth = api.MapGroup("/auth").WithTags("Identity");

        auth.MapGet("/challenge", (ProofOfWork proofs) => TypedResults.Ok(proofs.New()))
            .RequireRateLimiting(IdentityModule.SignInRateLimit)
            .WithName("GetChallenge")
            .WithSummary("A proof-of-work to solve before signing up or asking for a password reset, when /api/config says proofOfWork.");

        auth.MapPost("/register", SignUpAsync)
            .RequireRateLimiting(IdentityModule.SignInRateLimit)
            .WithName("Register")
            .WithSummary("Start signing up: a code goes to the email. 202 whether or not the address has an account.");

        auth.MapPost("/register/confirm", ConfirmSignUpAsync)
            .RequireRateLimiting(IdentityModule.CodeRateLimit)
            .WithName("ConfirmRegistration")
            .WithSummary("The code from the email creates the account and its first profile, which plays at once.");

        auth.MapPost("/login", LoginAsync)
            .RequireRateLimiting(IdentityModule.SignInRateLimit)
            .WithName("Login")
            .WithSummary("Sign in; sets the session cookie. An only profile without a PIN plays at once.");

        auth.MapPost("/password/forgot", ForgotPasswordAsync)
            .RequireRateLimiting(IdentityModule.SignInRateLimit)
            .WithName("ForgotPassword")
            .WithSummary("A code to set a new password goes to the email, if it has an account. 202 either way.");

        auth.MapPost("/password/reset", ResetPasswordAsync)
            .RequireRateLimiting(IdentityModule.CodeRateLimit)
            .WithName("ResetPassword")
            .WithSummary("The code sets a new password; every other session ends.");

        auth.MapPost("/logout", async (SignInManager<Account> signIn) =>
            {
                await signIn.SignOutAsync();
                return TypedResults.NoContent();
            })
            .WithName("Logout")
            .WithSummary("Sign out this device.");

        // "Nobody signed in" is a normal state of a device, not an error: 204 rather than 401, so browsers do not
        // log a failed request on every visit of a signed-out or guest device.
        auth.MapGet("/me", async Task<Results<Ok<MeView>, NoContent>> (HttpContext http, MeQueries me, CancellationToken ct) =>
            {
                if (SessionClaims.AccountId(http.User) is not { } accountId)
                {
                    return TypedResults.NoContent();
                }

                var view = await me.LoadAsync(accountId, DeviceSession.Of(http.User), ct);
                return view is null ? TypedResults.NoContent() : TypedResults.Ok(view);
            })
            .WithName("GetMe")
            .WithSummary("The device session (account, profiles, active profile, parent gate); 204 when signed out.");
    }

    private static async Task<Results<Accepted<AttemptView>, ValidationProblem, ProblemHttpResult>> SignUpAsync(
        SignUpRequest request,
        Attempts attempts,
        IEmailOutbox outbox,
        UserManager<Account> users,
        ISignInSettings settings,
        Invites invites,
        ProofOfWork proofs,
        ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        if (!await settings.IsOnAsync(SignInMethods.Password, ct))
        {
            return Problems.MethodDisabled();
        }

        if (!outbox.Enabled)
        {
            return Problems.EmailUnavailable();
        }

        // Before anything else costs the server a thing (ADR 0037).
        if (await settings.ProofOfWorkAsync(ct) && !proofs.Accepts(request.Proof))
        {
            return Problems.ProofOfWorkRequired();
        }

        if (Attempts.ParseEmail(request.Email) is not { } email)
        {
            return Problems.Field("email", "email_invalid");
        }

        if (await PasswordProblemAsync(users, request.Password) is { } weak)
        {
            return weak;
        }

        if (!ProfileNames.TryNormalize(request.DisplayName, out var displayName, out var nameError))
        {
            return Problems.Field("displayName", nameError);
        }

        // 16 or older, and the terms: under 16, a child plays as a profile a parent makes (ADR 0023, 0025).
        if (!request.AcceptTerms || !Consent.IsVersion(request.TermsVersion))
        {
            return Problems.Field("acceptTerms", "terms_required");
        }

        // Registration closed, or an invite code missing or spent (ADR 0028) — the same answer whoever the address is.
        if (await invites.RefusalAsync(request.InviteCode, clock.GetUtcNow(), ct) is { } closed)
        {
            return closed == "registration_closed" ? Problems.RegistrationClosed() : Problems.Field("inviteCode", closed);
        }

        if (await attempts.RefusalAsync(attempts.Normalize(email), ct) is { } refusal)
        {
            return Problems.TooManyCodes(refusal);
        }

        // Hashed either way, so an address with an account answers as fast as one without.
        var passwordHash = users.PasswordHasher.HashPassword(new Account { DisplayName = displayName }, request.Password);
        var existing = await users.FindByEmailAsync(email);

        // Verified first, created after: the account only exists once the code comes back, so nobody can hold an
        // address they do not read. An address that has an account gets the way back in instead of a code.
        var (attempt, code) = await attempts.StartAsync(
            AttemptPurpose.SignUp,
            email,
            decoy: existing is not null,
            ct,
            passwordHash: existing is null ? passwordHash : null,
            displayName: displayName,
            termsVersion: request.TermsVersion,
            inviteCode: Invites.Normalize(request.InviteCode));
        outbox.Add(existing?.Email is { } signsIn
            ? IdentityEmails.AlreadyRegistered(signsIn, attempts.Link("/welcome"))
            : IdentityEmails.SignUpCode(email, code!, attempts.Link($"/register/confirm?attempt={attempt.Id}&code={code}")));
        await db.SaveChangesAsync(ct);
        return TypedResults.Accepted((string?)null, new AttemptView(attempt.Id));
    }

    private static async Task<Results<Ok<MeView>, ProblemHttpResult>> ConfirmSignUpAsync(
        ConfirmCodeRequest request,
        Attempts attempts,
        UserManager<Account> users,
        Invites invites,
        ToheDbContext db,
        SessionWriter session,
        MeQueries me,
        TimeProvider clock,
        CancellationToken ct)
    {
        var check = await attempts.CheckAsync(request.AttemptId, AttemptPurpose.SignUp, request.Code, accountId: null, ct);
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

        var now = clock.GetUtcNow();

        // The registration mode and the invite code once more, now the account is made: the code counted (ADR 0028).
        var (community, inviteCode, refusal) = await invites.AdmitAsync(attempt.InviteCode, now, ct);
        if (refusal is not null)
        {
            return Problems.Of(StatusCodes.Status403Forbidden, refusal, "No new account now");
        }

        var id = Guid.CreateVersion7(now);
        var account = new Account
        {
            Id = id,
            // Identity needs a user name; an account that signs in by email has an opaque one (ADR 0024).
            UserName = id.ToString("N"),
            Email = attempt.Email,
            EmailConfirmed = true,
            PasswordHash = attempt.PasswordHash,
            DisplayName = attempt.DisplayName!,
            CreatedAt = now,
            TermsVersion = attempt.TermsVersion,
            TermsAcceptedAt = attempt.CreatedAt,
            CommunityId = community,
            InviteCode = inviteCode,
        };

        // Every account starts with a profile to play as (ADR 0023), and plays as it at once: nobody else to choose.
        var profile = new Profile
        {
            Id = Guid.CreateVersion7(now),
            AccountId = id,
            PublicId = await ProfileEndpoints.NewPublicIdAsync(db, ct),
            Name = attempt.DisplayName!,
            Avatar = ProfileOptions.Avatars[0],
            Kind = ProfileKind.Adult,
            // An adult's profile is on public boards from the start (ADR 0029); they switch it off in its settings.
            OnPublicBoards = true,
            CreatedAt = now,
        };
        try
        {
            var created = await users.CreateAsync(account);
            if (!created.Succeeded)
            {
                return Problems.AttemptClosed();
            }

            db.Profiles.Add(profile);
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Another attempt for the same address got there first.
            return Problems.AttemptClosed();
        }

        await transaction.CommitAsync(ct);
        var state = new DeviceSession(profile.Id);
        await session.WriteAsync(account, state);
        return TypedResults.Ok((await me.LoadAsync(account.Id, state, ct))!);
    }

    private static async Task<Results<Ok<MeView>, ProblemHttpResult>> LoginAsync(
        LoginRequest request,
        UserManager<Account> users,
        SignInManager<Account> signIn,
        ISignInSettings settings,
        ToheDbContext db,
        SessionWriter session,
        MeQueries me,
        ToheMetrics metrics,
        CancellationToken ct)
    {
        if (!await settings.IsOnAsync(SignInMethods.Password, ct))
        {
            return Problems.MethodDisabled();
        }

        // An email signs in. A username still does for an account from before email sign-in, until it adds an email.
        var login = request.Email.Trim();
        var account = login.Contains('@')
            ? await users.FindByEmailAsync(login)
            : await users.FindByNameAsync(login.ToLowerInvariant()) is { Email: null } legacy ? legacy : null;
        if (account?.PasswordHash is null)
        {
            users.PasswordHasher.VerifyHashedPassword(new Account { DisplayName = "" }, NoAccountHash, request.Password);
            metrics.SignIn(SignInMethods.Password, "refused");
            return Problems.InvalidCredentials();
        }

        var result = await signIn.CheckPasswordSignInAsync(account, request.Password, lockoutOnFailure: true);
        if (result.IsLockedOut)
        {
            metrics.SignIn(SignInMethods.Password, "locked");
            return Problems.LockedOut();
        }

        // Told only after the password was right: nobody learns which accounts are suspended (ADR 0027).
        if (!result.Succeeded || account.SuspendedAt is not null)
        {
            metrics.SignIn(SignInMethods.Password, "refused");
            return result.Succeeded ? Problems.AccountSuspended() : Problems.InvalidCredentials();
        }

        var playing = await OnlyProfileAsync(db, account.Id, ct);
        var state = new DeviceSession(playing);
        await session.SignInAsync(account, state, ct);
        metrics.SignIn(SignInMethods.Password, "ok");
        return TypedResults.Ok((await me.LoadAsync(account.Id, state, ct))!);
    }

    private static async Task<Results<Accepted<AttemptView>, ValidationProblem, ProblemHttpResult>> ForgotPasswordAsync(
        ForgotPasswordRequest request,
        Attempts attempts,
        IEmailOutbox outbox,
        UserManager<Account> users,
        ToheDbContext db,
        ISignInSettings settings,
        ProofOfWork proofs,
        CancellationToken ct)
    {
        // A new password signs in: with the password switched off it is no way in either (ADR 0028).
        if (!await settings.IsOnAsync(SignInMethods.Password, ct))
        {
            return Problems.MethodDisabled();
        }

        if (!outbox.Enabled)
        {
            return Problems.EmailUnavailable();
        }

        // Asked of every address alike, so the answer still says nothing about who has an account (ADR 0037).
        if (await settings.ProofOfWorkAsync(ct) && !proofs.Accepts(request.Proof))
        {
            return Problems.ProofOfWorkRequired();
        }

        if (Attempts.ParseEmail(request.Email) is not { } email)
        {
            return Problems.Field("email", "email_invalid");
        }

        if (await attempts.RefusalAsync(attempts.Normalize(email), ct) is { } refusal)
        {
            return Problems.TooManyCodes(refusal);
        }

        // An address without an account gets a decoy and no email: the same answer, nothing to learn.
        var account = await users.FindByEmailAsync(email);
        var to = account?.Email ?? email;
        var (attempt, code) = await attempts.StartAsync(
            AttemptPurpose.ResetPassword, to, decoy: account is null, ct, accountId: account?.Id);
        if (code is not null)
        {
            outbox.Add(IdentityEmails.ResetCode(
                to, code, attempts.Link($"/password/reset?attempt={attempt.Id}&code={code}")));
        }

        await db.SaveChangesAsync(ct);
        return TypedResults.Accepted((string?)null, new AttemptView(attempt.Id));
    }

    private static async Task<Results<Ok<MeView>, ValidationProblem, ProblemHttpResult>> ResetPasswordAsync(
        ResetPasswordRequest request,
        Attempts attempts,
        IEmailOutbox outbox,
        UserManager<Account> users,
        ToheDbContext db,
        SessionWriter session,
        MeQueries me,
        TimeProvider clock,
        ISignInSettings settings,
        CancellationToken ct)
    {
        // Also a code asked for before the switch went off.
        if (!await settings.IsOnAsync(SignInMethods.Password, ct))
        {
            return Problems.MethodDisabled();
        }

        // A weak password costs no try.
        if (await PasswordProblemAsync(users, request.Password) is { } weak)
        {
            return weak;
        }

        var check = await attempts.CheckAsync(
            request.AttemptId, AttemptPurpose.ResetPassword, request.Code, accountId: null, ct);
        if (check.Problem is { } problem)
        {
            return problem;
        }

        var attempt = check.Attempt!;
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var account = attempt.AccountId is { } accountId ? await users.FindByIdAsync(accountId.ToString()) : null;
        // Suspended (ADR 0027): a new password is no way in either. Said now that the code proved the address; nothing
        // changes.
        if (account is { SuspendedAt: not null })
        {
            return Problems.AccountSuspended();
        }

        if (account is null || !await attempts.UseAsync(attempt, ct))
        {
            return Problems.AttemptClosed();
        }

        // A new password and a new security stamp: every other session of the account ends. A lockout ends too.
        account.PasswordHash = users.PasswordHasher.HashPassword(account, request.Password);
        account.LockoutEnd = null;
        account.AccessFailedCount = 0;
        await users.UpdateSecurityStampAsync(account);

        // Whoever reset the password decides the sign-in email from now on.
        var now = clock.GetUtcNow();
        await db.AuthAttempts
            .Where(a => a.AccountId == account.Id && a.Purpose == AttemptPurpose.ChangeEmail && a.ClosedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.ClosedAt, now), ct);
        if (outbox.Enabled && account.Email is { } email)
        {
            outbox.Add(IdentityEmails.PasswordChanged(email));
        }

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        var playing = await OnlyProfileAsync(db, account.Id, ct);
        var state = new DeviceSession(playing);
        await session.SignInAsync(account, state, ct);
        return TypedResults.Ok((await me.LoadAsync(account.Id, state, ct))!);
    }

    /// <summary>One profile without a PIN leaves nobody to choose (ADR 0023): it plays at once. Otherwise null.</summary>
    internal static async Task<Guid?> OnlyProfileAsync(ToheDbContext db, Guid accountId, CancellationToken ct)
    {
        var profiles = await db.Profiles
            .Where(p => p.AccountId == accountId)
            .Select(p => new { p.Id, Locked = p.PinHash != null })
            .Take(2)
            .ToListAsync(ct);
        return profiles is [{ Locked: false } only] ? only.Id : null;
    }

    /// <summary>Identity's password rules (length beats composition, ADR 0011), checked before anything else.</summary>
    internal static async Task<ValidationProblem?> PasswordProblemAsync(UserManager<Account> users, string password)
    {
        foreach (var validator in users.PasswordValidators)
        {
            var result = await validator.ValidateAsync(users, new Account { DisplayName = "" }, password);
            if (!result.Succeeded)
            {
                return Problems.FromIdentity(result.Errors);
            }
        }

        return null;
    }
}
