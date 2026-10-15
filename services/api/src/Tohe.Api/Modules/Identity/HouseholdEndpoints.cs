using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Identity;

/// <param name="Name">A new name.</param>
/// <param name="Telemetry">Turn technical telemetry on or off for the household's devices (ADR 0015).</param>
public sealed record UpdateHouseholdRequest(
    [StringLength(40, MinimumLength = 1)] string? Name = null,
    bool? Telemetry = null);

/// <param name="Pin">Optional 4-digit PIN.</param>
public sealed record CreateProfileRequest(
    [Required, StringLength(20, MinimumLength = 1)] string Name,
    [Required] string Avatar,
    [Required] string AgeBand,
    [StringLength(4)] string? Pin = null);

/// <param name="Pin">A new 4-digit PIN.</param>
/// <param name="RemovePin">Remove the PIN.</param>
/// <param name="PlayWithOthers">Let a child play online with other households (ADR 0016).</param>
public sealed record UpdateProfileRequest(
    [StringLength(20, MinimumLength = 1)] string? Name = null,
    string? Avatar = null,
    string? AgeBand = null,
    [StringLength(4)] string? Pin = null,
    bool? RemovePin = null,
    bool? PlayWithOthers = null);

/// <summary>Household management. Every endpoint requires the parent gate (ADR 0011).</summary>
internal static class HouseholdEndpoints
{
    public static void Map(IEndpointRouteBuilder api)
    {
        api.MapGet("/profiles/options", () => new ProfileOptionsView(ProfileOptions.Avatars, ProfileOptions.AgeBands))
            .WithTags("Identity")
            .WithName("GetProfileOptions")
            .WithSummary("Allowed avatars and age bands.");

        var household = api.MapGroup("/household")
            .WithTags("Identity")
            .RequireAuthorization()
            .AddEndpointFilter(async (context, next) =>
            {
                var clock = context.HttpContext.RequestServices.GetRequiredService<TimeProvider>();
                return SessionClaims.IsParentUnlocked(context.HttpContext.User, clock.GetUtcNow())
                    ? await next(context)
                    : Problems.ParentGateRequired();
            })
            .ProducesProblem(StatusCodes.Status403Forbidden);

        household.MapPatch("/", async (UpdateHouseholdRequest request, Context context, CancellationToken ct) =>
            {
                var home = await context.Db.Households.FirstAsync(h => h.Id == context.Account.HouseholdId, ct);
                if (request.Name is { } name)
                {
                    home.Name = name.Trim();
                }

                if (request.Telemetry is { } telemetry)
                {
                    home.TelemetryEnabled = telemetry;
                }

                await context.Db.SaveChangesAsync(ct);
                return TypedResults.Ok(await context.MeAsync(ct));
            })
            .WithName("UpdateHousehold")
            .WithSummary("Rename the household, or turn its telemetry on or off.");

        household.MapPost("/invite", async (Context context, TimeProvider clock, CancellationToken ct) =>
            {
                var home = await context.Db.Households.FirstAsync(h => h.Id == context.Account.HouseholdId, ct);
                home.InviteCode = Invites.NewCode();
                home.InviteExpiresAt = clock.GetUtcNow() + Invites.Lifetime;
                await context.Db.SaveChangesAsync(ct);
                return TypedResults.Ok(await context.MeAsync(ct));
            })
            .WithName("CreateInvite")
            .WithSummary("New invite code for another adult (replaces the previous one).");

        household.MapDelete("/invite", async (Context context, CancellationToken ct) =>
            {
                var home = await context.Db.Households.FirstAsync(h => h.Id == context.Account.HouseholdId, ct);
                home.InviteCode = null;
                home.InviteExpiresAt = null;
                await context.Db.SaveChangesAsync(ct);
                return TypedResults.Ok(await context.MeAsync(ct));
            })
            .WithName("RevokeInvite")
            .WithSummary("Revoke the invite code.");

        household.MapPost("/profiles", CreateProfileAsync)
            .WithName("CreateProfile")
            .WithSummary("Add a child profile.");

        household.MapPatch("/profiles/{id:guid}", UpdateProfileAsync)
            .WithName("UpdateProfile")
            .WithSummary("Edit a profile. Adults can only edit their own adult profile.");

        household.MapDelete("/profiles/{id:guid}", DeleteProfileAsync)
            .WithName("DeleteProfile")
            .WithSummary("Remove a child profile.");
    }

