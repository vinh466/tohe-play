using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Email;

namespace Tohe.Api.Modules.Identity;

/// <summary>What the hub needs to finish a sign-in that came back from a provider (ADR 0026).</summary>
/// <param name="Provider">The provider's name, e.g. "Google".</param>
/// <param name="Step"><c>email</c>: the provider vouched for no address, so one is asked for and proven with a code ·
/// <c>link</c>: an account signs in with the address; its owner proves it before the provider joins it ·
/// <c>signup</c>: no account has the address; a name and the terms finish signing up.</param>
/// <param name="Email">The account's address, masked, for <c>link</c>; the new account's for <c>signup</c>.</param>
/// <param name="HasPassword"><c>link</c>: the account can prove it with its password as well as with a code.</param>
public sealed record PendingSignInView(string Provider, string Step, string? Email, bool HasPassword);

/// <summary>A pending sign-in moved on: signed in (<see cref="Me"/>), or waiting for its next step (<see cref="Pending"/>).</summary>
public sealed record ExternalOutcome(MeView? Me, PendingSignInView? Pending);

public sealed record PendingEmailRequest([Required(AllowEmptyStrings = true)] string Email);

public sealed record PendingCodeRequest([Required(AllowEmptyStrings = true)] string Code);

/// <param name="Code">The code sent to the account's address for this link.</param>
/// <param name="Password">Or the account's password.</param>
public sealed record LinkProofRequest(string? Code = null, string? Password = null);

/// <param name="DisplayName">The account's name, which also names its first profile (ADR 0023).</param>
/// <param name="AcceptTerms">16 or older, and the terms and privacy notice (ADR 0025).</param>
/// <param name="InviteCode">Needed when registration is by invite; welcome otherwise, for its community (ADR 0028).</param>
public sealed record CompleteSignUpRequest(
    [Required(AllowEmptyStrings = true)] string DisplayName,
    bool AcceptTerms,
    string? TermsVersion,
    string? InviteCode = null);

/// <summary>
/// Signing in with Google, GitHub or an OpenID Connect issuer, and linking them to accounts (ADR 0026). A provider's
/// identity is its subject, never its email: an address only finds the account it might belong to, and only when the
/// provider verified it — then the account's owner proves it before the link. What waits between steps is an attempt
/// bound to the browser by a cookie. Flows: docs/architecture/identity.md.
/// </summary>
internal static class ExternalEndpoints
{
    private const string PendingCookie = "tohe.external";
    private const string Paths = "/api/auth/external";

    public static void Map(IEndpointRouteBuilder api)
    {
        var external = api.MapGroup("/auth/external").WithTags("Identity");

        // The hub navigates to these two; they answer with redirects, so they stay out of the hub's typed client.
        external.MapGet("/{provider}", Start).ExcludeFromDescription();
        external.MapGet("/{provider}/done", DoneAsync).ExcludeFromDescription();

        external.MapGet("/pending", GetPendingAsync)
            .WithName("GetPendingSignIn")
            .WithSummary("The step a sign-in back from a provider waits for, on this browser; 404 when none.");

        external.MapPost("/pending/email", PendingEmailAsync)
            .RequireRateLimiting(IdentityModule.SignInRateLimit)
            .WithName("PendingSignInEmail")
            .WithSummary("The provider vouched for no address: a code goes to this one.");

        external.MapPost("/pending/email/confirm", PendingEmailConfirmAsync)
            .RequireRateLimiting(IdentityModule.CodeRateLimit)
            .WithName("ConfirmPendingSignInEmail")
            .WithSummary("The code proves the address: an account with it is linked at once; otherwise sign-up follows.");

        external.MapPost("/pending/link-code", LinkCodeAsync)
            .RequireRateLimiting(IdentityModule.SignInRateLimit)
            .WithName("PendingSignInLinkCode")
            .WithSummary("A code to the account's address, to prove it before the provider is linked.");

        external.MapPost("/pending/link", LinkAsync)
            .RequireRateLimiting(IdentityModule.CodeRateLimit)
            .WithName("LinkPendingSignIn")
            .WithSummary("The code, or the account's password, links the provider to the account and signs in.");

        external.MapPost("/pending/signup", SignUpAsync)
            .RequireRateLimiting(IdentityModule.SignInRateLimit)
            .WithName("CompletePendingSignUp")
            .WithSummary("A name and the terms finish signing up with the provider; the first profile plays at once.");

        external.MapDelete("/pending", CancelAsync)
            .WithName("CancelPendingSignIn")
            .WithSummary("Forget the sign-in waiting on this browser.");

        api.MapDelete("/account/logins/{provider}", UnlinkAsync)
            .WithTags("Identity")
            .RequireAuthorization()
            .WithName("UnlinkSignInMethod")
            .WithSummary("Remove a provider from the account (needs step-up level 2); never the last way in.");
    }

