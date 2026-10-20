using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Identity;

/// <summary>A transfer code asked for by the device a device profile is on (ADR 0043).</summary>
/// <param name="TermsVersion">The terms the hub shows: the profile's player must have accepted these.</param>
/// <param name="Data">The profile's saves and scores, carried to the new device: at most 50 saves and 1 000 scores.</param>
public sealed record TransferStart([Required(AllowEmptyStrings = true)] string TermsVersion, DeviceProfileData? Data = null);

/// <summary>A new transfer code: the only time its digits and its secret are seen.</summary>
/// <param name="Code">Six digits, typed on the new device: the old device then confirms.</param>
/// <param name="Secret">For the QR code, or the link <c>/account/transfer#&lt;secret&gt;</c>: moves the profile at once.</param>
public sealed record TransferCodeView(string Code, string Secret, DateTimeOffset ExpiresAt);

/// <summary>The device profile's live code, as its old device sees it.</summary>
/// <param name="State"><c>open</c>, or <c>asked</c> once a new device typed its six digits.</param>
public sealed record TransferStatusView(string State, DateTimeOffset ExpiresAt);

/// <summary>The old device's answer to "Máy mới muốn nhận …?".</summary>
public sealed record TransferAnswer(bool Accept);

/// <summary>A transfer code redeemed on the new device: its secret, or its six digits.</summary>
/// <param name="Proof">The answer to a challenge from <c>GET /api/auth/challenge</c>, when the console asks for one (ADR 0037).</param>
public sealed record TransferRedemption(string? Secret = null, string? Code = null, ProofOfWorkSolution? Proof = null);

/// <summary>A transfer as the device that redeemed it sees it (ADR 0043).</summary>
/// <param name="State"><c>asked</c> (the old device is asked), <c>done</c>, <c>declined</c>, <c>full</c> (this device had
/// five profiles by the time the old one said yes) or <c>expired</c>.</param>
/// <param name="Profile">Once done: the device profile, now this device's.</param>
/// <param name="Data">Once done: its saves and scores.</param>
public sealed record TransferView(Guid Id, string State, DeviceProfileView? Profile = null, DeviceProfileData? Data = null);

/// <summary>A device profile that moved away from this device with a transfer code.</summary>
public sealed record ProfileMoveView(Guid ProfileId, DateTimeOffset MovedAt);

/// <summary>
/// The transfer code (ADR 0043, step I2b): a device profile on the server moves to another device with its id, saves and
/// scores. The six digits are a question to the old device; only the QR code's secret moves it at once. Every route
/// needs the device key, and only it.
/// </summary>
internal static class TransferEndpoints
{
    /// <summary>Saves and scores kept with a code, as JSON.</summary>
    private static readonly JsonSerializerOptions Json = JsonSerializerOptions.Web;

    public static void Map(IEndpointRouteBuilder api)
    {
        var profiles = api.MapGroup("/devices/profiles/{id:guid}/transfer")
            .WithTags("Identity")
            .RequireAuthorization(DeviceEndpoints.DevicePolicy)
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        profiles.MapPost("/", StartAsync)
            .RequireRateLimiting(IdentityModule.DeviceRateLimit)
            .WithName("StartTransfer")
            .WithSummary("A transfer code for this device's profile, with its saves and scores: six digits and a secret, ten minutes, replacing any before.");

        profiles.MapGet("/", StatusAsync)
            .WithName("GetTransfer")
            .WithSummary("The profile's live code: open, or asked once a new device typed its six digits; 410 device_profile_moved once it moved.");

        profiles.MapPost("/confirm", ConfirmAsync)
            .WithName("ConfirmTransfer")
            .WithSummary("The old device's answer to six typed digits: yes moves the profile now, no ends the code.");

        profiles.MapDelete("/", CancelAsync)
            .WithName("CancelTransfer")
            .WithSummary("Cancel the profile's code.");

        var transfers = api.MapGroup("/devices")
            .WithTags("Identity")
            .RequireAuthorization(DeviceEndpoints.DevicePolicy)
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        // The auth-code bucket: every redemption counts against the address, a wrong one too.
        transfers.MapPost("/transfers/redeem", RedeemAsync)
            .RequireRateLimiting(IdentityModule.CodeRateLimit)
            .WithName("RedeemTransfer")
            .WithSummary("Redeem a transfer code on this device: the secret moves the profile at once, six digits ask the old device first.");

        transfers.MapGet("/transfers", ListAsync)
            .WithName("ListRedeemedTransfers")
            .WithSummary("The transfers this device redeemed, newest first, while their answer is kept: a lost answer is read here.");

        transfers.MapGet("/transfers/{id:guid}", GetAsync)
            .WithName("GetRedeemedTransfer")
            .WithSummary("A transfer this device redeemed: asked, done (with the profile, its saves and scores), declined or expired.");

        transfers.MapGet("/moves", MovesAsync)
            .WithName("ListProfileMoves")
            .WithSummary("This device's profiles that moved to another device with a transfer code.");
    }

