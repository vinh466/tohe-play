using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Integrity;
using Tohe.Api.Modules.Registry;

namespace Tohe.Api.Modules.Rooms;

public sealed class RoomsOptions
{
    public const string Section = "Rooms";

    /// <summary>A disconnected player's seat is held this long before a bot plays it (if the room allows).</summary>
    public int GraceSeconds { get; set; } = 30;

    /// <summary>A room nobody is connected to closes after this long without activity.</summary>
    public int IdleMinutes { get; set; } = 30;

    /// <summary>The next hand starts this long after one ends, if not everyone tapped "next" before.</summary>
    public int NextHandSeconds { get; set; } = 30;

    public int BotThinkMinMs { get; set; } = 600;

    public int BotThinkMaxMs { get; set; } = 1300;

    /// <summary>How soon a bot chops out of turn.</summary>
    public int BotChopMs { get; set; } = 450;

    public TimeSpan ReactionInterval { get; set; } = TimeSpan.FromSeconds(1.5);

    /// <summary>Open rooms one profile may host at once.</summary>
    public int MaxRoomsPerHost { get; set; } = 2;

    /// <summary>Room codes one profile may look up per minute (guessing codes is the only way into a private room).</summary>
    public int CodeLookupsPerMinute { get; set; } = 20;

    /// <summary>
    /// How long a closed table's code is not given out again (ADR 0044), so an old table link never opens a stranger's
    /// table.
    /// </summary>
    public TimeSpan ClosedCodeReserved { get; set; } = TimeSpan.FromDays(1);

    /// <summary>Invitations one account may send to other accounts' profiles in an hour (ADR 0033, D-17).</summary>
    public int InvitationsPerHour { get; set; } = 20;

    /// <summary>Invitations from other accounts that may wait for one profile at a time (ADR 0033, D-17).</summary>
    public int InvitationsWaitingPerProfile { get; set; } = 10;

    /// <summary>The longest one call into a rules module may take (a hard bot's look-ahead is the slowest).</summary>
    public TimeSpan RulesTimeout { get; set; } = TimeSpan.FromSeconds(10);

    public TimeSpan Tick { get; set; } = TimeSpan.FromMilliseconds(200);

    public bool ClockEnabled { get; set; } = true;
}

/// <summary>
/// A table as a link preview may show it (ADR 0044): its game, whether it is listed publicly, and the language it was
/// opened in (ADR 0047).
/// </summary>
/// <param name="Listed">Public, and open to more than its host's account: shown in the lobby to people it may seat.</param>
/// <param name="Language"><c>vi</c> or <c>en</c>: the language of the hub that opened it.</param>
public sealed record RoomPreview(string GameId, bool Listed, string Language);

/// <summary>Open tables by their code, for link previews (ADR 0044).</summary>
public interface IRoomPreviews
{
    /// <summary>The open table with this 6-digit code, or null.</summary>
    RoomPreview? FindByCode(string code);
}

/// <summary>The open rooms: how many, how many in a hand, the profiles connected to them, and the rooms of each game.</summary>
public sealed record LiveRooms(int Open, int Playing, int Online, IReadOnlyDictionary<string, int> OpenByGame);

