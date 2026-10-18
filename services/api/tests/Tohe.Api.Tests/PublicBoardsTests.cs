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
/// Public boards (ADR 0029): a community's and the server's, by trust — only what each audience can trust, only profiles
/// on public boards of accounts that are not suspended, children off until their owner asks them (D-06).
/// </summary>
public sealed class PublicBoardsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    [Fact]
    public async Task A_child_stays_off_public_boards_until_its_owner_says_they_asked_it()
    {
        var (client, me) = await PlayerAsync("Bố");
        Assert.True(me.Profiles[0].OnPublicBoards);
        await Accounts.StepUpAsync(client);
        var child = await AddChildAsync(client, "Na");
        Assert.False(child.OnPublicBoards);

        var unasked = await client.PatchAsJsonAsync(Url($"/api/profiles/{child.Id}"), new { onPublicBoards = true }, Ct);
        Assert.Contains("asked_child_required", (await ErrorsAsync(unasked))["askedChild"]);
        var asked = await client.PatchAsJsonAsync(Url($"/api/profiles/{child.Id}"), new { onPublicBoards = true, askedChild = true }, Ct);
        Assert.True((await asked.Content.ReadFromJsonAsync<MeView>(Ct))!.Profiles.Single(p => p.Id == child.Id).OnPublicBoards);
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var askedAt = await scope.ServiceProvider.GetRequiredService<ToheDbContext>().Profiles
                .Where(p => p.Id == child.Id).Select(p => p.AskedChildAt).SingleAsync(Ct);
            Assert.NotNull(askedAt);
        }

        // An adult switches off, and on again, without anyone to ask.
        var off = await client.PatchAsJsonAsync(Url($"/api/profiles/{me.Profiles[0].Id}"), new { onPublicBoards = false }, Ct);
        Assert.False((await off.Content.ReadFromJsonAsync<MeView>(Ct))!.Profiles[0].OnPublicBoards);
    }

    [Fact]
    public async Task The_server_board_counts_refereed_hands_with_two_people_of_profiles_on_public_boards()
    {
        await Games.KnowRoomGameAsync(factory, "bai-cao");
        var (client, first) = await PlayerAsync("Ba");
        var (_, second) = await PlayerAsync("Bốn");
        var (_, hidden) = await PlayerAsync("Ẩn");
        var (_, suspended) = await PlayerAsync("Bị khoá");
        var (_, alone) = await PlayerAsync("Một mình");
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var results = scope.ServiceProvider.GetRequiredService<IResults>();
            var now = DateTimeOffset.UtcNow;
            results.SubmitHand("bai-cao", Guid.NewGuid(), 1, [Seat(0, first, 0, 3), Seat(1, second, 1, 1)], now);
            results.SubmitHand("bai-cao", Guid.NewGuid(), 1, [Seat(0, first, 1, 1), Seat(1, hidden, 0, 3), Seat(2, suspended, 2, 0)], now);
            results.SubmitHand("bai-cao", Guid.NewGuid(), 1, [Seat(0, alone, 0, 3), new HandSeat(1, null, null, 1, 1)], now);
            var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
            await db.SaveChangesAsync(Ct);
            await db.Profiles.Where(p => p.Id == hidden.Profiles[0].Id).ExecuteUpdateAsync(s => s.SetProperty(p => p.OnPublicBoards, false), Ct);
            await db.Users.Where(a => a.Id == suspended.Account.Id).ExecuteUpdateAsync(s => s.SetProperty(a => a.SuspendedAt, now), Ct);
        }

        var board = await PublicAsync(client, "bai-cao", "server");
        Assert.True(board.Hands);
        Assert.Equal([("Ba", 4d, 2, 1), ("Bốn", 1d, 1, 0)], board.Top.Select(row => (row.Name, row.Value, row.Hands!.Value, row.Firsts!.Value)));
        Assert.Equal(1, board.Me!.Rank);
        Assert.Equal(2, board.Players);
    }

    [Fact]
    public async Task A_community_board_takes_checked_runs_labelled_and_the_server_board_only_verified_ones()
    {
        await Games.KnowAsync(factory, "merge-block");
        var community = await CommunityAsync("Bạn cờ");
        var (mine, me) = await PlayerAsync("Bố");
        var (theirs, them) = await PlayerAsync("Cô");
        var (outsider, _) = await PlayerAsync("Người ngoài");
        await JoinAsync(community, me, them);
        await RecordAsync(mine, 300);
        await RecordAsync(theirs, 500);
        await RecordAsync(outsider, 900);

        var board = await PublicAsync(mine, "merge-block", "community");
        Assert.Equal([("Cô", 500d, false), ("Bố", 300d, false)], board.Top.Select(row => (row.Name, row.Value, row.Verified)));
        Assert.Equal(2, board.Me!.Rank);
        Assert.Equal(me.Profiles[0].PublicId, board.Me.PublicId);
        Assert.Empty((await PublicAsync(mine, "merge-block", "server")).Top);

        var none = await outsider.GetAsync(Url("/api/boards/merge-block/public?scope=community"), Ct);
        Assert.Equal((HttpStatusCode.NotFound, "no_community"), (none.StatusCode, await CodeOfAsync(none)));
        Assert.Equal(HttpStatusCode.NotFound, (await mine.GetAsync(Url("/api/boards/khong-co-game/public"), Ct)).StatusCode);
    }

    [Fact]
    public async Task The_top_is_fifty_ties_go_to_who_got_there_first_and_a_viewer_past_it_sees_two_places_on_each_side()
    {
        await Games.KnowAsync(factory, "tap-merge");
        var (client, me) = await PlayerAsync("Bố");
        var start = DateTimeOffset.UtcNow.AddMinutes(-30);
        // 55 others, verified as a replay will make them: 100, 101 … 154 — and two more at 200, the earlier one first.
        var others = await ProfilesAsync(57);
        var runs = others.Take(55).Select((profile, index) => (profile, Value: 100d + index, At: start)).ToList();
        runs.Add((others[55], 200, start.AddMinutes(2)));
        runs.Add((others[56], 200, start.AddMinutes(1)));
        runs.Add((me.Profiles[0].Id, 101.5, start));
        await VerifiedRunsAsync("tap-merge", runs);

        var board = await PublicAsync(client, "tap-merge", "server");
        Assert.Equal(58, board.Players);
        Assert.Equal(PublicBoards.TopSize, board.Top.Count);
        Assert.Equal([others[56], others[55]], board.Top.Take(2).Select(row => row.ProfileId));
        Assert.Equal(56, board.Me!.Rank);
        Assert.Equal([54, 55, 56, 57, 58], board.Around.Select(row => row.Rank));
        Assert.All(board.Top, row => Assert.True(row.Verified));
    }

    // ------------------------------------------------------------------ helpers

    private static HandSeat Seat(int seat, MeView player, int place, int points) =>
        new(seat, player.Profiles[0].Id, player.Account.Id, place, points);

    private async Task<(HttpClient Client, MeView Me)> PlayerAsync(string name)
    {
        var client = factory.CreateClient();
        var me = await Accounts.SignUpAsync(factory, client, name);
        var response = await client.PutAsJsonAsync(Url("/api/session/profile"), new { profileId = me.Profiles[0].Id }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (client, me);
    }

    private static async Task RecordAsync(HttpClient client, double value)
    {
        var scores = new[] { new ScoreInput(Guid.NewGuid(), "merge-block", "default", value, DateTimeOffset.UtcNow) };
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync(Url("/api/progress/scores"), new { scores }, Ct)).StatusCode);
    }

    private static async Task<PublicBoardView> PublicAsync(HttpClient client, string game, string scope) =>
        (await client.GetFromJsonAsync<PublicBoardView>(Url($"/api/boards/{game}/public?scope={scope}&period=week"), Ct))!;

    private async Task<Guid> CommunityAsync(string name)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var community = new Community { Id = Guid.CreateVersion7(), Name = $"{name} {Guid.NewGuid():N}", CreatedAt = DateTimeOffset.UtcNow };
        db.Communities.Add(community);
        await db.SaveChangesAsync(Ct);
        return community.Id;
    }

    private async Task JoinAsync(Guid community, params MeView[] players)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var ids = players.Select(player => player.Account.Id).ToList();
        await scope.ServiceProvider.GetRequiredService<ToheDbContext>().Users
            .Where(account => ids.Contains(account.Id))
            .ExecuteUpdateAsync(s => s.SetProperty(account => account.CommunityId, community), Ct);
    }

    /// <summary>Accounts with one adult profile each, on public boards, made directly: signing up fifty is slow.</summary>
    private async Task<List<Guid>> ProfilesAsync(int count)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var profiles = new List<Guid>();
        for (var i = 0; i < count; i++)
        {
            var account = new Account { Id = Guid.CreateVersion7(), UserName = Guid.NewGuid().ToString("N"), DisplayName = $"Người {i}", CreatedAt = DateTimeOffset.UtcNow };
            db.Users.Add(account);
            var profile = new Profile
            {
                Id = Guid.CreateVersion7(),
                AccountId = account.Id,
                PublicId = ProfileIds.New(),
                Name = $"Người {i}",
                Avatar = ProfileOptions.Avatars[0],
                Kind = ProfileKind.Adult,
                OnPublicBoards = true,
                CreatedAt = DateTimeOffset.UtcNow,
            };
            db.Profiles.Add(profile);
            profiles.Add(profile.Id);
        }

        await db.SaveChangesAsync(Ct);
        return profiles;
    }

    private async Task VerifiedRunsAsync(string game, IEnumerable<(Guid Profile, double Value, DateTimeOffset At)> runs)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var accounts = await db.Profiles.ToDictionaryAsync(profile => profile.Id, profile => profile.AccountId, Ct);
        foreach (var (profile, value, at) in runs)
        {
            db.IntegrityResults.Add(new IntegrityResult
            {
                Kind = ResultKind.Run,
                ProfileId = profile,
                AccountId = accounts[profile],
                GameId = game,
                Board = "default",
                Value = value,
                Source = $"test:{Guid.NewGuid():N}",
                Final = true,
                Level = TrustLevel.Verified,
                At = at,
                RuleVersion = IntegrityEngine.RuleVersion,
            });
        }

        await db.SaveChangesAsync(Ct);
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
