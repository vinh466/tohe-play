using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Identity;

/// <param name="Pin">Required when the profile has a PIN.</param>
public sealed record SelectProfileRequest(Guid ProfileId, [StringLength(4)] string? Pin = null);

public sealed record ParentGateRequest([Required] string Password);

internal static class SessionEndpoints
{
    public static void Map(IEndpointRouteBuilder api)
    {
        var session = api.MapGroup("/session").WithTags("Identity").RequireAuthorization();

        session.MapPut("/profile", SelectProfileAsync)
            .RequireRateLimiting(IdentityModule.AuthRateLimit)
            .WithName("SelectProfile")
            .WithSummary("Choose who plays on this device. Locks the parent gate.");

        session.MapDelete("/profile", async (HttpContext http, UserManager<Account> users, SessionWriter writer, MeQueries me, CancellationToken ct) =>
            {
                var account = await users.GetUserAsync(http.User);
                if (account is null)
                {
                    return Results.Unauthorized();
                }

                await writer.WriteAsync(account, profileId: null, parentUntil: null);
                return Results.Ok(await me.LoadAsync(account.Id, null, null, ct));
            })
            .Produces<MeView>()
            .WithName("ClearProfile")
            .WithSummary("Back to the profile picker.");

        session.MapPost("/parent-gate", UnlockParentGateAsync)
            .RequireRateLimiting(IdentityModule.AuthRateLimit)
            .WithName("UnlockParentGate")
            .WithSummary("Re-enter the password to manage the household for a few minutes.");

        session.MapDelete("/parent-gate", async (HttpContext http, UserManager<Account> users, SessionWriter writer, MeQueries me, CancellationToken ct) =>
            {
                var account = await users.GetUserAsync(http.User);
                if (account is null)
                {
                    return Results.Unauthorized();
                }

                var profileId = SessionClaims.ProfileId(http.User);
                await writer.WriteAsync(account, profileId, parentUntil: null);
                return Results.Ok(await me.LoadAsync(account.Id, profileId, null, ct));
            })
            .Produces<MeView>()
            .WithName("LockParentGate")
            .WithSummary("Lock household management again.");
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
            .FirstOrDefaultAsync(p => p.Id == request.ProfileId && p.HouseholdId == account.HouseholdId, ct);
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
        await writer.WriteAsync(account, profile.Id, parentUntil: null);
        return TypedResults.Ok((await me.LoadAsync(account.Id, profile.Id, null, ct))!);
    }

    private static async Task<Results<Ok<MeView>, ProblemHttpResult, UnauthorizedHttpResult>> UnlockParentGateAsync(
        ParentGateRequest request,
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

        var result = await signIn.CheckPasswordSignInAsync(account, request.Password, lockoutOnFailure: true);
        if (result.IsLockedOut)
        {
            return Problems.LockedOut();
        }

        if (!result.Succeeded)
        {
            return Problems.Of(StatusCodes.Status403Forbidden, "password_invalid", "Wrong password");
        }

        var until = clock.GetUtcNow() + SessionClaims.ParentGateDuration;
        var profileId = SessionClaims.ProfileId(http.User);
        await writer.WriteAsync(account, profileId, until);
        return TypedResults.Ok((await me.LoadAsync(account.Id, profileId, until, ct))!);
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
