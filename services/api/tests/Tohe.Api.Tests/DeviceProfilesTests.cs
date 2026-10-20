using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Integrity;
using Tohe.Api.Modules.Progress;

namespace Tohe.Api.Tests;

/// <summary>
/// Device profiles brought into accounts (ADR 0043, step I1): the id kept when the server can take it, the name filter,
/// the account's limits and state, and every score that came with a device profile marked and off public boards.
/// </summary>
public sealed class DeviceProfilesTests(ApiFactory factory) : IClassFixture<ApiFactory>, IAsyncDisposable
{
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    private readonly WebApplicationFactory<Program> _app = factory.WithWebHostBuilder(builder =>
        builder.ConfigureTestServices(services =>
        {
            services.AddAuthentication().AddRemoteScheme<FakeProviderOptions, FakeProviderHandler>("fake", "Fake", o =>
                o.SignInScheme = IdentityConstants.ExternalScheme);
            services.AddSingleton(new ExternalProviderCatalog([new ExternalProvider("fake", "Fake")]));
        }));

    public ValueTask DisposeAsync() => _app.DisposeAsync();

    // ------------------------------------------------------------------ signing up

    [Fact]
    public async Task Signing_up_with_the_device_profile_as_ones_own_makes_it_the_first_profile_keeping_its_id()
    {
        await Games.KnowAsync(factory, "merge-block");
        var client = factory.CreateClient();
        var email = Accounts.NewEmail();
        var device = Guid.NewGuid();
        var attempt = await StartAsync(client, email, "Mèo Cam", device);
        var confirmed = await client.PostAsJsonAsync(
            Url("/api/auth/register/confirm"),
            new { attemptId = attempt, code = await factory.CodeSentToAsync(email), deviceProfile = Upload(device, "Mèo Cam", runs: [120, 80]) },
            Ct);
        Assert.Equal(HttpStatusCode.OK, confirmed.StatusCode);
        var me = (await confirmed.Content.ReadFromJsonAsync<MeView>(Ct))!;

        // No empty first profile: the device profile is the account's only one, an adult's, with a 12-digit ID now.
        var profile = Assert.Single(me.Profiles);
        Assert.Equal((device, "Mèo Cam", "🐯", "adult"), (profile.Id, profile.Name, profile.Avatar, profile.Kind));
        Assert.True(ProfileIds.TryNormalize(profile.PublicId, out _));
        Assert.Equal(device, me.ActiveProfileId);

        // Its progress came with it, every score marked as a device profile's.
        var saves = await client.GetFromJsonAsync<List<SavedGameView>>(Url("/api/progress/saves"), Ct);
        Assert.Equal(["merge-block"], saves!.Select(save => save.GameId));
        Assert.Equal([(80d, true), (120d, true)], await MarksAsync(device));
    }

    [Fact]
    public async Task Signing_up_for_a_child_keeps_the_usual_first_profile_and_adds_the_device_profile_as_a_child()
    {
        await Games.KnowAsync(factory, "merge-block");
        var client = factory.CreateClient();
        var email = Accounts.NewEmail();
        var device = Guid.NewGuid();
        var attempt = await StartAsync(client, email, "Mẹ", device);
        var me = await ConfirmAsync(client, email, attempt, Upload(device, "Bé Na", ageBand: "6-8", runs: [40]));

        Assert.Equal(2, me.Profiles.Count);
        Assert.Equal(("Mẹ", "adult"), (me.Profiles[0].Name, me.Profiles[0].Kind));
        Assert.Equal(me.Profiles[0].Id, me.ActiveProfileId);
        var child = me.Profiles.Single(p => p.Id == device);
        Assert.Equal(("Bé Na", "child", "6-8", false, false), (child.Name, child.Kind, child.AgeBand, child.PlayWithOthers, child.OnPublicBoards));
        Assert.Equal("account", child.Invites);
        Assert.Equal([(40d, true)], await MarksAsync(device));
    }

