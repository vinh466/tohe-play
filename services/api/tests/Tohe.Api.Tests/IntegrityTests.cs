using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Tohe.Api.Infrastructure;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Integrity;
using Tohe.Api.Modules.Progress;

namespace Tohe.Api.Tests;

/// <summary>
/// The integrity engine (ADR 0029): a level for every result from its evidence, conservatively — hard proof rejects,
/// anything else that looks wrong is held — every change of level logged for good, and the account's board reading by
/// it, this week or all time.
/// </summary>
public sealed class IntegrityTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    [Fact]
    public async Task A_run_that_passes_the_rules_is_checked_and_every_level_it_had_is_logged()
    {
        await Games.KnowAsync(factory, "merge-block");
        var (client, me) = await PlayerAsync("Bố");
        var quick = Guid.NewGuid();
        var growing = Guid.NewGuid();

        await RecordAsync(client, Run(quick, 120), Run(growing, 50, final: false));
        Assert.Equal(TrustLevel.Reported, (await ResultAsync(me, growing)).Level);
        await RecordAsync(client, Run(growing, 80));

        var done = await ResultAsync(me, quick);
        Assert.Equal(TrustLevel.Checked, done.Level);
        Assert.Equal([(null, TrustLevel.Checked, "checked")], await DecisionsAsync(done.Id));
        var grown = await ResultAsync(me, growing);
        Assert.Equal((TrustLevel.Checked, 80d), (grown.Level, grown.Value));
        Assert.Equal(
            [(null, TrustLevel.Reported, "in_progress"), (TrustLevel.Reported, TrustLevel.Checked, "checked")],
            await DecisionsAsync(grown.Id));
    }

    [Fact]
    public async Task A_score_for_a_game_the_registry_never_knew_is_rejected_and_on_no_board()
    {
        var (client, me) = await PlayerAsync("Bố");
        var run = Guid.NewGuid();
        await RecordAsync(client, Run(run, 999, game: "khong-co-game"));

        var result = await ResultAsync(me, run);
        Assert.Equal(TrustLevel.Rejected, result.Level);
        Assert.Equal([(null, TrustLevel.Rejected, "unknown_game")], await DecisionsAsync(result.Id));
        Assert.Empty((await BoardAsync(client, "khong-co-game", "all")).Rows);
    }

    [Fact]
    public async Task A_best_far_above_its_own_history_is_held_and_only_its_player_sees_it_under_review()
    {
        await Games.KnowAsync(factory, "merge-block");
        var (client, me) = await PlayerAsync("Bố");
        await Accounts.StepUpAsync(client);
        var child = await AddChildAsync(client, "Na");
        await PlayAsAsync(client, me.Profiles[0].Id);
        await RecordAsync(client, [.. Enumerable.Range(0, IntegrityEngine.JumpHistory).Select(_ => Run(Guid.NewGuid(), 100))]);

        var jump = Guid.NewGuid();
        await RecordAsync(client, Run(jump, 100 * IntegrityEngine.JumpFactor + 1));
        var held = await ResultAsync(me, jump);
        Assert.Equal(TrustLevel.Held, held.Level);
        var (_, _, reason) = Assert.Single(await DecisionsAsync(held.Id));
        Assert.Equal("personal_jump", reason);

        // Its player sees it, labelled; the rest of the account sees the best it can trust.
        var mine = Assert.Single((await BoardAsync(client, "merge-block", "all")).Rows);
        Assert.Equal((501d, true), (mine.Value, mine.UnderReview));
        await PlayAsAsync(client, child.Id);
        var theirs = Assert.Single((await BoardAsync(client, "merge-block", "all")).Rows);
        Assert.Equal((100d, false), (theirs.Value, theirs.UnderReview));

        // A run that does not move a board is not looked at more closely.
        await PlayAsAsync(client, me.Profiles[0].Id);
        var small = Guid.NewGuid();
        await RecordAsync(client, Run(small, 90));
        Assert.Equal(TrustLevel.Checked, (await ResultAsync(me, small)).Level);
    }

    [Fact]
    public async Task Runs_arriving_faster_than_a_person_plays_are_held()
    {
        await Games.KnowAsync(factory, "tap-merge");
        var (client, me) = await PlayerAsync("Bố");
        var runs = Enumerable.Range(1, IntegrityEngine.RateLimit + 1)
            .Select(value => Run(Guid.NewGuid(), value, game: "tap-merge"))
            .ToArray();
        await RecordAsync(client, runs);

        await using var scope = factory.Services.CreateAsyncScope();
        var levels = await scope.ServiceProvider.GetRequiredService<ToheDbContext>().IntegrityResults
            .Where(result => result.ProfileId == me.Profiles[0].Id && result.GameId == "tap-merge")
            .OrderBy(result => result.Value)
            .Select(result => result.Level)
            .ToListAsync(Ct);
        Assert.All(levels[..IntegrityEngine.RateLimit], level => Assert.Equal(TrustLevel.Checked, level));
        Assert.Equal(TrustLevel.Held, levels[^1]);
    }

    [Fact]
    public async Task Once_held_a_run_stays_held_until_a_person_decides()
    {
        await Games.KnowAsync(factory, "tap-merge");
        var (client, me) = await PlayerAsync("Bố");
        var ids = Enumerable.Range(0, IntegrityEngine.RateLimit + 1).Select(_ => Guid.NewGuid()).ToArray();
        await RecordAsync(client, [.. ids.Select((id, index) => Run(id, index + 1, game: "tap-merge"))]);
        var held = await ResultAsync(me, ids[^1]);
        Assert.Equal(TrustLevel.Held, held.Level);

        // Later, the burst long over, it comes again higher and would pass the rules: it stays held.
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            await scope.ServiceProvider.GetRequiredService<ToheDbContext>().IntegrityResults
                .Where(result => result.ProfileId == me.Profiles[0].Id)
                .ExecuteUpdateAsync(s => s.SetProperty(result => result.At, result => result.At.AddMinutes(-11)), Ct);
        }

        await RecordAsync(client, Run(ids[^1], 100, game: "tap-merge"));
        var again = await ResultAsync(me, ids[^1]);
        Assert.Equal((TrustLevel.Held, 100d), (again.Level, again.Value));
        Assert.Single(await DecisionsAsync(again.Id));
    }

    [Fact]
    public async Task A_hand_is_verified_for_every_person_at_the_table_and_public_only_with_two_people()
    {
        var (_, alone) = await PlayerAsync("Một mình");
        var (_, first) = await PlayerAsync("Ba");
        var (_, second) = await PlayerAsync("Bốn");
        var now = DateTimeOffset.UtcNow;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var results = scope.ServiceProvider.GetRequiredService<IResults>();
            results.SubmitHand("tien-len", Guid.NewGuid(), 1, [Seat(0, alone, place: 0, points: 3), new HandSeat(1, null, null, 1, 1)], now);
            results.SubmitHand(
                "tien-len", Guid.NewGuid(), 4, [Seat(0, first, place: 1, points: 1), Seat(1, second, place: 0, points: 3), new HandSeat(2, null, null, 2, 0)], now);
            await scope.ServiceProvider.GetRequiredService<ToheDbContext>().SaveChangesAsync(Ct);
        }

        await using var read = factory.Services.CreateAsyncScope();
        var db = read.ServiceProvider.GetRequiredService<ToheDbContext>();
        var profiles = new[] { alone.Profiles[0].Id, first.Profiles[0].Id, second.Profiles[0].Id };
        var hands = await db.IntegrityResults
            .Where(result => profiles.Contains(result.ProfileId))
            .ToDictionaryAsync(result => result.ProfileId, Ct);
        Assert.All(hands.Values, hand => Assert.Equal((TrustLevel.Verified, ResultKind.Hand), (hand.Level, hand.Kind)));
        Assert.False(hands[alone.Profiles[0].Id].Public);
        Assert.True(hands[first.Profiles[0].Id].Public && hands[second.Profiles[0].Id].Public);

        var board = await read.ServiceProvider.GetRequiredService<IBoards>().AccountHandsAsync(alone.Account.Id, "tien-len", Weeks.StartOf(now), Ct);
        var row = Assert.Single(board);
        Assert.Equal((1, 1, 3), (row.Hands, row.Firsts, row.Points));
    }

    [Fact]
    public async Task Decisions_are_history_nothing_rewrites()
    {
        await Games.KnowAsync(factory, "merge-block");
        var (client, _) = await PlayerAsync("Bố");
        await RecordAsync(client, Run(Guid.NewGuid(), 10));

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        foreach (var sql in (string[])["UPDATE integrity.decisions SET reason = 'rewritten'", "DELETE FROM integrity.decisions", "TRUNCATE integrity.decisions"])
        {
            var refused = await Assert.ThrowsAsync<PostgresException>(() => db.Database.ExecuteSqlRawAsync(sql, Ct));
            Assert.Contains("append-only", refused.MessageText, StringComparison.Ordinal);
        }
    }

    [Fact]
    public async Task The_week_starts_on_monday_in_viet_nam_and_all_time_keeps_every_week()
    {
        // 2026-10-18 is a Sunday: 16:59 UTC is still Sunday in Việt Nam, 17:00 is Monday.
        var sundayNight = new DateTimeOffset(2026, 10, 18, 16, 59, 59, TimeSpan.Zero);
        Assert.Equal(new DateTimeOffset(2026, 10, 11, 17, 0, 0, TimeSpan.Zero), Weeks.StartOf(sundayNight));
        Assert.Equal(new DateTimeOffset(2026, 10, 18, 17, 0, 0, TimeSpan.Zero), Weeks.StartOf(sundayNight.AddSeconds(1)));
        Assert.Equal(new DateTimeOffset(2026, 10, 18, 17, 0, 0, TimeSpan.Zero), Weeks.StartOf(new DateTimeOffset(2026, 10, 25, 16, 0, 0, TimeSpan.Zero)));

        await Games.KnowAsync(factory, "merge-block");
        var (client, me) = await PlayerAsync("Bố");
        var old = Guid.NewGuid();
        await RecordAsync(client, Run(old, 500), Run(Guid.NewGuid(), 200));
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var source = IntegrityEngine.RunSource(me.Profiles[0].Id, old);
            await scope.ServiceProvider.GetRequiredService<ToheDbContext>().IntegrityResults
                .Where(result => result.Source == source)
                .ExecuteUpdateAsync(s => s.SetProperty(result => result.At, result => result.At.AddDays(-8)), Ct);
        }

        Assert.Equal(200d, Assert.Single((await BoardAsync(client, "merge-block", "week")).Rows).Value);
        Assert.Equal(500d, Assert.Single((await BoardAsync(client, "merge-block", "all")).Rows).Value);
        var month = await client.GetAsync(Url("/api/boards/merge-block?period=month"), Ct);
        Assert.Equal(HttpStatusCode.BadRequest, month.StatusCode);
    }

    // ------------------------------------------------------------------ helpers

    private static ScoreInput Run(Guid id, double value, bool final = true, string game = "merge-block") =>
        new(id, game, "default", value, DateTimeOffset.UtcNow, final);

    private static HandSeat Seat(int seat, MeView player, int place, int points) =>
        new(seat, player.Profiles[0].Id, player.Account.Id, place, points);

    private async Task<(HttpClient Client, MeView Me)> PlayerAsync(string name)
    {
        var client = factory.CreateClient();
        var me = await Accounts.SignUpAsync(factory, client, name);
        await PlayAsAsync(client, me.Profiles[0].Id);
        return (client, me);
    }

    private static async Task RecordAsync(HttpClient client, params ScoreInput[] scores)
    {
        var response = await client.PostAsJsonAsync(Url("/api/progress/scores"), new { scores }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task<AccountBoardView> BoardAsync(HttpClient client, string game, string period) =>
        (await client.GetFromJsonAsync<AccountBoardView>(Url($"/api/boards/{game}?period={period}"), Ct))!;

    private async Task<IntegrityResult> ResultAsync(MeView me, Guid run)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var source = IntegrityEngine.RunSource(me.Profiles[0].Id, run);
        return await scope.ServiceProvider.GetRequiredService<ToheDbContext>().IntegrityResults
            .AsNoTracking()
            .SingleAsync(result => result.Source == source, Ct);
    }

    private async Task<List<(TrustLevel? From, TrustLevel To, string Reason)>> DecisionsAsync(long result)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var decisions = await scope.ServiceProvider.GetRequiredService<ToheDbContext>().IntegrityDecisions
            .Where(decision => decision.ResultId == result)
            .OrderBy(decision => decision.Id)
            .Select(decision => new { decision.From, decision.To, decision.Reason })
            .ToListAsync(Ct);
        return [.. decisions.Select(decision => (decision.From, decision.To, decision.Reason))];
    }

    private static async Task PlayAsAsync(HttpClient client, Guid profileId)
    {
        var response = await client.PutAsJsonAsync(Url("/api/session/profile"), new { profileId }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
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
}
