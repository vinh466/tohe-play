using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Platform;

namespace Tohe.Api.Modules.Identity;

/// <summary>A device profile's server copy, made the first time its player does something that needs the server (ADR 0043).</summary>
/// <param name="Id">The id the device gave it: taken only if no profile has it, nor ever had it.</param>
/// <param name="Name">Goes through the name rules and the filter (ADR 0023, 0035).</param>
/// <param name="TermsVersion">The version of the terms the hub showed when its player ticked "Tôi đồng ý Điều khoản và từ 16
/// tuổi trở lên, hoặc bố mẹ đã cho phép".</param>
/// <param name="Proof">The answer to a challenge from <c>GET /api/auth/challenge</c>, when the server asks for one
/// (<c>proofOfWork</c> in <c>/api/config</c>, ADR 0037); only a new server copy needs it.</param>
public sealed record DeviceProfileRegistration(
    Guid Id,
    [Required(AllowEmptyStrings = true)] string Name,
    [Required] string Avatar,
    [Required(AllowEmptyStrings = true)] string TermsVersion,
    ProofOfWorkSolution? Proof = null);

/// <summary>A device profile as the server keeps it (ADR 0043).</summary>
public sealed record DeviceProfileView(Guid Id, string Name, string Avatar, string TermsVersion);

/// <summary>
/// The device key and the device profiles on the server (ADR 0043). Making the key needs nothing; everything else needs
/// it, and only it: an account's session never acts here, and the key never acts on an account's endpoints.
/// </summary>
internal static class DeviceEndpoints
{
    /// <summary>The device key alone authenticates these routes.</summary>
    public static readonly AuthorizationPolicy DevicePolicy =
        new AuthorizationPolicyBuilder(DeviceKey.Scheme).RequireAuthenticatedUser().Build();

    public static void Map(IEndpointRouteBuilder api)
    {
        api.MapPost("/devices", StartAsync)
            .WithTags("Identity")
            .AllowAnonymous()
            .RequireRateLimiting(IdentityModule.DeviceRateLimit)
            .WithName("StartDevice")
            .WithSummary("Give this device its key (ADR 0043): a cookie, renewed on use, 90 days. A device that has one keeps it.");

        var profiles = api.MapGroup("/devices/profiles")
            .WithTags("Identity")
            .RequireAuthorization(DevicePolicy)
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        profiles.MapPost("/", RegisterAsync)
            .RequireRateLimiting(IdentityModule.DeviceRateLimit)
            .WithName("RegisterDeviceProfile")
            .WithSummary("Make — or bring up to date — a device profile's server copy, with the terms its player accepted; 409 id_taken when the id cannot be taken.");

        profiles.MapDelete("/{id:guid}", DeleteAsync)
            .WithName("DeleteDeviceProfile")
            .WithSummary("Delete a device profile's server copy and everything of it, for good (ADR 0034); its id is retired.");
    }

    private static async Task<NoContent> StartAsync(
        HttpContext http, ToheDbContext db, IOptions<AppOptions> app, TimeProvider clock, CancellationToken ct)
    {
        // A device that has a key keeps it (the scheme renews it when due): asking again is harmless.
        if ((await http.AuthenticateAsync(DeviceKey.Scheme)).Succeeded)
        {
            return TypedResults.NoContent();
        }

        var now = clock.GetUtcNow();
        var key = RandomNumberGenerator.GetBytes(DeviceKeys.KeyBytes);
        db.Devices.Add(new Device { Id = Guid.CreateVersion7(now), KeyHash = DeviceKey.Hash(key), CreatedAt = now, LastSeenAt = now });
        await db.SaveChangesAsync(ct);
        DeviceKey.Write(http, app.Value, WebEncoders.Base64UrlEncode(key), now);
        return TypedResults.NoContent();
    }