    [Fact]
    public async Task A_link_opened_on_another_device_makes_the_account_the_usual_way()
    {
        var client = factory.CreateClient();
        var email = Accounts.NewEmail();
        var device = Guid.NewGuid();
        var attempt = await StartAsync(client, email, "Bố", device);

        // Another device: no device profile, or one that is not the attempt's.
        var elsewhere = factory.CreateClient();
        var me = await ConfirmAsync(elsewhere, email, attempt, Upload(Guid.NewGuid(), "Khác"));
        var profile = Assert.Single(me.Profiles);
        Assert.Equal("Bố", profile.Name);
        Assert.NotEqual(device, profile.Id);
    }

    [Fact]
    public async Task An_id_the_server_cannot_take_is_refused_before_a_code_is_sent()
    {
        var (_, owner) = await PlayerAsync("Chủ");
        var client = factory.CreateClient();
        var taken = await client.PostAsJsonAsync(
            Url("/api/auth/register"),
            new
            {
                email = Accounts.NewEmail(),
                password = Accounts.Password,
                displayName = "Mèo",
                acceptTerms = true,
                termsVersion = Accounts.TermsVersion,
                deviceProfileId = owner.Profiles[0].Id,
            },
            Ct);
        Assert.Equal((HttpStatusCode.Conflict, "id_taken"), (taken.StatusCode, await CodeOfAsync(taken)));
    }

    [Fact]
    public async Task A_refused_name_is_renamed_first_and_the_same_code_still_works()
    {
        var client = factory.CreateClient();
        var email = Accounts.NewEmail();
        var device = Guid.NewGuid();
        var attempt = await StartAsync(client, email, "Ba", device);
        var code = await factory.CodeSentToAsync(email);

        var refused = await client.PostAsJsonAsync(
            Url("/api/auth/register/confirm"), new { attemptId = attempt, code, deviceProfile = Upload(device, "Admin", ageBand: "9-12") }, Ct);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, refused.StatusCode);
        Assert.Equal(("name_refused", "name_reserved"), await CodeAndReasonAsync(refused));