/// <summary>
/// The rooms in memory, one actor each (ADR 0016), loaded from the database when the API starts so a deploy does not
/// end a table: a hand in progress is rebuilt by replaying its actions.
/// </summary>
internal sealed partial class RoomRegistry(
    IServiceScopeFactory scopes,
    IHubContext<RoomsHub> hub,
    IOptions<RoomsOptions> options,
    TimeProvider clock,
    ILogger<RoomRegistry> logger) : IRoomPreviews
{
    private readonly ConcurrentDictionary<Guid, RoomActor> _rooms = new();
    private readonly ConcurrentDictionary<Guid, int> _minSeats = new();

    public IEnumerable<RoomActor> All => _rooms.Values;

    /// <summary>Draws a table's code: six random digits. Tests replace it to draw a code they chose.</summary>
    internal Func<string> DrawCode { get; set; } =
        () => RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6", System.Globalization.CultureInfo.InvariantCulture);

    /// <summary>The open rooms right now, for the admin console (ADR 0027).</summary>
    public LiveRooms Live()
    {
        var open = _rooms.Values.Where(room => !room.IsClosed).ToList();
        return new LiveRooms(
            open.Count,
            open.Count(room => room.Room.Status == RoomStatus.Playing),
            open.Sum(room => room.Online),
            open.GroupBy(room => room.Room.GameId, StringComparer.Ordinal)
                .ToDictionary(game => game.Key, game => game.Count(), StringComparer.Ordinal));
    }

    public RoomActor? Find(Guid id) => _rooms.TryGetValue(id, out var room) && !room.IsClosed ? room : null;

    public RoomActor? FindByCode(string code) => _rooms.Values.FirstOrDefault(room => !room.IsClosed && room.Room.Code == code);

    RoomPreview? IRoomPreviews.FindByCode(string code) =>
        FindByCode(code) is { } room
            ? new RoomPreview(room.Room.GameId, room.Room.IsPublic && room.Room.Entry != RoomEntry.Own, room.Room.Language)
            : null;

    public int MinSeats(Guid roomId) => _minSeats.TryGetValue(roomId, out var min) ? min : 2;

    public async Task<RoomActor> CreateAsync(Room room, int minSeats, CancellationToken cancellationToken)
    {
        await using (var scope = scopes.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();

            // A code unique among open rooms — in memory, and in the database, should a table be opening as the API starts
            // — and not one a table closed with in the last day (ADR 0044): an old link never opens a stranger's table.
            // At family scale a collision is rare, a retry rarer still.
            var reservedSince = clock.GetUtcNow() - options.Value.ClosedCodeReserved;
            for (var attempt = 0; ; attempt++)
            {
                room.Code = DrawCode();
                var code = room.Code;
                if (attempt > 20
                    || (FindByCode(code) is null
                        && !await db.Rooms.AnyAsync(taken => taken.Code == code && (taken.ClosedAt == null || taken.ClosedAt > reservedSince), cancellationToken)))
                {
                    break;
                }
            }

            db.Rooms.Add(room);
            await db.SaveChangesAsync(cancellationToken);
        }

        var actor = NewActor(room);
        _rooms[room.Id] = actor;
        _minSeats[room.Id] = minSeats;
        await new RoomOutbox(scopes, hub).LobbyChangedAsync(room.GameId);
        return actor;
    }

    private RoomActor NewActor(Room room) => new(
        room,
        new RoomOutbox(scopes, hub),
        options.Value,
        clock,
        async ct =>
        {
            await using var scope = scopes.CreateAsyncScope();
            var source = await scope.ServiceProvider.GetRequiredService<RulesSource>().GetAsync(room.RulesPath, ct);
            return new RulesHost(source, options.Value.RulesTimeout);
        });

    /// <summary>Loads every open room; a hand that cannot be rebuilt (its build is gone) closes its room.</summary>
    public async Task LoadAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var registry = scope.ServiceProvider.GetRequiredService<IRegistryGames>();
        var open = await db.Rooms.AsNoTracking().Where(room => room.ClosedAt == null).ToListAsync(cancellationToken);
        foreach (var room in open)
        {
            var actor = NewActor(room);
            _rooms[room.Id] = actor;
            var game = await registry.GetAsync(room.GameId, cancellationToken);
            _minSeats[room.Id] = game?.Rooms?.MinSeats ?? 2;
            var actions = await db.RoomActions.AsNoTracking()
                .Where(action => action.RoomId == room.Id && action.Hand == room.Hand)
                .OrderBy(action => action.Id)
                .ToListAsync(cancellationToken);
            try
            {
                await actor.RunAsync(() => actor.RecoverAsync(actions, cancellationToken));
            }
            catch (Exception exception) when (exception is HttpRequestException or RulesException or TaskCanceledException)
            {
                LogRecoveryFailed(exception, room.Id);
                await actor.RunAsync(() => actor.CloseAsync("unavailable"));
            }
        }
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Room {RoomId} could not be rebuilt and was closed")]
    private partial void LogRecoveryFailed(Exception exception, Guid roomId);
}

