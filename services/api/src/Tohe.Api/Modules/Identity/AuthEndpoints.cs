using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Identity;

/// <param name="DisplayName">The account's name, which also names its first profile (ADR 0023).</param>
public sealed record RegisterRequest(
    [Required(AllowEmptyStrings = true)] string DisplayName,
    [Required, RegularExpression("^[A-Za-z0-9._-]{3,32}$")] string Username,
    [Required, StringLength(128, MinimumLength = 8)] string Password);

public sealed record LoginRequest([Required] string Username, [Required] string Password);

internal static class AuthEndpoints
{
    public static void Map(IEndpointRouteBuilder api)
    {
        var auth = api.MapGroup("/auth").WithTags("Identity");

        auth.MapPost("/register", RegisterAsync)
            .RequireRateLimiting(IdentityModule.AuthRateLimit)
            .WithName("Register")
            .WithSummary("Create an account and its first profile.");

        auth.MapPost("/login", LoginAsync)
            .RequireRateLimiting(IdentityModule.AuthRateLimit)
            .WithName("Login")
            .WithSummary("Sign in; sets the session cookie.");

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

                var view = await me.LoadAsync(
                    accountId,
                    SessionClaims.ProfileId(http.User),
                    SessionClaims.ParentUnlockedUntil(http.User),
                    ct);
                return view is null ? TypedResults.NoContent() : TypedResults.Ok(view);
            })
            .WithName("GetMe")
            .WithSummary("The device session (account, profiles, active profile, parent gate); 204 when signed out.");
    }

    private static async Task<Results<Ok<MeView>, ValidationProblem>> RegisterAsync(
        RegisterRequest request,
        UserManager<Account> users,
        ToheDbContext db,
        SessionWriter session,
        MeQueries me,
        TimeProvider clock,
        CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        if (!ProfileNames.TryNormalize(request.DisplayName, out var displayName, out var nameError))
        {
            return Problems.Field("displayName", nameError);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var account = new Account
        {
            Id = Guid.CreateVersion7(),
            UserName = request.Username.Trim().ToLowerInvariant(),
            DisplayName = displayName,
            CreatedAt = now,
        };
        var created = await users.CreateAsync(account, request.Password);
        if (!created.Succeeded)
        {
            return Problems.FromIdentity(created.Errors);
        }

        // Every account starts with a profile to play as (ADR 0023), and plays as it at once: nobody else to choose.
        var profile = new Profile
        {
            Id = Guid.CreateVersion7(),
            AccountId = account.Id,
            PublicId = await ProfileEndpoints.NewPublicIdAsync(db, ct),
            Name = displayName,
            Avatar = ProfileOptions.Avatars[0],
            Kind = ProfileKind.Adult,
            CreatedAt = now,
        };
        db.Profiles.Add(profile);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        await session.WriteAsync(account, profileId: profile.Id, parentUntil: null);
        return TypedResults.Ok((await me.LoadAsync(account.Id, profile.Id, null, ct))!);
    }

    private static async Task<Results<Ok<MeView>, ProblemHttpResult>> LoginAsync(
        LoginRequest request,
        UserManager<Account> users,
        SignInManager<Account> signIn,
        ToheDbContext db,
        SessionWriter session,
        MeQueries me,
        CancellationToken ct)
    {
        var account = await users.FindByNameAsync(request.Username.Trim().ToLowerInvariant());
        if (account is null)
        {
            return Problems.InvalidCredentials();
        }

        var result = await signIn.CheckPasswordSignInAsync(account, request.Password, lockoutOnFailure: true);
        if (result.IsLockedOut)
        {
            return Problems.LockedOut();
        }

        if (!result.Succeeded)
        {
            return Problems.InvalidCredentials();
        }

        // One profile without a PIN leaves nobody to choose (ADR 0023): it plays at once. Otherwise the picker asks.
        var profiles = await db.Profiles
            .Where(p => p.AccountId == account.Id)
            .Select(p => new { p.Id, Locked = p.PinHash != null })
            .Take(2)
            .ToListAsync(ct);
        Guid? playing = profiles is [{ Locked: false } only] ? only.Id : null;

        await session.WriteAsync(account, profileId: playing, parentUntil: null);
        return TypedResults.Ok((await me.LoadAsync(account.Id, playing, null, ct))!);
    }
}
