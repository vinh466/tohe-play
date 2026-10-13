using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Identity;

/// <param name="InviteCode">Join the household that issued this code instead of creating a new one.</param>
public sealed record RegisterRequest(
    [Required, StringLength(40, MinimumLength = 1)] string DisplayName,
    [Required, RegularExpression("^[A-Za-z0-9._-]{3,32}$")] string Username,
    [Required, StringLength(128, MinimumLength = 8)] string Password,
    [StringLength(40)] string? HouseholdName = null,
    [StringLength(16)] string? InviteCode = null);

public sealed record LoginRequest([Required] string Username, [Required] string Password);

internal static class AuthEndpoints
{
    public static void Map(IEndpointRouteBuilder api)
    {
        var auth = api.MapGroup("/auth").WithTags("Identity");

        auth.MapPost("/register", RegisterAsync)
            .RequireRateLimiting(IdentityModule.AuthRateLimit)
            .WithName("Register")
            .WithSummary("Create an adult account: a new household, or join one with an invite code.");

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

        auth.MapGet("/me", async Task<Results<Ok<MeView>, UnauthorizedHttpResult>> (
                HttpContext http, MeQueries me, CancellationToken ct) =>
            {
                if (SessionClaims.AccountId(http.User) is not { } accountId)
                {
                    return TypedResults.Unauthorized();
                }

                var view = await me.LoadAsync(
                    accountId,
                    SessionClaims.ProfileId(http.User),
                    SessionClaims.ParentUnlockedUntil(http.User),
                    ct);
                return view is null ? TypedResults.Unauthorized() : TypedResults.Ok(view);
            })
            .RequireAuthorization()
            .WithName("GetMe")
            .WithSummary("The device session: account, household, profiles, active profile, parent gate.");
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
        var displayName = request.DisplayName.Trim();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        Household? household;
        if (!string.IsNullOrWhiteSpace(request.InviteCode))
        {
            var code = Invites.Normalize(request.InviteCode);
            household = await db.Households.FirstOrDefaultAsync(h => h.InviteCode == code && h.InviteExpiresAt > now, ct);
            if (household is null)
            {
                return Problems.Field("inviteCode", "invite_invalid");
            }
        }
        else
        {
            var name = string.IsNullOrWhiteSpace(request.HouseholdName) ? $"Nhà {displayName}" : request.HouseholdName.Trim();
            household = new Household { Id = Guid.CreateVersion7(), Name = name[..Math.Min(name.Length, 40)], CreatedAt = now };
            db.Households.Add(household);
            await db.SaveChangesAsync(ct);
        }

        var account = new Account
        {
            Id = Guid.CreateVersion7(),
            UserName = request.Username.Trim().ToLowerInvariant(),
            DisplayName = displayName,
            HouseholdId = household.Id,
            CreatedAt = now,
        };
        var created = await users.CreateAsync(account, request.Password);
        if (!created.Succeeded)
        {
            return Problems.FromIdentity(created.Errors);
        }

        db.Profiles.Add(new Profile
        {
            Id = Guid.CreateVersion7(),
            HouseholdId = household.Id,
            Name = displayName[..Math.Min(displayName.Length, 20)],
            Avatar = ProfileOptions.Avatars[0],
            Kind = ProfileKind.Adult,
            AccountId = account.Id,
            CreatedAt = now,
        });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        await session.WriteAsync(account, profileId: null, parentUntil: null);
        return TypedResults.Ok((await me.LoadAsync(account.Id, null, null, ct))!);
    }

    private static async Task<Results<Ok<MeView>, ProblemHttpResult>> LoginAsync(
        LoginRequest request,
        UserManager<Account> users,
        SignInManager<Account> signIn,
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

        await session.WriteAsync(account, profileId: null, parentUntil: null);
        return TypedResults.Ok((await me.LoadAsync(account.Id, null, null, ct))!);
    }
}
