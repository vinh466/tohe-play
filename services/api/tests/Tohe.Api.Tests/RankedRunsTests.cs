using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Integrity;
using Tohe.Api.Modules.Progress;

namespace Tohe.Api.Tests;

/// <summary>
/// Ranked runs (ADR 0030): the server deals the seed, the game hands its moves in, the server replays them with the
/// game's own verify module — verified when the score agrees, rejected when it does not or a move is not legal, held when
/// it was faster than a person.
/// </summary>
public sealed class RankedRunsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    /// <summary>A verify module: each move scores its value times a number the seed decides; a negative move is illegal.</summary>
    private const string Verify = """
        export const verify = {
          replay({ seed, moves }) {
            let score = 0;
            for (const move of moves) {
              if (typeof move !== 'number' || move < 0) return { error: 'not a move' };
              score += move * ((seed % 7) + 1);
            }
            return { score, over: moves.length > 0 };
          },
          bot() { return null; },
        };
        """;

    [Fact]
    public async Task A_run_replayed_to_its_score_is_verified_and_counts_where_only_verified_runs_do()
    {
        await Games.KnowRankedGameAsync(factory, "scorer", Verify);
        var (client, me) = await PlayerAsync("Bố");
        await JoinCommunityAsync(me);

        var run = await StartAsync(client, "scorer");
        var score = 6 * ((run.Seed % 7) + 1);
        Assert.Equal(HttpStatusCode.Accepted, (await FinishAsync(client, run.Run, [1, 2, 3], score)).StatusCode);
        // A run handed in twice (an answer lost on the way) is taken once; other moves are not.
        Assert.Equal(HttpStatusCode.Accepted, (await FinishAsync(client, run.Run, [1, 2, 3], score)).StatusCode);
        Assert.Equal("run_finished", await CodeOfAsync(await FinishAsync(client, run.Run, [3, 2, 1, 0], score)));
        await ReplayAsync();

        var result = await ResultOfAsync(run.Run);
        Assert.Equal((TrustLevel.Verified, (double)score), (result.Level, result.Value));
        Assert.Equal("replayed", await ReasonOfAsync(result.Id));

        // A device's own score, higher but only checked, counts on neither public board of a game the server replays.
        var scores = new[] { new ScoreInput(Guid.NewGuid(), "scorer", "default", score + 100, DateTimeOffset.UtcNow) };
        await client.PostAsJsonAsync(Url("/api/progress/scores"), new { scores }, Ct);
        foreach (var scope in (string[])["server", "community"])
        {
            var board = (await client.GetFromJsonAsync<PublicBoardView>(Url($"/api/boards/scorer/public?scope={scope}"), Ct))!;
            Assert.True(board.Reproducible);
            var row = Assert.Single(board.Top);
            Assert.Equal(((double)score, true), (row.Value, row.Verified));
        }
    }

    [Fact]
    public async Task A_replay_that_disagrees_or_meets_a_move_that_is_not_legal_is_rejected()
    {
        await Games.KnowRankedGameAsync(factory, "scorer", Verify);
        var (client, _) = await PlayerAsync("Bố");
        var wrong = await StartAsync(client, "scorer");
        await FinishAsync(client, wrong.Run, [1, 1], 999_999);
        await ReplayAsync();
        var illegal = await StartAsync(client, "scorer");
        await FinishAsync(client, illegal.Run, [1, -1], 1);
        await ReplayAsync();

        var mismatch = await ResultOfAsync(wrong.Run);
        Assert.Equal((TrustLevel.Rejected, "replay_mismatch"), (mismatch.Level, await ReasonOfAsync(mismatch.Id)));
        var refused = await ResultOfAsync(illegal.Run);
        Assert.Equal((TrustLevel.Rejected, "illegal_move"), (refused.Level, await ReasonOfAsync(refused.Id)));
    }

    [Fact]
    public async Task A_run_faster_than_a_person_is_held()
    {
        await Games.KnowRankedGameAsync(factory, "pacer", Verify, minMsPerMove: 60_000);
        var (client, _) = await PlayerAsync("Bố");
        var run = await StartAsync(client, "pacer");
        await FinishAsync(client, run.Run, [1], (run.Seed % 7) + 1);
        await ReplayAsync();

        var held = await ResultOfAsync(run.Run);
        Assert.Equal((TrustLevel.Held, "too_fast"), (held.Level, await ReasonOfAsync(held.Id)));
    }

    [Fact]
    public async Task One_open_run_per_game_and_only_ranked_games_deal_them()
    {
        await Games.KnowRankedGameAsync(factory, "scorer", Verify);
        await Games.KnowAsync(factory, "merge-block");
        var (client, _) = await PlayerAsync("Bố");

        var first = await StartAsync(client, "scorer");
        var second = await StartAsync(client, "scorer");
        Assert.NotEqual(first.Run, second.Run);
        Assert.Equal("run_closed", await CodeOfAsync(await FinishAsync(client, first.Run, [1], 1)));
        Assert.Contains("too_many_moves", (await ErrorsAsync(await FinishAsync(client, second.Run, [1, 1, 1, 1, 1, 1], 6)))["moves"]);

        foreach (var game in (string[])["merge-block", "khong-co-game"])
        {
            var refused = await client.PostAsJsonAsync(Url("/api/runs"), new { gameId = game }, Ct);
            Assert.Equal((HttpStatusCode.NotFound, "not_ranked"), (refused.StatusCode, await CodeOfAsync(refused)));
        }

        var (stranger, _) = await PlayerAsync("Người lạ");
        Assert.Equal(HttpStatusCode.NotFound, (await FinishAsync(stranger, second.Run, [1], 1)).StatusCode);
    }

    [Fact]
    public void Ghép_Khối_s_verify_module_replays_in_Jint_the_same_way_every_time()
    {
        var host = new VerifyHost(File.ReadAllText(Path.Combine(FindBuild("merge-block", "verify.js"), "verify.js")), TimeSpan.FromSeconds(10));
        const string moves = "[0,1,2,3,4,0,1,2,3,4,2,2]";
        var first = host.Replay(913, moves);
        Assert.Null(first.Error);
        Assert.True(first.Score > 0);
        Assert.Equal(first, new VerifyHost(File.ReadAllText(Path.Combine(FindBuild("merge-block", "verify.js"), "verify.js")), TimeSpan.FromSeconds(10)).Replay(913, moves));
        Assert.Equal("move 0: no_such_column", host.Replay(913, "[9]").Error);
    }

    // ------------------------------------------------------------------ helpers

    private static string FindBuild(string game, string file)
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var dist = Path.Combine(dir.FullName, "games", game, "dist");
            if (File.Exists(Path.Combine(dist, file)))
            {
                return dist;
            }
        }

        throw new FileNotFoundException($"games/{game}/dist/{file} is missing: run pnpm --filter @tohe/game-{game} build");
    }

    private async Task<(HttpClient Client, MeView Me)> PlayerAsync(string name)
    {
        var client = factory.CreateClient();
        var me = await Accounts.SignUpAsync(factory, client, name);
        var response = await client.PutAsJsonAsync(Url("/api/session/profile"), new { profileId = me.Profiles[0].Id }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (client, me);
    }

    private static async Task<RankedRunView> StartAsync(HttpClient client, string game)
    {
        var response = await client.PostAsJsonAsync(Url("/api/runs"), new { gameId = game }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<RankedRunView>(Ct))!;
    }

    private static Task<HttpResponseMessage> FinishAsync(HttpClient client, string run, int[] moves, double score) =>
        client.PostAsJsonAsync(Url($"/api/runs/{run}/finish"), new { moves, score }, Ct);

    private async Task ReplayAsync()
    {
        await using var scope = factory.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<RankedReplays>().RunAsync(Ct);
    }

    private async Task<IntegrityResult> ResultOfAsync(string run)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var source = $"ranked:{run}";
        return await scope.ServiceProvider.GetRequiredService<ToheDbContext>().IntegrityResults
            .AsNoTracking()
            .SingleAsync(result => result.Source == source, Ct);
    }

    private async Task<string> ReasonOfAsync(long result)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<ToheDbContext>().IntegrityDecisions
            .Where(decision => decision.ResultId == result)
            .OrderBy(decision => decision.Id)
            .Select(decision => decision.Reason)
            .LastAsync(Ct);
    }

    private async Task JoinCommunityAsync(MeView player)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var community = new Community { Id = Guid.CreateVersion7(), Name = $"Bạn cờ {Guid.NewGuid():N}", CreatedAt = DateTimeOffset.UtcNow };
        db.Communities.Add(community);
        await db.SaveChangesAsync(Ct);
        await db.Users.Where(account => account.Id == player.Account.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(account => account.CommunityId, community.Id), Ct);
    }

    private static async Task<string?> CodeOfAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    private static async Task<Dictionary<string, string[]>> ErrorsAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.GetProperty("errors").Deserialize<Dictionary<string, string[]>>()!;
    }

    private static Uri Url(string path) => new(path, UriKind.Relative);
}