    /// <summary>
    /// The device profile's server copy (ADR 0043). Its own device's copy again answers 200 and brings it up to date —
    /// its name (the name rules and the day's renames), its avatar, the terms accepted — so a lost answer never makes a
    /// second one. A new one: the proof-of-work when the console asks, the name filter, five per device, and an id no
    /// profile has nor ever had.
    /// </summary>
    private static async Task<Results<Ok<DeviceProfileView>, ProblemHttpResult>> RegisterAsync(
        DeviceProfileRegistration request,
        HttpContext http,
        ToheDbContext db,
        DeviceProfiles devices,
        ISignInSettings settings,
        ProofOfWork proofs,
        TimeProvider clock,
        IOptions<IdentityOptions> options,
        IEnumerable<IProfileNames> names,
        CancellationToken ct)
    {
        var deviceId = DeviceKey.DeviceOf(http.User)!.Value;
        if (!Consent.IsVersion(request.TermsVersion))
        {
            return TermsRequired();
        }

        if (!ProfileOptions.Avatars.Contains(request.Avatar))
        {
            return Problems.Of(StatusCodes.Status400BadRequest, "avatar_invalid", "Not one of the avatars");
        }

        var now = clock.GetUtcNow();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        // Serializes the device's profiles, so two requests cannot both pass the count of five.
        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM identity.devices WHERE id = {deviceId} FOR UPDATE", ct);
        if (await db.Profiles.FirstOrDefaultAsync(p => p.Id == request.Id && p.DeviceId == deviceId, ct) is { } own)
        {
            // The server's name stays when a moderator chose it, or when the day's renames are used up: the rest is taken,
            // and the answer carries the name the device keeps (ADR 0035, 0043).
            var renamed = own.Name;
            if (own.NameModeratedAt is null)
            {
                if (DeviceProfiles.CheckName(request.Name, out var asked) is { } refusedRename)
                {
                    return refusedRename;
                }

                if (asked != own.Name
                    && await ProfileEndpoints.RenamesTodayAsync(db, own.Id, now, ct) < options.Value.ProfileRenamesPerDay)
                {
                    renamed = asked;
                }
            }

            var newName = renamed != own.Name;
            own.Name = renamed;
            own.Avatar = request.Avatar;
            if (own.TermsVersion != request.TermsVersion)
            {
                own.TermsVersion = request.TermsVersion;
                own.TermsAcceptedAt = now;
            }

            own.LastUsedAt = now;
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            if (newName)
            {
                foreach (var table in names)
                {
                    await table.RenamedAsync(own.Id, own.Name, ct);
                }
            }

            return TypedResults.Ok(View(own));
        }

        // Before anything else costs the server a thing (ADR 0037).
        if (await settings.ProofOfWorkAsync(ct) && !proofs.Accepts(request.Proof))
        {
            return Problems.ProofOfWorkRequired();
        }

        if (DeviceProfiles.CheckName(request.Name, out var name) is { } refused)
        {
            return refused;
        }

        if (await db.Profiles.CountAsync(p => p.DeviceId == deviceId, ct) >= DeviceKeys.MaxProfilesPerDevice)
        {
            return Problems.Of(StatusCodes.Status409Conflict, "too_many_profiles", "A device keeps at most five device profiles on the server");
        }

        if (await devices.IdTakenAsync(request.Id, ct))
        {
            return DeviceProfiles.IdTaken();
        }

        var profile = new Profile
        {
            Id = request.Id,
            DeviceId = deviceId,
            Name = name,
            Avatar = request.Avatar,
            // A device profile has no age (ADR 0043): it is an adult's as far as games go, and an outsider to every
            // account — the children rule at tables reads that it has no account.
            Kind = ProfileKind.Adult,
            Invites = InviteScope.Account,
            CreatedAt = now,
            TermsVersion = request.TermsVersion,
            TermsAcceptedAt = now,
            LastUsedAt = now,
        };
        db.Profiles.Add(profile);

        // Another request took the same id at this very moment.
        if (!await devices.SaveAsync(ct))
        {
            return DeviceProfiles.IdTaken();
        }

        await transaction.CommitAsync(ct);
        return TypedResults.Ok(View(profile));
    }