    /// <summary>
    /// A code for one of this device's profiles (ADR 0043), whose player accepted the terms the hub shows. The saves and
    /// scores come with it and wait for the new device. Six digits no other live code has, a secret of 32 random bytes;
    /// both hashed. A code made before for the profile goes.
    /// </summary>
    private static async Task<Results<Ok<TransferCodeView>, ProblemHttpResult>> StartAsync(
        Guid id, TransferStart request, HttpContext http, ToheDbContext db, DeviceProfiles devices, TimeProvider clock, CancellationToken ct)
    {
        var deviceId = DeviceKey.DeviceOf(http.User)!.Value;
        if (devices.CheckData(request.Data) is { } invalid)
        {
            return invalid;
        }

        var now = clock.GetUtcNow();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await LockDevicesAsync(db, [deviceId], ct);
        var profile = await db.Profiles.FirstOrDefaultAsync(p => p.Id == id && p.DeviceId == deviceId, ct);
        if (profile is null)
        {
            return await GoneAsync(db, deviceId, id, ct);
        }

        if (profile.TermsVersion is null || profile.TermsVersion != request.TermsVersion)
        {
            return DeviceEndpoints.TermsRequired();
        }

        // One code per profile; and codes past their answer's time go, whoever's.
        var stale = now - TransferCodes.Grace;
        await db.ProfileTransfers.Where(t => t.ProfileId == id || t.ExpiresAt < stale).ExecuteDeleteAsync(ct);

        // At most 1 MB a code, and 2 MB of live codes a device: the hub sends what fits, newest saves first, and keeps the
        // rest on the old device.
        var data = JsonSerializer.Serialize(request.Data ?? new DeviceProfileData(), Json);
        var bytes = Encoding.UTF8.GetByteCount(data);
        var others = await db.Database
            .SqlQuery<long>($"""
                SELECT COALESCE(SUM(octet_length(data::text)), 0)::bigint AS "Value"
                FROM identity.profile_transfers
                WHERE from_device_id = {deviceId} AND expires_at > {stale}
                """)
            .SingleAsync(ct);
        if (bytes > TransferCodes.MaxDataBytes || others + bytes > TransferCodes.MaxDeviceBytes)
        {
            return Problems.Of(StatusCodes.Status400BadRequest, "upload_too_large", "Too many saves or scores for one transfer code");
        }

        var transferId = Guid.CreateVersion7(now);
        var live = await LiveCodesAsync(db, now, ct);
        var code = TransferCodes.NewCode();
        for (var attempt = 0; attempt < 20 && live.Any(other => TransferCodes.Matches(other, code)); attempt++)
        {
            code = TransferCodes.NewCode();
        }

        var secret = RandomNumberGenerator.GetBytes(TransferCodes.SecretBytes);
        var transfer = new ProfileTransfer
        {
            Id = transferId,
            ProfileId = id,
            FromDeviceId = deviceId,
            CodeHash = TransferCodes.HashCode(transferId, code),
            SecretHash = TransferCodes.HashSecret(secret),
            Data = data,
            State = TransferState.Open,
            CreatedAt = now,
            ExpiresAt = now + TransferCodes.Lifetime,
        };
        db.ProfileTransfers.Add(transfer);
        profile.LastUsedAt = now;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return TypedResults.Ok(new TransferCodeView(code, WebEncoders.Base64UrlEncode(secret), transfer.ExpiresAt));
    }

