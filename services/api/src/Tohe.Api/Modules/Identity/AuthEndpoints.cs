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
/// <param name="DeviceProfileId">The device profile signing up, when the device has one (ADR 0043): kept on the
/// attempt, so only the confirmation that sends this device profile brings it in. 409 <c>id_taken</c> when the server
/// cannot take its id.</param>
public sealed record SignUpRequest(
    [Required(AllowEmptyStrings = true)] string Email,
    [Required(AllowEmptyStrings = true), StringLength(128)] string Password,
    [Required(AllowEmptyStrings = true)] string DisplayName,
    bool AcceptTerms,
    string? TermsVersion,
    string? InviteCode = null,
    ProofOfWorkSolution? Proof = null,
    Guid? DeviceProfileId = null);

/// <summary>A flow waiting for the code sent by email. The same answer whoever the address belongs to (ADR 0024).</summary>
/// <param name="AttemptId">Send it back with the code: a code opens only the attempt it was sent for.</param>
public sealed record AttemptView(Guid AttemptId);

/// <param name="Code">The six digits from the email; spaces are fine.</param>
public sealed record ConfirmCodeRequest(Guid AttemptId, [Required(AllowEmptyStrings = true)] string Code);

/// <param name="Code">The six digits from the email; spaces are fine.</param>
/// <param name="DeviceProfile">The device profile that started the sign-up, with what it played (ADR 0043): without
/// an age band it becomes the account's first profile, with one it joins the usual first profile as a child's. Only
/// when its id is the attempt's — sent from the device that started — and the server can take it.</param>
public sealed record ConfirmSignUpRequest(
    Guid AttemptId,
    [Required(AllowEmptyStrings = true)] string Code,
    DeviceProfileUpload? DeviceProfile = null);

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
        HttpContext http,
        Attempts attempts,
        IEmailOutbox outbox,
        UserManager<Account> users,
        ISignInSettings settings,
        Invites invites,
        ProofOfWork proofs,
        DeviceProfiles devices,
        ToheDbContext db,
        TimeProvider clock,
        ToheMetrics metrics,
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

        // A device profile whose id the server cannot take gets a new one on the device first (ADR 0043) — unless it is
        // this device's own copy on the server, which comes in as itself.
        if (request.DeviceProfileId is { } deviceProfile && await devices.TakenFromAsync(http, deviceProfile, ct))
        {
            return DeviceProfiles.IdTaken();
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
            inviteCode: Invites.Normalize(request.InviteCode),
            deviceProfileId: request.DeviceProfileId);
        outbox.Add(existing?.Email is { } signsIn
            ? IdentityEmails.AlreadyRegistered(signsIn, attempts.Link(HubPaths.Welcome))
            : IdentityEmails.SignUpCode(email, code!, attempts.Link($"{HubPaths.RegisterConfirm}?attempt={attempt.Id}&code={code}")));
        await db.SaveChangesAsync(ct);
        // Only a real sign-up counts: an address that has an account got the way back in, not a code to sign up with.
        if (existing is null)
        {
            metrics.SignUp(SignInMethods.Password, "started");
        }

        return TypedResults.Accepted((string?)null, new AttemptView(attempt.Id));
    }

    private static async Task<Results<Ok<MeView>, ProblemHttpResult>> ConfirmSignUpAsync(
        ConfirmSignUpRequest request,
        HttpContext http,
        Attempts attempts,
        UserManager<Account> users,
        Invites invites,
        DeviceProfiles devices,
        ToheDbContext db,
        SessionWriter session,
        MeQueries me,
        TimeProvider clock,
        ToheMetrics metrics,
        CancellationToken ct)
    {
        var check = await attempts.CheckAsync(request.AttemptId, AttemptPurpose.SignUp, request.Code, accountId: null, ct);
        if (check.Problem is { } problem)
        {
            return problem;
        }

        var attempt = check.Attempt!;
        // The device profile that started it, from the device that started it (ADR 0043). A refused name is changed on
        // the device first, before the attempt is used: the same code works again.
        var device = DeviceProfiles.Of(attempt, request.DeviceProfile);
        var deviceName = "";
        if (device is not null && devices.Check(device, out deviceName) is { } refused)
        {
            return refused;
        }

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

        // This device's copy on the server becomes the account's, keeping its id, seats and results (ADR 0043). Another id
        // taken since the sign-up started: the account is made the usual way, and the device keeps its profile.
        var copy = device is null ? null : await devices.ServerCopyAsync(http, device.Id, ct);
        if (device is not null && copy is null && await devices.IdTakenAsync(device.Id, ct))
        {
            device = null;
        }

        try
        {
            var created = await users.CreateAsync(account);
            if (!created.Succeeded)
            {
                return Problems.AttemptClosed();
            }
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Another attempt for the same address got there first.
            return Problems.AttemptClosed();
        }

        // Every account starts with a profile to play as (ADR 0023), and plays as it at once: nobody else to choose. A
        // device profile that is the person's own is that profile; a child's joins it (ADR 0043).
        // Its id taken at this very moment: the account is made the usual way.
        var profile = await devices.SaveFirstProfileAsync(account, attempt.DisplayName!, device, deviceName, now, ct, copy);

        await transaction.CommitAsync(ct);
        metrics.SignUp(SignInMethods.Password, "completed");
        var state = new DeviceSession(profile.Id);
        await session.WriteAsync(account, state);
        return TypedResults.Ok((await me.LoadAsync(account.Id, state, ct))!);
    }

    private static async Task<Results<Ok<MeView>, ProblemHttpResult>> LoginAsync(
        LoginRequest request,
        PasswordSignIn passwords,
        ToheDbContext db,
        SessionWriter session,
        MeQueries me,
        ToheMetrics metrics,
        CancellationToken ct)
    {
        var (check, account) = await passwords.CheckAsync(request.Email, request.Password, ct);
        if (check != PasswordCheck.Ok)
        {
            if (check != PasswordCheck.MethodDisabled)
            {
                metrics.SignIn(SignInMethods.Password, check == PasswordCheck.LockedOut ? "locked" : "refused");
            }

            return PasswordSignIn.Problem(check);
        }

        var playing = await OnlyProfileAsync(db, account!.Id, ct);
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
                to, code, attempts.Link($"{HubPaths.PasswordReset}?attempt={attempt.Id}&code={code}")));
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

