using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Registry;
using Tohe.Api.Modules.Rooms;

namespace Tohe.Api.Tests;

/// <summary>
/// The transfer code and merge aliases (ADR 0043, step I2b): a device profile on the server moves to another device —
/// at once with the QR code's secret, after the old device's yes with six digits — once, within ten minutes, with its
/// saves and scores, and its old device's key stops speaking for it; a merged copy's id stays reachable as an alias.
/// </summary>
public sealed class TransferTests(ApiFactory factory) : IClassFixture<ApiFactory>, IAsyncLifetime
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

    // ------------------------------------------------------------------ the code

    [Fact]
    public async Task A_code_is_six_digits_and_a_secret_for_ten_minutes_stored_hashed_and_a_new_one_replaces_it()
    {
        var old = await DevicePhoneAsync("Mèo Cam");
        var first = await StartAsync(old);
        Assert.Matches("^[0-9]{6}$", first.Code);
        Assert.Equal(TransferCodes.SecretBytes, WebEncoders.Base64UrlDecode(first.Secret).Length);
        Assert.InRange(first.ExpiresAt, DateTimeOffset.UtcNow.AddMinutes(9), DateTimeOffset.UtcNow.AddMinutes(11));

        var stored = await QueryAsync(db => db.ProfileTransfers.AsNoTracking().SingleAsync(t => t.ProfileId == old.ProfileId, Ct));
        Assert.Equal(TransferCodes.HashCode(stored.Id, first.Code), stored.CodeHash);
        Assert.DoesNotContain(first.Code, stored.CodeHash!, StringComparison.Ordinal);
        Assert.Equal(TransferCodes.HashSecret(WebEncoders.Base64UrlDecode(first.Secret)), stored.SecretHash);

        // A new code replaces the one before: one per profile.
        var second = await StartAsync(old);
        Assert.Equal(1, await QueryAsync(db => db.ProfileTransfers.CountAsync(t => t.ProfileId == old.ProfileId, Ct)));
        var phone = await StartedPhoneAsync();
        var replaced = await RedeemAsync(phone, new { secret = first.Secret });
        Assert.Equal((HttpStatusCode.NotFound, "transfer_invalid"), (replaced.StatusCode, await CodeAsync(replaced)));
        Assert.Equal("done", (await ReadAsync<TransferView>(await RedeemAsync(phone, new { secret = second.Secret }))).State);
    }

    [Fact]
    public async Task Only_its_own_device_with_the_terms_accepted_makes_a_code_and_an_account_never_does()
    {
        var old = await DevicePhoneAsync("Mèo Cam");
        var other = await DevicePhoneAsync("Gà Con");
        var stolen = await other.Plain.PostAsJsonAsync(Url($"/api/devices/profiles/{old.ProfileId}/transfer"), new { termsVersion = Terms }, Ct);
        Assert.Equal((HttpStatusCode.NotFound, "device_profile_not_found"), (stolen.StatusCode, await CodeAsync(stolen)));

        var newTerms = await old.Plain.PostAsJsonAsync(Url($"/api/devices/profiles/{old.ProfileId}/transfer"), new { termsVersion = "2026-12-01" }, Ct);
        Assert.Equal((HttpStatusCode.PreconditionFailed, "terms_required"), (newTerms.StatusCode, await CodeAsync(newTerms)));

        var tooMuch = await old.Plain.PostAsJsonAsync(
            Url($"/api/devices/profiles/{old.ProfileId}/transfer"),
            new { termsVersion = Terms, data = new { saves = Enumerable.Range(0, DeviceProfiles.MaxSaves + 1).Select(i => Save($"game-{i}")) } },
            Ct);
        Assert.Equal((HttpStatusCode.BadRequest, "upload_too_large"), (tooMuch.StatusCode, await CodeAsync(tooMuch)));

        var bo = await PersonAsync("Bố");
        Assert.Equal(HttpStatusCode.Unauthorized, (await bo.Client.PostAsJsonAsync(Url($"/api/devices/profiles/{bo.ProfileId}/transfer"), new { termsVersion = Terms }, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await bo.Client.PostAsJsonAsync(Url("/api/devices/transfers/redeem"), new { code = "123456" }, Ct)).StatusCode);
    }

    // ------------------------------------------------------------------ redeeming

    [Fact]
    public async Task The_secret_moves_the_profile_with_its_saves_and_scores_at_once_and_the_old_key_no_longer_acts()
    {
        var old = await DevicePhoneAsync("Mèo Cam");
        var bo = await PersonAsync("Bố");
        var room = await CreateAsync(bo, new { gameId = "tien-len", seats = 3 });
        await JoinAsync(old, room.Id);
        var scoreId = Guid.NewGuid();
        var code = await StartAsync(old, new { saves = new[] { Save("merge-block") }, scores = new[] { Score(scoreId, 1234) } });

        var phone = await StartedPhoneAsync();
        var response = await RedeemAsync(phone, new { secret = code.Secret });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var done = await ReadAsync<TransferView>(response);
        Assert.Equal("done", done.State);
        Assert.Equal((old.ProfileId, "Mèo Cam", Terms), (done.Profile!.Id, done.Profile.Name, done.Profile.TermsVersion));
        var save = Assert.Single(done.Data!.AllSaves());
        Assert.Equal(("merge-block", 7), (save.GameId, save.Data.GetProperty("level").GetInt32()));
        Assert.Equal((scoreId, 1234d), (Assert.Single(done.Data.AllScores()).ClientId, done.Data.AllScores()[0].Value));

        // The profile is the new device's: its id, name, seats and results stay; it left the table it sat at.
        var moved = await QueryAsync(db => db.Profiles.AsNoTracking().SingleAsync(p => p.Id == old.ProfileId, Ct));
        Assert.Equal(await DeviceOfAsync(phone), moved.DeviceId);
        Assert.DoesNotContain((await bo.Client.GetFromJsonAsync<RoomView>(Url($"/api/rooms/{room.Id}"), Ct))!.SeatList, seat => seat.ProfileId == old.ProfileId);
        var acting = phone with { ProfileId = old.ProfileId };
        Name(acting);
        Assert.Equal(HttpStatusCode.OK, (await acting.Client.GetAsync(Url("/api/rooms/mine"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await acting.Plain.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(old.ProfileId, "Mèo Cam"), Ct)).StatusCode);

        // The old device's key no longer acts for it, and says why: at a table, its copy, its code, deleting it.
        var atTable = await old.Client.GetAsync(Url("/api/rooms/mine"), Ct);
        Assert.Equal((HttpStatusCode.Gone, "device_profile_moved"), (atTable.StatusCode, await CodeAsync(atTable)));
        var copy = await old.Plain.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(old.ProfileId, "Mèo Cam"), Ct);
        Assert.Equal((HttpStatusCode.Gone, "device_profile_moved"), (copy.StatusCode, await CodeAsync(copy)));
        var status = await old.Plain.GetAsync(Url($"/api/devices/profiles/{old.ProfileId}/transfer"), Ct);
        Assert.Equal((HttpStatusCode.Gone, "device_profile_moved"), (status.StatusCode, await CodeAsync(status)));
        var delete = await old.Plain.DeleteAsync(Url($"/api/devices/profiles/{old.ProfileId}"), Ct);
        Assert.Equal((HttpStatusCode.Gone, "device_profile_moved"), (delete.StatusCode, await CodeAsync(delete)));
        var moves = (await old.Plain.GetFromJsonAsync<List<ProfileMoveView>>(Url("/api/devices/moves"), Ct))!;
        Assert.Equal(old.ProfileId, Assert.Single(moves).ProfileId);
        Assert.Empty((await phone.Plain.GetFromJsonAsync<List<ProfileMoveView>>(Url("/api/devices/moves"), Ct))!);

        // Used once: another device hears nothing; the same device asking again — its answer lost — hears it again.
        var third = await StartedPhoneAsync();
        var again = await RedeemAsync(third, new { secret = code.Secret });
        Assert.Equal((HttpStatusCode.NotFound, "transfer_invalid"), (again.StatusCode, await CodeAsync(again)));
        var lost = await ReadAsync<TransferView>(await RedeemAsync(phone, new { secret = code.Secret }));
        Assert.Equal(("done", old.ProfileId), (lost.State, lost.Profile!.Id));
        var digits = await RedeemAsync(third, new { code = code.Code });
        Assert.Equal((HttpStatusCode.NotFound, "transfer_invalid"), (digits.StatusCode, await CodeAsync(digits)));
    }

    [Fact]
    public async Task Six_digits_wait_for_the_old_devices_yes_and_are_used_up_when_typed()
    {
        var old = await DevicePhoneAsync("Mèo Cam");
        var code = await StartAsync(old, new { saves = new[] { Save("merge-block") } });
        var phone = await StartedPhoneAsync();
        var asked = await ReadAsync<TransferView>(await RedeemAsync(phone, new { code = $"{code.Code[..3]} {code.Code[3..]}" }));
        Assert.Equal("asked", asked.State);
        Assert.Null(asked.Profile);
        Assert.Null(asked.Data);

        // Nothing moved yet; the old device is asked; the code is used up for anyone else.
        Assert.Equal(await DeviceOfAsync(old), await QueryAsync(db => db.Profiles.Where(p => p.Id == old.ProfileId).Select(p => p.DeviceId).SingleAsync(Ct)));
        var status = (await old.Plain.GetFromJsonAsync<TransferStatusView>(Url($"/api/devices/profiles/{old.ProfileId}/transfer"), Ct))!;
        Assert.Equal("asked", status.State);
        var other = await StartedPhoneAsync();
        var twice = await RedeemAsync(other, new { code = code.Code });
        Assert.Equal((HttpStatusCode.NotFound, "transfer_invalid"), (twice.StatusCode, await CodeAsync(twice)));
        Assert.Equal("asked", (await phone.Plain.GetFromJsonAsync<TransferView>(Url($"/api/devices/transfers/{asked.Id}"), Ct))!.State);
        // Only the device that typed it reads it.
        Assert.Equal(HttpStatusCode.NotFound, (await other.Plain.GetAsync(Url($"/api/devices/transfers/{asked.Id}"), Ct)).StatusCode);

        // Yes: it moves now, and the new device reads the profile and its data.
        Assert.Equal(HttpStatusCode.NoContent, (await old.Plain.PostAsJsonAsync(Url($"/api/devices/profiles/{old.ProfileId}/transfer/confirm"), new { accept = true }, Ct)).StatusCode);
        var done = (await phone.Plain.GetFromJsonAsync<TransferView>(Url($"/api/devices/transfers/{asked.Id}"), Ct))!;
        Assert.Equal(("done", old.ProfileId), (done.State, done.Profile!.Id));
        Assert.Single(done.Data!.AllSaves());
        Assert.Equal(await DeviceOfAsync(phone), await QueryAsync(db => db.Profiles.Where(p => p.Id == old.ProfileId).Select(p => p.DeviceId).SingleAsync(Ct)));
        var again = await old.Plain.PostAsJsonAsync(Url($"/api/devices/profiles/{old.ProfileId}/transfer/confirm"), new { accept = true }, Ct);
        Assert.Equal((HttpStatusCode.Gone, "device_profile_moved"), (again.StatusCode, await CodeAsync(again)));
    }

    [Fact]
    public async Task The_old_device_saying_no_ends_the_code_and_the_profile_stays()
    {
        var old = await DevicePhoneAsync("Mèo Cam");
        var code = await StartAsync(old);
        var stranger = await StartedPhoneAsync();
        var asked = await ReadAsync<TransferView>(await RedeemAsync(stranger, new { code = code.Code }));
        Assert.Equal(HttpStatusCode.NoContent, (await old.Plain.PostAsJsonAsync(Url($"/api/devices/profiles/{old.ProfileId}/transfer/confirm"), new { accept = false }, Ct)).StatusCode);

        Assert.Equal("declined", (await stranger.Plain.GetFromJsonAsync<TransferView>(Url($"/api/devices/transfers/{asked.Id}"), Ct))!.State);
        Assert.Equal(HttpStatusCode.OK, (await old.Client.GetAsync(Url("/api/rooms/mine"), Ct)).StatusCode);
        var gone = await old.Plain.GetAsync(Url($"/api/devices/profiles/{old.ProfileId}/transfer"), Ct);
        Assert.Equal((HttpStatusCode.NotFound, "transfer_not_found"), (gone.StatusCode, await CodeAsync(gone)));
        // The secret of a declined code moves nothing either.
        var secret = await RedeemAsync(stranger, new { secret = code.Secret });
        Assert.Equal("declined", (await ReadAsync<TransferView>(secret)).State);
        var third = await RedeemAsync(await StartedPhoneAsync(), new { secret = code.Secret });
        Assert.Equal((HttpStatusCode.NotFound, "transfer_invalid"), (third.StatusCode, await CodeAsync(third)));
        Assert.Equal(await DeviceOfAsync(old), await QueryAsync(db => db.Profiles.Where(p => p.Id == old.ProfileId).Select(p => p.DeviceId).SingleAsync(Ct)));
    }

    [Fact]
    public async Task A_code_expires_after_ten_minutes_and_a_cancelled_one_is_gone()
    {
        var old = await DevicePhoneAsync("Mèo Cam");
        var code = await StartAsync(old);
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
            var past = DateTimeOffset.UtcNow.AddSeconds(-1);
            await db.ProfileTransfers.Where(t => t.ProfileId == old.ProfileId).ExecuteUpdateAsync(set => set.SetProperty(t => t.ExpiresAt, past), Ct);
        }

        var phone = await StartedPhoneAsync();
        foreach (var redemption in new object[] { new { secret = code.Secret }, new { code = code.Code } })
        {
            var expired = await RedeemAsync(phone, redemption);
            Assert.Equal((HttpStatusCode.NotFound, "transfer_invalid"), (expired.StatusCode, await CodeAsync(expired)));
        }

        var fresh = await StartAsync(old);
        Assert.Equal(HttpStatusCode.NoContent, (await old.Plain.DeleteAsync(Url($"/api/devices/profiles/{old.ProfileId}/transfer"), Ct)).StatusCode);
        var cancelled = await RedeemAsync(phone, new { secret = fresh.Secret });
        Assert.Equal((HttpStatusCode.NotFound, "transfer_invalid"), (cancelled.StatusCode, await CodeAsync(cancelled)));

        // Codes past the time their answer is kept are deleted by the daily cleanup.
        await StartAsync(old);
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
            var long_ago = DateTimeOffset.UtcNow.AddHours(-1);
            await db.ProfileTransfers.Where(t => t.ProfileId == old.ProfileId).ExecuteUpdateAsync(set => set.SetProperty(t => t.ExpiresAt, long_ago), Ct);
            await scope.ServiceProvider.GetRequiredService<DeviceCleanup>().RunAsync(Ct);
        }

        Assert.Equal(0, await QueryAsync(db => db.ProfileTransfers.CountAsync(t => t.ProfileId == old.ProfileId, Ct)));
    }

    [Fact]
    public async Task Redeeming_on_its_own_device_or_on_a_full_one_moves_nothing()
    {
        var old = await DevicePhoneAsync("Mèo Cam");
        var code = await StartAsync(old);
        var own = await RedeemAsync(old, new { secret = code.Secret });
        Assert.Equal((HttpStatusCode.Conflict, "transfer_same_device"), (own.StatusCode, await CodeAsync(own)));

        var full = await StartedPhoneAsync();
        for (var i = 0; i < DeviceKeys.MaxProfilesPerDevice; i++)
        {
            Assert.Equal(HttpStatusCode.OK, (await full.Plain.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(Guid.NewGuid(), $"Bé {i}"), Ct)).StatusCode);
        }

        var refused = await RedeemAsync(full, new { secret = code.Secret });
        Assert.Equal((HttpStatusCode.Conflict, "too_many_profiles"), (refused.StatusCode, await CodeAsync(refused)));
        var typed = await RedeemAsync(full, new { code = code.Code });
        Assert.Equal((HttpStatusCode.Conflict, "too_many_profiles"), (typed.StatusCode, await CodeAsync(typed)));

        // Still open: another device takes it.
        Assert.Equal("done", (await ReadAsync<TransferView>(await RedeemAsync(await StartedPhoneAsync(), new { secret = code.Secret }))).State);
    }

    [Fact]
    public async Task A_code_is_bound_to_its_profile_and_ends_when_the_profile_comes_into_an_account()
    {
        var old = await DevicePhoneAsync("Mèo Cam");
        var code = await StartAsync(old);
        var me = await Accounts.SignUpAsync(factory, old.Plain, "Chú");
        await Accounts.StepUpAsync(old.Plain);
        var adopted = await old.Plain.PostAsJsonAsync(Url("/api/profiles/adopt"), Upload(old.ProfileId, "Mèo Cam"), Ct);
        Assert.Equal(HttpStatusCode.OK, adopted.StatusCode);
        Assert.Equal(me.Account.Id, await QueryAsync(db => db.Profiles.Where(p => p.Id == old.ProfileId).Select(p => p.AccountId).SingleAsync(Ct)));

        var phone = await StartedPhoneAsync();
        var refused = await RedeemAsync(phone, new { secret = code.Secret });
        Assert.Equal((HttpStatusCode.NotFound, "transfer_invalid"), (refused.StatusCode, await CodeAsync(refused)));
        Assert.Null(await QueryAsync(db => db.Profiles.Where(p => p.Id == old.ProfileId).Select(p => p.DeviceId).SingleAsync(Ct)));
    }

    // ------------------------------------------------------------------ races, and what happens meanwhile

    [Fact]
    public async Task Two_devices_redeeming_one_secret_at_once_move_it_once()
    {
        var old = await DevicePhoneAsync("Mèo Cam");
        var code = await StartAsync(old);
        var phones = new[] { await StartedPhoneAsync(), await StartedPhoneAsync() };
        var answers = await Task.WhenAll(phones.Select(phone => RedeemAsync(phone, new { secret = code.Secret })));

        Assert.Single(answers, answer => answer.StatusCode == HttpStatusCode.OK);
        Assert.Single(answers, answer => answer.StatusCode == HttpStatusCode.NotFound);
        var winner = phones[Array.FindIndex(answers, answer => answer.StatusCode == HttpStatusCode.OK)];
        Assert.Equal(await DeviceOfAsync(winner), await QueryAsync(db => db.Profiles.Where(p => p.Id == old.ProfileId).Select(p => p.DeviceId).SingleAsync(Ct)));
    }

    [Fact]
    public async Task Its_digits_and_its_secret_at_once_from_two_devices_settle_one_way()
    {
        var old = await DevicePhoneAsync("Mèo Cam");
        var code = await StartAsync(old);
        var typing = await StartedPhoneAsync();
        var scanning = await StartedPhoneAsync();
        var answers = await Task.WhenAll(RedeemAsync(typing, new { code = code.Code }), RedeemAsync(scanning, new { secret = code.Secret }));

        // Either the digits asked first and the secret finds a used code, or the secret moved it and the digits find none.
        Assert.Single(answers, answer => answer.StatusCode == HttpStatusCode.OK);
        var device = await QueryAsync(db => db.Profiles.Where(p => p.Id == old.ProfileId).Select(p => p.DeviceId).SingleAsync(Ct));
        if (answers[0].StatusCode == HttpStatusCode.OK)
        {
            Assert.Equal("asked", (await ReadAsync<TransferView>(answers[0])).State);
            Assert.Equal(await DeviceOfAsync(old), device);
        }
        else
        {
            Assert.Equal("done", (await ReadAsync<TransferView>(answers[1])).State);
            Assert.Equal(await DeviceOfAsync(scanning), device);
        }
    }

    [Fact]
    public async Task Another_device_neither_reads_nor_answers_nor_cancels_someone_elses_code()
    {
        var old = await DevicePhoneAsync("Mèo Cam");
        var code = await StartAsync(old);
        var phone = await StartedPhoneAsync();
        Assert.Equal("asked", (await ReadAsync<TransferView>(await RedeemAsync(phone, new { code = code.Code }))).State);

        // Not even the device that typed the digits: only the profile's own device answers.
        foreach (var stranger in new[] { phone, await DevicePhoneAsync("Gà Con") })
        {
            var status = await stranger.Plain.GetAsync(Url($"/api/devices/profiles/{old.ProfileId}/transfer"), Ct);
            Assert.Equal((HttpStatusCode.NotFound, "device_profile_not_found"), (status.StatusCode, await CodeAsync(status)));
            var yes = await stranger.Plain.PostAsJsonAsync(Url($"/api/devices/profiles/{old.ProfileId}/transfer/confirm"), new { accept = true }, Ct);
            Assert.Equal((HttpStatusCode.NotFound, "device_profile_not_found"), (yes.StatusCode, await CodeAsync(yes)));
            Assert.Equal(HttpStatusCode.NoContent, (await stranger.Plain.DeleteAsync(Url($"/api/devices/profiles/{old.ProfileId}/transfer"), Ct)).StatusCode);
        }

        Assert.Equal("asked", (await old.Plain.GetFromJsonAsync<TransferStatusView>(Url($"/api/devices/profiles/{old.ProfileId}/transfer"), Ct))!.State);
        Assert.Equal(await DeviceOfAsync(old), await QueryAsync(db => db.Profiles.Where(p => p.Id == old.ProfileId).Select(p => p.DeviceId).SingleAsync(Ct)));
    }

    [Fact]
    public async Task A_yes_after_the_ten_minutes_moves_nothing_and_the_new_device_hears_it_expired()
    {
        var old = await DevicePhoneAsync("Mèo Cam");
        var code = await StartAsync(old);
        var phone = await StartedPhoneAsync();
        var asked = await ReadAsync<TransferView>(await RedeemAsync(phone, new { code = code.Code }));
        await ExpireAsync(old.ProfileId, TimeSpan.FromSeconds(-1));

        var late = await old.Plain.PostAsJsonAsync(Url($"/api/devices/profiles/{old.ProfileId}/transfer/confirm"), new { accept = true }, Ct);
        Assert.Equal((HttpStatusCode.NotFound, "transfer_not_found"), (late.StatusCode, await CodeAsync(late)));
        Assert.Equal("expired", (await phone.Plain.GetFromJsonAsync<TransferView>(Url($"/api/devices/transfers/{asked.Id}"), Ct))!.State);
        Assert.Equal(await DeviceOfAsync(old), await QueryAsync(db => db.Profiles.Where(p => p.Id == old.ProfileId).Select(p => p.DeviceId).SingleAsync(Ct)));
    }

    [Fact]
    public async Task A_new_device_full_before_the_yes_hears_it_was_full_not_declined()
    {
        var old = await DevicePhoneAsync("Mèo Cam");
        var code = await StartAsync(old);
        var phone = await StartedPhoneAsync();
        var asked = await ReadAsync<TransferView>(await RedeemAsync(phone, new { code = code.Code }));
        for (var i = 0; i < DeviceKeys.MaxProfilesPerDevice; i++)
        {
            Assert.Equal(HttpStatusCode.OK, (await phone.Plain.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(Guid.NewGuid(), $"Bé {i}"), Ct)).StatusCode);
        }

        var yes = await old.Plain.PostAsJsonAsync(Url($"/api/devices/profiles/{old.ProfileId}/transfer/confirm"), new { accept = true }, Ct);
        Assert.Equal((HttpStatusCode.Conflict, "too_many_profiles"), (yes.StatusCode, await CodeAsync(yes)));
        Assert.Equal("full", (await phone.Plain.GetFromJsonAsync<TransferView>(Url($"/api/devices/transfers/{asked.Id}"), Ct))!.State);
    }

    [Fact]
    public async Task A_lost_answer_to_six_digits_is_found_in_this_devices_transfers()
    {
        var old = await DevicePhoneAsync("Mèo Cam");
        var code = await StartAsync(old, new { saves = new[] { Save("merge-block") } });
        var phone = await StartedPhoneAsync();
        await RedeemAsync(phone, new { code = code.Code }); // its answer never reached the phone
        Assert.Empty((await old.Plain.GetFromJsonAsync<List<TransferView>>(Url("/api/devices/transfers"), Ct))!);

        var waiting = Assert.Single((await phone.Plain.GetFromJsonAsync<List<TransferView>>(Url("/api/devices/transfers"), Ct))!);
        Assert.Equal("asked", waiting.State);
        await old.Plain.PostAsJsonAsync(Url($"/api/devices/profiles/{old.ProfileId}/transfer/confirm"), new { accept = true }, Ct);
        var done = Assert.Single((await phone.Plain.GetFromJsonAsync<List<TransferView>>(Url("/api/devices/transfers"), Ct))!);
        Assert.Equal(("done", old.ProfileId), (done.State, done.Profile!.Id));
        Assert.Single(done.Data!.AllSaves());
    }

    [Fact]
    public async Task Deleting_or_merging_the_profile_while_its_code_lives_ends_the_code()
    {
        var deleted = await DevicePhoneAsync("Mèo Cam");
        var deletedCode = await StartAsync(deleted);
        Assert.Equal(HttpStatusCode.NoContent, (await deleted.Plain.DeleteAsync(Url($"/api/devices/profiles/{deleted.ProfileId}"), Ct)).StatusCode);
        var phone = await StartedPhoneAsync();
        Assert.Equal("transfer_invalid", await CodeAsync(await RedeemAsync(phone, new { secret = deletedCode.Secret })));

        var merged = await DevicePhoneAsync("Gà Con");
        var mergedCode = await StartAsync(merged);
        var me = await Accounts.SignUpAsync(factory, merged.Plain, "Chú");
        await Accounts.StepUpAsync(merged.Plain);
        Assert.Equal(HttpStatusCode.OK, (await merged.Plain.PostAsJsonAsync(
            Url($"/api/profiles/{me.Profiles[0].Id}/merge"), new { name = "Gà Con", deviceProfileId = merged.ProfileId }, Ct)).StatusCode);
        Assert.Equal("transfer_invalid", await CodeAsync(await RedeemAsync(phone, new { secret = mergedCode.Secret })));
        Assert.Equal(0, await QueryAsync(db => db.ProfileTransfers.CountAsync(t => t.ProfileId == deleted.ProfileId || t.ProfileId == merged.ProfileId, Ct)));
    }

    [Fact]
    public async Task A_profile_that_moved_away_cannot_be_brought_into_an_account_by_its_old_device()
    {
        var old = await DevicePhoneAsync("Mèo Cam");
        await RedeemAsync(await StartedPhoneAsync(), new { secret = (await StartAsync(old)).Secret });
        await Accounts.SignUpAsync(factory, old.Plain, "Chú");
        await Accounts.StepUpAsync(old.Plain);
        var adopt = await old.Plain.PostAsJsonAsync(Url("/api/profiles/adopt"), Upload(old.ProfileId, "Mèo Cam"), Ct);
        Assert.Equal((HttpStatusCode.Conflict, "id_taken"), (adopt.StatusCode, await CodeAsync(adopt)));
        Assert.NotNull(await QueryAsync(db => db.Profiles.Where(p => p.Id == old.ProfileId).Select(p => p.DeviceId).SingleAsync(Ct)));
    }

    [Fact]
    public async Task Moved_away_notes_go_after_90_days_and_with_the_profile()
    {
        var old = await DevicePhoneAsync("Mèo Cam");
        var phone = await StartedPhoneAsync();
        await RedeemAsync(phone, new { secret = (await StartAsync(old)).Secret });
        var second = await DevicePhoneAsync("Gà Con");
        await RedeemAsync(phone, new { secret = (await StartAsync(second)).Secret });
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
            var longAgo = DateTimeOffset.UtcNow.AddDays(-91);
            await db.ProfileMoves.Where(m => m.ProfileId == old.ProfileId).ExecuteUpdateAsync(set => set.SetProperty(m => m.MovedAt, longAgo), Ct);
            await scope.ServiceProvider.GetRequiredService<DeviceCleanup>().RunAsync(Ct);
        }

        Assert.Empty((await old.Plain.GetFromJsonAsync<List<ProfileMoveView>>(Url("/api/devices/moves"), Ct))!);
        Assert.Single((await second.Plain.GetFromJsonAsync<List<ProfileMoveView>>(Url("/api/devices/moves"), Ct))!);

        // Deleted on its new device: nothing of it is kept, the note neither.
        Assert.Equal(HttpStatusCode.NoContent, (await phone.Plain.DeleteAsync(Url($"/api/devices/profiles/{second.ProfileId}"), Ct)).StatusCode);
        Assert.Empty((await second.Plain.GetFromJsonAsync<List<ProfileMoveView>>(Url("/api/devices/moves"), Ct))!);
    }

    // ------------------------------------------------------------------ against guessing

    [Fact]
    public async Task Wrong_six_digit_codes_have_a_limit_per_address_and_the_secret_still_works()
    {
        await using var app = factory.WithWebHostBuilder(builder => builder.UseSetting("Identity:TransferCodeMissesPerAddressPerHour", "2"));
        var old = await DevicePhoneAsync("Mèo Cam");
        var code = await StartAsync(old);
        var wrong = code.Code == "000000" ? "000001" : "000000";

        // A right code gives its slot back: it never counts.
        var guesser = await StartedPhoneAsync(app.CreateClient());
        var right = await StartAsync(await DevicePhoneAsync("Gà Con"));
        Assert.Equal("asked", (await ReadAsync<TransferView>(await RedeemAsync(guesser, new { code = right.Code }))).State);
        Assert.Equal("transfer_invalid", await CodeAsync(await RedeemAsync(guesser, new { code = wrong })));
        Assert.Equal("transfer_invalid", await CodeAsync(await RedeemAsync(guesser, new { code = wrong })));
        var limited = await RedeemAsync(guesser, new { code = code.Code });
        Assert.Equal((HttpStatusCode.TooManyRequests, "transfer_limit"), (limited.StatusCode, await CodeAsync(limited)));
        Assert.Equal("done", (await ReadAsync<TransferView>(await RedeemAsync(guesser, new { secret = code.Secret }))).State);
    }

    [Fact]
    public async Task Past_the_servers_wrong_codes_six_digits_take_a_proof_of_work_instead_of_being_shut()
    {
        await using var app = factory.WithWebHostBuilder(builder => builder
            .UseSetting("Identity:TransferCodeMissesPerHour", "2")
            .UseSetting("Identity:ProofOfWorkMaxNumber", "2000"));
        var old = await DevicePhoneAsync("Mèo Cam");
        var code = await StartAsync(old);
        var wrong = code.Code == "000000" ? "000001" : "000000";

        var guesser = await StartedPhoneAsync(app.CreateClient());
        var another = await StartedPhoneAsync(app.CreateClient());
        Assert.Equal("transfer_invalid", await CodeAsync(await RedeemAsync(guesser, new { code = wrong })));
        Assert.Equal("transfer_invalid", await CodeAsync(await RedeemAsync(another, new { code = wrong })));

        // The console's switch is off, yet six digits now take a solved challenge — and still work with one.
        var asked = await RedeemAsync(another, new { code = code.Code });
        Assert.Equal((HttpStatusCode.BadRequest, "proof_of_work_required"), (asked.StatusCode, await CodeAsync(asked)));
        var challenge = (await another.Plain.GetFromJsonAsync<ProofOfWorkChallenge>(Url("/api/auth/challenge"), Ct))!;
        var number = Enumerable.Range(0, challenge.MaxNumber + 1).First(n => ProofOfWork.Hash(challenge.Salt, n) == challenge.Challenge);
        var solved = await RedeemAsync(another, new { code = code.Code, proof = new ProofOfWorkSolution(challenge.Token, number) });
        Assert.Equal("asked", (await ReadAsync<TransferView>(solved)).State);
    }

    [Fact]
    public async Task A_code_carries_at_most_a_megabyte_and_a_device_two_in_its_live_codes()
    {
        var old = await DevicePhoneAsync("Mèo Cam");
        var big = new string('x', 60_000);
        object Saves(int count) => new { saves = Enumerable.Range(0, count).Select(i => new { gameId = $"game-{i}", data = new { big }, updatedAt = DateTimeOffset.UtcNow }) };

        var tooBig = await old.Plain.PostAsJsonAsync(Url($"/api/devices/profiles/{old.ProfileId}/transfer"), new { termsVersion = Terms, data = Saves(17) }, Ct);
        Assert.Equal((HttpStatusCode.BadRequest, "upload_too_large"), (tooBig.StatusCode, await CodeAsync(tooBig)));

        // Two codes of 0.9 MB on one device; a third does not fit, and replacing one does.
        var ids = new List<Guid> { old.ProfileId };
        for (var i = 0; i < 2; i++)
        {
            var id = Guid.NewGuid();
            Assert.Equal(HttpStatusCode.OK, (await old.Plain.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(id, $"Bé {i}"), Ct)).StatusCode);
            ids.Add(id);
        }

        Assert.Equal(HttpStatusCode.OK, (await old.Plain.PostAsJsonAsync(Url($"/api/devices/profiles/{ids[0]}/transfer"), new { termsVersion = Terms, data = Saves(15) }, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await old.Plain.PostAsJsonAsync(Url($"/api/devices/profiles/{ids[1]}/transfer"), new { termsVersion = Terms, data = Saves(15) }, Ct)).StatusCode);
        var third = await old.Plain.PostAsJsonAsync(Url($"/api/devices/profiles/{ids[2]}/transfer"), new { termsVersion = Terms, data = Saves(15) }, Ct);
        Assert.Equal((HttpStatusCode.BadRequest, "upload_too_large"), (third.StatusCode, await CodeAsync(third)));
        Assert.Equal(HttpStatusCode.OK, (await old.Plain.PostAsJsonAsync(Url($"/api/devices/profiles/{ids[1]}/transfer"), new { termsVersion = Terms, data = Saves(15) }, Ct)).StatusCode);
    }

    [Fact]
    public async Task Redeeming_has_the_auth_code_bucket_per_address()
    {
        await using var app = factory.WithWebHostBuilder(builder => builder.UseSetting("Identity:AuthRequestsPerMinute", "2"));
        var phone = await StartedPhoneAsync(app.CreateClient());
        Assert.Equal(HttpStatusCode.NotFound, (await RedeemAsync(phone, new { code = "111111" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await RedeemAsync(phone, new { secret = "nope" })).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await RedeemAsync(phone, new { code = "222222" })).StatusCode);
    }

    [Fact]
    public async Task With_the_console_switch_on_redeeming_takes_a_solved_challenge()
    {
        await using var app = factory.WithWebHostBuilder(builder => builder.UseSetting("Identity:ProofOfWorkMaxNumber", "2000"));
        var old = await DevicePhoneAsync("Mèo Cam");
        var code = await StartAsync(old);
        var owner = await Admins.NewAsync(factory, "owner", app);
        await owner.Client.PutAsJsonAsync(Url("/api/admin/settings"), new { proofOfWork = true }, Ct);
        try
        {
            var phone = await StartedPhoneAsync(app.CreateClient());
            var refused = await RedeemAsync(phone, new { secret = code.Secret });
            Assert.Equal((HttpStatusCode.BadRequest, "proof_of_work_required"), (refused.StatusCode, await CodeAsync(refused)));

            var challenge = (await phone.Plain.GetFromJsonAsync<ProofOfWorkChallenge>(Url("/api/auth/challenge"), Ct))!;
            var number = Enumerable.Range(0, challenge.MaxNumber + 1).First(n => ProofOfWork.Hash(challenge.Salt, n) == challenge.Challenge);
            var solved = await RedeemAsync(phone, new { secret = code.Secret, proof = new ProofOfWorkSolution(challenge.Token, number) });
            Assert.Equal("done", (await ReadAsync<TransferView>(solved)).State);
        }
        finally
        {
            await owner.Client.PutAsJsonAsync(Url("/api/admin/settings"), new { proofOfWork = false }, Ct);
        }
    }

    // ------------------------------------------------------------------ moving back, and the moved device's key

    [Fact]
    public async Task Moving_back_clears_the_note_and_a_device_left_with_no_profile_keeps_its_key_to_hear_it()
    {
        var old = await DevicePhoneAsync("Mèo Cam");
        var phone = await StartedPhoneAsync();
        await RedeemAsync(phone, new { secret = (await StartAsync(old)).Secret });

        // The cleanup of bare keys keeps a device that a profile moved away from.
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
            var oldDevice = await DeviceOfAsync(old);
            var yesterday = DateTimeOffset.UtcNow.AddDays(-2);
            await db.Devices.Where(d => d.Id == oldDevice).ExecuteUpdateAsync(set => set.SetProperty(d => d.CreatedAt, yesterday), Ct);
            await scope.ServiceProvider.GetRequiredService<DeviceCleanup>().RunAsync(Ct);
        }

        Assert.Single((await old.Plain.GetFromJsonAsync<List<ProfileMoveView>>(Url("/api/devices/moves"), Ct))!);

        // Back to the old device: its note goes, the new device's comes.
        var back = await phone.Plain.PostAsJsonAsync(Url($"/api/devices/profiles/{old.ProfileId}/transfer"), new { termsVersion = Terms }, Ct);
        var secret = (await ReadAsync<TransferCodeView>(back)).Secret;
        Assert.Equal("done", (await ReadAsync<TransferView>(await RedeemAsync(old, new { secret }))).State);
        Assert.Empty((await old.Plain.GetFromJsonAsync<List<ProfileMoveView>>(Url("/api/devices/moves"), Ct))!);
        Assert.Single((await phone.Plain.GetFromJsonAsync<List<ProfileMoveView>>(Url("/api/devices/moves"), Ct))!);
        Assert.Equal(HttpStatusCode.OK, (await old.Client.GetAsync(Url("/api/rooms/mine"), Ct)).StatusCode);
    }

    // ------------------------------------------------------------------ merge aliases

    [Fact]
    public async Task A_merged_copys_id_is_an_alias_replays_and_invites_find_the_target_and_the_id_is_taken()
    {
        var device = await DevicePhoneAsync("Mèo Cam");
        var bo = await PersonAsync("Bố");
        var room = await CreateAsync(bo, new { gameId = "tien-len", seats = 3 });
        var me = await Accounts.SignUpAsync(factory, device.Plain, "Chú");
        await Accounts.StepUpAsync(device.Plain);
        var target = me.Profiles[0].Id;
        var merged = await device.Plain.PostAsJsonAsync(Url($"/api/profiles/{target}/merge"), new { name = "Mèo Cam", deviceProfileId = device.ProfileId }, Ct);
        Assert.Equal(HttpStatusCode.OK, merged.StatusCode);
        var alias = await QueryAsync(db => db.ProfileAliases.AsNoTracking().SingleAsync(a => a.OldId == device.ProfileId, Ct));
        Assert.Equal(target, alias.ProfileId);

        // Sent again, its answer lost: the same target, idempotently; another of the account's profiles is not it.
        var again = await device.Plain.PostAsJsonAsync(Url($"/api/profiles/{target}/merge"), new { name = "Mèo Cam", deviceProfileId = device.ProfileId }, Ct);
        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        Assert.Equal(1, await QueryAsync(db => db.ProfileNameHistory.CountAsync(n => n.ProfileId == target && n.Kind == ProfileNameKind.Merged, Ct)));
        var second = await device.Plain.PostAsJsonAsync(Url("/api/profiles"), new { name = "Út", avatar = ProfileOptions.Avatars[1] }, Ct);
        var other = (await ReadAsync<MeView>(second)).Profiles.Single(p => p.Name == "Út").Id;
        var elsewhere = await device.Plain.PostAsJsonAsync(Url($"/api/profiles/{other}/merge"), new { name = "Mèo Cam", deviceProfileId = device.ProfileId }, Ct);
        Assert.Equal((HttpStatusCode.Conflict, "id_taken"), (elsewhere.StatusCode, await CodeAsync(elsewhere)));

        // Its old id is taken: a new copy, adopting it.
        var phone = await StartedPhoneAsync();
        var copy = await phone.Plain.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(device.ProfileId, "Mèo"), Ct);
        Assert.Equal((HttpStatusCode.Conflict, "id_taken"), (copy.StatusCode, await CodeAsync(copy)));
        await Accounts.StepUpAsync(bo.Client);
        var adopt = await bo.Client.PostAsJsonAsync(Url("/api/profiles/adopt"), Upload(device.ProfileId, "Mèo"), Ct);
        Assert.Equal((HttpStatusCode.Conflict, "id_taken"), (adopt.StatusCode, await CodeAsync(adopt)));

        // An alias alone takes its id, whether or not the id was retired too.
        var aliasOnly = Guid.NewGuid();
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
            db.ProfileAliases.Add(new ProfileAlias { OldId = aliasOnly, ProfileId = target, CreatedAt = DateTimeOffset.UtcNow });
            await db.SaveChangesAsync(Ct);
        }

        var aliased = await phone.Plain.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(aliasOnly, "Mèo"), Ct);
        Assert.Equal((HttpStatusCode.Conflict, "id_taken"), (aliased.StatusCode, await CodeAsync(aliased)));
        var aliasedAdopt = await bo.Client.PostAsJsonAsync(Url("/api/profiles/adopt"), Upload(aliasOnly, "Mèo"), Ct);
        Assert.Equal((HttpStatusCode.Conflict, "id_taken"), (aliasedAdopt.StatusCode, await CodeAsync(aliasedAdopt)));

        // A hand recorded under the old id as the merge was made: the target replays it, and counts it.
        await SatAsync(room.Id, device.ProfileId);
        await PlayAsAsync(device.Plain, target);
        var replay = await device.Plain.GetAsync(Url($"/api/rooms/{room.Id}/hands/1"), Ct);
        Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
        var history = (await device.Plain.GetFromJsonAsync<List<HandSummary>>(Url("/api/rooms/history?game=tien-len"), Ct))!;
        Assert.Equal(room.Id, Assert.Single(history).RoomId);
        Assert.Equal(1, (await device.Plain.GetFromJsonAsync<RoomStatsView>(Url("/api/rooms/stats?game=tien-len"), Ct))!.AllTime.Hands);

        // Asked to a table by its old id: the target is asked.
        var invite = await bo.Client.PostAsJsonAsync(Url($"/api/rooms/{room.Id}/invite"), new { profileId = device.ProfileId }, Ct);
        Assert.Equal(HttpStatusCode.NoContent, invite.StatusCode);
        Assert.Equal(room.Id, Assert.Single((await device.Plain.GetFromJsonAsync<List<RoomInvite>>(Url("/api/rooms/invites"), Ct))!).RoomId);

        // Deleting the target retires its aliases' ids with its own; the aliases go.
        await Accounts.StepUpAsync(device.Plain);
        Assert.Equal(HttpStatusCode.OK, (await device.Plain.DeleteAsync(Url($"/api/profiles/{target}"), Ct)).StatusCode);
        Assert.Equal(0, await QueryAsync(db => db.ProfileAliases.CountAsync(a => a.ProfileId == target, Ct)));
        Assert.Equal(1, await QueryAsync(db => db.RetiredProfileIds.CountAsync(r => r.ProfileId == device.ProfileId, Ct)));
        Assert.Equal(1, await QueryAsync(db => db.RetiredProfileIds.CountAsync(r => r.ProfileId == aliasOnly, Ct)));
        Assert.Equal(1, await QueryAsync(db => db.RetiredProfileIds.CountAsync(r => r.ProfileId == target, Ct)));
    }

    // ------------------------------------------------------------------ helpers

    /// <summary>
    /// One browser: <paramref name="Client"/> acts as the device profile (its headers name it), <paramref name="Plain"/>
    /// shares its cookies without naming it.
    /// </summary>
    private sealed record Phone(HttpClient Client, HttpClient Plain, CookieJar Jar, Guid ProfileId);

    private sealed record Person(HttpClient Client, MeView Me, Guid ProfileId);

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

    /// <summary>A device of another host built over the same database (its own settings): one client, its own cookies.</summary>
    private static async Task<Phone> StartedPhoneAsync(HttpClient client)
    {
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync(Url("/api/devices"), null, Ct)).StatusCode);
        return new Phone(client, client, null!, Guid.Empty);
    }

    private async Task<Phone> DevicePhoneAsync(string name)
    {
        var phone = await StartedPhoneAsync();
        var id = Guid.NewGuid();
        Assert.Equal(HttpStatusCode.OK, (await phone.Client.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(id, name), Ct)).StatusCode);
        var acting = phone with { ProfileId = id };
        Name(acting);
        return acting;
    }

    /// <summary>Its client names the device profile, as the hub does at tables.</summary>
    private static void Name(Phone phone)
    {
        phone.Client.DefaultRequestHeaders.Remove(DeviceKey.ProfileHeader);
        phone.Client.DefaultRequestHeaders.Remove(DeviceKey.TermsHeader);
        phone.Client.DefaultRequestHeaders.Add(DeviceKey.ProfileHeader, phone.ProfileId.ToString());
        phone.Client.DefaultRequestHeaders.Add(DeviceKey.TermsHeader, Terms);
    }

    private async Task<Guid?> DeviceOfAsync(Phone phone)
    {
        // A profile of the phone made just to read its device; deleted again.
        var probe = Guid.NewGuid();
        await phone.Plain.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(probe, "Thử"), Ct);
        var device = await QueryAsync(db => db.Profiles.Where(p => p.Id == probe).Select(p => p.DeviceId).SingleAsync(Ct));
        await phone.Plain.DeleteAsync(Url($"/api/devices/profiles/{probe}"), Ct);
        return device;
    }

    private static async Task<TransferCodeView> StartAsync(Phone phone, object? data = null)
    {
        var response = await phone.Plain.PostAsJsonAsync(Url($"/api/devices/profiles/{phone.ProfileId}/transfer"), new { termsVersion = Terms, data }, Ct);
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync(Ct));
        return await ReadAsync<TransferCodeView>(response);
    }

    private static Task<HttpResponseMessage> RedeemAsync(Phone phone, object redemption) =>
        phone.Plain.PostAsJsonAsync(Url("/api/devices/transfers/redeem"), redemption, Ct);

    private static object Save(string gameId) =>
        new { gameId, data = new { level = 7 }, updatedAt = DateTimeOffset.UtcNow.AddMinutes(-5) };

    private static object Score(Guid clientId, double value) =>
        new { clientId, gameId = "merge-block", board = "score", value, achievedAt = DateTimeOffset.UtcNow.AddMinutes(-5), final = true };

    private static object Registration(Guid id, string name) =>
        new { id, name, avatar = ProfileOptions.Avatars[2], termsVersion = Terms };

    private static object Upload(Guid id, string name) => new { id, name, avatar = ProfileOptions.Avatars[2] };

    private async Task<Person> PersonAsync(string displayName)
    {
        var jar = new CookieJar(factory.Server.CreateHandler());
        var client = new HttpClient(jar) { BaseAddress = factory.Server.BaseAddress };
        var me = await Accounts.SignUpAsync(factory, client, displayName);
        await PlayAsAsync(client, me.Profiles[0].Id);
        return new Person(client, me, me.Profiles[0].Id);
    }

    private static async Task PlayAsAsync(HttpClient client, Guid profileId)
    {
        var response = await client.PutAsJsonAsync(Url("/api/session/profile"), new { profileId }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task<RoomView> CreateAsync(Person person, object request)
    {
        var response = await person.Client.PostAsJsonAsync(Url("/api/rooms"), request, Ct);
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync(Ct));
        return await ReadAsync<RoomView>(response);
    }

    private static async Task JoinAsync(Phone phone, Guid roomId)
    {
        var response = await phone.Client.PostAsync(Url($"/api/rooms/{roomId}/join"), null, Ct);
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync(Ct));
    }

    /// <summary>The profile sat at a finished first hand of the room, as the rooms record it.</summary>
    private async Task SatAsync(Guid roomId, Guid profileId)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        db.RoomResults.Add(new RoomResult { RoomId = roomId, GameId = "tien-len", Hand = 1, Seat = 0, ProfileId = profileId, At = DateTimeOffset.UtcNow });
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
        await db.SaveChangesAsync(Ct);
    }

    /// <summary>The profile's code ends <paramref name="fromNow"/> from now (a negative span: it has ended).</summary>
    private async Task ExpireAsync(Guid profileId, TimeSpan fromNow)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var at = DateTimeOffset.UtcNow + fromNow;
        await db.ProfileTransfers.Where(t => t.ProfileId == profileId).ExecuteUpdateAsync(set => set.SetProperty(t => t.ExpiresAt, at), Ct);
    }

    private async Task<T> QueryAsync<T>(Func<ToheDbContext, Task<T>> query)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        return await query(scope.ServiceProvider.GetRequiredService<ToheDbContext>());
    }

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync(Ct));
        return (await response.Content.ReadFromJsonAsync<T>(Ct))!;
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

        throw new InvalidOperationException("Build games/tien-len first (pnpm --filter @tohe/game-tien-len build).");
    }
}
