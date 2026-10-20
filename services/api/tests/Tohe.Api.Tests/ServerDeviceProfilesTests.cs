using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Registry;
using Tohe.Api.Modules.Rooms;

namespace Tohe.Api.Tests;

/// <summary>
/// Device profiles on the server (ADR 0043, step I2a): the device key and its scheme, kept apart from the account's
/// session both ways; a device profile's server copy and its id rules; the terms line; tables open to `named` device
/// profiles, the children rule and the mark on their results; bringing one into an account; deleting it, and the
/// 90-day cleanup.
/// </summary>
public sealed class ServerDeviceProfilesTests(ApiFactory factory) : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private const string Terms = "2026-10-20";
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        var dist = FindGameBuild();
        var manifest = File.ReadAllText(Path.Combine(dist, "game.json"));
        var version = JsonNode.Parse(manifest)!["version"]!.GetValue<string>();
        factory.Catalog.Json = $$"""
            { "generatedAt": "2026-10-16T00:00:00Z",
              "games": [{ "manifest": {{manifest}}, "path": "tien-len/{{version}}/", "sizeKb": 1442 }] }
            """;
        factory.Catalog.Files[$"/tien-len/{version}/rules.js"] = File.ReadAllText(Path.Combine(dist, "rules.js"));
        await using var scope = factory.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<CatalogSync>().RunAsync(Ct);
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;

    // ------------------------------------------------------------------ the device key

    [Fact]
    public async Task The_device_key_is_an_http_only_lax_cookie_for_90_days_made_once()
    {
        var phone = NewPhone();
        var started = await phone.Client.PostAsync(Url("/api/devices"), null, Ct);
        Assert.Equal(HttpStatusCode.NoContent, started.StatusCode);
        var cookie = Assert.Single(started.Headers.GetValues("Set-Cookie"));
        Assert.StartsWith("tohe.device=", cookie, StringComparison.Ordinal);
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("secure", cookie, StringComparison.OrdinalIgnoreCase);
        var expires = DateTimeOffset.Parse(cookie.Split("expires=", StringSplitOptions.None)[1].Split(';')[0], System.Globalization.CultureInfo.InvariantCulture);
        Assert.InRange(expires, DateTimeOffset.UtcNow.AddDays(89), DateTimeOffset.UtcNow.AddDays(91));

        // A device that has its key keeps it: asking again makes nothing new.
        var devices = await CountAsync(db => db.Devices.CountAsync(Ct));
        var again = await phone.Client.PostAsync(Url("/api/devices"), null, Ct);
        Assert.Equal(HttpStatusCode.NoContent, again.StatusCode);
        Assert.False(again.Headers.Contains("Set-Cookie"));
        Assert.Equal(devices, await CountAsync(db => db.Devices.CountAsync(Ct)));
    }

    [Fact]
    public async Task Behind_an_https_hub_the_device_key_is_secure_and_locked_to_the_host()
    {
        await using var https = factory.WithWebHostBuilder(builder => builder.UseSetting("App:PublicUrl", "https://tohe.example.test"));
        var client = https.CreateClient(new() { BaseAddress = new Uri("https://tohe.example.test") });
        var started = await client.PostAsync(Url("/api/devices"), null, Ct);
        Assert.Equal(HttpStatusCode.NoContent, started.StatusCode);
        var cookie = Assert.Single(started.Headers.GetValues("Set-Cookie"));
        Assert.StartsWith("__Host-tohe.device=", cookie, StringComparison.Ordinal);
        Assert.Contains("secure", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("domain=", cookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task The_device_key_never_acts_for_an_account_nor_an_account_session_for_a_device_profile()
    {
        // The device key alone: no account endpoint, no account's profile.
        var phone = await DevicePhoneAsync("Mèo Cam");
        Assert.Equal(HttpStatusCode.NoContent, (await phone.Plain.GetAsync(Url("/api/auth/me"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await phone.Plain.GetAsync(Url("/api/progress/saves"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await phone.Plain.PatchAsJsonAsync(Url("/api/account"), new { telemetry = true }, Ct)).StatusCode);

        var bo = await PersonAsync("Bố");
        using (var asAccount = Named(bo.ProfileId))
        {
            var refused = await phone.Plain.SendAsync(asAccount, Ct);
            Assert.Equal((HttpStatusCode.NotFound, "device_profile_not_found"), (refused.StatusCode, await CodeAsync(refused)));
        }

        // Another device's key never speaks for this one's profile.
        var other = await DevicePhoneAsync("Chó Vàng");
        using (var stolen = Named(phone.ProfileId))
        {
            Assert.Equal(HttpStatusCode.NotFound, (await other.Plain.SendAsync(stolen, Ct)).StatusCode);
        }

        // An account's session alone: no device-profile endpoint, and naming a device profile needs its device's key.
        var upload = await bo.Client.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(Guid.NewGuid(), "Bé"), Ct);
        Assert.Equal(HttpStatusCode.Unauthorized, upload.StatusCode);
        using (var asDevice = Named(phone.ProfileId))
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await bo.Client.SendAsync(asDevice, Ct)).StatusCode);
        }

        // Without naming a device profile, the session plays as itself; with one, the key alone counts.
        Assert.Equal(HttpStatusCode.OK, (await bo.Client.GetAsync(Url("/api/rooms/mine"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await phone.Plain.GetAsync(Url("/api/rooms/mine"), Ct)).StatusCode);
    }

    // ------------------------------------------------------------------ the server copy

    [Fact]
    public async Task A_server_copy_takes_an_unknown_id_once_and_its_own_device_may_send_it_again()
    {
        var phone = await StartedPhoneAsync();
        var id = Guid.NewGuid();
        var made = await phone.Client.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(id, "  Mèo   Cam "), Ct);
        Assert.Equal(HttpStatusCode.OK, made.StatusCode);
        var view = (await made.Content.ReadFromJsonAsync<DeviceProfileView>(Ct))!;
        Assert.Equal((id, "Mèo Cam", Terms), (view.Id, view.Name, view.TermsVersion));

        // The answer was lost: the same device sends it again, and nothing new is made.
        var again = await phone.Client.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(id, "Mèo Cam"), Ct);
        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        Assert.Equal(1, await CountAsync(db => db.Profiles.CountAsync(p => p.Id == id, Ct)));
        var stored = await CountAsync(db => db.Profiles.AsNoTracking().SingleAsync(p => p.Id == id, Ct));
        Assert.Null(stored.AccountId);
        Assert.Null(stored.PublicId);
        Assert.NotNull(stored.DeviceId);
        Assert.Equal(Terms, stored.TermsVersion);
        Assert.NotNull(stored.TermsAcceptedAt);

        // Another device, the empty id, an account's profile, a deleted profile's id: id_taken, and the hub re-ids.
        var other = await StartedPhoneAsync();
        var bo = await PersonAsync("Bố");
        foreach (var taken in new[] { id, Guid.Empty, bo.ProfileId })
        {
            var refused = await other.Client.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(taken, "Mèo"), Ct);
            Assert.Equal((HttpStatusCode.Conflict, "id_taken"), (refused.StatusCode, await CodeAsync(refused)));
        }

        var gone = Guid.NewGuid();
        Assert.Equal(HttpStatusCode.OK, (await other.Client.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(gone, "Gà"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await other.Client.DeleteAsync(Url($"/api/devices/profiles/{gone}"), Ct)).StatusCode);
        var retired = await other.Client.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(gone, "Gà"), Ct);
        Assert.Equal((HttpStatusCode.Conflict, "id_taken"), (retired.StatusCode, await CodeAsync(retired)));
    }

    [Fact]
    public async Task A_server_copy_needs_a_clean_name_the_terms_and_at_most_five_per_device()
    {
        var phone = await StartedPhoneAsync();
        var rude = await phone.Client.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(Guid.NewGuid(), "Admin"), Ct);
        Assert.Equal((HttpStatusCode.UnprocessableEntity, "name_refused"), (rude.StatusCode, await CodeAsync(rude)));
        var noTerms = await phone.Client.PostAsJsonAsync(
            Url("/api/devices/profiles"), new { id = Guid.NewGuid(), name = "Mèo", avatar = ProfileOptions.Avatars[2], termsVersion = "" }, Ct);
        Assert.Equal((HttpStatusCode.PreconditionFailed, "terms_required"), (noTerms.StatusCode, await CodeAsync(noTerms)));

        for (var i = 0; i < DeviceKeys.MaxProfilesPerDevice; i++)
        {
            Assert.Equal(HttpStatusCode.OK, (await phone.Client.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(Guid.NewGuid(), $"Bé {i}"), Ct)).StatusCode);
        }

        var sixth = await phone.Client.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(Guid.NewGuid(), "Bé 6"), Ct);
        Assert.Equal((HttpStatusCode.Conflict, "too_many_profiles"), (sixth.StatusCode, await CodeAsync(sixth)));
    }

    [Fact]
    public async Task With_the_console_switch_on_a_new_server_copy_takes_a_solved_challenge()
    {
        await using var app = factory.WithWebHostBuilder(builder => builder.UseSetting("Identity:ProofOfWorkMaxNumber", "2000"));
        var owner = await Admins.NewAsync(factory, "owner", app);
        await owner.Client.PutAsJsonAsync(Url("/api/admin/settings"), new { proofOfWork = true }, Ct);
        try
        {
            var client = app.CreateClient();
            Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync(Url("/api/devices"), null, Ct)).StatusCode);
            var id = Guid.NewGuid();
            var refused = await client.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(id, "Mèo"), Ct);
            Assert.Equal("proof_of_work_required", await CodeAsync(refused));

            var challenge = (await client.GetFromJsonAsync<ProofOfWorkChallenge>(Url("/api/auth/challenge"), Ct))!;
            var number = Enumerable.Range(0, challenge.MaxNumber + 1).First(n => ProofOfWork.Hash(challenge.Salt, n) == challenge.Challenge);
            var solved = await client.PostAsJsonAsync(
                Url("/api/devices/profiles"),
                new { id, name = "Mèo", avatar = ProfileOptions.Avatars[2], termsVersion = Terms, proof = new ProofOfWorkSolution(challenge.Token, number) },
                Ct);
            Assert.Equal(HttpStatusCode.OK, solved.StatusCode);

            // Sending its own copy again costs no new puzzle.
            Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(id, "Mèo"), Ct)).StatusCode);
        }
        finally
        {
            await owner.Client.PutAsJsonAsync(Url("/api/admin/settings"), new { proofOfWork = false }, Ct);
        }
    }

    [Fact]
    public async Task Making_keys_and_server_copies_has_a_limit_per_address()
    {
        await using var app = factory.WithWebHostBuilder(builder => builder.UseSetting("Identity:DeviceRequestsPerMinute", "2"));
        var client = app.CreateClient();
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync(Url("/api/devices"), null, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(Guid.NewGuid(), "Mèo"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await client.PostAsync(Url("/api/devices"), null, Ct)).StatusCode);
    }

    [Fact]
    public async Task New_terms_ask_the_device_profile_again_before_it_acts()
    {
        var phone = await DevicePhoneAsync("Mèo Cam");
        Assert.Equal(HttpStatusCode.OK, (await phone.Client.GetAsync(Url("/api/rooms/mine"), Ct)).StatusCode);

        phone.Client.DefaultRequestHeaders.Remove(DeviceKey.TermsHeader);
        phone.Client.DefaultRequestHeaders.Add(DeviceKey.TermsHeader, "2026-12-01");
        var asked = await phone.Client.GetAsync(Url("/api/rooms/mine"), Ct);
        Assert.Equal((HttpStatusCode.PreconditionFailed, "terms_required"), (asked.StatusCode, await CodeAsync(asked)));

        // The player ticks the line again: the new version and its time are kept.
        var accepted = await phone.Client.PostAsJsonAsync(
            Url("/api/devices/profiles"), new { id = phone.ProfileId, name = "Mèo Cam", avatar = ProfileOptions.Avatars[2], termsVersion = "2026-12-01" }, Ct);
        Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await phone.Client.GetAsync(Url("/api/rooms/mine"), Ct)).StatusCode);
    }

    // ------------------------------------------------------------------ at the tables

    [Fact]
    public async Task A_named_table_seats_a_device_profile_and_the_others_do_not()
    {
        var bo = await PersonAsync("Bố");
        var named = await CreateAsync(bo, new { gameId = "tien-len", seats = 3 });
        Assert.Equal("named", named.Entry);
        // A host opens two tables at most: another person opens the one for accounts.
        var accounts = await CreateAsync(await PersonAsync("Cô"), new { gameId = "tien-len", seats = 3, entry = "account" });
        var own = await CreateAsync(bo, new { gameId = "tien-len", seats = 3, entry = "own" });
        var phone = await DevicePhoneAsync("Mèo Cam");

        var lobby = await phone.Client.GetFromJsonAsync<List<RoomSummary>>(Url("/api/rooms?game=tien-len"), Ct);
        Assert.Contains(lobby!, room => room.Id == named.Id);
        Assert.DoesNotContain(lobby!, room => room.Id == accounts.Id || room.Id == own.Id);

        var preview = await phone.Client.GetFromJsonAsync<RoomView>(Url($"/api/rooms/code/{named.Code}"), Ct);
        Assert.Equal(named.Id, preview!.Id);
        var sat = await phone.Client.PostAsync(Url($"/api/rooms/{named.Id}/join"), null, Ct);
        Assert.Equal(HttpStatusCode.OK, sat.StatusCode);
        var view = (await sat.Content.ReadFromJsonAsync<RoomView>(Ct))!;
        Assert.Equal((1, phone.ProfileId, "Mèo Cam"), (view.MySeat, view.SeatList[1].ProfileId, view.SeatList[1].Name));

        var refused = await phone.Client.PostAsync(Url($"/api/rooms/{accounts.Id}/join"), null, Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "account_required"), (refused.StatusCode, await CodeAsync(refused)));
        var kept = await phone.Client.PostAsync(Url($"/api/rooms/{own.Id}/join"), null, Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "room_account_only"), (kept.StatusCode, await CodeAsync(kept)));

        // Asking by ID stays an account's; a device profile opens only a table for anyone named.
        var invite = await phone.Client.PostAsJsonAsync(Url($"/api/rooms/{named.Id}/invite"), new { profileId = bo.ProfileId }, Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "account_required"), (invite.StatusCode, await CodeAsync(invite)));
        var opened = await phone.Client.PostAsJsonAsync(Url("/api/rooms"), new { gameId = "tien-len", seats = 2, entry = "account" }, Ct);
        Assert.Equal("account_required", await CodeAsync(opened));
        Assert.Equal("named", (await CreateAsync(phone, new { gameId = "tien-len", seats = 2 })).Entry);
    }

    [Fact]
    public async Task A_child_kept_to_its_account_never_sits_with_a_device_profile()
    {
        var bo = await PersonAsync("Bố");
        var phone = await DevicePhoneAsync("Mèo Cam");
        var named = await CreateAsync(bo, new { gameId = "tien-len", seats = 4 });
        await JoinAsync(phone, named.Id);

        // The child's switch is off: not at a table with an outsider…
        var na = await ChildAsync(bo, "Na");
        var refused = await na.Client.PostAsync(Url($"/api/rooms/{named.Id}/join"), null, Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "parent_permission"), (refused.StatusCode, await CodeAsync(refused)));

        // …and a table the child sits at, kept to the account, opened by the host to anyone named later, still never
        // seats a device profile.
        await PlayAsAsync(bo, bo.Me.Profiles[0].Id);
        var family = await CreateAsync(bo, new { gameId = "tien-len", seats = 3, entry = "own" });
        await PlayAsAsync(bo, na.ProfileId);
        await JoinAsync(bo, family.Id);
        await PlayAsAsync(bo, bo.Me.Profiles[0].Id);
        var opened = await bo.Client.PatchAsJsonAsync(Url($"/api/rooms/{family.Id}"), new { entry = "named" }, Ct);
        Assert.Equal("named", (await opened.Content.ReadFromJsonAsync<RoomView>(Ct))!.Entry);
        var meets = await phone.Client.PostAsync(Url($"/api/rooms/{family.Id}/join"), null, Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "parent_permission"), (meets.StatusCode, await CodeAsync(meets)));
    }

    [Fact]
    public async Task A_device_profiles_results_at_a_table_are_marked_and_on_no_board_of_an_account()
    {
        var bo = await PersonAsync("Bố");
        var phone = await DevicePhoneAsync("Mèo Cam");
        var room = await CreateAsync(bo, new { gameId = "tien-len", seats = 2, botLevel = "easy", turnSeconds = 0 });
        await JoinAsync(phone, room.Id);
        await using (await TableAsync(bo, room.Id))
        await using (await TableAsync(phone, room.Id))
        {
            await bo.Client.PostAsync(Url($"/api/rooms/{room.Id}/start"), null, Ct);
            await WaitForAsync(bo, room.Id, r => r.Status == "between", TimeSpan.FromSeconds(60));
        }

        var results = await CountAsync(db => db.IntegrityResults.AsNoTracking().Where(r => r.Source.StartsWith($"hand:{room.Id:N}:")).ToListAsync(Ct));
        var device = Assert.Single(results, r => r.ProfileId == phone.ProfileId);
        Assert.True(device.DeviceEarned);
        Assert.Null(device.AccountId);
        Assert.False(Assert.Single(results, r => r.ProfileId == bo.ProfileId).DeviceEarned);

        // The device profile has its own results and replays, and no account's board.
        var stats = await phone.Client.GetFromJsonAsync<RoomStatsView>(Url("/api/rooms/stats?game=tien-len"), Ct);
        Assert.Equal(1, stats!.AllTime.Hands);
        Assert.Empty(stats.Account);
        Assert.Equal(HttpStatusCode.OK, (await phone.Client.GetAsync(Url($"/api/rooms/{room.Id}/hands/1"), Ct)).StatusCode);
        var board = await bo.Client.GetFromJsonAsync<RoomStatsView>(Url("/api/rooms/stats?game=tien-len"), Ct);
        Assert.DoesNotContain(board!.Account, row => row.ProfileId == phone.ProfileId);
    }

    // ------------------------------------------------------------------ into an account

    [Fact]
    public async Task Adopting_a_server_copy_with_its_devices_key_keeps_the_row_its_id_and_its_results()
    {
        var phone = await DevicePhoneAsync("Mèo Cam");
        var bo = await PersonAsync("Bố");
        var room = await CreateAsync(bo, new { gameId = "tien-len", seats = 2 });
        await JoinAsync(phone, room.Id);
        await SatAsync(room.Id, phone.ProfileId);

        // Without the device's key: the id is someone else's.
        await Accounts.StepUpAsync(bo.Client);
        var stranger = await bo.Client.PostAsJsonAsync(Url("/api/profiles/adopt"), Upload(phone.ProfileId, "Mèo Cam"), Ct);
        Assert.Equal((HttpStatusCode.Conflict, "id_taken"), (stranger.StatusCode, await CodeAsync(stranger)));

        // With it — the same browser signs in — the same row becomes the account's.
        var me = await Accounts.SignUpAsync(factory, phone.Plain, "Chú");
        await Accounts.StepUpAsync(phone.Plain);
        var adopted = await phone.Plain.PostAsJsonAsync(Url("/api/profiles/adopt"), Upload(phone.ProfileId, "Mèo Cam"), Ct);
        Assert.Equal(HttpStatusCode.OK, adopted.StatusCode);
        var profile = Assert.Single((await adopted.Content.ReadFromJsonAsync<MeView>(Ct))!.Profiles, p => p.Id == phone.ProfileId);
        Assert.True(ProfileIds.TryNormalize(profile.PublicId, out _));
        var stored = await CountAsync(db => db.Profiles.AsNoTracking().SingleAsync(p => p.Id == phone.ProfileId, Ct));
        Assert.Equal((me.Account.Id, (Guid?)null, (string?)null), (stored.AccountId, stored.DeviceId, stored.TermsVersion));
        Assert.NotNull(stored.DeviceUntil);
        // It left the table it sat at as a device profile; its results name the account now.
        Assert.DoesNotContain(
            (await bo.Client.GetFromJsonAsync<RoomView>(Url($"/api/rooms/{room.Id}"), Ct))!.SeatList, seat => seat.ProfileId == phone.ProfileId);
        Assert.Equal(me.Account.Id, await CountAsync(db => db.RoomResults.Where(r => r.ProfileId == phone.ProfileId).Select(r => r.AccountId).SingleAsync(Ct)));

        // The device key no longer speaks for it.
        using var asDevice = Named(phone.ProfileId);
        Assert.Equal(HttpStatusCode.NotFound, (await phone.Plain.SendAsync(asDevice, Ct)).StatusCode);
    }

    [Fact]
    public async Task Merging_a_server_copy_moves_its_results_and_deletes_it_only_with_its_devices_key()
    {
        var phone = await DevicePhoneAsync("Mèo Cam");
        var bo = await PersonAsync("Bố");
        var room = await CreateAsync(bo, new { gameId = "tien-len", seats = 2 });
        await SatAsync(room.Id, phone.ProfileId);

        await Accounts.StepUpAsync(bo.Client);
        var stranger = await bo.Client.PostAsJsonAsync(
            Url($"/api/profiles/{bo.ProfileId}/merge"), new { name = "Mèo Cam", deviceProfileId = phone.ProfileId }, Ct);
        Assert.Equal((HttpStatusCode.Conflict, "id_taken"), (stranger.StatusCode, await CodeAsync(stranger)));

        var me = await Accounts.SignUpAsync(factory, phone.Plain, "Chú");
        await Accounts.StepUpAsync(phone.Plain);
        var target = me.Profiles[0].Id;
        var merged = await phone.Plain.PostAsJsonAsync(
            Url($"/api/profiles/{target}/merge"), new { name = "Mèo Cam", deviceProfileId = phone.ProfileId }, Ct);
        Assert.Equal(HttpStatusCode.OK, merged.StatusCode);

        Assert.Equal(0, await CountAsync(db => db.Profiles.CountAsync(p => p.Id == phone.ProfileId, Ct)));
        Assert.Equal(1, await CountAsync(db => db.RetiredProfileIds.CountAsync(r => r.ProfileId == phone.ProfileId, Ct)));
        var result = await CountAsync(db => db.RoomResults.AsNoTracking().SingleAsync(r => r.RoomId == room.Id, Ct));
        Assert.Equal((target, me.Account.Id), (result.ProfileId!.Value, result.AccountId!.Value));
    }

    // ------------------------------------------------------------------ deleting, and the cleanup

    [Fact]
    public async Task Deleting_a_device_profile_deletes_its_server_copy_and_its_seats_read_deleted()
    {
        var phone = await DevicePhoneAsync("Mèo Cam");
        var bo = await PersonAsync("Bố");
        var room = await CreateAsync(bo, new { gameId = "tien-len", seats = 2 });
        await JoinAsync(phone, room.Id);
        await SatAsync(room.Id, phone.ProfileId, seats: true);

        Assert.Equal(HttpStatusCode.NoContent, (await phone.Plain.DeleteAsync(Url($"/api/devices/profiles/{phone.ProfileId}"), Ct)).StatusCode);
        var again = await phone.Plain.DeleteAsync(Url($"/api/devices/profiles/{phone.ProfileId}"), Ct);
        Assert.Equal((HttpStatusCode.NotFound, "device_profile_not_found"), (again.StatusCode, await CodeAsync(again)));

        // Its seat at the live table went; the finished hand keeps a deleted person's seat; its next action finds nothing.
        Assert.DoesNotContain(
            (await bo.Client.GetFromJsonAsync<RoomView>(Url($"/api/rooms/{room.Id}"), Ct))!.SeatList, seat => seat.ProfileId == phone.ProfileId);
        var seats = await CountAsync(db => db.RoomHands.Where(h => h.RoomId == room.Id).Select(h => h.Seats).SingleAsync(Ct));
        Assert.Contains("\"Deleted\": true", seats, StringComparison.Ordinal);
        var gone = await phone.Client.GetAsync(Url("/api/rooms/mine"), Ct);
        Assert.Equal((HttpStatusCode.NotFound, "device_profile_not_found"), (gone.StatusCode, await CodeAsync(gone)));
    }

    [Fact]
    public async Task Device_profiles_unused_for_90_days_and_devices_unseen_for_90_days_are_deleted()
    {
        var idle = await DevicePhoneAsync("Mèo Cam");
        var busy = await DevicePhoneAsync("Chó Vàng");
        var unseen = await DevicePhoneAsync("Gà Con");
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
            var old = DateTimeOffset.UtcNow.AddDays(-91);
            await db.Profiles.Where(p => p.Id == idle.ProfileId).ExecuteUpdateAsync(set => set.SetProperty(p => p.LastUsedAt, old), Ct);
            var device = await db.Profiles.Where(p => p.Id == unseen.ProfileId).Select(p => p.DeviceId).SingleAsync(Ct);
            await db.Devices.Where(d => d.Id == device).ExecuteUpdateAsync(set => set.SetProperty(d => d.LastSeenAt, old), Ct);
            await scope.ServiceProvider.GetRequiredService<DeviceCleanup>().RunAsync(Ct);
        }

        Assert.Equal(0, await CountAsync(db => db.Profiles.CountAsync(p => p.Id == idle.ProfileId || p.Id == unseen.ProfileId, Ct)));
        Assert.Equal(1, await CountAsync(db => db.Profiles.CountAsync(p => p.Id == busy.ProfileId, Ct)));
        Assert.Equal(2, await CountAsync(db => db.RetiredProfileIds.CountAsync(r => r.ProfileId == idle.ProfileId || r.ProfileId == unseen.ProfileId, Ct)));

        // The idle one's device keeps its key; its next action finds its copy gone, and the hub gives it a new id.
        var gone = await idle.Client.GetAsync(Url("/api/rooms/mine"), Ct);
        Assert.Equal("device_profile_not_found", await CodeAsync(gone));
        var reIded = await idle.Plain.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(Guid.NewGuid(), "Mèo Cam"), Ct);
        Assert.Equal(HttpStatusCode.OK, reIded.StatusCode);
        // The unseen device's key is gone with it.
        Assert.Equal(HttpStatusCode.Unauthorized, (await unseen.Plain.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(Guid.NewGuid(), "Gà"), Ct)).StatusCode);
    }

    // ------------------------------------------------------------------ moderation

    [Fact]
    public async Task The_console_renames_a_device_profile_and_takes_it_off_its_table()
    {
        var phone = await DevicePhoneAsync("Mèo Cam");
        var bo = await PersonAsync("Bố");
        var room = await CreateAsync(bo, new { gameId = "tien-len", seats = 2 });
        await JoinAsync(phone, room.Id);
        var moderator = await Admins.NewAsync(factory, "moderator");

        var found = await moderator.Client.GetFromJsonAsync<List<DeviceProfileDetail>>(Url("/api/admin/device-profiles?q=Mèo"), Ct);
        Assert.Contains(found!, p => p.Id == phone.ProfileId);
        var renamed = await moderator.Client.PatchAsJsonAsync(Url($"/api/admin/device-profiles/{phone.ProfileId}"), new { name = "Người chơi" }, Ct);
        Assert.Equal(HttpStatusCode.OK, renamed.StatusCode);
        var detail = (await renamed.Content.ReadFromJsonAsync<DeviceProfileDetail>(Ct))!;
        Assert.Equal("Người chơi", detail.Name);
        Assert.Contains(detail.Names, n => n.Name == "Mèo Cam");

        Assert.Equal(HttpStatusCode.NoContent, (await moderator.Client.PostAsync(Url($"/api/admin/profiles/{phone.ProfileId}/withdraw"), null, Ct)).StatusCode);
        Assert.DoesNotContain(
            (await bo.Client.GetFromJsonAsync<RoomView>(Url($"/api/rooms/{room.Id}"), Ct))!.SeatList, seat => seat.ProfileId == phone.ProfileId);
    }

    // ------------------------------------------------------------------ helpers

    /// <summary>
    /// One browser: <paramref name="Client"/> acts as the device profile (its headers name it), <paramref name="Plain"/>
    /// shares its cookies without naming it — the device key, and an account's session once one signs in.
    /// </summary>
    private sealed record Phone(HttpClient Client, HttpClient Plain, CookieJar Jar, Guid ProfileId);

    private sealed record Person(HttpClient Client, CookieJar Jar, MeView Me, Guid ProfileId);

    private Phone NewPhone()
    {
        var jar = new CookieJar(factory.Server.CreateHandler());
        var client = new HttpClient(jar, disposeHandler: false) { BaseAddress = factory.Server.BaseAddress };
        var plain = new HttpClient(jar, disposeHandler: false) { BaseAddress = factory.Server.BaseAddress };
        return new Phone(client, plain, jar, Guid.Empty);
    }

    private async Task<Phone> StartedPhoneAsync()
    {
        var phone = NewPhone();
        Assert.Equal(HttpStatusCode.NoContent, (await phone.Client.PostAsync(Url("/api/devices"), null, Ct)).StatusCode);
        return phone;
    }

    /// <summary>A new browser with a device key and a device profile on the server, which its client acts as.</summary>
    private async Task<Phone> DevicePhoneAsync(string name)
    {
        var phone = await StartedPhoneAsync();
        var id = Guid.NewGuid();
        var made = await phone.Client.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(id, name), Ct);
        Assert.Equal(HttpStatusCode.OK, made.StatusCode);
        phone.Client.DefaultRequestHeaders.Add(DeviceKey.ProfileHeader, id.ToString());
        phone.Client.DefaultRequestHeaders.Add(DeviceKey.TermsHeader, Terms);
        return phone with { ProfileId = id };
    }

    private static object Registration(Guid id, string name) =>
        new { id, name, avatar = ProfileOptions.Avatars[2], termsVersion = Terms };

    private static object Upload(Guid id, string name) => new { id, name, avatar = ProfileOptions.Avatars[2] };

    /// <summary>A rooms request naming <paramref name="profileId"/> as the device profile that acts.</summary>
    private static HttpRequestMessage Named(Guid profileId)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, Url("/api/rooms/mine"));
        request.Headers.Add(DeviceKey.ProfileHeader, profileId.ToString());
        request.Headers.Add(DeviceKey.TermsHeader, Terms);
        return request;
    }

    private async Task<Person> PersonAsync(string displayName)
    {
        var jar = new CookieJar(factory.Server.CreateHandler());
        var client = new HttpClient(jar) { BaseAddress = factory.Server.BaseAddress };
        var me = await Accounts.SignUpAsync(factory, client, displayName);
        var person = new Person(client, jar, me, me.Profiles[0].Id);
        await PlayAsAsync(person, person.ProfileId);
        return person;
    }

    private static async Task<Person> ChildAsync(Person parent, string name)
    {
        await Accounts.StepUpAsync(parent.Client);
        var response = await parent.Client.PostAsJsonAsync(Url("/api/profiles"), new { name, avatar = ProfileOptions.Avatars[1], ageBand = "9-12" }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var me = (await response.Content.ReadFromJsonAsync<MeView>(Ct))!;
        var child = me.Profiles.Last(p => p.Name == name);
        await PlayAsAsync(parent, child.Id);
        return parent with { Me = me, ProfileId = child.Id };
    }

    private static async Task PlayAsAsync(Person person, Guid profileId)
    {
        var response = await person.Client.PutAsJsonAsync(Url("/api/session/profile"), new { profileId }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task<RoomView> CreateAsync(Person person, object request) => await CreateAsync(person.Client, request);

    private static async Task<RoomView> CreateAsync(Phone phone, object request) => await CreateAsync(phone.Client, request);

    private static async Task<RoomView> CreateAsync(HttpClient client, object request)
    {
        var response = await client.PostAsJsonAsync(Url("/api/rooms"), request, Ct);
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync(Ct));
        return (await response.Content.ReadFromJsonAsync<RoomView>(Ct))!;
    }

    private static async Task JoinAsync(Phone phone, Guid roomId) => await JoinAsync(phone.Client, roomId);

    private static async Task JoinAsync(Person person, Guid roomId) => await JoinAsync(person.Client, roomId);

    private static async Task JoinAsync(HttpClient client, Guid roomId)
    {
        var response = await client.PostAsync(Url($"/api/rooms/{roomId}/join"), null, Ct);
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync(Ct));
    }

    /// <summary>The profile sat at a finished first hand of the room, as the rooms and the integrity engine record it.</summary>
    private async Task SatAsync(Guid roomId, Guid profileId, bool seats = false)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        db.RoomResults.Add(new RoomResult { RoomId = roomId, GameId = "tien-len", Hand = 1, Seat = 1, ProfileId = profileId, At = DateTimeOffset.UtcNow });
        if (seats)
        {
            db.RoomHands.Add(new RoomHand
            {
                RoomId = roomId,
                GameId = "tien-len",
                GameVersion = "0.0.0",
                Hand = 1,
                Options = "{}",
                Seats = JsonSerializer.Serialize(new[] { new SeatRecord(profileId, null, "Mèo Cam", "🐯", null) }),
                Result = "{}",
                FinishedAt = DateTimeOffset.UtcNow,
            });
        }

        await db.SaveChangesAsync(Ct);
    }

    private async Task<T> CountAsync<T>(Func<ToheDbContext, Task<T>> query)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        return await query(scope.ServiceProvider.GetRequiredService<ToheDbContext>());
    }

    /// <summary>The person's — or the phone's — cookie jar for a hub connection, kept open when the connection closes.</summary>
    private sealed class Borrowed(HttpMessageHandler inner) : DelegatingHandler(inner)
    {
        protected override void Dispose(bool disposing)
        {
        }
    }

    private Task<HubConnection> TableAsync(Person person, Guid roomId) => TableAsync(person.Jar, "api/rooms/hub", roomId);

    private Task<HubConnection> TableAsync(Phone phone, Guid roomId) =>
        TableAsync(phone.Jar, $"api/rooms/hub?{DeviceKey.ProfileQuery}={phone.ProfileId}&{DeviceKey.TermsQuery}={Terms}", roomId);

    /// <summary>Sits at the table through the hub, playing like the turn timer.</summary>
    private async Task<HubConnection> TableAsync(CookieJar jar, string path, Guid roomId)
    {
        var hub = new HubConnectionBuilder()
            .WithUrl(new Uri(factory.Server.BaseAddress, path), options =>
            {
                options.HttpMessageHandlerFactory = _ => new Borrowed(jar);
                options.Transports = HttpTransportType.LongPolling;
            })
            .Build();
        hub.On<Guid, JsonElement, JsonElement, int, int?>("View", (_, view, _, _, _) =>
        {
            var node = JsonNode.Parse(view.GetRawText())!;
            if (!node["over"]!.GetValue<bool>() && node["turn"]!.GetValue<int>() == node["seat"]!.GetValue<int>())
            {
                var hand = node["hand"]!.AsArray().Select(card => card!.GetValue<int>()).ToList();
                object action = node["table"] is JsonObject
                    ? new { type = "pass" }
                    : new { type = "play", cards = new[] { node["mustInclude"]?.GetValue<int>() ?? hand.Min() } };
                _ = Task.Run(() => hub.InvokeAsync<string?>("Act", roomId, JsonSerializer.SerializeToElement(action)));
            }
        });
        await hub.StartAsync(Ct);
        Assert.NotNull(await hub.InvokeAsync<RoomView?>("Enter", roomId, Ct));
        return hub;
    }

    private static async Task<RoomView> WaitForAsync(Person person, Guid roomId, Func<RoomView, bool> wanted, TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow + timeout;
        RoomView? room = null;
        while (DateTime.UtcNow < deadline)
        {
            room = await person.Client.GetFromJsonAsync<RoomView>(Url($"/api/rooms/{roomId}"), Ct);
            if (room is not null && wanted(room))
            {
                return room;
            }

            await Task.Delay(100, Ct);
        }

        throw new TimeoutException($"room never got there; last status {room?.Status}");
    }

    private static Uri Url(string path) => new(path, UriKind.Relative);

    private static async Task<string?> CodeAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync(Ct);
        if (string.IsNullOrEmpty(text))
        {
            return null;
        }

        using var json = JsonDocument.Parse(text);
        return json.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    private static string FindGameBuild()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var dist = Path.Combine(dir.FullName, "games", "tien-len", "dist");
            if (File.Exists(Path.Combine(dist, "rules.js")))
            {
                return dist;
            }
        }

        throw new FileNotFoundException("games/tien-len/dist/rules.js is missing: run pnpm --filter @tohe/game-tien-len build");
    }
}