    private static async Task<IResult> Start(
        string provider, string? intent, HttpContext http, ExternalProviderCatalog catalog, ISignInSettings settings, TimeProvider clock, CancellationToken ct)
    {
        if (catalog.Find(provider) is null)
        {
            return Results.NotFound();
        }

        // Switched off in the admin console (ADR 0028).
        if (!await settings.IsOnAsync(provider, ct))
        {
            return Results.Redirect(intent == "link" ? AccountPage("link_error", "method_disabled") : "/welcome?external=disabled");
        }

        var properties = new AuthenticationProperties { RedirectUri = $"{Paths}/{provider}/done" };
        properties.Items["provider"] = provider;
        if (intent == "link")
        {
            // Linking from Quản lý tài khoản: step-up level 2 now, and the account to link comes back with the answer.
            if (SessionClaims.AccountId(http.User) is not { } accountId)
            {
                return Results.Redirect("/welcome");
            }

            // Only the hub's own page starts a link. A navigation from another site carries the session cookie too
            // (SameSite=Lax), and with a browser signed in to someone else's provider account it would link theirs.
            if (http.Request.Headers.TryGetValue("Sec-Fetch-Site", out var site) && site != "same-origin")
            {
                return Results.Redirect(AccountPage("link_error", "cross_origin"));
            }

            if (!SessionClaims.IsSecure(http.User, clock.GetUtcNow()))
            {
                return Results.Redirect(AccountPage("link_error", "step_up_required"));
            }

            properties.Items["link"] = accountId.ToString();
        }

        return Results.Challenge(properties, [provider]);
    }

    private static async Task<IResult> DoneAsync(
        string provider,
        HttpContext http,
        UserManager<Account> users,
        ToheDbContext db,
        Attempts attempts,
        IEmailOutbox outbox,
        SessionWriter session,
        ExternalProviderCatalog catalog,
        ISignInSettings settings,
        IDataProtectionProvider protection,
        TimeProvider clock,
        CancellationToken ct)
    {
        // Identity's external cookie holds the provider's answer for this one request.
        var answer = await http.AuthenticateAsync(IdentityConstants.ExternalScheme);
        await http.SignOutAsync(IdentityConstants.ExternalScheme);
        if (!answer.Succeeded || answer.Properties is null || answer.Principal is null)
        {
            return Results.Redirect("/welcome?external=failed");
        }

        // Switched off while the person was at the provider.
        if (!await settings.IsOnAsync(provider, ct))
        {
            return Results.Redirect(answer.Properties.GetString("link") is null
                ? "/welcome?external=disabled"
                : AccountPage("link_error", "method_disabled"));
        }

        var properties = answer.Properties;
        var known = catalog.Find(provider);
        var key = answer.Principal.FindFirstValue(ExternalProviders.SubjectClaim)
            ?? answer.Principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (known is null || properties.GetString("provider") != provider || string.IsNullOrEmpty(key))
        {
            return Results.Redirect("/welcome?external=failed");
        }

        var owner = await users.FindByLoginAsync(provider, key);

        if (properties.GetString("link") is { } linkTo)
        {
            var account = await users.GetUserAsync(http.User);
            if (account is null || account.Id.ToString() != linkTo || !SessionClaims.IsSecure(http.User, clock.GetUtcNow()))
            {
                return Results.Redirect(AccountPage("link_error", "step_up_required"));
            }

            if (owner is not null)
            {
                return Results.Redirect(owner.Id == account.Id
                    ? AccountPage("linked", provider)
                    : AccountPage("link_error", "provider_account_in_use"));
            }

            return Results.Redirect(await AddLoginAsync(users, outbox, db, account, provider, key, known.Name, ct)
                ? AccountPage("linked", provider)
                : AccountPage("link_error", "provider_account_in_use"));
        }

        // Signed in with this provider before: in it goes, to the picker (which goes straight on for one profile) —
        // unless the account is suspended (ADR 0027).
        if (owner is { SuspendedAt: not null })
        {
            return Results.Redirect("/welcome?external=suspended");
        }

        if (owner is not null)
        {
            var playing = await AuthEndpoints.OnlyProfileAsync(db, owner.Id, ct);
            await session.WriteAsync(owner, new DeviceSession(playing));
            return Results.Redirect("/profiles?auto=true");
        }

        // New with this provider: the rest waits in an attempt bound to this browser.
        var email = Attempts.ParseEmail(answer.Principal.FindFirstValue(ExternalProviders.EmailClaim));
        var verified = string.Equals(
            answer.Principal.FindFirstValue(ExternalProviders.EmailVerifiedClaim), "true", StringComparison.OrdinalIgnoreCase);
        var attempt = attempts.NewExternal(provider, key, known.Name, verified ? email : null, verified && email is not null, code: null);
        db.AuthAttempts.Add(attempt);
        await db.SaveChangesAsync(ct);
        Bind(http, protection, attempt);
        return Results.Redirect("/sign-in/continue");
    }