/// <summary>Sends a room's changes to phones through the hub's groups, and stores them.</summary>
internal sealed class RoomOutbox(IServiceScopeFactory scopes, IHubContext<RoomsHub> hub) : IRoomOutbox
{
    public static string RoomGroup(Guid roomId) => $"room:{roomId}";

    public static string PlayerGroup(Guid roomId, Guid profileId) => $"room:{roomId}:{profileId}";

    public static string LobbyGroup(string gameId) => $"lobby:{gameId}";

    public Task RoomChangedAsync(RoomActor room) =>
        hub.Clients.Group(RoomGroup(room.Id)).SendAsync("Room", room.View(null));

    public Task ViewAsync(Guid roomId, Guid profileId, string view, string events, int seq, int? turnMs)
    {
        using var viewDocument = JsonDocument.Parse(view);
        using var eventsDocument = JsonDocument.Parse(events);
        return hub.Clients.Group(PlayerGroup(roomId, profileId))
            .SendAsync("View", roomId, viewDocument.RootElement.Clone(), eventsDocument.RootElement.Clone(), seq, turnMs);
    }

    public Task ReactionAsync(Guid roomId, int seat, string reaction) =>
        hub.Clients.Group(RoomGroup(roomId)).SendAsync("Reaction", roomId, seat, reaction);

    public Task LobbyChangedAsync(string gameId) =>
        hub.Clients.Group(LobbyGroup(gameId)).SendAsync("LobbyChanged", gameId);

    public Task ClosedAsync(Guid roomId, string reason) =>
        hub.Clients.Group(RoomGroup(roomId)).SendAsync("Closed", roomId, reason);

    public async Task ForgetAsync(Guid roomId, Guid profileId, IReadOnlyCollection<string> connectionIds)
    {
        foreach (var connection in connectionIds)
        {
            await hub.Groups.RemoveFromGroupAsync(connection, RoomGroup(roomId));
            await hub.Groups.RemoveFromGroupAsync(connection, PlayerGroup(roomId, profileId));
        }
    }

    public async Task SaveRoomAsync(Room room)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        db.Rooms.Update(room);
        await db.SaveChangesAsync();
        db.Entry(room).State = EntityState.Detached;
    }

    public async Task SaveHandAsync(RoomHand hand, IReadOnlyList<RoomResult> results)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        db.RoomHands.Add(hand);
        db.RoomResults.AddRange(results);
        // Refereed here, so verified for every person at the table; saved with the hand (ADR 0029).
        scope.ServiceProvider.GetRequiredService<IResults>().SubmitHand(
            hand.GameId,
            hand.RoomId,
            hand.Hand,
            [.. results.Select(result => new HandSeat(result.Seat, result.ProfileId, result.AccountId, result.Place, result.Points))],
            hand.FinishedAt);
        await db.SaveChangesAsync();
    }

    public async Task SaveActionAsync(RoomAction action)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        db.RoomActions.Add(action);
        await db.SaveChangesAsync();
    }
}

/// <summary>Loads the rooms when the API starts, then ticks every room a few times a second.</summary>
internal sealed partial class RoomClock(RoomRegistry registry, IOptions<RoomsOptions> options, ILogger<RoomClock> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await registry.LoadAsync(stoppingToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            LogLoadFailed(exception);
        }

        using var timer = new PeriodicTimer(options.Value.Tick);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            // Each room on its own: a slow bot at one table never holds up the others.
            foreach (var room in registry.All.Where(room => !room.IsClosed))
            {
                if (room.TryBeginTick())
                {
                    _ = Task.Run(() => TickAsync(room, stoppingToken), stoppingToken);
                }
            }
        }
    }

    private async Task TickAsync(RoomActor room, CancellationToken cancellationToken)
    {
        try
        {
            await room.RunAsync(() => room.TickAsync(registry.MinSeats(room.Id), cancellationToken));
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            LogTickFailed(exception, room.Id);
        }
        finally
        {
            room.EndTick();
        }
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Rooms could not be loaded")]
    private partial void LogLoadFailed(Exception exception);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Room {RoomId} tick failed")]
    private partial void LogTickFailed(Exception exception, Guid roomId);
}