        var renamed = await client.PostAsJsonAsync(
            Url("/api/auth/register/confirm"), new { attemptId = attempt, code, deviceProfile = Upload(device, "Bé Út", ageBand: "9-12") }, Ct);
        Assert.Equal(HttpStatusCode.OK, renamed.StatusCode);
        Assert.Contains((await renamed.Content.ReadFromJsonAsync<MeView>(Ct))!.Profiles, p => p.Id == device && p.Name == "Bé Út");
    }

    [Fact]
    public async Task With_a_provider_the_id_travels_in_its_state_and_the_sign_up_brings_the_device_profile_in()
    {
        var browser = _app.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        var device = Guid.NewGuid();
        Assert.Equal(
            "/account/sign-in/continue",
            await FakeProvider.ComeBackAsync(browser, Guid.NewGuid().ToString("N"), Accounts.NewEmail(), verified: true, intent: $"?profile={device}"));

        var response = await browser.PostAsJsonAsync(
            Url("/api/auth/external/pending/signup"),
            new { displayName = "Cáo Nhanh", acceptTerms = true, termsVersion = Accounts.TermsVersion, deviceProfile = Upload(device, "Cáo Nhanh") },
            Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var me = (await response.Content.ReadFromJsonAsync<ExternalOutcome>(Ct))!.Me!;
        Assert.Equal(device, Assert.Single(me.Profiles).Id);
    }

    // ------------------------------------------------------------------ signing in: adopting

    [Fact]
    public async Task Adopting_needs_step_up_level_one_then_keeps_the_id_and_marks_every_score()
    {
        await Games.KnowAsync(factory, "merge-block");
        var (client, _) = await PlayerAsync("Bố");
        var device = Guid.NewGuid();
        var locked = await client.PostAsJsonAsync(Url("/api/profiles/adopt"), Upload(device, "Mèo Cam", runs: [10]), Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "parent_gate_required"), (locked.StatusCode, await CodeOfAsync(locked)));

        await Accounts.StepUpAsync(client);
        var adopted = await client.PostAsJsonAsync(Url("/api/profiles/adopt"), Upload(device, "Mèo Cam", runs: [10, 30]), Ct);
        Assert.Equal(HttpStatusCode.OK, adopted.StatusCode);
        var profile = (await adopted.Content.ReadFromJsonAsync<MeView>(Ct))!.Profiles.Single(p => p.Id == device);
        Assert.Equal(("Mèo Cam", "adult", true), (profile.Name, profile.Kind, profile.OnPublicBoards));
        Assert.Equal([(10d, true), (30d, true)], await MarksAsync(device));
    }

    [Fact]
    public async Task An_id_a_profile_has_or_had_is_refused_and_a_new_one_is_taken()
    {
        var (client, me) = await PlayerAsync("Bố");
        await Accounts.StepUpAsync(client);

        var known = await client.PostAsJsonAsync(Url("/api/profiles/adopt"), Upload(me.Profiles[0].Id, "Mèo"), Ct);
        Assert.Equal((HttpStatusCode.Conflict, "id_taken"), (known.StatusCode, await CodeOfAsync(known)));

        // A deleted profile's id is retired with its public ID (ADR 0034): never adopted from a device.
        var added = await client.PostAsJsonAsync(Url("/api/profiles"), new { name = "Tạm", avatar = "🐼" }, Ct);
        var gone = (await added.Content.ReadFromJsonAsync<MeView>(Ct))!.Profiles.Single(p => p.Name == "Tạm");
        Assert.Equal(HttpStatusCode.OK, (await client.DeleteAsync(Url($"/api/profiles/{gone.Id}"), Ct)).StatusCode);
        var retired = await client.PostAsJsonAsync(Url("/api/profiles/adopt"), Upload(gone.Id, "Mèo"), Ct);
        Assert.Equal((HttpStatusCode.Conflict, "id_taken"), (retired.StatusCode, await CodeOfAsync(retired)));

        // The hub gives it a new id and asks again.
        var fresh = await client.PostAsJsonAsync(Url("/api/profiles/adopt"), Upload(Guid.NewGuid(), "Mèo"), Ct);
        Assert.Equal(HttpStatusCode.OK, fresh.StatusCode);
    }

    [Fact]
    public async Task A_name_the_filter_refuses_answers_name_refused()
    {
        var (client, _) = await PlayerAsync("Bố");
        await Accounts.StepUpAsync(client);
        var refused = await client.PostAsJsonAsync(Url("/api/profiles/adopt"), Upload(Guid.NewGuid(), "sh1t head"), Ct);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, refused.StatusCode);
        Assert.Equal(("name_refused", "name_inappropriate"), await CodeAndReasonAsync(refused));
    }

    [Fact]
    public async Task Nothing_comes_into_a_suspended_account_nor_one_waiting_to_be_deleted()
    {
        var (suspended, one) = await PlayerAsync("Bị khoá");
        var (deleting, other) = await PlayerAsync("Chờ xoá");
        await Accounts.StepUpAsync(suspended);
        await Accounts.StepUpAsync(deleting);
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
            await db.Users.Where(a => a.Id == one.Account.Id).ExecuteUpdateAsync(s => s.SetProperty(a => a.SuspendedAt, DateTimeOffset.UtcNow), Ct);
            await db.Users.Where(a => a.Id == other.Account.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.DeleteAfter, DateTimeOffset.UtcNow.AddDays(7)), Ct);
        }

        var refused = await suspended.PostAsJsonAsync(Url("/api/profiles/adopt"), Upload(Guid.NewGuid(), "Mèo"), Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "account_suspended"), (refused.StatusCode, await CodeOfAsync(refused)));
        var ended = await deleting.PostAsJsonAsync(Url($"/api/profiles/{other.Profiles[0].Id}/merge"), new { name = "Mèo" }, Ct);
        Assert.Equal((HttpStatusCode.Unauthorized, "session_ended"), (ended.StatusCode, await CodeOfAsync(ended)));
    }

    [Fact]
    public async Task A_full_account_takes_no_more_and_a_request_has_a_size_limit()
    {
        var (client, _) = await PlayerAsync("Bố");
        await Accounts.StepUpAsync(client);
        var tooMany = Enumerable.Range(0, DeviceProfiles.MaxScores + 1)
            .Select(i => new DeviceScore(Guid.NewGuid(), "merge-block", "default", i, DateTimeOffset.UtcNow))
            .ToList();
        var large = await client.PostAsJsonAsync(
            Url("/api/profiles/adopt"), new DeviceProfileUpload(Guid.NewGuid(), "Mèo", "🐯", null, new DeviceProfileData(null, tooMany)), Ct);
        Assert.Equal((HttpStatusCode.BadRequest, "upload_too_large"), (large.StatusCode, await CodeOfAsync(large)));

        for (var i = 1; i < ProfileOptions.MaxProfilesPerAccount; i++)
        {
            Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync(Url("/api/profiles/adopt"), Upload(Guid.NewGuid(), $"Mèo {i}"), Ct)).StatusCode);
        }

        var full = await client.PostAsJsonAsync(Url("/api/profiles/adopt"), Upload(Guid.NewGuid(), "Mèo nữa"), Ct);
        Assert.Contains("too_many_profiles", (await ErrorsAsync(full))[""]);
    }

    // ------------------------------------------------------------------ merging

    [Fact]
    public async Task Merging_takes_the_newer_save_keeps_the_other_and_puts_the_name_in_the_history()
    {
        await Games.KnowAsync(factory, "merge-block");
        await Games.KnowAsync(factory, "tap-merge");
        var (client, me) = await PlayerAsync("Bố");
        var target = me.Profiles[0].Id;
        await PutSaveAsync(client, "merge-block", """{"level":9}""");
        await PutSaveAsync(client, "tap-merge", """{"level":2}""");
        await Accounts.StepUpAsync(client);

        var data = new DeviceProfileData(
            [
                // Older than the server's: the server's stays, the device's is kept as the previous one.
                new DeviceSave("merge-block", Json("""{"level":3}"""), DateTimeOffset.UtcNow.AddDays(-1)),
                // Newer: it wins, and the server's becomes the previous one.
                new DeviceSave("tap-merge", Json("""{"level":5}"""), DateTimeOffset.UtcNow.AddMinutes(5)),
                // Only on the device: taken.
                new DeviceSave("hello", Json("""{"best":1}"""), DateTimeOffset.UtcNow),
            ],
            [new DeviceScore(Guid.NewGuid(), "merge-block", "default", 77, DateTimeOffset.UtcNow)]);
        var merged = await client.PostAsJsonAsync(Url($"/api/profiles/{target}/merge"), new MergeProfileRequest("Mèo Cam", data), Ct);
        Assert.Equal(HttpStatusCode.OK, merged.StatusCode);
        Assert.Equal("Bố", (await merged.Content.ReadFromJsonAsync<MeView>(Ct))!.Profiles.Single(p => p.Id == target).Name);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var saves = await db.SavedGames.AsNoTracking().Where(s => s.ProfileId == target).ToDictionaryAsync(s => s.GameId, Ct);
        Assert.Equal((9, 3), (Level(saves["merge-block"].Data), Level(saves["merge-block"].PreviousData!)));
        Assert.Equal((5, 2), (Level(saves["tap-merge"].Data), Level(saves["tap-merge"].PreviousData!)));
        Assert.True(saves.ContainsKey("hello"));
        Assert.Contains("Mèo Cam", await db.ProfileNameHistory.Where(n => n.ProfileId == target).Select(n => n.Name).ToListAsync(Ct));
        Assert.Equal([(77d, true)], await MarksAsync(target));
    }

    // ------------------------------------------------------------------ boards

    [Fact]
    public async Task A_device_profiles_results_are_on_no_public_board_even_later()
    {
        await Games.KnowAsync(factory, "merge-block");
        var community = Guid.NewGuid();
        var (client, me) = await PlayerAsync("Bố");
        await Accounts.StepUpAsync(client);
        var device = Guid.NewGuid();
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync(Url("/api/profiles/adopt"), Upload(device, "Mèo Cam", runs: [900]), Ct)).StatusCode);
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
            db.Communities.Add(new Community { Id = community, Name = $"Bạn cờ {community:N}", CreatedAt = DateTimeOffset.UtcNow });
            await db.SaveChangesAsync(Ct);
            await db.Users.Where(a => a.Id == me.Account.Id).ExecuteUpdateAsync(s => s.SetProperty(a => a.CommunityId, community), Ct);
        }

        // Now an account's profile, it plays as any other: what it plays from now on counts.
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync(Url("/api/session/profile"), new { profileId = device }, Ct)).StatusCode);
        var scores = new[] { new ScoreInput(Guid.NewGuid(), "merge-block", "default", 50, DateTimeOffset.UtcNow) };
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync(Url("/api/progress/scores"), new { scores }, Ct)).StatusCode);

        var board = (await client.GetFromJsonAsync<PublicBoardView>(Url("/api/boards/merge-block/public?scope=community&period=week"), Ct))!;
        Assert.Equal([(device, 50d)], board.Top.Select(row => (row.ProfileId, row.Value)));

        // The account's own board counts it.
        var own = (await client.GetFromJsonAsync<AccountBoardView>(Url("/api/boards/merge-block?period=week"), Ct))!;
        Assert.Equal(900, own.Rows.Single(row => row.ProfileId == device).Value);

        // Even verified later, it never reaches the server's board, and the mark cannot be cleared.
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
            await db.IntegrityResults.Where(r => r.ProfileId == device && r.DeviceEarned)
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.Level, TrustLevel.Verified), Ct);
            await Assert.ThrowsAnyAsync<Exception>(() => db.IntegrityResults.Where(r => r.ProfileId == device && r.DeviceEarned)
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.DeviceEarned, false), Ct));
            await Assert.ThrowsAnyAsync<Exception>(() => db.Scores.Where(s => s.ProfileId == device && s.DeviceEarned)
                .ExecuteUpdateAsync(s => s.SetProperty(e => e.DeviceEarned, false), Ct));
        }

        var server = (await client.GetFromJsonAsync<PublicBoardView>(Url("/api/boards/merge-block/public?scope=server&period=week"), Ct))!;
        Assert.DoesNotContain(server.Top, row => row.ProfileId == device);
    }

    [Fact]
    public async Task A_device_profiles_many_runs_are_not_held_for_their_rate_nor_count_for_the_runs_after()
    {
        await Games.KnowAsync(factory, "merge-block");
        var (client, _) = await PlayerAsync("Bố");
        await Accounts.StepUpAsync(client);
        var device = Guid.NewGuid();
        var runs = Enumerable.Range(1, IntegrityEngine.RateLimit + 10).Select(i => (double)i).ToArray();
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync(Url("/api/profiles/adopt"), Upload(device, "Mèo", runs: runs), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync(Url("/api/session/profile"), new { profileId = device }, Ct)).StatusCode);
        var scores = new[] { new ScoreInput(Guid.NewGuid(), "merge-block", "default", 100, DateTimeOffset.UtcNow) };
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync(Url("/api/progress/scores"), new { scores }, Ct)).StatusCode);

        await using var scope = factory.Services.CreateAsyncScope();
        var levels = await scope.ServiceProvider.GetRequiredService<ToheDbContext>().IntegrityResults
            .Where(r => r.ProfileId == device).Select(r => r.Level).ToListAsync(Ct);
        Assert.Equal(runs.Length + 1, levels.Count);
        Assert.All(levels, level => Assert.Equal(TrustLevel.Checked, level));
    }

    // ------------------------------------------------------------------ helpers

    private static DeviceProfileUpload Upload(Guid id, string name, string? ageBand = null, double[]? runs = null) =>
        new(
            id,
            name,
            "🐯",
            ageBand,
            new DeviceProfileData(
                runs is null ? [] : [new DeviceSave("merge-block", Json("""{"level":4}"""), DateTimeOffset.UtcNow)],
                [.. (runs ?? []).Select(value => new DeviceScore(Guid.NewGuid(), "merge-block", "default", value, DateTimeOffset.UtcNow.AddDays(-1)))]));

    private static async Task<Guid> StartAsync(HttpClient client, string email, string displayName, Guid device)
    {
        var started = await client.PostAsJsonAsync(
            Url("/api/auth/register"),
            new { email, password = Accounts.Password, displayName, acceptTerms = true, termsVersion = Accounts.TermsVersion, deviceProfileId = device },
            Ct);
        Assert.Equal(HttpStatusCode.Accepted, started.StatusCode);
        return (await started.Content.ReadFromJsonAsync<AttemptView>(Ct))!.AttemptId;
    }

    private async Task<MeView> ConfirmAsync(HttpClient client, string email, Guid attempt, DeviceProfileUpload? device)
    {
        var confirmed = await client.PostAsJsonAsync(
            Url("/api/auth/register/confirm"),
            new { attemptId = attempt, code = await factory.CodeSentToAsync(email), deviceProfile = device },
            Ct);
        Assert.Equal(HttpStatusCode.OK, confirmed.StatusCode);
        return (await confirmed.Content.ReadFromJsonAsync<MeView>(Ct))!;
    }

    private async Task<(HttpClient Client, MeView Me)> PlayerAsync(string name)
    {
        var client = factory.CreateClient();
        return (client, await Accounts.SignUpAsync(factory, client, name));
    }

    /// <summary>The profile's scores and whether each, and its result, is marked as a device profile's, by value.</summary>
    private async Task<List<(double Value, bool Marked)>> MarksAsync(Guid profileId)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var scores = await db.Scores.AsNoTracking().Where(s => s.ProfileId == profileId).ToListAsync(Ct);
        var results = await db.IntegrityResults.AsNoTracking().Where(r => r.ProfileId == profileId).ToListAsync(Ct);
        Assert.Equal(scores.Count, results.Count);
        return
        [
            .. scores
                .OrderBy(s => s.Value)
                .Select(s => (s.Value, s.DeviceEarned && results.Single(r => r.Source == IntegrityEngine.RunSource(profileId, s.ClientId)).DeviceEarned)),
        ];
    }

    private static async Task PutSaveAsync(HttpClient client, string game, string json)
    {
        var response = await client.PutAsJsonAsync(Url($"/api/progress/saves/{game}"), new { data = Json(json) }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static JsonElement Json(string json) => JsonDocument.Parse(json).RootElement.Clone();

    private static int Level(string json) => JsonDocument.Parse(json).RootElement.GetProperty("level").GetInt32();

    private static async Task<string?> CodeOfAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    private static async Task<(string?, string?)> CodeAndReasonAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return (json.RootElement.GetProperty("code").GetString(), json.RootElement.GetProperty("reason").GetString());
    }

    private static async Task<Dictionary<string, string[]>> ErrorsAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.GetProperty("errors").Deserialize<Dictionary<string, string[]>>()!;
    }

    private static Uri Url(string path) => new(path, UriKind.Relative);
}