    private static async Task<Results<Ok<PendingSignInView>, NotFound>> GetPendingAsync(
        HttpContext http, IDataProtectionProvider protection, ToheDbContext db, UserManager<Account> users, TimeProvider clock, CancellationToken ct)
    {
        var attempt = await PendingAsync(http, protection, db, clock, ct);
        return attempt is null ? TypedResults.NotFound() : TypedResults.Ok(await ViewAsync(attempt, users));
    }

    private static async Task<Results<Accepted, ValidationProblem, ProblemHttpResult>> PendingEmailAsync(
        PendingEmailRequest request,
        HttpContext http,
        IDataProtectionProvider protection,
        Attempts attempts,
        IEmailOutbox outbox,
        ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        var attempt = await PendingAsync(http, protection, db, clock, ct);
        if (attempt is null)
        {
            return SignInExpired();
        }

        if (attempt.EmailProven)
        {
            return WrongStep();
        }

        if (!outbox.Enabled)
        {
            return Problems.EmailUnavailable();
        }

        if (Attempts.ParseEmail(request.Email) is not { } email)
        {
            return Problems.Field("email", "email_invalid");
        }

        if (await attempts.RefusalAsync(attempts.Normalize(email), ct) is { } refusal)
        {
            return Problems.TooManyCodes(refusal);
        }

        var code = Codes.New();
        var next = await ContinueAsync(attempt, attempts, db, email, emailProven: false, code, clock, ct);
        outbox.Add(IdentityEmails.EmailCode(email, code, link: null));
        await db.SaveChangesAsync(ct);
        Bind(http, protection, next);
        return TypedResults.Accepted((string?)null);
    }

    private static async Task<Results<Ok<ExternalOutcome>, ValidationProblem, ProblemHttpResult>> PendingEmailConfirmAsync(
        PendingCodeRequest request,
        HttpContext http,
        IDataProtectionProvider protection,
        Attempts attempts,
        UserManager<Account> users,
        IEmailOutbox outbox,
        ToheDbContext db,
        SessionWriter session,
        MeQueries me,
        TimeProvider clock,
        ISignInSettings settings,
        CancellationToken ct)
    {
        var attempt = await PendingAsync(http, protection, db, clock, ct);
        if (attempt is null)
        {
            return SignInExpired();
        }

        if (attempt.EmailProven || attempt.CodeHash is null)
        {
            return WrongStep();
        }

        var check = await attempts.CheckAsync(attempt.Id, AttemptPurpose.External, request.Code, accountId: null, ct);
        if (check.Problem is { } problem)
        {
            return problem;
        }

        // Proven by our own code: once, even when two requests bring it at the same moment.
        var proven = await db.AuthAttempts
            .Where(a => a.Id == attempt.Id && !a.EmailProven && a.ClosedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.EmailProven, true), ct);
        if (proven != 1)
        {
            return Problems.AttemptClosed();
        }

        attempt.EmailProven = true;

        // An account signs in with the address: our code was the proof, so the provider joins it now (D-03).
        if (await users.FindByEmailAsync(attempt.Email) is { } account)
        {
            return await FinishLinkAsync(http, attempt, account, attempts, users, outbox, db, session, me, settings, ct);
        }