    /// <summary>The profile's live code, as the old device polls it while its screen is open.</summary>
    private static async Task<Results<Ok<TransferStatusView>, ProblemHttpResult>> StatusAsync(
        Guid id, HttpContext http, ToheDbContext db, TimeProvider clock, CancellationToken ct)
    {
        var deviceId = DeviceKey.DeviceOf(http.User)!.Value;
        if (!await db.Profiles.AnyAsync(p => p.Id == id && p.DeviceId == deviceId, ct))
        {
            return await GoneAsync(db, deviceId, id, ct);
        }

        var now = clock.GetUtcNow();
        var transfer = await db.ProfileTransfers.AsNoTracking()
            .Where(t => t.ProfileId == id && t.FromDeviceId == deviceId && t.ExpiresAt > now
                && (t.State == TransferState.Open || t.State == TransferState.Asked))
            .FirstOrDefaultAsync(ct);
        return transfer is null
            ? TransferNotFound()
            : TypedResults.Ok(new TransferStatusView(StateName(transfer.State), transfer.ExpiresAt));
    }

    /// <summary>
    /// The old device answers six typed digits: yes moves the profile to the device that typed them, now; no ends the
    /// code. Only an asked code of this device's profile, within its ten minutes.
    /// </summary>
    private static async Task<Results<NoContent, ProblemHttpResult>> ConfirmAsync(
        Guid id,
        TransferAnswer request,
        HttpContext http,
        ToheDbContext db,
        IEnumerable<IProfileData> modules,
        TimeProvider clock,
        CancellationToken ct)
    {
        var deviceId = DeviceKey.DeviceOf(http.User)!.Value;
        var now = clock.GetUtcNow();
        var asked = await db.ProfileTransfers.AsNoTracking()
            .Where(t => t.ProfileId == id && t.FromDeviceId == deviceId && t.State == TransferState.Asked && t.ExpiresAt > now)
            .Select(t => new { t.Id, t.ToDeviceId })
            .FirstOrDefaultAsync(ct);
        if (asked?.ToDeviceId is not { } newDevice)
        {
            return await db.Profiles.AnyAsync(p => p.Id == id && p.DeviceId == deviceId, ct)
                ? TransferNotFound()
                : await GoneAsync(db, deviceId, id, ct);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await LockDevicesAsync(db, [deviceId, newDevice], ct);
        var transfer = await LockTransferAsync(db, asked.Id, ct);
        if (transfer is not { State: TransferState.Asked } || transfer.ExpiresAt <= now || transfer.ToDeviceId != newDevice)
        {
            return TransferNotFound();
        }

        if (!request.Accept)
        {
            transfer.State = TransferState.Declined;
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return TypedResults.NoContent();
        }

        var refused = await MoveAsync(db, modules, transfer, newDevice, now, ct);
        if (refused is not null && transfer.State == TransferState.Asked)
        {
            // The new device filled up before the yes: the code ends, and the new device hears why.
            transfer.State = TransferState.Full;
        }

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        if (refused is not null)
        {
            return refused;
        }

        return TypedResults.NoContent();
    }

    /// <summary>The player left the code's screen: an open code goes, an asked one is declined.</summary>
    private static async Task<NoContent> CancelAsync(Guid id, HttpContext http, ToheDbContext db, CancellationToken ct)
    {
        var deviceId = DeviceKey.DeviceOf(http.User)!.Value;
        await db.ProfileTransfers
            .Where(t => t.ProfileId == id && t.FromDeviceId == deviceId && t.State == TransferState.Open)
            .ExecuteDeleteAsync(ct);
        await db.ProfileTransfers
            .Where(t => t.ProfileId == id && t.FromDeviceId == deviceId && t.State == TransferState.Asked)
            .ExecuteUpdateAsync(set => set.SetProperty(t => t.State, TransferState.Declined).SetProperty(t => t.CodeHash, (string?)null), ct);
        return TypedResults.NoContent();
    }

    /// <summary>
    /// A code redeemed on this device (ADR 0043). The proof-of-work first, when the console asks; then the secret moves
    /// the profile at once, or six digits make the old device asked. Wrong digits are counted for the address
    /// (<c>Identity:TransferCodeMissesPerAddressPerHour</c>, past which it hears <c>429 transfer_limit</c>) and for the
    /// whole server (<c>Identity:TransferCodeMissesPerHour</c>, past which digits take a proof-of-work, whatever the
    /// console says): one source can neither guess on nor shut the digits for everyone. A right code gives its slots
    /// back. Under the transfer's lock, an open code within its ten minutes, of a profile still its device's: anything
    /// else is the same <c>404 transfer_invalid</c>. The same device asking again with the same secret hears its answer
    /// again.
    /// </summary>
    private static async Task<Results<Ok<TransferView>, ProblemHttpResult>> RedeemAsync(
        TransferRedemption request,
        HttpContext http,
        ToheDbContext db,
        ISignInSettings settings,
        ProofOfWork proofs,
        TransferMisses misses,
        IEnumerable<IProfileData> modules,
        IOptions<IdentityOptions> options,
        TimeProvider clock,
        CancellationToken ct)
    {
        var deviceId = DeviceKey.DeviceOf(http.User)!.Value;
        var proven = false;
        if (await settings.ProofOfWorkAsync(ct))
        {
            if (!proofs.Accepts(request.Proof))
            {
                return Problems.ProofOfWorkRequired();
            }

            proven = true;
        }

        var now = clock.GetUtcNow();
        var bySecret = !string.IsNullOrEmpty(request.Secret);
        Guid? found;
        if (bySecret)
        {
            found = SecretHash(request.Secret!) is { } hash
                ? await db.ProfileTransfers.Where(t => t.SecretHash == hash).Select(t => (Guid?)t.Id).FirstOrDefaultAsync(ct)
                : null;
        }
        else
        {
            if (TransferCodes.Digits(request.Code) is not { } digits)
            {
                return TransferInvalid();
            }

            // Each slot is taken before the code is looked at, and given back when it was right.
            var address = TransferMisses.AddressOf(http.Connection.RemoteIpAddress);
            if (!misses.TryTake(address, options.Value.TransferCodeMissesPerAddressPerHour))
            {
                return Problems.Of(StatusCodes.Status429TooManyRequests, "transfer_limit", "Too many wrong transfer codes from here this hour; use the QR code");
            }

            var everyone = misses.TryTake(TransferMisses.Everyone, options.Value.TransferCodeMissesPerHour);
            if (!everyone && !proven && !proofs.Accepts(request.Proof))
            {
                misses.GiveBack(address);
                return Problems.ProofOfWorkRequired();
            }

            found = (await LiveCodesAsync(db, now, ct)).FirstOrDefault(live => TransferCodes.Matches(live, digits))?.Id;
            if (found is not null)
            {
                misses.GiveBack(address);
                if (everyone)
                {
                    misses.GiveBack(TransferMisses.Everyone);
                }
            }
        }

        if (found is not { } transferId
            || await db.ProfileTransfers.AsNoTracking().Where(t => t.Id == transferId).Select(t => (Guid?)t.FromDeviceId).FirstOrDefaultAsync(ct) is not { } fromDevice)
        {
            return TransferInvalid();
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await LockDevicesAsync(db, [fromDevice, deviceId], ct);
        var transfer = await LockTransferAsync(db, transferId, ct);
        if (transfer is null)
        {
            return TransferInvalid();
        }

        // This device redeemed it already, and its answer was lost: the answer again. The secret also settles a code
        // this device typed and the old device has not answered yet.
        if (transfer.ToDeviceId == deviceId && now < transfer.KeepUntil)
        {
            if (!(bySecret && transfer.State == TransferState.Asked && now < transfer.ExpiresAt))
            {
                return TypedResults.Ok(await ViewAsync(db, transfer, now, ct));
            }
        }
        else if (transfer.State != TransferState.Open || now >= transfer.ExpiresAt)
        {
            return TransferInvalid();
        }

        if (transfer.FromDeviceId == deviceId)
        {
            return Problems.Of(StatusCodes.Status409Conflict, "transfer_same_device", "This is the device the profile is on");
        }

        if (bySecret)
        {
            if (await MoveAsync(db, modules, transfer, deviceId, now, ct) is { } refused)
            {
                // Nothing moved: the profile went meanwhile (its code with it), or this device is full and may try again.
                await db.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);
                return refused;
            }
        }
        else
        {
            if (await db.Profiles.CountAsync(p => p.DeviceId == deviceId, ct) >= DeviceKeys.MaxProfilesPerDevice)
            {
                return TooManyProfiles();
            }

            // The six digits are used up now, whatever the old device answers.
            transfer.State = TransferState.Asked;
            transfer.ToDeviceId = deviceId;
            transfer.CodeHash = null;
        }

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return TypedResults.Ok(await ViewAsync(db, transfer, now, ct));
    }

    /// <summary>A transfer this device redeemed, until ten minutes after its code ended.</summary>
    private static async Task<Results<Ok<TransferView>, ProblemHttpResult>> GetAsync(
        Guid id, HttpContext http, ToheDbContext db, TimeProvider clock, CancellationToken ct)
    {
        var deviceId = DeviceKey.DeviceOf(http.User)!.Value;
        var now = clock.GetUtcNow();
        var kept = now - TransferCodes.Grace;
        var transfer = await db.ProfileTransfers.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id && t.ToDeviceId == deviceId && t.ExpiresAt > kept, ct);
        return transfer is null ? TransferNotFound() : TypedResults.Ok(await ViewAsync(db, transfer, now, ct));
    }

