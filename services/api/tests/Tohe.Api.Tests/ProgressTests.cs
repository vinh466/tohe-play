using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Progress;

namespace Tohe.Api.Tests;

public sealed class ProgressTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string Password = "mat-khau-cua-bo";
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    [Fact]
    public async Task Progress_needs_a_chosen_profile()
    {
        var (client, _) = await RegisterAsync("Bố");
        await client.DeleteAsync(Url("/api/session/profile"), Ct); // back to "Ai đang chơi?"

        var response = await client.GetAsync(Url("/api/progress/saves"), Ct);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("profile_required", await CodeAsync(response));
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync(Url("/api/progress/saves"), Ct)).StatusCode);
    }

    [Fact]
    public async Task A_save_round_trips_and_the_last_write_wins_keeping_the_one_it_replaced()
    {
        var (client, me) = await RegisterAsync("Bố");
        await PlayAsAsync(client, me.Profiles[0].Id);

        await PutSaveAsync(client, "merge-block", new { score = 10 });
        var second = await PutSaveAsync(client, "merge-block", new { score = 42 });

        var saves = await client.GetFromJsonAsync<List<SavedGameView>>(Url("/api/progress/saves"), Ct);
        var save = Assert.Single(saves!);
        Assert.Equal(("merge-block", 42), (save.GameId, save.Data.GetProperty("score").GetInt32()));
        Assert.Equal(second.UpdatedAt, save.UpdatedAt);

        await using var scope = factory.Services.CreateAsyncScope();
        var stored = await scope.ServiceProvider.GetRequiredService<ToheDbContext>().SavedGames
            .SingleAsync(s => s.ProfileId == me.Profiles[0].Id, Ct);
        Assert.Contains("10", stored.PreviousData, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Saves_belong_to_one_profile()
    {
        var (client, me) = await RegisterAsync("Bố");
        await UnlockAsync(client);
        var child = await AddChildAsync(client, "Na");
        await PlayAsAsync(client, child.Id);
        await PutSaveAsync(client, "hello", new { best = 7 });

        await PlayAsAsync(client, me.Profiles[0].Id);

        Assert.Empty((await client.GetFromJsonAsync<List<SavedGameView>>(Url("/api/progress/saves"), Ct))!);
    }

    [Fact]
    public async Task Oversized_saves_and_unknown_game_ids_are_refused()
    {
        var (client, me) = await RegisterAsync("Bố");
        await PlayAsAsync(client, me.Profiles[0].Id);

        var big = await client.PutAsJsonAsync(Url("/api/progress/saves/hello"), new { data = new { blob = new string('x', 70_000) } }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, big.StatusCode);
        var badId = await client.PutAsJsonAsync(Url("/api/progress/saves/Not_A_Game"), new { data = new { } }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, badId.StatusCode);
    }

    [Fact]
    public async Task Scores_are_stored_once_and_the_leaderboard_ranks_the_accounts_profiles_only()
    {
        var (client, me) = await RegisterAsync("Bố");
        await UnlockAsync(client);
        var child = await AddChildAsync(client, "Na");

        await PlayAsAsync(client, me.Profiles[0].Id);
        var dadRun = Score("merge-block", 120);
        Assert.Equal(2, await RecordAsync(client, dadRun, Score("merge-block", 80)));
        Assert.Equal(0, await RecordAsync(client, dadRun));

        await PlayAsAsync(client, child.Id);
        await RecordAsync(client, Score("merge-block", 300), Score("hello", 999));

        // Another family's record must not show up.
        var (stranger, strangerMe) = await RegisterAsync("Người lạ");
        await PlayAsAsync(stranger, strangerMe.Profiles[0].Id);
        await RecordAsync(stranger, Score("merge-block", 5000));

        var board = await client.GetFromJsonAsync<List<LeaderboardEntry>>(Url("/api/progress/leaderboard/merge-block"), Ct);
        Assert.Equal([("Na", 300d), ("Bố", 120d)], board!.Select(e => (e.Name, e.Value)));
    }

    [Fact]
    public async Task A_long_run_is_one_score_that_rises_and_shows_in_progress_until_it_is_final()
    {
        var (client, me) = await RegisterAsync("Bố");
        await PlayAsAsync(client, me.Profiles[0].Id);
        var run = Guid.NewGuid();
        ScoreInput Report(double value, bool final) => new(run, "merge-block", "default", value, DateTimeOffset.UtcNow, final);

        await RecordAsync(client, Report(100, final: false));
        await RecordAsync(client, Report(350, final: false));
        Assert.Equal(0, await RecordAsync(client, Report(200, final: false))); // lower, nothing changes

        var live = Assert.Single((await client.GetFromJsonAsync<List<LeaderboardEntry>>(Url("/api/progress/leaderboard/merge-block"), Ct))!);
        Assert.Equal((350d, true), (live.Value, live.InProgress));

        await RecordAsync(client, Report(350, final: true));
        var done = Assert.Single((await client.GetFromJsonAsync<List<LeaderboardEntry>>(Url("/api/progress/leaderboard/merge-block"), Ct))!);
        Assert.Equal((350d, false), (done.Value, done.InProgress));

        await using var scope = factory.Services.CreateAsyncScope();
        Assert.Equal(1, await scope.ServiceProvider.GetRequiredService<ToheDbContext>().Scores.CountAsync(s => s.ClientId == run, Ct));
    }

    // ------------------------------------------------------------------ helpers

    private static ScoreInput Score(string gameId, double value) =>
        new(Guid.NewGuid(), gameId, "default", value, DateTimeOffset.UtcNow);

    private static async Task<int> RecordAsync(HttpClient client, params ScoreInput[] scores)
    {
        var response = await client.PostAsJsonAsync(Url("/api/progress/scores"), new { scores }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<RecordScoresResult>(Ct))!.Recorded;
    }

    private static async Task<SavedGameView> PutSaveAsync(HttpClient client, string gameId, object data)
    {
        var response = await client.PutAsJsonAsync(Url($"/api/progress/saves/{gameId}"), new { data }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<SavedGameView>(Ct))!;
    }

    private static async Task PlayAsAsync(HttpClient client, Guid profileId)
    {
        var response = await client.PutAsJsonAsync(Url("/api/session/profile"), new { profileId }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private async Task<(HttpClient Client, MeView Me)> RegisterAsync(string displayName)
    {
        var client = factory.CreateClient();
        return (client, await Accounts.SignUpAsync(factory, client, displayName));
    }

    private static async Task UnlockAsync(HttpClient client)
    {
        await Accounts.StepUpAsync(client);
    }

    private static async Task<ProfileView> AddChildAsync(HttpClient client, string name)
    {
        var response = await client.PostAsJsonAsync(
            Url("/api/profiles"),
            new { name, avatar = ProfileOptions.Avatars[1], ageBand = "6-8" },
            Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<MeView>(Ct))!.Profiles.Single(p => p.Name == name);
    }

    private static Uri Url(string path) => new(path, UriKind.Relative);

    private static async Task<string?> CodeAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }
}