    /// <summary>
    /// Deleting a device profile on the device deletes its server copy too (ADR 0043), through ADR 0034's deletion: it
    /// leaves its tables, the modules purge what they keep, its seats read "Người chơi đã xoá", and its id is retired.
    /// </summary>
    private static async Task<Results<NoContent, ProblemHttpResult>> DeleteAsync(
        Guid id, HttpContext http, ToheDbContext db, AccountDeletion deletion, CancellationToken ct)
    {
        var deviceId = DeviceKey.DeviceOf(http.User)!.Value;
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM identity.devices WHERE id = {deviceId} FOR UPDATE", ct);
        var profile = await db.Profiles.FirstOrDefaultAsync(p => p.Id == id && p.DeviceId == deviceId, ct);
        if (profile is null)
        {
            return DeviceProfileNotFound();
        }

        await deletion.DeleteProfileAsync(profile, ct);
        await transaction.CommitAsync(ct);
        return TypedResults.NoContent();
    }

    private static DeviceProfileView View(Profile profile) =>
        new(profile.Id, profile.Name, profile.Avatar, profile.TermsVersion ?? "");

    /// <summary>
    /// The device profile has accepted no terms, or not the version the hub shows (ADR 0043): the hub asks its player
    /// again, then sends the new version.
    /// </summary>
    public static ProblemHttpResult TermsRequired() =>
        Problems.Of(StatusCodes.Status412PreconditionFailed, "terms_required", "Accept the terms the hub shows first");

    /// <summary>
    /// No such device profile of this device on the server — never made, deleted, or cleaned up after 90 days unused: the
    /// hub gives it a new id and makes its server copy again (ADR 0043).
    /// </summary>
    public static ProblemHttpResult DeviceProfileNotFound() =>
        Problems.Of(StatusCodes.Status404NotFound, "device_profile_not_found", "This device has no such profile on the server");
}

/// <summary>A device profile acting at a table, as other modules see it (ADR 0043).</summary>
public sealed record DevicePlayer(Guid Id, Guid DeviceId, string Name, string Avatar);

/// <summary>The device profile a request acts as, or why it cannot: an HTTP status and a problem code.</summary>
public sealed record DevicePlayerLookup(DevicePlayer? Player, int Status = StatusCodes.Status200OK, string? Code = null);

/// <summary>Finds the device profile a request names, for its device alone, and checks its terms (ADR 0043).</summary>
public interface IDevicePlayers
{
    Task<DevicePlayerLookup> FindAsync(HttpContext http, CancellationToken ct);
}

internal sealed class DevicePlayers(ToheDbContext db, TimeProvider clock) : IDevicePlayers
{
    public async Task<DevicePlayerLookup> FindAsync(HttpContext http, CancellationToken ct)
    {
        if (DeviceKey.DeviceOf(http.User) is not { } deviceId || DeviceKey.NamedProfile(http) is not { } profileId)
        {
            return new DevicePlayerLookup(null, StatusCodes.Status403Forbidden, "profile_required");
        }

        // Only a profile of this device: the key never acts for another device's profile, nor for an account's.
        var profile = await db.Profiles.AsNoTracking()
            .Where(p => p.Id == profileId && p.DeviceId == deviceId)
            .Select(p => new { p.Id, p.Name, p.Avatar, p.TermsVersion, p.LastUsedAt })
            .FirstOrDefaultAsync(ct);
        if (profile is null)
        {
            return new DevicePlayerLookup(null, StatusCodes.Status404NotFound, "device_profile_not_found");
        }

        if (profile.TermsVersion is null || profile.TermsVersion != DeviceKey.Terms(http))
        {
            return new DevicePlayerLookup(null, StatusCodes.Status412PreconditionFailed, "terms_required");
        }

        var now = clock.GetUtcNow();
        if (profile.LastUsedAt is not { } used || now - used > DeviceKey.RenewAfter)
        {
            await db.Profiles.Where(p => p.Id == profile.Id)
                .ExecuteUpdateAsync(set => set.SetProperty(p => p.LastUsedAt, now), ct);
        }

        return new DevicePlayerLookup(new DevicePlayer(profile.Id, deviceId, profile.Name, profile.Avatar));
    }
}

/// <summary>The device key's numbers (ADR 0043).</summary>
public static class DeviceKeys
{
    /// <summary>A key is 32 random bytes.</summary>
    public const int KeyBytes = 32;

    /// <summary>Device profiles one device keeps on the server.</summary>
    public const int MaxProfilesPerDevice = 5;
}