    /// <summary>
    /// The transfers this device redeemed, while their answer is kept: the hub that lost the answer to six digits — the
    /// app closed, the network gone — finds its transfer here, and the profile and data once it is done.
    /// </summary>
    private static async Task<Ok<List<TransferView>>> ListAsync(HttpContext http, ToheDbContext db, TimeProvider clock, CancellationToken ct)
    {
        var deviceId = DeviceKey.DeviceOf(http.User)!.Value;
        var now = clock.GetUtcNow();
        var kept = now - TransferCodes.Grace;
        var transfers = await db.ProfileTransfers.AsNoTracking()
            .Where(t => t.ToDeviceId == deviceId && t.ExpiresAt > kept)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(ct);
        var views = new List<TransferView>();
        foreach (var transfer in transfers)
        {
            views.Add(await ViewAsync(db, transfer, now, ct));
        }

        return TypedResults.Ok(views);
    }

    /// <summary>This device's profiles that moved away: the hub keeps what it played since as new device profiles.</summary>
    private static async Task<Ok<List<ProfileMoveView>>> MovesAsync(HttpContext http, ToheDbContext db, CancellationToken ct)
    {
        var deviceId = DeviceKey.DeviceOf(http.User)!.Value;
        return TypedResults.Ok(await db.ProfileMoves.AsNoTracking()
            .Where(move => move.DeviceId == deviceId)
            .OrderBy(move => move.MovedAt)
            .Select(move => new ProfileMoveView(move.ProfileId, move.MovedAt))
            .ToListAsync(ct));
    }

