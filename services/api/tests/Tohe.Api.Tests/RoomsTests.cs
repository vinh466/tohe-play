using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Registry;
using Tohe.Api.Modules.Rooms;

namespace Tohe.Api.Tests;

/// <summary>
/// Online rooms (ADR 0016) against the real Tiến lên rules module from games/tien-len/dist (built before the API's
/// tests by turbo), a real PostgreSQL, and a real SignalR client.
/// </summary>
public sealed class RoomsTests(ApiFactory factory) : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private const string Password = "mat-khau-cua-bo";
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

    [Fact]
    public async Task The_registry_tells_the_hub_how_a_game_is_played_at_a_table()
    {
        var bo = await PersonAsync("Bố");
        var games = await bo.Client.GetFromJsonAsync<List<GameSummary>>(Url("/api/games"), Ct);
        var game = Assert.Single(games!, g => g.Id == "tien-len");
        Assert.Equal((2, 4), (game.Rooms!.MinSeats, game.Rooms.MaxSeats));
        Assert.Equal(["easy", "normal", "hard"], game.Rooms.Bots);
        Assert.Contains(game.Rooms.Options.EnumerateArray(), option => option.GetProperty("id").GetString() == "chopChain");
    }

    [Fact]
    public async Task Public_rooms_are_listed_only_for_the_people_who_may_join_them()
    {
        var bo = await PersonAsync("Bố");
        var room = await CreateAsync(bo, new { gameId = "tien-len", seats = 4 });
        Assert.Matches("^[0-9]{6}$", room.Code);
        Assert.Equal((0, "waiting"), (room.MySeat, room.Status));

        var family = await CreateAsync(bo, new { gameId = "tien-len", seats = 2, accountOnly = true });
        var chu = await PersonAsync("Chú");
        var chuSees = await ListAsync(chu);
        Assert.Contains(chuSees, r => r.Id == room.Id);
        Assert.DoesNotContain(chuSees, r => r.Id == family.Id);

        // A child the owner has not allowed sees only the account's own tables (children play on a parent's session).
        var be = await ChildAsync(chu, "Bé");
        Assert.DoesNotContain(await ListAsync(be), r => r.Id == room.Id);
        var na = await ChildAsync(bo, "Na");
        var naSees = await ListAsync(na);
        Assert.Contains(naSees, r => r.Id == family.Id);
        Assert.DoesNotContain(naSees, r => r.Id == room.Id);
    }

    [Fact]
    public async Task A_room_is_joined_by_its_code_and_refuses_who_it_should()
    {
        var bo = await PersonAsync("Bố");
        var room = await CreateAsync(bo, new { gameId = "tien-len", seats = 3 });
        var chu = await PersonAsync("Chú");

        var preview = await chu.Client.GetFromJsonAsync<RoomView>(Url($"/api/rooms/code/{room.Code[..3]} {room.Code[3..]}"), Ct);
        Assert.Equal((room.Id, (int?)null), (preview!.Id, preview.MySeat));
        Assert.Equal(1, (await JoinAsync(chu, room.Id)).MySeat);

        // A child of another account needs its owner's switch.
        var be = await ChildAsync(chu, "Bé");
        var refused = await be.Client.PostAsync(Url($"/api/rooms/{room.Id}/join"), null, Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "parent_permission"), (refused.StatusCode, await CodeAsync(refused)));
        await PlayAsAsync(chu, chu.Me.Profiles[0].Id);
        await UnlockAsync(chu);
        var allowed = await chu.Client.PatchAsJsonAsync(Url($"/api/profiles/{be.ProfileId}"), new { playWithOthers = true }, Ct);
        Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
        await PlayAsAsync(chu, be.ProfileId);
        Assert.Equal(2, (await JoinAsync(chu, room.Id)).MySeat);

        var co = await PersonAsync("Cô");
        var full = await co.Client.PostAsync(Url($"/api/rooms/{room.Id}/join"), null, Ct);
        Assert.Equal((HttpStatusCode.Conflict, "room_full"), (full.StatusCode, await CodeAsync(full)));

        var locked = await bo.Client.PatchAsJsonAsync(Url($"/api/rooms/{room.Id}"), new { locked = true, seats = 4 }, Ct);
        Assert.Equal(HttpStatusCode.OK, locked.StatusCode);
        var door = await co.Client.PostAsync(Url($"/api/rooms/{room.Id}/join"), null, Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "room_locked"), (door.StatusCode, await CodeAsync(door)));
        Assert.Equal(HttpStatusCode.NotFound, (await co.Client.GetAsync(Url("/api/rooms/code/000000x"), Ct)).StatusCode);
    }

    [Fact]
    public async Task Only_the_host_changes_the_room_and_options_must_fit_the_game()
    {
        var bo = await PersonAsync("Bố");
        var room = await CreateAsync(bo, new { gameId = "tien-len", seats = 4, options = new { chopChain = false } });
        Assert.False(room.Options.GetProperty("chopChain").GetBoolean());
        Assert.True(room.Options.GetProperty("cong").GetBoolean());

        var bad = await bo.Client.PostAsJsonAsync(Url("/api/rooms"), new { gameId = "tien-len", options = new { points = "money" } }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);

        var chu = await PersonAsync("Chú");
        await JoinAsync(chu, room.Id);
        var notHost = await chu.Client.PatchAsJsonAsync(Url($"/api/rooms/{room.Id}"), new { turnSeconds = 0 }, Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "not_host"), (notHost.StatusCode, await CodeAsync(notHost)));
        var bot = await bo.Client.PutAsJsonAsync(Url($"/api/rooms/{room.Id}/seats/2"), new { bot = "hard" }, Ct);
        var view = (await bot.Content.ReadFromJsonAsync<RoomView>(Ct))!;
        Assert.Equal("hard", view.SeatList[2].Bot);
    }

    [Fact]
    public async Task A_hand_is_played_to_the_end_with_bots_then_the_next_one_starts()
    {
        var bo = await PersonAsync("Bố");
        // No instant wins, so both hands are played: about 3 % of four-seat deals end at once otherwise (the game's
        // own tests cover them).
        var room = await CreateAsync(bo, new
        {
            gameId = "tien-len",
            seats = 4,
            botLevel = "easy",
            turnSeconds = 0,
            options = new { instantWins = Array.Empty<string>() },
        });
        await using var table = await TableAsync(bo, room.Id);

        var started = await bo.Client.PostAsync(Url($"/api/rooms/{room.Id}/start"), null, Ct);
        Assert.Equal(HttpStatusCode.OK, started.StatusCode);
        var after = await WaitForAsync(bo, room.Id, r => r.Status == "between", TimeSpan.FromSeconds(60));

        Assert.Equal(0, after.Scores.Sum());
        Assert.Equal([0, 1, 2, 3], after.HandSeats);
        Assert.True(table.Views.Count > 5);
        Assert.All(table.Views, view =>
        {
            Assert.Equal(0, view["seat"]!.GetValue<int>());
            // Other hands are only shown once the hand is over.
            if (!view["over"]!.GetValue<bool>())
            {
                Assert.Null(view["revealed"]);
            }
        });

        Assert.Null(await table.Hub.InvokeAsync<string?>("Next", room.Id, Ct));
        var next = await WaitForAsync(bo, room.Id, r => r.Hand == 2, TimeSpan.FromSeconds(10));
        Assert.Equal("playing", next.Status);
    }

    [Fact]
    public async Task A_finished_hand_counts_in_the_stats_and_replays_to_the_same_result()
    {
        var bo = await PersonAsync("Bố");
        var room = await CreateAsync(bo, new { gameId = "tien-len", seats = 2, botLevel = "easy", turnSeconds = 0 });
        await using (var table = await TableAsync(bo, room.Id))
        {
            await bo.Client.PostAsync(Url($"/api/rooms/{room.Id}/start"), null, Ct);
            await WaitForAsync(bo, room.Id, r => r.Status == "between", TimeSpan.FromSeconds(60));
        }

        var stats = await bo.Client.GetFromJsonAsync<RoomStatsView>(Url("/api/rooms/stats?game=tien-len"), Ct);
        Assert.Equal(1, stats!.AllTime.Hands);
        Assert.Equal(stats.AllTime, stats.Week);
        var row = Assert.Single(stats.Account);
        Assert.Equal((bo.ProfileId, "Bố", 1), (row.ProfileId, row.Name, row.Hands));

        var history = await bo.Client.GetFromJsonAsync<List<HandSummary>>(Url("/api/rooms/history?game=tien-len"), Ct);
        var played = Assert.Single(history!);
        Assert.Equal((room.Id, 1, 2), (played.RoomId, played.Hand, played.Players));

        var replay = await bo.Client.GetFromJsonAsync<HandReplay>(Url($"/api/rooms/{room.Id}/hands/1"), Ct);
        Assert.Equal(played.Seat, replay!.MySeat);
        Assert.Equal(2, replay.Seats.Count);

        // The game's own rules module, given the seed, options, carry and actions, ends the hand the same way.
        var rules = new RulesHost(File.ReadAllText(Path.Combine(FindGameBuild(), "rules.js")), TimeSpan.FromSeconds(10));
        var state = rules.Setup(replay.Seats.Count, replay.Seed, replay.Options.GetRawText(), replay.Carry.GetRawText());
        foreach (var action in replay.Actions)
        {
            var step = JsonNode.Parse(rules.Act(state, action.Seat, action.Action.GetRawText()))!;
            Assert.True(step["ok"]!.GetValue<bool>());
            state = step["state"]!.ToJsonString();
        }

        var status = JsonNode.Parse(rules.Status(state))!;
        Assert.True(status["over"]!.GetValue<bool>());
        Assert.Equal(replay.Result.GetProperty("points").GetRawText(), status["result"]!["points"]!.ToJsonString());

        // Nobody else sees the hand again: its seed reveals every card.
        var chu = await PersonAsync("Chú");
        Assert.Equal(HttpStatusCode.NotFound, (await chu.Client.GetAsync(Url($"/api/rooms/{room.Id}/hands/1"), Ct)).StatusCode);
        Assert.Empty((await chu.Client.GetFromJsonAsync<RoomStatsView>(Url("/api/rooms/stats?game=tien-len"), Ct))!.Account);
    }

    [Fact]
    public async Task Spectators_see_the_table_without_any_hand_when_the_host_allows_them()
    {
        var bo = await PersonAsync("Bố");
        var closed = await CreateAsync(bo, new { gameId = "tien-len", seats = 2 });
        var open = await CreateAsync(bo, new { gameId = "tien-len", seats = 2, botLevel = "easy", turnSeconds = 0, spectators = true });
        var chu = await PersonAsync("Chú");

        var refused = await chu.Client.PostAsync(Url($"/api/rooms/{closed.Id}/watch"), null, Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "spectators_off"), (refused.StatusCode, await CodeAsync(refused)));
        var watching = await chu.Client.PostAsync(Url($"/api/rooms/{open.Id}/watch"), null, Ct);
        var room = (await watching.Content.ReadFromJsonAsync<RoomView>(Ct))!;
        Assert.Equal(((int?)null, true), (room.MySeat, room.Watchers.Contains(chu.ProfileId)));

        await using var player = await TableAsync(bo, open.Id);
        await using var watcher = await TableAsync(chu, open.Id, autoplay: false);
        await bo.Client.PostAsync(Url($"/api/rooms/{open.Id}/start"), null, Ct);
        var seen = await watcher.NextViewAsync(_ => true);
        Assert.Null(seen["seat"]?.GetValue<int?>());
        Assert.Empty(seen["hand"]!.AsArray());
        // Leaving as a watcher gives up nothing at the table.
        Assert.Equal(HttpStatusCode.NoContent, (await chu.Client.PostAsync(Url($"/api/rooms/{open.Id}/leave"), null, Ct)).StatusCode);
    }

    [Fact]
    public async Task An_invitation_opens_a_locked_door_for_the_family_but_never_the_parent_switch()
    {
        var bo = await PersonAsync("Bố");
        var family = await CreateAsync(bo, new { gameId = "tien-len", seats = 3, accountOnly = true });
        var others = await CreateAsync(bo, new { gameId = "tien-len", seats = 3 });
        foreach (var id in new[] { family.Id, others.Id })
        {
            Assert.Equal(HttpStatusCode.OK, (await bo.Client.PatchAsJsonAsync(Url($"/api/rooms/{id}"), new { locked = true }, Ct)).StatusCode);
        }

        var na = await ChildAsync(bo, "Na");
        await PlayAsAsync(bo, bo.ProfileId);
        var chu = await PersonAsync("Chú");
        var stranger = await bo.Client.PostAsJsonAsync(Url($"/api/rooms/{family.Id}/invite"), new { profileId = chu.ProfileId }, Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "not_in_account"), (stranger.StatusCode, await CodeAsync(stranger)));
        foreach (var id in new[] { family.Id, others.Id })
        {
            var invited = await bo.Client.PostAsJsonAsync(Url($"/api/rooms/{id}/invite"), new { profileId = na.ProfileId }, Ct);
            Assert.Equal(HttpStatusCode.NoContent, invited.StatusCode);
        }

        await PlayAsAsync(bo, na.ProfileId);
        var invites = await bo.Client.GetFromJsonAsync<List<RoomInvite>>(Url("/api/rooms/invites"), Ct);
        Assert.Equal(2, invites!.Count);
        Assert.All(invites, invite => Assert.Equal("Bố", invite.FromName));
        Assert.Equal(1, (await JoinAsync(bo, family.Id)).MySeat);
        // The other table has people from other accounts: a child without the owner's switch stays out.
        var blocked = await bo.Client.PostAsync(Url($"/api/rooms/{others.Id}/join"), null, Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "parent_permission"), (blocked.StatusCode, await CodeAsync(blocked)));
        Assert.Single((await bo.Client.GetFromJsonAsync<List<RoomInvite>>(Url("/api/rooms/invites"), Ct))!);
    }

    [Fact]
    public async Task A_refused_action_comes_back_with_the_rules_error_code()
    {
        var bo = await PersonAsync("Bố");
        var room = await CreateAsync(bo, new { gameId = "tien-len", seats = 2, botLevel = "easy", turnSeconds = 0 });
        await using var table = await TableAsync(bo, room.Id, autoplay: false);
        await bo.Client.PostAsync(Url($"/api/rooms/{room.Id}/start"), null, Ct);
        var view = await table.NextViewAsync(v => v["turn"]!.GetValue<int>() == 0 || v["over"]!.GetValue<bool>());
        if (view["over"]!.GetValue<bool>())
        {
            return; // an instant win on the deal: nothing to refuse
        }

        var error = await table.Hub.InvokeAsync<string?>("Act", room.Id, JsonSerializer.SerializeToElement(new { type = "play", cards = new[] { 999 } }), Ct);
        Assert.Equal("not_your_cards", error);
        var notSeated = await (await PersonAsync("Chú")).Client.PostAsync(Url($"/api/rooms/{room.Id}/leave"), null, Ct);
        Assert.Equal(HttpStatusCode.NotFound, notSeated.StatusCode);
    }

    [Fact]
    public async Task A_restart_rebuilds_the_hand_in_progress_from_its_actions()
    {
        var bo = await PersonAsync("Bố");
        // No out-of-turn chops, so the bots stay still while it is the person's turn.
        var room = await CreateAsync(bo, new { gameId = "tien-len", seats = 3, botLevel = "easy", turnSeconds = 0, options = new { chopOutOfTurn = false } });
        await using (var table = await TableAsync(bo, room.Id, autoplay: false))
        {
            await bo.Client.PostAsync(Url($"/api/rooms/{room.Id}/start"), null, Ct);
            await table.NextViewAsync(v => v["turn"]!.GetValue<int>() == 0 || v["over"]!.GetValue<bool>());
        }

        var registry = factory.Services.GetRequiredService<RoomRegistry>();
        var live = registry.Find(room.Id)!;
        var state = await live.RunAsync(() => Task.FromResult(live.State));

        var rebuilt = ActivatorUtilities.CreateInstance<RoomRegistry>(factory.Services);
        await rebuilt.LoadAsync(Ct);
        var again = rebuilt.Find(room.Id);
        Assert.NotNull(again);
        Assert.Equal(state, await again.RunAsync(() => Task.FromResult(again.State)));
    }

    [Fact]
    public void A_hard_bot_decides_well_within_the_rules_time_limit()
    {
        var rules = new RulesHost(File.ReadAllText(Path.Combine(FindGameBuild(), "rules.js")), TimeSpan.FromSeconds(60));
        var options = JsonSerializer.Serialize(new { instantWins = Array.Empty<string>() });
        var state = rules.Setup(4, 20261016, options, null);
        var turn = JsonNode.Parse(rules.Status(state))!["turn"]![0]!.GetValue<int>();
        // A few moves in, so the bot has choices to weigh.
        for (var i = 0; i < 6; i++)
        {
            var move = JsonNode.Parse(rules.Act(state, turn, rules.Bot(state, turn, "normal", i)))!;
            state = move["state"]!.ToJsonString();
            turn = JsonNode.Parse(rules.Status(state))!["turn"]![0]!.GetValue<int>();
        }

        var watch = System.Diagnostics.Stopwatch.StartNew();
        var action = rules.Bot(state, turn, "hard", 7);
        watch.Stop();
        TestContext.Current.SendDiagnosticMessage($"hard bot in Jint: {watch.ElapsedMilliseconds} ms");
        Assert.True(JsonNode.Parse(rules.Act(state, turn, action))!["ok"]!.GetValue<bool>());
        // About 0.5 s on the owner's workstation (docs/research/online-rooms.md); the bound only catches a look-ahead
        // that became many times slower, even on a machine busy running every test at once.
        Assert.True(watch.Elapsed < TimeSpan.FromSeconds(20), $"{watch.ElapsedMilliseconds} ms");
    }

    [Fact]
    public async Task A_bot_that_runs_out_of_time_plays_the_timer_move_so_the_table_goes_on()
    {
        // A rules module whose bot never decides: two seats, seat 0 a bot; a move is { n }, the hand ends after two.
        const string source = """
            export const rules = {
              setup: () => ({ moves: 0, turn: 0 }),
              view: (state, seat) => ({ ...state, seat }),
              act: (state, seat, action) => seat === state.turn
                ? { ok: true, state: { moves: state.moves + 1, turn: 1 - state.turn }, events: [action] }
                : { ok: false, error: 'not_your_turn' },
              status: (state) => state.moves >= 2
                ? { over: true, result: { points: [0, 0] }, carry: null }
                : { over: false, turn: [state.turn], chop: [] },
              timeout: (state, seat) => ({ timer: seat }),
              bot: () => { for (;;) {} },
            };
            """;
        var outbox = new RecordingOutbox();
        var host = Guid.NewGuid();
        var room = new Room
        {
            Id = Guid.NewGuid(),
            Code = "123456",
            GameId = "test",
            GameVersion = "1.0.0",
            RulesPath = "test/1.0.0/rules.js",
            HostProfileId = host,
            Seats = 2,
            BotsFill = true,
            BotLevel = "normal",
            Status = RoomStatus.Waiting,
            SeatList = JsonSerializer.Serialize(new[] { SeatRecord.Empty, new SeatRecord(host, Guid.NewGuid(), "Bố", "🦊", null) }),
        };
        var options = new RoomsOptions { BotThinkMinMs = 0, BotThinkMaxMs = 0 };
        var actor = new RoomActor(room, outbox, options, TimeProvider.System, _ => Task.FromResult(new RulesHost(source, TimeSpan.FromMilliseconds(200))));

        Assert.Null(await actor.RunAsync(() => actor.StartAsync(host, 2, Ct)));
        await Task.Delay(10, Ct);
        await actor.RunAsync(() => actor.TickAsync(2, Ct));

        var action = Assert.Single(outbox.Actions);
        Assert.Equal((0, """{"timer":0}"""), (action.Seat, action.Action));
    }

    /// <summary>The person's cookie jar for a hub connection, which disposes its handler when it closes.</summary>
    private sealed class Borrowed(HttpMessageHandler inner) : DelegatingHandler(inner)
    {
        // The jar stays with the person: their HTTP client keeps using it after the table closes.
        protected override void Dispose(bool disposing)
        {
        }
    }

    /// <summary>An outbox that keeps what a room sends and stores, without phones or a database.</summary>
    private sealed class RecordingOutbox : IRoomOutbox
    {
        public List<RoomAction> Actions { get; } = [];

        public Task RoomChangedAsync(RoomActor room) => Task.CompletedTask;

        public Task ViewAsync(Guid roomId, Guid profileId, string view, string events, int seq, int? turnMs) => Task.CompletedTask;

        public Task ReactionAsync(Guid roomId, int seat, string reaction) => Task.CompletedTask;

        public Task LobbyChangedAsync(string gameId) => Task.CompletedTask;

        public Task ClosedAsync(Guid roomId, string reason) => Task.CompletedTask;

        public Task SaveRoomAsync(Room room) => Task.CompletedTask;

        public Task SaveActionAsync(RoomAction action)
        {
            Actions.Add(action);
            return Task.CompletedTask;
        }

        public Task SaveHandAsync(RoomHand hand, IReadOnlyList<RoomResult> results) => Task.CompletedTask;
    }

    [Fact]
    public void The_rules_engine_refuses_randomness_and_code_that_never_ends()
    {
        var random = new RulesHost("export const rules = { setup() { return Math.random(); } };", TimeSpan.FromSeconds(2));
        Assert.Throws<RulesException>(() => random.Setup(2, 1, "{}", null));
        var forever = new RulesHost("export const rules = { setup() { for (;;) {} } };", TimeSpan.FromMilliseconds(200));
        Assert.Throws<RulesException>(() => forever.Setup(2, 1, "{}", null));
    }

    [Fact]
    public async Task The_hub_refuses_pages_of_other_origins()
    {
        var bo = await PersonAsync("Bố");
        using var request = new HttpRequestMessage(HttpMethod.Post, Url("/api/rooms/hub/negotiate?negotiateVersion=1"));
        request.Headers.Add("Origin", "http://evil.example");
        var response = await bo.Client.SendAsync(request, Ct);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // ------------------------------------------------------------------ helpers

    private sealed record Person(HttpClient Client, CookieJar Jar, MeView Me, Guid ProfileId);

    private sealed class Table(HubConnection hub) : IAsyncDisposable
    {
        public HubConnection Hub { get; } = hub;

        public ConcurrentQueue<JsonNode> Views { get; } = new();

        public readonly SemaphoreSlim Arrived = new(0);

        public async Task<JsonNode> NextViewAsync(Func<JsonNode, bool> wanted)
        {
            var deadline = DateTime.UtcNow.AddSeconds(30);
            while (DateTime.UtcNow < deadline)
            {
                if (Views.LastOrDefault() is { } latest && wanted(latest))
                {
                    return latest;
                }

                await Arrived.WaitAsync(TimeSpan.FromMilliseconds(200), Ct);
            }

            throw new TimeoutException("no such view");
        }

        public async ValueTask DisposeAsync() => await Hub.DisposeAsync();
    }

    /// <summary>Sits at the table through the hub; with <paramref name="autoplay"/> the person plays like the turn timer.</summary>
    private async Task<Table> TableAsync(Person person, Guid roomId, bool autoplay = true)
    {
        var hub = new HubConnectionBuilder()
            .WithUrl(new Uri(factory.Server.BaseAddress, "api/rooms/hub"), options =>
            {
                options.HttpMessageHandlerFactory = _ => new Borrowed(person.Jar);
                options.Transports = HttpTransportType.LongPolling;
            })
            .Build();
        var table = new Table(hub);
        hub.On<Guid, JsonElement, JsonElement, int, int?>("View", (_, view, _, _, _) =>
        {
            var node = JsonNode.Parse(view.GetRawText())!;
            table.Views.Enqueue(node);
            table.Arrived.Release();
            if (autoplay && !node["over"]!.GetValue<bool>() && node["turn"]!.GetValue<int>() == node["seat"]!.GetValue<int>())
            {
                // Like the turn timer: pass, or lead the lowest card (3♠ when it must).
                var hand = node["hand"]!.AsArray().Select(card => card!.GetValue<int>()).ToList();
                object action = node["table"] is JsonObject
                    ? new { type = "pass" }
                    : new { type = "play", cards = new[] { node["mustInclude"]?.GetValue<int>() ?? hand.Min() } };
                _ = Task.Run(() => hub.InvokeAsync<string?>("Act", roomId, JsonSerializer.SerializeToElement(action)));
            }
        });
        await hub.StartAsync(Ct);
        var view = await hub.InvokeAsync<RoomView?>("Enter", roomId, Ct);
        Assert.NotNull(view);
        return table;
    }

    private async Task<RoomView> WaitForAsync(Person person, Guid roomId, Func<RoomView, bool> wanted, TimeSpan timeout)
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

        throw new TimeoutException($"room never got there; last status {room?.Status}, hand {room?.Hand}");
    }

    private async Task<Person> PersonAsync(string displayName)
    {
        var jar = new CookieJar(factory.Server.CreateHandler());
        var client = new HttpClient(jar) { BaseAddress = factory.Server.BaseAddress };
        var response = await client.PostAsJsonAsync(
            Url("/api/auth/register"),
            new { displayName, username = $"u{Guid.NewGuid():N}"[..16], password = Password },
            Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var me = (await response.Content.ReadFromJsonAsync<MeView>(Ct))!;
        var person = new Person(client, jar, me, me.Profiles[0].Id);
        await PlayAsAsync(person, person.ProfileId);
        return person;
    }

    /// <summary>A child profile of the person's account, played on the same device (same session).</summary>
    private static async Task<Person> ChildAsync(Person parent, string name)
    {
        await UnlockAsync(parent);
        var response = await parent.Client.PostAsJsonAsync(
            Url("/api/profiles"),
            new { name, avatar = ProfileOptions.Avatars[1], ageBand = "9-12" },
            Ct);
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

    private static async Task UnlockAsync(Person person)
    {
        var response = await person.Client.PostAsJsonAsync(Url("/api/session/parent-gate"), new { password = Password }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task<RoomView> CreateAsync(Person person, object request)
    {
        var response = await person.Client.PostAsJsonAsync(Url("/api/rooms"), request, Ct);
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync(Ct));
        return (await response.Content.ReadFromJsonAsync<RoomView>(Ct))!;
    }

    private static async Task<RoomView> JoinAsync(Person person, Guid roomId)
    {
        var response = await person.Client.PostAsync(Url($"/api/rooms/{roomId}/join"), null, Ct);
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync(Ct));
        return (await response.Content.ReadFromJsonAsync<RoomView>(Ct))!;
    }

    private static async Task<List<RoomSummary>> ListAsync(Person person) =>
        (await person.Client.GetFromJsonAsync<List<RoomSummary>>(Url("/api/rooms?game=tien-len"), Ct))!;

    private static Uri Url(string path) => new(path, UriKind.Relative);

    private static async Task<string?> CodeAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    /// <summary>games/tien-len/dist, built by turbo before the API's tests (services/api/package.json).</summary>
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
