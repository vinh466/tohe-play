using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Identity;

/// <summary>A game's save as a device profile kept it on the device (ADR 0043).</summary>
/// <param name="Data">The game's own JSON, at most 64 KB (the Game Contract's limit).</param>
/// <param name="UpdatedAt">When the device saved it, by its clock: a merge compares it with the server's save.</param>
public sealed record DeviceSave([Required, StringLength(40)] string GameId, JsonElement Data, DateTimeOffset UpdatedAt);

/// <summary>A run a device profile played on the device, as the hub records it.</summary>
/// <param name="ClientId">Chosen by the device when the run was recorded.</param>
/// <param name="AchievedAt">When the run was reached, by the device's clock.</param>
/// <param name="Final">False for a long run still going on (ADR 0014).</param>
public sealed record DeviceScore(
    Guid ClientId,
    [Required, StringLength(40)] string GameId,
    [Required, StringLength(40)] string Board,
    double Value,
    DateTimeOffset AchievedAt,
    bool Final = true);

/// <summary>
/// What a device profile played: its saves and scores, sent once, with the request that brings it into an account
/// (ADR 0043). At most <see cref="DeviceProfiles.MaxSaves"/> saves and <see cref="DeviceProfiles.MaxScores"/> scores.
/// </summary>
public sealed record DeviceProfileData(IReadOnlyList<DeviceSave>? Saves = null, IReadOnlyList<DeviceScore>? Scores = null)
{
    public IReadOnlyList<DeviceSave> AllSaves() => Saves ?? [];

    public IReadOnlyList<DeviceScore> AllScores() => Scores ?? [];
}

/// <summary>A device profile brought into an account (ADR 0043): its id, its name and avatar, and what it played.</summary>
/// <param name="Id">The id the device gave it. Taken only if no profile has it, nor ever had it.</param>
/// <param name="Name">Goes through the name rules and the filter (ADR 0023, 0035).</param>
/// <param name="AgeBand">A child's profile, with this age band (ADR 0025's child template); none for an adult's.</param>
public sealed record DeviceProfileUpload(
    Guid Id,
    [Required(AllowEmptyStrings = true)] string Name,
    [Required] string Avatar,
    string? AgeBand = null,
    DeviceProfileData? Data = null);

/// <summary>A device profile merged into one of the account's profiles (ADR 0043, step I1: no alias yet).</summary>
/// <param name="Name">The device profile's name: it goes into the target's name history, once it passes the name rules.</param>
public sealed record MergeProfileRequest([Required(AllowEmptyStrings = true)] string Name, DeviceProfileData? Data = null);

/// <summary>
/// Stores what a device profile played under a profile of an account (ADR 0043), within the caller's unit of work:
/// saves — the newer wins when the profile has one too — and scores, marked as earned by a device profile. Implemented by
/// the module that owns saves and scores.
/// </summary>
public interface IDeviceProgress
{
    /// <summary>Why the data cannot be taken — a game id, a save too large, a score that is no number — or null.</summary>
    string? Refusal(DeviceProfileData data);

    Task ImportAsync(Guid profileId, Guid accountId, DeviceProfileData data, CancellationToken ct);
}

/// <summary>
/// Bringing device profiles into accounts (ADR 0043, step I1): the checks every way in shares — on signing up, by email
/// or with a provider, and from a signed-in device — and the profile it becomes.
/// </summary>
internal sealed class DeviceProfiles(ToheDbContext db, IDeviceProgress progress)
{
    /// <summary>Saves one request may carry: one per game, with room to spare.</summary>
    public const int MaxSaves = 50;

    /// <summary>Scores one request may carry: the hub sends each board's best first.</summary>
    public const int MaxScores = 1000;

    /// <summary>
    /// True when the server cannot take this id: a profile has it, or had it and was deleted (ADR 0034). Aliases join
    /// these with step I2. Profile ids are not secrets, so the answer tells nothing worth hiding.
    /// </summary>
    public async Task<bool> IdTakenAsync(Guid id, CancellationToken ct) =>
        id == Guid.Empty
        || await db.Profiles.AnyAsync(profile => profile.Id == id, ct)
        || await db.RetiredProfileIds.AnyAsync(retired => retired.ProfileId == id, ct);

    /// <summary>Everything of a device profile but its id, checked before anything is made; null when it may come in.</summary>
    public ProblemHttpResult? Check(DeviceProfileUpload upload, out string name)
    {
        if (CheckName(upload.Name, out name) is { } refused)
        {
            return refused;
        }

        if (!ProfileOptions.Avatars.Contains(upload.Avatar))
        {
            return Problems.Of(StatusCodes.Status400BadRequest, "avatar_invalid", "Not one of the avatars");
        }

        if (upload.AgeBand is not null && !ProfileOptions.AgeBands.Contains(upload.AgeBand))
        {
            return Problems.Of(StatusCodes.Status400BadRequest, "age_band_invalid", "Not one of the age bands");
        }

        return CheckData(upload.Data);
    }