        return TypedResults.Ok(new ExternalOutcome(null, await ViewAsync(attempt, users)));
    }

    private static async Task<Results<Accepted, ProblemHttpResult>> LinkCodeAsync(
        HttpContext http,
        IDataProtectionProvider protection,
        Attempts attempts,
        UserManager<Account> users,
        IEmailOutbox outbox,
        ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        var attempt = await PendingAsync(http, protection, db, clock, ct);
        if (attempt is null)
        {
            return SignInExpired();
        }

        var account = attempt.EmailProven ? await users.FindByEmailAsync(attempt.Email) : null;
        if (account?.Email is not { } email)
        {
            return WrongStep();
        }

        if (!outbox.Enabled)
        {
            return Problems.EmailUnavailable();
        }

        if (await attempts.RefusalAsync(attempts.Normalize(email), ct) is { } refusal)
        {
            return Problems.TooManyCodes(refusal);
        }

        var code = Codes.New();
        var next = await ContinueAsync(attempt, attempts, db, email, emailProven: true, code, clock, ct);
        outbox.Add(IdentityEmails.LinkCode(email, code, attempt.ProviderName!));
        await db.SaveChangesAsync(ct);
        Bind(http, protection, next);
        return TypedResults.Accepted((string?)null);
    }

    private static async Task<Results<Ok<ExternalOutcome>, ValidationProblem, ProblemHttpResult>> LinkAsync(
        LinkProofRequest request,
        HttpContext http,
        IDataProtectionProvider protection,
        Attempts attempts,
        UserManager<Account> users,
        SignInManager<Account> signIn,
        IEmailOutbox outbox,
        ToheDbContext db,
        SessionWriter session,
        MeQueries me,
        TimeProvider clock,
        ISignInSettings settings,
        CancellationToken ct)
    {
        var attempt = await PendingAsync(http, protection, db, clock, ct);
        if (attempt is null)
        {
            return SignInExpired();
        }

        var account = attempt.EmailProven ? await users.FindByEmailAsync(attempt.Email) : null;
        if (account is null)
        {
            return WrongStep();
        }

        if (!string.IsNullOrEmpty(request.Password))
        {
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
        else if (!string.IsNullOrEmpty(request.Code))
        {
            var check = await attempts.CheckAsync(attempt.Id, AttemptPurpose.External, request.Code, accountId: null, ct);
            if (check.Problem is { } problem)
            {
                return problem;
            }
        }
        else
        {
            return Problems.Field("code", "proof_required");
        }

        return await FinishLinkAsync(http, attempt, account, attempts, users, outbox, db, session, me, settings, ct);
    }

    private static async Task<Results<Ok<ExternalOutcome>, ValidationProblem, ProblemHttpResult>> SignUpAsync(
        CompleteSignUpRequest request,
        HttpContext http,
        IDataProtectionProvider protection,
        Attempts attempts,
        UserManager<Account> users,
        ISignInSettings settings,
        Invites invites,
        ToheDbContext db,
        SessionWriter session,
        MeQueries me,
        TimeProvider clock,
        CancellationToken ct)
    {
        var attempt = await PendingAsync(http, protection, db, clock, ct);
        if (attempt is null)
        {
            return SignInExpired();
        }

        if (!attempt.EmailProven || await users.FindByEmailAsync(attempt.Email) is not null)
        {
            return WrongStep();
        }

        if (!ProfileNames.TryNormalize(request.DisplayName, out var displayName, out var nameError))
        {
            return Problems.Field("displayName", nameError);
        }

        if (!request.AcceptTerms || !Consent.IsVersion(request.TermsVersion))
        {
            return Problems.Field("acceptTerms", "terms_required");
        }

        if (!await settings.IsOnAsync(attempt.Provider!, ct))
        {
            return Problems.MethodDisabled();
        }

        // Registration closed, or an invite code missing or spent: no back door through a provider (ADR 0028).
        var now = clock.GetUtcNow();
        if (await invites.RefusalAsync(request.InviteCode, now, ct) is { } closed)
        {
            return closed == "registration_closed" ? Problems.RegistrationClosed() : Problems.Field("inviteCode", closed);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        if (!await attempts.UseAsync(attempt, ct))
        {
            return Problems.AttemptClosed();
        }

        var (community, inviteCode, refusal) = await invites.AdmitAsync(request.InviteCode, now, ct);
        if (refusal is not null)
        {
            return refusal == "registration_closed" ? Problems.RegistrationClosed() : Problems.Field("inviteCode", refusal);
        }

        var id = Guid.CreateVersion7(now);
        var account = new Account
        {
            Id = id,
            UserName = id.ToString("N"),
            Email = attempt.Email,
            // Verified by the provider, or by our own code.
            EmailConfirmed = true,
            DisplayName = displayName,
            CreatedAt = now,
            TermsVersion = request.TermsVersion,
            TermsAcceptedAt = now,
            CommunityId = community,
            InviteCode = inviteCode,
        };
        var profile = new Profile
        {
            Id = Guid.CreateVersion7(now),
            AccountId = id,
            PublicId = await ProfileEndpoints.NewPublicIdAsync(db, ct),
            Name = displayName,
            Avatar = ProfileOptions.Avatars[0],
            Kind = ProfileKind.Adult,
            // An adult's profile is on public boards from the start (ADR 0029); they switch it off in its settings.
            OnPublicBoards = true,
            CreatedAt = now,
        };
        try
        {
            if (!(await users.CreateAsync(account)).Succeeded
                || !(await users.AddLoginAsync(account, new UserLoginInfo(attempt.Provider!, attempt.ProviderKey!, attempt.ProviderName))).Succeeded)
            {
                return Problems.AttemptClosed();
            }

            db.Profiles.Add(profile);
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // The address, or this provider's subject, was taken meanwhile.
            return Problems.AttemptClosed();
        }

        await transaction.CommitAsync(ct);
        Unbind(http);
        var state = new DeviceSession(profile.Id);
        await session.WriteAsync(account, state);
        return TypedResults.Ok(new ExternalOutcome((await me.LoadAsync(account.Id, state, ct))!, null));
    }

    private static async Task<NoContent> CancelAsync(
        HttpContext http, IDataProtectionProvider protection, ToheDbContext db, TimeProvider clock, CancellationToken ct)
    {
        if (await PendingAsync(http, protection, db, clock, ct) is { } attempt)
        {
            var now = clock.GetUtcNow();
            await db.AuthAttempts.Where(a => a.Id == attempt.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.ClosedAt, now), ct);
        }

        Unbind(http);
        return TypedResults.NoContent();
    }

    private static async Task<Results<Ok<MeView>, NotFound, ProblemHttpResult, UnauthorizedHttpResult>> UnlinkAsync(
        string provider,
        HttpContext http,
        UserManager<Account> users,
        IEmailOutbox outbox,
        ToheDbContext db,
        ExternalProviderCatalog catalog,
        SessionWriter session,
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

        var logins = await users.GetLoginsAsync(account);
        if (logins.FirstOrDefault(l => l.LoginProvider == provider) is not { } login)
        {
            return TypedResults.NotFound();
        }

        // Never the last way in: a password, or another provider, stays.
        if (account.PasswordHash is null && logins.Count == 1)
        {
            return Problems.Of(StatusCodes.Status409Conflict, "last_method", "The account's last way to sign in stays");
        }

        // Removing a login gives the account a new security stamp: its other sessions end.
        await users.RemoveLoginAsync(account, login.LoginProvider, login.ProviderKey);
        if (outbox.Enabled && account.Email is { } email)
        {
            outbox.Add(IdentityEmails.MethodUnlinked(email, catalog.Find(provider)?.Name ?? login.ProviderDisplayName ?? provider));
            await db.SaveChangesAsync(ct);
        }

        var state = DeviceSession.Of(http.User);
        await session.WriteAsync(account, state);
        return TypedResults.Ok((await me.LoadAsync(account.Id, state, ct))!);
    }

    // ------------------------------------------------------------------ the pending sign-in

    /// <summary>The provider joins the account, the account's address hears of it, and the browser signs in.</summary>
    private static async Task<Results<Ok<ExternalOutcome>, ValidationProblem, ProblemHttpResult>> FinishLinkAsync(
        HttpContext http,
        AuthAttempt attempt,
        Account account,
        Attempts attempts,
        UserManager<Account> users,
        IEmailOutbox outbox,
        ToheDbContext db,
        SessionWriter session,
        MeQueries me,
        ISignInSettings settings,
        CancellationToken ct)
    {
        // Switched off since this sign-in began (ADR 0028): no link, no session.
        if (!await settings.IsOnAsync(attempt.Provider!, ct))
        {
            return Problems.MethodDisabled();
        }

        if (account.SuspendedAt is not null)
        {
            return Problems.AccountSuspended();
        }

        if (!await attempts.UseAsync(attempt, ct))
        {
            return Problems.AttemptClosed();
        }

        // Meanwhile the subject may have joined this account (nothing left to do) or another one (refused).
        var other = await users.FindByLoginAsync(attempt.Provider!, attempt.ProviderKey!);
        var linked = other is null
            ? await AddLoginAsync(users, outbox, db, account, attempt.Provider!, attempt.ProviderKey!, attempt.ProviderName!, ct)
            : other.Id == account.Id;
        if (!linked)
        {
            return Problems.Of(StatusCodes.Status409Conflict, "provider_account_in_use", "This provider's account is linked to another account");
        }

        Unbind(http);
        var state = new DeviceSession(await AuthEndpoints.OnlyProfileAsync(db, account.Id, ct));
        await session.WriteAsync(account, state);
        return TypedResults.Ok(new ExternalOutcome((await me.LoadAsync(account.Id, state, ct))!, null));
    }

    /// <summary>The provider joins the account and the account's address hears of it; false when another account got
    /// this subject first, at the same moment.</summary>
    private static async Task<bool> AddLoginAsync(
        UserManager<Account> users,
        IEmailOutbox outbox,
        ToheDbContext db,
        Account account,
        string provider,
        string key,
        string name,
        CancellationToken ct)
    {
        try
        {
            if (!(await users.AddLoginAsync(account, new UserLoginInfo(provider, key, name))).Succeeded)
            {
                return false;
            }
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return false;
        }

        if (outbox.Enabled && account.Email is { } email)
        {
            outbox.Add(IdentityEmails.MethodLinked(email, name));
            await db.SaveChangesAsync(ct);
        }

        return true;
    }

    /// <summary>The next step as a new attempt: the provider comes along, the one before closes.</summary>
    private static async Task<AuthAttempt> ContinueAsync(
        AuthAttempt from, Attempts attempts, ToheDbContext db, string email, bool emailProven, string code, TimeProvider clock, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        await db.AuthAttempts.Where(a => a.Id == from.Id).ExecuteUpdateAsync(s => s.SetProperty(a => a.ClosedAt, now), ct);
        var next = attempts.NewExternal(from.Provider!, from.ProviderKey!, from.ProviderName!, email, emailProven, code);
        db.AuthAttempts.Add(next);
        return next;
    }

    private static async Task<PendingSignInView> ViewAsync(AuthAttempt attempt, UserManager<Account> users)
    {
        if (!attempt.EmailProven)
        {
            return new PendingSignInView(attempt.ProviderName!, "email", null, false);
        }

        return await users.FindByEmailAsync(attempt.Email) is { } account
            ? new PendingSignInView(attempt.ProviderName!, "link", IdentityEmails.Mask(account.Email!), account.PasswordHash is not null)
            : new PendingSignInView(attempt.ProviderName!, "signup", attempt.Email, false);
    }

    private static IDataProtector Protector(IDataProtectionProvider protection) =>
        protection.CreateProtector("Tohe.Identity.PendingSignIn");

    /// <summary>The attempt's id, sealed, in a cookie only the API reads — never in a link that could travel.</summary>
    private static void Bind(HttpContext http, IDataProtectionProvider protection, AuthAttempt attempt) =>
        http.Response.Cookies.Append(PendingCookie, Protector(protection).Protect(attempt.Id.ToString()), new CookieOptions
        {
            HttpOnly = true,
            Secure = http.Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            Path = Paths,
            Expires = attempt.ExpiresAt,
        });

    private static void Unbind(HttpContext http) =>
        http.Response.Cookies.Delete(PendingCookie, new CookieOptions { Path = Paths });

    private static async Task<AuthAttempt?> PendingAsync(
        HttpContext http, IDataProtectionProvider protection, ToheDbContext db, TimeProvider clock, CancellationToken ct)
    {
        if (!http.Request.Cookies.TryGetValue(PendingCookie, out var sealedId))
        {
            return null;
        }

        Guid id;
        try
        {
            id = Guid.Parse(Protector(protection).Unprotect(sealedId));
        }
        catch (Exception e) when (e is CryptographicException or FormatException)
        {
            return null;
        }

        var attempt = await db.AuthAttempts.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id && a.Purpose == AttemptPurpose.External, ct);
        return attempt is not null && attempt.IsOpen(clock.GetUtcNow()) ? attempt : null;
    }

    private static ProblemHttpResult SignInExpired() =>
        Problems.Of(StatusCodes.Status404NotFound, "sign_in_expired", "Nothing waits on this browser; sign in again");

    private static ProblemHttpResult WrongStep() =>
        Problems.Of(StatusCodes.Status409Conflict, "wrong_step", "The sign-in waits for another step");

    private static string AccountPage(string key, string value) => $"/account?{key}={Uri.EscapeDataString(value)}";
}