/// <summary>What checking an email and a password found (<see cref="PasswordSignIn"/>).</summary>
internal enum PasswordCheck
{
    /// <summary>The password is right and the account may sign in.</summary>
    Ok,

    /// <summary>The console switched signing in with a password off (ADR 0028).</summary>
    MethodDisabled,

    /// <summary>No such account, no password on it, or a wrong password: the same answer for each.</summary>
    Refused,

    /// <summary>Too many wrong tries in a row (Identity's lockout).</summary>
    LockedOut,

    /// <summary>The password is right, and the account is suspended (ADR 0027).</summary>
    Suspended,
}

/// <summary>
/// The checks of a sign-in with an email and a password, shared by the players' sign-in and the console's (ADR 0011,
/// 0024, 0027, 0028, 0042): the switch, the account by its email — or by its username, for an account from before email
/// sign-in — the password against Identity's lockout, and suspension, told only once the password was right.
/// </summary>
internal sealed class PasswordSignIn(UserManager<Account> users, SignInManager<Account> signIn, ISignInSettings settings)
{
    /// <summary>Checked against the password typed for an address with no account, so a miss takes as long as a wrong
    /// password and says nothing about who has an account.</summary>
    private static readonly string NoAccountHash =
        new PasswordHasher<Account>().HashPassword(new Account { DisplayName = "" }, "no account has this password");

    /// <summary>The account is returned whenever one was found, whatever the result.</summary>
    /// <param name="honourSwitch">The players' sign-in honours the console's switch for the password; the console's own
    /// sign-in does not.</param>
    public async Task<(PasswordCheck Result, Account? Account)> CheckAsync(
        string login, string password, CancellationToken ct, bool honourSwitch = true)
    {
        if (honourSwitch && !await settings.IsOnAsync(SignInMethods.Password, ct))
        {
            return (PasswordCheck.MethodDisabled, null);
        }

        var account = await FindAsync(login);
        return (await CheckPasswordAsync(account, password), account);
    }

    /// <summary>
    /// The account that signs in with <paramref name="login"/>: an email, or a username still, for an account from before
    /// email sign-in, until it adds an email.
    /// </summary>
    public async Task<Account?> FindAsync(string login)
    {
        login = login.Trim();
        return login.Contains('@')
            ? await users.FindByEmailAsync(login)
            : await users.FindByNameAsync(login.ToLowerInvariant()) is { Email: null } legacy ? legacy : null;
    }

    /// <summary>
    /// The password of <paramref name="account"/>, against Identity's lockout. No account — or one without a password —
    /// costs a check against a hash nobody has, as long as a wrong password takes, and touches no lockout.
    /// </summary>
    public async Task<PasswordCheck> CheckPasswordAsync(Account? account, string password)
    {
        if (account?.PasswordHash is null)
        {
            users.PasswordHasher.VerifyHashedPassword(new Account { DisplayName = "" }, NoAccountHash, password);
            return PasswordCheck.Refused;
        }

        var result = await signIn.CheckPasswordSignInAsync(account, password, lockoutOnFailure: true);
        if (result.IsLockedOut)
        {
            return PasswordCheck.LockedOut;
        }

        if (!result.Succeeded)
        {
            return PasswordCheck.Refused;
        }

        // Told only after the password was right: nobody learns which accounts are suspended (ADR 0027).
        return account.SuspendedAt is null ? PasswordCheck.Ok : PasswordCheck.Suspended;
    }

    /// <summary>The answer to a check that did not pass.</summary>
    public static ProblemHttpResult Problem(PasswordCheck check) => check switch
    {
        PasswordCheck.MethodDisabled => Problems.MethodDisabled(),
        PasswordCheck.LockedOut => Problems.LockedOut(),
        PasswordCheck.Suspended => Problems.AccountSuspended(),
        _ => Problems.InvalidCredentials(),
    };
}