    /// <summary>
    /// The move, within the caller's transaction, both devices' rows held (ADR 0043): the profile — still the old
    /// device's — leaves its tables (a bot finishes a hand), becomes the new device's, and the old device is noted as one
    /// it left; the transfer is done. Null when it moved; otherwise why not, and nothing moved.
    /// </summary>
    private static async Task<ProblemHttpResult?> MoveAsync(
        ToheDbContext db, IEnumerable<IProfileData> modules, ProfileTransfer transfer, Guid newDevice, DateTimeOffset now, CancellationToken ct)
    {
        var profile = await db.Profiles.FirstOrDefaultAsync(p => p.Id == transfer.ProfileId, ct);
        if (profile is null || profile.DeviceId != transfer.FromDeviceId)
        {
            // Brought into an account, or moved, meanwhile: the code was its device profile's, and ends.
            db.ProfileTransfers.Remove(transfer);
            return TransferInvalid();
        }

        if (await db.Profiles.CountAsync(p => p.DeviceId == newDevice, ct) >= DeviceKeys.MaxProfilesPerDevice)
        {
            return TooManyProfiles();
        }

        foreach (var module in modules)
        {
            await module.WithdrawAsync([profile.Id], ct);
        }

        profile.DeviceId = newDevice;
        profile.LastUsedAt = now;
        // The old device is told; a device it comes back to is not.
        await db.ProfileMoves
            .Where(move => move.ProfileId == profile.Id && (move.DeviceId == transfer.FromDeviceId || move.DeviceId == newDevice))
            .ExecuteDeleteAsync(ct);
        db.ProfileMoves.Add(new ProfileMove { DeviceId = transfer.FromDeviceId, ProfileId = profile.Id, MovedAt = now });
        transfer.State = TransferState.Done;
        transfer.ToDeviceId = newDevice;
        transfer.CodeHash = null;
        transfer.DoneAt = now;
        return null;
    }