    /// <summary>
    /// The name rules and the filter (ADR 0023, 0035): a refused name is changed on the device first, so the answer is
    /// one code, <c>name_refused</c>, with the rule that refused it in <c>reason</c>.
    /// </summary>
    public static ProblemHttpResult? CheckName(string? input, out string name)
    {
        if (ProfileNames.TryNormalize(input, out name, out var rule))
        {
            return null;
        }

        return TypedResults.Problem(
            title: "Rename the profile first",
            statusCode: StatusCodes.Status422UnprocessableEntity,
            extensions: new Dictionary<string, object?> { ["code"] = "name_refused", ["reason"] = rule });
    }

    public ProblemHttpResult? CheckData(DeviceProfileData? data)
    {
        if (data is null)
        {
            return null;
        }

        if (data.AllSaves().Count > MaxSaves || data.AllScores().Count > MaxScores)
        {
            return Problems.Of(StatusCodes.Status400BadRequest, "upload_too_large", "Too many saves or scores in one request");
        }

        return progress.Refusal(data) is { } code
            ? Problems.Of(StatusCodes.Status400BadRequest, code, "A save or a score cannot be taken")
            : null;
    }

    /// <summary>
    /// The account's profile the device profile becomes, keeping its id: an adult's profile — on public boards, asked to
    /// tables by anyone — or, with an age band, a child's, kept to its account (ADR 0023, 0025, 0033). Its 12-digit ID is
    /// given now. Added to the caller's unit of work.
    /// </summary>
    public async Task<Profile> AddAsync(Guid accountId, DeviceProfileUpload upload, string name, DateTimeOffset now, CancellationToken ct)
    {
        var child = upload.AgeBand is not null;
        var profile = new Profile
        {
            Id = upload.Id,
            AccountId = accountId,
            PublicId = await ProfileEndpoints.NewPublicIdAsync(db, ct),
            Name = name,
            Avatar = upload.Avatar,
            Kind = child ? ProfileKind.Child : ProfileKind.Adult,
            AgeBand = upload.AgeBand,
            OnPublicBoards = !child,
            Invites = child ? InviteScope.Account : InviteScope.Anyone,
            CreatedAt = now,
        };
        db.Profiles.Add(profile);
        return profile;
    }

    /// <summary>
    /// The device profile a sign-up brings in: the one sent with its last step, when it is the one that started it — so a
    /// link opened on another device makes the account the usual way (ADR 0043).
    /// </summary>
    public static DeviceProfileUpload? Of(AuthAttempt attempt, DeviceProfileUpload? sent) =>
        sent is not null && attempt.DeviceProfileId == sent.Id ? sent : null;

    /// <summary>
    /// A new account's first profile (ADR 0023), added with what it played to the caller's unit of work: the device
    /// profile itself when it is the person's own (no age band), keeping its id; otherwise the usual adult profile
    /// named <paramref name="displayName"/>, with the device profile as a child's beside it when there is one (ADR 0043).
    /// </summary>
    public async Task<Profile> FirstProfileAsync(
        Account account, string displayName, DeviceProfileUpload? device, string deviceName, DateTimeOffset now, CancellationToken ct)
    {
        if (device is { AgeBand: null })
        {
            var own = await AddAsync(account.Id, device, deviceName, now, ct);
            await ImportAsync(own.Id, account.Id, device.Data, ct);
            return own;
        }

        var first = new Profile
        {
            Id = Guid.CreateVersion7(now),
            AccountId = account.Id,
            PublicId = await ProfileEndpoints.NewPublicIdAsync(db, ct),
            Name = displayName,
            Avatar = ProfileOptions.Avatars[0],
            Kind = ProfileKind.Adult,
            // An adult's profile is on public boards from the start (ADR 0029); they switch it off in its settings.
            OnPublicBoards = true,
            CreatedAt = now,
        };
        db.Profiles.Add(first);
        if (device is not null)
        {
            // Made a moment later, so the account's own profile stays the first in its list.
            var child = await AddAsync(account.Id, device, deviceName, now.AddTicks(10), ct);
            await ImportAsync(child.Id, account.Id, device.Data, ct);
        }

        return first;
    }

    /// <summary>What the device profile played goes up under <paramref name="profileId"/>, marked as a device's.</summary>
    public Task ImportAsync(Guid profileId, Guid accountId, DeviceProfileData? data, CancellationToken ct) =>
        data is null ? Task.CompletedTask : progress.ImportAsync(profileId, accountId, data, ct);

    public static ProblemHttpResult IdTaken() =>
        Problems.Of(StatusCodes.Status409Conflict, "id_taken", "That profile id is taken: give the device profile a new one");
}