    private static async Task<Results<Ok<MeView>, ValidationProblem>> CreateProfileAsync(
        CreateProfileRequest request, Context context, TimeProvider clock, CancellationToken ct)
    {
        if (Invalid(request.Avatar, request.AgeBand, request.Pin) is { } invalid)
        {
            return invalid;
        }

        var count = await context.Db.Profiles.CountAsync(p => p.HouseholdId == context.Account.HouseholdId, ct);
        if (count >= ProfileOptions.MaxProfilesPerHousehold)
        {
            return Problems.Field("", "too_many_profiles");
        }

        var profile = new Profile
        {
            Id = Guid.CreateVersion7(),
            HouseholdId = context.Account.HouseholdId,
            Name = request.Name.Trim(),
            Avatar = request.Avatar,
            Kind = ProfileKind.Child,
            AgeBand = request.AgeBand,
            CreatedAt = clock.GetUtcNow(),
        };
        if (!string.IsNullOrEmpty(request.Pin))
        {
            profile.PinHash = Pins.Hash(profile, request.Pin);
        }

        context.Db.Profiles.Add(profile);
        await context.Db.SaveChangesAsync(ct);
        return TypedResults.Ok(await context.MeAsync(ct));
    }

    private static async Task<Results<Ok<MeView>, NotFound, ValidationProblem, ProblemHttpResult>> UpdateProfileAsync(
        Guid id, UpdateProfileRequest request, Context context, CancellationToken ct)
    {
        var profile = await context.Db.Profiles
            .FirstOrDefaultAsync(p => p.Id == id && p.HouseholdId == context.Account.HouseholdId, ct);
        if (profile is null)
        {
            return TypedResults.NotFound();
        }

        if (profile.Kind == ProfileKind.Adult && profile.AccountId != context.Account.Id)
        {
            return Problems.Of(StatusCodes.Status403Forbidden, "not_your_profile", "Only its owner can edit an adult profile");
        }

        if (profile.Kind == ProfileKind.Adult && request.AgeBand is not null)
        {
            return Problems.Field("ageBand", "adults_have_no_age_band");
        }

        if (Invalid(request.Avatar, request.AgeBand, request.Pin) is { } invalid)
        {
            return invalid;
        }

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            profile.Name = request.Name.Trim();
        }

        profile.Avatar = request.Avatar ?? profile.Avatar;
        profile.AgeBand = request.AgeBand ?? profile.AgeBand;
        if (request.PlayWithOthers is { } others && profile.Kind == ProfileKind.Child)
        {
            profile.PlayWithOthers = others;
        }
        if (request.RemovePin == true)
        {
            profile.PinHash = null;
        }
        else if (!string.IsNullOrEmpty(request.Pin))
        {
            profile.PinHash = Pins.Hash(profile, request.Pin);
        }

        await context.Db.SaveChangesAsync(ct);
        return TypedResults.Ok(await context.MeAsync(ct));
    }

    private static async Task<Results<Ok<MeView>, NotFound, ProblemHttpResult>> DeleteProfileAsync(
        Guid id, Context context, CancellationToken ct)
    {
        var profile = await context.Db.Profiles
            .FirstOrDefaultAsync(p => p.Id == id && p.HouseholdId == context.Account.HouseholdId, ct);
        if (profile is null)
        {
            return TypedResults.NotFound();
        }

        if (profile.Kind == ProfileKind.Adult)
        {
            return Problems.Of(StatusCodes.Status409Conflict, "adult_profile", "Adult profiles belong to their account");
        }

        context.Db.Profiles.Remove(profile);
        await context.Db.SaveChangesAsync(ct);
        return TypedResults.Ok(await context.MeAsync(ct));
    }

    /// <summary>Checks values that DataAnnotations cannot express; null when everything given is valid.</summary>
    private static ValidationProblem? Invalid(string? avatar, string? ageBand, string? pin)
    {
        if (avatar is not null && !ProfileOptions.Avatars.Contains(avatar))
        {
            return Problems.Field("avatar", "avatar_invalid");
        }

        if (ageBand is not null && !ProfileOptions.AgeBands.Contains(ageBand))
        {
            return Problems.Field("ageBand", "age_band_invalid");
        }

        if (!string.IsNullOrEmpty(pin) && !ProfileOptions.Pin().IsMatch(pin))
        {
            return Problems.Field("pin", "pin_format");
        }

        return null;
    }

    /// <summary>The signed-in adult and what every household endpoint needs, bound per request.</summary>
    internal sealed class Context(ToheDbContext db, MeQueries me, Account account, HttpContext http)
    {
        public ToheDbContext Db { get; } = db;

        public Account Account { get; } = account;

        public async Task<MeView> MeAsync(CancellationToken ct) =>
            (await me.LoadAsync(
                Account.Id,
                SessionClaims.ProfileId(http.User),
                SessionClaims.ParentUnlockedUntil(http.User),
                ct))!;

        public static async ValueTask<Context?> BindAsync(HttpContext http)
        {
            var services = http.RequestServices;
            var account = await services.GetRequiredService<UserManager<Account>>().GetUserAsync(http.User);
            return account is null
                ? null
                : new Context(services.GetRequiredService<ToheDbContext>(), services.GetRequiredService<MeQueries>(), account, http);
        }
    }
}