    private static async Task<TransferView> ViewAsync(ToheDbContext db, ProfileTransfer transfer, DateTimeOffset now, CancellationToken ct)
    {
        if (transfer.State != TransferState.Done)
        {
            var state = transfer.State == TransferState.Asked && now >= transfer.ExpiresAt ? "expired" : StateName(transfer.State);
            return new TransferView(transfer.Id, state);
        }

        var profile = await db.Profiles.AsNoTracking()
            .Where(p => p.Id == transfer.ProfileId)
            .Select(p => new DeviceProfileView(p.Id, p.Name, p.Avatar, p.TermsVersion ?? ""))
            .FirstOrDefaultAsync(ct);
        return new TransferView(
            transfer.Id, StateName(transfer.State), profile, JsonSerializer.Deserialize<DeviceProfileData>(transfer.Data, Json));
    }

    private static string StateName(TransferState state) => state.ToString().ToLowerInvariant();

    /// <summary>The live codes' ids and hashes, to find the one six digits belong to: a handful at any time.</summary>
    private static async Task<List<ProfileTransferCode>> LiveCodesAsync(ToheDbContext db, DateTimeOffset now, CancellationToken ct) =>
        await db.ProfileTransfers.AsNoTracking()
            .Where(t => t.State == TransferState.Open && t.CodeHash != null && t.ExpiresAt > now)
            .Select(t => new ProfileTransferCode(t.Id, t.CodeHash!))
            .ToListAsync(ct);

    /// <summary>The secret's hash, or null when it is not one: 32 bytes, base64url.</summary>
    private static byte[]? SecretHash(string secret)
    {
        try
        {
            var bytes = WebEncoders.Base64UrlDecode(secret.Trim());
            return bytes.Length == TransferCodes.SecretBytes ? TransferCodes.HashSecret(bytes) : null;
        }
        catch (FormatException)
        {
            return null;
        }
    }

    /// <summary>
    /// The devices' rows, in one order, as every change to a device's profiles takes them (DeviceEndpoints): a move takes
    /// both, so the count of five holds on the new one and nothing else changes the profile on the old one meanwhile.
    /// </summary>
    private static async Task LockDevicesAsync(ToheDbContext db, IEnumerable<Guid> devices, CancellationToken ct)
    {
        foreach (var device in devices.Distinct().Order())
        {
            await db.Database.ExecuteSqlAsync($"SELECT 1 FROM identity.devices WHERE id = {device} FOR UPDATE", ct);
        }
    }

    /// <summary>The transfer's row, held until the transaction ends: a code is used once, however many ask at once.</summary>
    private static async Task<ProfileTransfer?> LockTransferAsync(ToheDbContext db, Guid id, CancellationToken ct)
    {
        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM identity.profile_transfers WHERE id = {id} FOR UPDATE", ct);
        var transfer = await db.ProfileTransfers.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (transfer is not null)
        {
            await db.Entry(transfer).ReloadAsync(ct);
        }

        return transfer;
    }

    /// <summary>The profile is not this device's: moved to another (<c>410</c>), or gone.</summary>
    private static async Task<ProblemHttpResult> GoneAsync(ToheDbContext db, Guid deviceId, Guid profileId, CancellationToken ct) =>
        await MovedAwayAsync(db, deviceId, profileId, ct) ? DeviceProfileMoved() : DeviceEndpoints.DeviceProfileNotFound();

    /// <summary>The profile moved away from this device with a transfer code.</summary>
    public static Task<bool> MovedAwayAsync(ToheDbContext db, Guid deviceId, Guid profileId, CancellationToken ct) =>
        db.ProfileMoves.AnyAsync(move => move.DeviceId == deviceId && move.ProfileId == profileId, ct);

    /// <summary>
    /// The device profile moved to another device with a transfer code (ADR 0043): this device's key speaks for it no
    /// more. The hub keeps what was played here since as a new device profile.
    /// </summary>
    public static ProblemHttpResult DeviceProfileMoved() =>
        Problems.Of(StatusCodes.Status410Gone, "device_profile_moved", "This profile moved to another device");

    /// <summary>No such code: never made, typed wrong, used, expired, declined or cancelled — one answer for all.</summary>
    private static ProblemHttpResult TransferInvalid() =>
        Problems.Of(StatusCodes.Status404NotFound, "transfer_invalid", "This transfer code does not work");

    private static ProblemHttpResult TransferNotFound() =>
        Problems.Of(StatusCodes.Status404NotFound, "transfer_not_found", "No such transfer");

    private static ProblemHttpResult TooManyProfiles() =>
        Problems.Of(StatusCodes.Status409Conflict, "too_many_profiles", "A device keeps at most five device profiles on the server");
}
