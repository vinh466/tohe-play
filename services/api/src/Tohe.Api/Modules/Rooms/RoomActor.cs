using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Rooms;

/// <summary>
/// Who is asking: the active profile of an account's session, or a device profile acting with its device's key
/// (ADR 0043) — which has no account, no age, and is an outsider to every account.
/// </summary>
internal sealed record Player(Guid ProfileId, Guid? AccountId, string Name, string Avatar, bool MayPlayWithOthers, int MaxGameMinAge)
{
    /// <summary>A device profile: no account.</summary>
    public bool IsDevice => AccountId is null;

    public static Player From(ActiveProfile profile) =>
        new(profile.Id, profile.AccountId, profile.Name, profile.Avatar, profile.MayPlayWithOthers, profile.MaxGameMinAge);

    public static Player From(DevicePlayer profile) =>
        new(profile.Id, null, profile.Name, profile.Avatar, MayPlayWithOthers: true, MaxGameMinAge: int.MaxValue);
}

/// <summary>Someone watching: their account — none for a device profile — and whether a child kept to its account.</summary>
internal sealed record Watcher(Guid? AccountId, bool Kept);

/// <summary>Where a room's changes go: people's phones (SignalR) and the database.</summary>
internal interface IRoomOutbox
{
    /// <summary>The room's public picture changed (seats, status, scores).</summary>
    Task RoomChangedAsync(RoomActor room);

    /// <summary>A seat's view after a change; <paramref name="events"/> is a JSON array.</summary>
    Task ViewAsync(Guid roomId, Guid profileId, string view, string events, int seq, int? turnMs);

    Task ReactionAsync(Guid roomId, int seat, string reaction);

    /// <summary>The lobby of a game changed: phones that watch it fetch the list again.</summary>
    Task LobbyChangedAsync(string gameId);

    Task ClosedAsync(Guid roomId, string reason);

    /// <summary>These phones no longer show the profile at this room: out of the room's and the seat's groups.</summary>
    Task ForgetAsync(Guid roomId, Guid profileId, IReadOnlyCollection<string> connectionIds);

    Task SaveRoomAsync(Room room);

    Task SaveActionAsync(RoomAction action);

    /// <summary>A hand ended: its record (for replays) and one result per seat (for statistics).</summary>
    Task SaveHandAsync(RoomHand hand, IReadOnlyList<RoomResult> results);
}

/// <summary>
/// One room in memory (ADR 0016). Everything that happens to it — joins, actions, bots, timers — runs one at a
/// time through <see cref="RunAsync{T}"/>, so the rules engine and the state are never touched concurrently.
/// </summary>
internal sealed class RoomActor
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly IRoomOutbox _outbox;
    private readonly RoomsOptions _options;
    private readonly TimeProvider _clock;
    private readonly Func<CancellationToken, Task<RulesHost>> _loadRules;
    private RulesHost? _rules;
    private List<SeatRecord> _seats;
    private int[] _handSeats;
    private int[] _scores;
    /// <summary>The rules module's state of the current hand, JSON; null outside a hand.</summary>
    private string? _state;
    private int _seq;
    private readonly Dictionary<Guid, HashSet<string>> _connections = [];
    /// <summary>Profiles with a live connection, counted after every change for readers outside the actor.</summary>
    private int _online;
    private readonly Dictionary<int, DateTimeOffset> _goneSince = [];
    /// <summary>Room seats a bot plays for their player until they come back.</summary>
    private readonly HashSet<int> _takenOver = [];
    private readonly HashSet<int> _ready = [];
    private readonly Dictionary<int, DateTimeOffset> _lastReaction = [];
    /// <summary>Profiles watching without a seat: their account (none for a device profile), and whether they are kept.</summary>
    private readonly Dictionary<Guid, Watcher> _watchers = [];
    /// <summary>Other profiles of a player's account asked to the table: who asked, and until when.</summary>
    private readonly Dictionary<Guid, (Guid From, DateTimeOffset Until)> _invites = [];
    private DateTimeOffset? _turnDeadline;
    private DateTimeOffset? _botAt;
    private DateTimeOffset? _nextHandAt;
    private DateTimeOffset _lastActivity;

    public RoomActor(Room room, IRoomOutbox outbox, RoomsOptions options, TimeProvider clock, Func<CancellationToken, Task<RulesHost>> loadRules)
    {
        Room = room;
        _outbox = outbox;
        _options = options;
        _clock = clock;
        _loadRules = loadRules;
        _seats = JsonSerializer.Deserialize<List<SeatRecord>>(room.SeatList) ?? [];
        while (_seats.Count < room.Seats)
        {
            _seats.Add(SeatRecord.Empty);
        }

        _handSeats = JsonSerializer.Deserialize<int[]>(room.HandSeats) ?? [];
        _scores = JsonSerializer.Deserialize<int[]>(room.Scores) ?? [];
        _lastActivity = clock.GetUtcNow();
    }

    /// <summary>The stored room; changed only inside <see cref="RunAsync{T}"/>.</summary>
    public Room Room { get; }

    public Guid Id => Room.Id;

    public IReadOnlyList<SeatRecord> Seats => _seats;

    public bool IsClosed => Room.Status == RoomStatus.Closed;

    /// <summary>Profiles connected to the room right now; safe to read from outside the actor (the admin console).</summary>
    public int Online => Volatile.Read(ref _online);

    /// <summary>The rules module's state of the hand in progress, JSON (tests compare it after a rebuild).</summary>
    internal string? State => _state;

    public async Task<T> RunAsync<T>(Func<Task<T>> work)
    {
        await _gate.WaitAsync();
        try
        {
            return await work();
        }
        finally
        {
            _gate.Release();
        }
    }

    public Task RunAsync(Func<Task> work) => RunAsync(async () =>
    {
        await work();
        return true;
    });

    // ------------------------------------------------------------------ what people see

    public int? SeatOf(Guid profileId)
    {
        var index = _seats.FindIndex(seat => seat.ProfileId == profileId);
        return index < 0 ? null : index;
    }

    private bool IsConnected(int seat) =>
        _seats[seat].ProfileId is { } id && _connections.TryGetValue(id, out var set) && set.Count > 0;

    /// <summary>A seat's bot level right now: a bot seat, or a player a bot plays for.</summary>
    private string? BotOf(int seat) => _seats[seat].Bot ?? (_takenOver.Contains(seat) ? BotLevel : null);

    private string? BotLevel => Room.BotLevel;

    public RoomView View(Guid? viewer)
    {
        var seats = _seats.Select((seat, index) => new SeatView(
            index,
            seat.ProfileId,
            seat.Name,
            seat.Avatar,
            BotOf(index),
            seat.Bot is not null || IsConnected(index),
            _ready.Contains(index))).ToList();
        using var options = JsonDocument.Parse(Room.Options);
        return new RoomView(
            Room.Id,
            Room.Code,
            Room.GameId,
            Room.GameVersion,
            Room.Status.ToString().ToLowerInvariant(),
            Room.HostProfileId,
            Room.IsPublic,
            RoomEntries.NameOf(Room.Entry),
            Room.Locked,
            Room.Seats,
            Room.BotsFill,
            Room.BotLevel,
            Room.BotsTakeOver,
            Room.TurnSeconds,
            options.RootElement.Clone(),
            seats,
            [.. Enumerable.Range(0, Room.Seats).Select(i => i < _scores.Length ? _scores[i] : 0)],
            Room.Hand,
            Room.Status is RoomStatus.Playing or RoomStatus.Between ? _handSeats : [],
            viewer is { } id ? SeatOf(id) : null,
            Room.AllowSpectators,
            [.. _watchers.Keys],
            Room.Entry == RoomEntry.Own);
    }

    public bool IsWatcher(Guid profileId) => _watchers.ContainsKey(profileId);

    /// <summary>Seated, or watching: may enter the room's live connection.</summary>
    public bool IsMember(Guid profileId) => SeatOf(profileId) is not null || _watchers.ContainsKey(profileId);

    /// <summary>The people seated or watching who have an account: whose "play with outsiders" may matter now.</summary>
    public IReadOnlyList<Guid> AccountMembers() =>
    [
        .. _seats.Where(seat => seat is { ProfileId: not null, AccountId: not null }).Select(seat => seat.ProfileId!.Value),
        .. _watchers.Where(watcher => watcher.Value.AccountId is not null).Select(watcher => watcher.Key),
    ];

    /// <param name="withCode">The room's code too — only for a table the viewer sits at (<c>GET /api/rooms/mine</c>).</param>
    public RoomSummary Summary(Guid viewer, bool withCode = false)
    {
        var host = _seats.FirstOrDefault(seat => seat.ProfileId == Room.HostProfileId);
        return new RoomSummary(
            Room.Id,
            Room.GameId,
            Room.Status.ToString().ToLowerInvariant(),
            host?.Name ?? "",
            host?.Avatar ?? "",
            _seats.Count(seat => seat.ProfileId is not null),
            Room.Seats,
            Room.Locked,
            Room.TurnSeconds,
            SeatOf(viewer) is not null || _watchers.ContainsKey(viewer),
            Room.AllowSpectators,
            withCode && SeatOf(viewer) is not null ? Room.Code : null);
    }

    // ------------------------------------------------------------------ joining and leaving

    /// <summary>Why <paramref name="player"/> may not sit at this table, or null.</summary>
    /// <param name="keptNow">The account profiles at the table whose "play with outsiders" is off now (ADR 0043), when the
    /// caller read them — the seats' own record is from when they sat.</param>
    public string? WhyNot(Player player, IReadOnlySet<Guid>? keptNow = null)
    {
        if (IsClosed)
        {
            return RoomErrors.Closed;
        }

        if (SeatOf(player.ProfileId) is not null)
        {
            return null;
        }

        if (Door(player, keptNow) is { } closed)
        {
            return closed;
        }

        // An invitation from someone at the table opens a locked door (never the parent switch above).
        if (Room.Locked && InvitationFor(player.ProfileId) is null)
        {
            return RoomErrors.Locked;
        }

        return FreeSeat() is null ? RoomErrors.Full : null;
    }

    /// <summary>Why <paramref name="player"/> may not watch, or null.</summary>
    public string? WhyNotWatch(Player player, IReadOnlySet<Guid>? keptNow = null)
    {
        if (IsClosed)
        {
            return RoomErrors.Closed;
        }

        if (IsMember(player.ProfileId))
        {
            return null;
        }

        if (!Room.AllowSpectators)
        {
            return RoomErrors.SpectatorsOff;
        }

        return Door(player, keptNow);
    }

    /// <summary>
    /// Who the table lets in, sitting or watching (ADR 0016, 0043): its entry level, then the parent switch — a child
    /// its account's owner has not let play with outsiders stays at tables kept to the account, and never meets a
    /// device profile, which is always an outsider.
    /// </summary>
    private string? Door(Player player, IReadOnlySet<Guid>? keptNow)
    {
        var sameAccount = player.AccountId is { } account && account == Room.HostAccountId;
        if (Room.Entry == RoomEntry.Own && !sameAccount)
        {
            return RoomErrors.AccountOnly;
        }

        if (Room.Entry == RoomEntry.Account && player.IsDevice)
        {
            return RoomErrors.AccountRequired;
        }

        // A child the account's owner has not allowed only plays within the account: at tables that stay in it.
        if (!player.MayPlayWithOthers && !(sameAccount && Room.Entry == RoomEntry.Own))
        {
            return RoomErrors.ParentPermission;
        }

        // …and never with a device profile, from whichever side the meeting would come, seated or watching.
        if ((!player.MayPlayWithOthers && HasDeviceProfile()) || (player.IsDevice && HasKept(keptNow)))
        {
            return RoomErrors.ParentPermission;
        }

        return null;
    }

    private bool HasDeviceProfile() =>
        _seats.Any(seat => seat.IsDeviceProfile()) || _watchers.Values.Any(watcher => watcher.AccountId is null);

    /// <summary>A child kept to its account is here, by its record when it came or by what its account says now.</summary>
    private bool HasKept(IReadOnlySet<Guid>? keptNow) =>
        _seats.Any(seat => seat.Kept || (seat.ProfileId is { } id && keptNow?.Contains(id) == true))
        || _watchers.Any(watcher => watcher.Value.Kept || keptNow?.Contains(watcher.Key) == true);

    /// <summary>Who still passes the door as it is now, for a member already in: its entry level.</summary>
    private bool Passes(Guid? accountId) => Room.Entry switch
    {
        RoomEntry.Own => accountId is { } account && account == Room.HostAccountId,
        RoomEntry.Account => accountId is not null,
        _ => true,
    };

    /// <summary>The profile's seat shows its new name (a moderator renamed it, or its owner).</summary>
    public async Task RenameAsync(Guid profileId, string name)
    {
        if (SeatOf(profileId) is not { } seat || _seats[seat].Name == name)
        {
            return;
        }

        _seats[seat] = _seats[seat] with { Name = name };
        await SaveAsync();
        await _outbox.RoomChangedAsync(this);
    }

    /// <summary>
    /// A child's account turned its "play with outsiders" off (ADR 0016, 0043): it stays only at a table kept to its
    /// account — marked so a device profile never joins — and leaves any other.
    /// </summary>
    public async Task KeepAsync(Guid profileId, Guid accountId)
    {
        if (IsClosed || !IsMember(profileId))
        {
            return;
        }

        if (Room.Entry != RoomEntry.Own || Room.HostAccountId != accountId)
        {
            await LeaveAsync(profileId);
            return;
        }

        if (SeatOf(profileId) is { } seat)
        {
            _seats[seat] = _seats[seat] with { Kept = true };
            await SaveAsync();
        }
        else
        {
            _watchers[profileId] = _watchers[profileId] with { Kept = true };
        }
    }

    public async Task<string?> WatchAsync(Player player, IReadOnlySet<Guid>? keptNow = null)
    {
        if (WhyNotWatch(player, keptNow) is { } problem)
        {
            return problem;
        }

        if (_watchers.TryAdd(player.ProfileId, new Watcher(player.AccountId, !player.MayPlayWithOthers)))
        {
            Touch();
            await _outbox.RoomChangedAsync(this);
        }

        return null;
    }

    /// <summary>
    /// A player at the table asks another profile to it: of their account, or by its ID (ADR 0033). The endpoints check
    /// who may be asked; the table only that the asker is seated.
    /// </summary>
    public string? Invite(Guid from, Guid to)
    {
        if (IsClosed)
        {
            return RoomErrors.Closed;
        }

        if (SeatOf(from) is null)
        {
            return RoomErrors.NotSeated;
        }

        _invites[to] = (from, _clock.GetUtcNow().AddMinutes(10));
        return null;
    }

    /// <summary>The seat of whoever asked this profile to the table, while the invitation holds and it has no seat.</summary>
    public SeatRecord? InvitationFor(Guid profileId)
    {
        if (IsClosed || SeatOf(profileId) is not null || !_invites.TryGetValue(profileId, out var invite)
            || invite.Until < _clock.GetUtcNow())
        {
            return null;
        }

        return _seats.FirstOrDefault(seat => seat.ProfileId == invite.From);
    }

    public DateTimeOffset? InvitationUntil(Guid profileId) =>
        _invites.TryGetValue(profileId, out var invite) ? invite.Until : null;

    /// <summary>An empty seat, or between hands a bot that only filled one; null when the table is full.</summary>
    private int? FreeSeat()
    {
        for (var i = 0; i < _seats.Count; i++)
        {
            // During a hand, only a seat that is not in it.
            if (_seats[i].IsEmpty && (Room.Status != RoomStatus.Playing || !_handSeats.Contains(i)))
            {
                return i;
            }
        }

        if (Room.Status == RoomStatus.Playing)
        {
            return null;
        }

        var auto = _seats.FindIndex(seat => seat.Auto);
        return auto < 0 ? null : auto;
    }

    public async Task<string?> JoinAsync(Player player, IReadOnlySet<Guid>? keptNow = null)
    {
        if (WhyNot(player, keptNow) is { } problem)
        {
            return problem;
        }

        if (SeatOf(player.ProfileId) is not null)
        {
            return null;
        }

        var seat = FreeSeat()!.Value;
        _seats[seat] = new SeatRecord(player.ProfileId, player.AccountId, player.Name, player.Avatar, null, Kept: !player.MayPlayWithOthers);
        _invites.Remove(player.ProfileId);
        _watchers.Remove(player.ProfileId);
        Touch();
        await SaveAsync();
        await _outbox.RoomChangedAsync(this);
        await _outbox.LobbyChangedAsync(Room.GameId);
        return null;
    }

    /// <summary>
    /// A profile deleted, or of an account waiting to be deleted, lets go of the table (ADR 0034): it leaves its seat —
    /// a bot finishes a hand it is in — or stops watching, and an invitation to it ends. Those it sent end with its seat.
    /// </summary>
    public async Task WithdrawAsync(Guid profileId)
    {
        _invites.Remove(profileId);
        // The phones that showed it — a device it moved away from (ADR 0043) among them — stop receiving its seat's views
        // and the room, even should it sit here again from another device.
        var phones = _connections.TryGetValue(profileId, out var set) ? set.ToList() : [];
        if (!IsClosed && IsMember(profileId))
        {
            await LeaveAsync(profileId);
        }

        if (phones.Count > 0)
        {
            _connections.Remove(profileId);
            CountOnline();
            await _outbox.ForgetAsync(Room.Id, profileId, phones);
        }
    }

    public async Task<string?> LeaveAsync(Guid profileId)
    {
        if (_watchers.Remove(profileId))
        {
            _connections.Remove(profileId);
            CountOnline();
            await _outbox.RoomChangedAsync(this);
            return null;
        }

        if (SeatOf(profileId) is not { } seat)
        {
            return RoomErrors.NotSeated;
        }

        if (Room.Status == RoomStatus.Playing && _handSeats.Contains(seat))
        {
            // The hand goes on: a bot finishes it for them, then the seat is free.
            _seats[seat] = new SeatRecord(null, null, null, null, BotLevel ?? "bot", Auto: true);
        }
        else
        {
            _seats[seat] = SeatRecord.Empty;
        }

        _ready.Remove(seat);
        _takenOver.Remove(seat);
        _goneSince.Remove(seat);
        _connections.Remove(profileId);
        CountOnline();
        Touch();
        if (!_seats.Any(s => s.ProfileId is not null))
        {
            await CloseAsync("empty");
            return null;
        }

        if (Room.HostProfileId == profileId)
        {
            // The host role passes to the player seated longest: the lowest seat — with its account, so "the host's
            // account" is the new host's; a device profile hosting has none (ADR 0043).
            var host = _seats.First(s => s.ProfileId is not null);
            Room.HostProfileId = host.ProfileId!.Value;
            Room.HostAccountId = host.AccountId;
        }

        await SaveAsync();
        await _outbox.RoomChangedAsync(this);
        await _outbox.LobbyChangedAsync(Room.GameId);
        await ScheduleAsync();
        return null;
    }

    public async Task CloseAsync(string reason)
    {
        if (IsClosed)
        {
            return;
        }

        Room.Status = RoomStatus.Closed;
        Room.ClosedAt = _clock.GetUtcNow();
        _state = null;
        _turnDeadline = _botAt = _nextHandAt = null;
        await SaveAsync();
        await _outbox.ClosedAsync(Room.Id, reason);
        await _outbox.LobbyChangedAsync(Room.GameId);
    }

    // ------------------------------------------------------------------ phones coming and going

    public async Task ConnectedAsync(Guid profileId, string connectionId)
    {
        if (!_connections.TryGetValue(profileId, out var set))
        {
            set = [];
            _connections[profileId] = set;
        }

        set.Add(connectionId);
        CountOnline();
        if (SeatOf(profileId) is { } seat)
        {
            _goneSince.Remove(seat);
            _takenOver.Remove(seat);
        }

        Touch();
        await _outbox.RoomChangedAsync(this);
        await SendViewAsync(profileId, "[]");
        await ScheduleAsync();
    }

    public async Task DisconnectedAsync(string connectionId)
    {
        foreach (var (profileId, set) in _connections)
        {
            if (!set.Remove(connectionId) || set.Count > 0)
            {
                continue;
            }

            CountOnline();

            if (SeatOf(profileId) is { } seat)
            {
                _goneSince[seat] = _clock.GetUtcNow();
            }

            await _outbox.RoomChangedAsync(this);
        }
    }

    private void CountOnline() => Volatile.Write(ref _online, _connections.Count(connection => connection.Value.Count > 0));

    // ------------------------------------------------------------------ the host's controls

    public string? HostOnly(Guid profileId) =>
        Room.HostProfileId != profileId ? RoomErrors.NotHost : Room.Status == RoomStatus.Playing ? RoomErrors.HandInProgress : null;

    public async Task<string?> UpdateAsync(
        Guid profileId, UpdateRoomRequest request, RoomEntry? entry, string? optionsJson, IReadOnlyCollection<string> bots, (int Min, int Max) seats)
    {
        if (HostOnly(profileId) is { } problem)
        {
            return problem;
        }

        if (request.Seats is { } count)
        {
            if (count < seats.Min || count > seats.Max || _seats.Skip(count).Any(seat => seat.ProfileId is not null))
            {
                return RoomErrors.InvalidOptions;
            }

            _seats = [.. _seats.Take(count)];
            while (_seats.Count < count)
            {
                _seats.Add(SeatRecord.Empty);
            }

            Room.Seats = count;
        }

        if (request.BotLevel is { } level)
        {
            if (!bots.Contains(level))
            {
                return RoomErrors.InvalidOptions;
            }

            Room.BotLevel = level;
        }

        Room.IsPublic = request.IsPublic ?? Room.IsPublic;
        var reopened = entry is { } next && next != Room.Entry;
        Room.Entry = entry ?? Room.Entry;
        Room.Locked = request.Locked ?? Room.Locked;
        Room.BotsFill = request.BotsFill ?? Room.BotsFill;
        Room.BotsTakeOver = request.BotsTakeOver ?? Room.BotsTakeOver;
        Room.TurnSeconds = request.TurnSeconds ?? Room.TurnSeconds;
        Room.AllowSpectators = request.Spectators ?? Room.AllowSpectators;
        if (!Room.AllowSpectators)
        {
            _watchers.Clear();
        }
        Room.Options = optionsJson ?? Room.Options;
        Touch();

        // A new door holds for those already in too (ADR 0043): whoever it would not let in leaves — between hands
        // (the host changes nothing during one), so a seat empties.
        if (reopened)
        {
            var outside = _seats.Where(seat => seat.ProfileId is not null && seat.Bot is null && !Passes(seat.AccountId))
                .Select(seat => seat.ProfileId!.Value)
                .Concat(_watchers.Where(watcher => !Passes(watcher.Value.AccountId)).Select(watcher => watcher.Key))
                .ToList();
            foreach (var member in outside)
            {
                await LeaveAsync(member);
            }
        }

        await SaveAsync();
        await _outbox.RoomChangedAsync(this);
        await _outbox.LobbyChangedAsync(Room.GameId);
        return null;
    }

    public async Task<string?> SetSeatAsync(Guid profileId, int seat, string? bot, IReadOnlyCollection<string> bots)
    {
        if (HostOnly(profileId) is { } problem)
        {
            return problem;
        }

        if (seat < 0 || seat >= _seats.Count || _seats[seat].ProfileId == Room.HostProfileId)
        {
            return RoomErrors.InvalidOptions;
        }

        if (bot is not null && !bots.Contains(bot))
        {
            return RoomErrors.InvalidOptions;
        }

        if (_seats[seat].ProfileId is { } removed)
        {
            _connections.Remove(removed);
            CountOnline();
        }

        _seats[seat] = bot is null ? SeatRecord.Empty : new SeatRecord(null, null, null, null, bot);
        _ready.Remove(seat);
        Touch();
        await SaveAsync();
        await _outbox.RoomChangedAsync(this);
        await _outbox.LobbyChangedAsync(Room.GameId);
        return null;
    }

    // ------------------------------------------------------------------ hands

    public async Task<string?> StartAsync(Guid profileId, int minSeats, CancellationToken cancellationToken)
    {
        if (HostOnly(profileId) is { } problem)
        {
            return problem;
        }

        return await StartHandAsync(minSeats, cancellationToken);
    }

    private async Task<string?> StartHandAsync(int minSeats, CancellationToken cancellationToken)
    {
        // Empty seats get a bot, or the table plays with the seats taken.
        for (var i = 0; i < _seats.Count; i++)
        {
            if (_seats[i].IsEmpty && Room.BotsFill && BotLevel is { } level)
            {
                _seats[i] = new SeatRecord(null, null, null, null, level, Auto: true);
            }
        }

        var playing = Enumerable.Range(0, _seats.Count).Where(i => !_seats[i].IsEmpty).ToArray();
        if (playing.Length < minSeats || !playing.Any(i => _seats[i].ProfileId is not null))
        {
            return RoomErrors.NotEnoughPlayers;
        }

        try
        {
            _rules ??= await _loadRules(cancellationToken);
        }
        catch (Exception exception) when (exception is HttpRequestException or RulesException or TaskCanceledException)
        {
            return RoomErrors.RulesUnavailable;
        }

        if (_scores.Length < _seats.Count)
        {
            Array.Resize(ref _scores, _seats.Count);
        }

        _handSeats = playing;
        Room.Hand++;
        Room.Seed = RandomNumberGenerator.GetInt32(int.MaxValue);
        Room.HandSeats = JsonSerializer.Serialize(_handSeats);
        Room.Status = RoomStatus.Playing;
        Room.HandCarry = Room.Carry;
        _state = _rules.Setup(playing.Length, Room.Seed, Room.Options, Room.HandCarry);
        _ready.Clear();
        _nextHandAt = null;
        Touch();
        await SaveAsync();
        await _outbox.RoomChangedAsync(this);
        await _outbox.LobbyChangedAsync(Room.GameId);
        await AfterChangeAsync("[]");
        return null;
    }

    /// <summary>Rebuilds the hand in progress after a restart: the hand's setup, then its actions in order.</summary>
    public async Task RecoverAsync(IReadOnlyList<RoomAction> actions, CancellationToken cancellationToken)
    {
        if (Room.Status is not (RoomStatus.Playing or RoomStatus.Between) || _handSeats.Length == 0)
        {
            return;
        }

        // A finished hand is rebuilt too, so phones that come back see its results.
        _rules = await _loadRules(cancellationToken);
        _state = _rules.Setup(_handSeats.Length, Room.Seed, Room.Options, Room.HandCarry);
        foreach (var action in actions)
        {
            var result = JsonNode.Parse(_rules.Act(_state, action.Seat, action.Action))!;
            if (result["ok"]?.GetValue<bool>() != true)
            {
                throw new RulesException($"replay of room {Room.Id} refused an action: {result["error"]}", new InvalidOperationException());
            }

            _state = result["state"]!.ToJsonString();
        }

        if (Room.Status == RoomStatus.Between)
        {
            _nextHandAt = _clock.GetUtcNow().AddSeconds(_options.NextHandSeconds);
            return;
        }

        // Players get time to come back before bots take their seats.
        foreach (var seat in _handSeats.Where(seat => _seats[seat].ProfileId is not null))
        {
            _goneSince[seat] = _clock.GetUtcNow();
        }

        await ScheduleAsync();
    }

    /// <summary>A player's action. Returns the rules module's error code when it refuses.</summary>
    public async Task<string?> ActAsync(Guid profileId, string action)
    {
        if (Room.Status != RoomStatus.Playing || _state is null || _rules is null)
        {
            return RoomErrors.HandInProgress;
        }

        if (SeatOf(profileId) is not { } roomSeat || Array.IndexOf(_handSeats, roomSeat) is var rulesSeat && rulesSeat < 0)
        {
            return RoomErrors.NotSeated;
        }

        _takenOver.Remove(roomSeat);
        return await ApplyAsync(rulesSeat, action);
    }

    private async Task<string?> ApplyAsync(int rulesSeat, string action)
    {
        var result = JsonNode.Parse(_rules!.Act(_state!, rulesSeat, action))!;
        if (result["ok"]?.GetValue<bool>() != true)
        {
            return result["error"]?.GetValue<string>() ?? RoomErrors.ActionInvalid;
        }

        _state = result["state"]!.ToJsonString();
        Touch();
        await _outbox.SaveActionAsync(new RoomAction
        {
            RoomId = Room.Id,
            Hand = Room.Hand,
            Seat = rulesSeat,
            Action = action,
            At = _clock.GetUtcNow(),
        });
        await AfterChangeAsync(result["events"]?.ToJsonString() ?? "[]");
        return null;
    }

    /// <summary>After every change of the hand: send views, end the hand, or plan the next turn.</summary>
    private async Task AfterChangeAsync(string events)
    {
        _seq++;
        var status = JsonNode.Parse(_rules!.Status(_state!))!;
        if (status["over"]?.GetValue<bool>() == true)
        {
            var points = status["result"]?["points"]?.AsArray();
            for (var rulesSeat = 0; rulesSeat < _handSeats.Length; rulesSeat++)
            {
                _scores[_handSeats[rulesSeat]] += points?[rulesSeat]?.GetValue<int>() ?? 0;
            }

            await RecordHandAsync(status["result"]!);
            Room.Carry = status["carry"]?.ToJsonString();
            Room.Scores = JsonSerializer.Serialize(_scores);
            Room.Status = RoomStatus.Between;
            _turnDeadline = _botAt = null;
            _nextHandAt = _clock.GetUtcNow().AddSeconds(_options.NextHandSeconds);
            // Bots that only finished a hand for someone who left free their seat now.
            for (var i = 0; i < _seats.Count; i++)
            {
                if (_seats[i].Auto && !Room.BotsFill)
                {
                    _seats[i] = SeatRecord.Empty;
                }
            }

            await SaveAsync();
            await SendViewsAsync(events);
            await _outbox.RoomChangedAsync(this);
            await _outbox.LobbyChangedAsync(Room.GameId);
            return;
        }

        PlanTurn(status);
        await SendViewsAsync(events);
    }

    /// <summary>Keeps the finished hand for replays and its seats' outcomes for statistics.</summary>
    private async Task RecordHandAsync(JsonNode result)
    {
        var now = _clock.GetUtcNow();
        var seats = _handSeats.Select(roomSeat => _seats[roomSeat]).ToList();
        var points = result["points"]?.AsArray();
        var ranking = result["ranking"]?.AsArray().Select(node => node!.GetValue<int>()).ToList() ?? [];
        var results = seats.Select((seat, rulesSeat) => new RoomResult
        {
            RoomId = Room.Id,
            GameId = Room.GameId,
            Hand = Room.Hand,
            Seat = rulesSeat,
            ProfileId = seat.ProfileId,
            AccountId = seat.AccountId,
            Place = ranking.IndexOf(rulesSeat) is var place and >= 0 ? place : rulesSeat,
            Points = points?[rulesSeat]?.GetValue<int>() ?? 0,
            At = now,
        }).ToList();
        await _outbox.SaveHandAsync(
            new RoomHand
            {
                RoomId = Room.Id,
                GameId = Room.GameId,
                GameVersion = Room.GameVersion,
                Hand = Room.Hand,
                Seed = Room.Seed,
                Options = Room.Options,
                Carry = Room.HandCarry,
                Seats = JsonSerializer.Serialize(seats),
                Result = result.ToJsonString(),
                FinishedAt = now,
            },
            results);
    }

    private void PlanTurn(JsonNode status)
    {
        var now = _clock.GetUtcNow();
        var turn = status["turn"]?.AsArray().FirstOrDefault()?.GetValue<int>() ?? 0;
        var roomSeat = _handSeats[turn];
        var chopper = status["chop"]?.AsArray().Select(node => node!.GetValue<int>()).Any(seat => BotOf(_handSeats[seat]) is not null) == true;
        _turnDeadline = null;
        _botAt = null;
        if (chopper)
        {
            _botAt = now.AddMilliseconds(_options.BotChopMs);
        }

        if (BotOf(roomSeat) is not null)
        {
            var think = _options.BotThinkMinMs + RandomNumberGenerator.GetInt32(Math.Max(1, _options.BotThinkMaxMs - _options.BotThinkMinMs + 1));
            var at = now.AddMilliseconds(think);
            _botAt = _botAt is { } early && early < at ? early : at;
        }
        else if (Room.TurnSeconds > 0)
        {
            _turnDeadline = now.AddSeconds(Room.TurnSeconds);
        }
    }

    private async Task ScheduleAsync()
    {
        if (Room.Status == RoomStatus.Playing && _state is not null && _rules is not null)
        {
            PlanTurn(JsonNode.Parse(_rules.Status(_state))!);
        }

        await Task.CompletedTask;
    }

    private int? TurnMs()
    {
        if (_turnDeadline is not { } deadline)
        {
            return null;
        }

        var left = (deadline - _clock.GetUtcNow()).TotalMilliseconds;
        return (int)Math.Max(0, left);
    }

    private async Task SendViewsAsync(string events)
    {
        foreach (var roomSeat in _handSeats)
        {
            if (_seats[roomSeat].ProfileId is { } profileId)
            {
                await SendViewAsync(profileId, events);
            }
        }

        // Watchers get the public view (no hand), as the rules module gives a spectator.
        foreach (var watcher in _watchers.Keys)
        {
            await SendViewAsync(watcher, events);
        }
    }

    private async Task SendViewAsync(Guid profileId, string events)
    {
        if (_state is null || _rules is null || Room.Status is not (RoomStatus.Playing or RoomStatus.Between))
        {
            return;
        }

        var rulesSeat = SeatOf(profileId) is { } roomSeat ? Array.IndexOf(_handSeats, roomSeat) : -1;
        var view = _rules.View(_state, rulesSeat < 0 ? null : rulesSeat);
        await _outbox.ViewAsync(Room.Id, profileId, view, events, _seq, TurnMs());
    }

    /// <summary>The player is ready for the next hand; it starts once every connected player is.</summary>
    public async Task<string?> NextAsync(Guid profileId, int minSeats, CancellationToken cancellationToken)
    {
        if (SeatOf(profileId) is not { } seat)
        {
            return RoomErrors.NotSeated;
        }

        if (Room.Status != RoomStatus.Between)
        {
            return null;
        }

        _ready.Add(seat);
        await _outbox.RoomChangedAsync(this);
        var waiting = Enumerable.Range(0, _seats.Count).Where(i => _seats[i].ProfileId is not null && IsConnected(i));
        if (waiting.All(_ready.Contains))
        {
            return await StartHandAsync(minSeats, cancellationToken);
        }

        return null;
    }

    public async Task<bool> ReactAsync(Guid profileId, string reaction)
    {
        if (SeatOf(profileId) is not { } roomSeat)
        {
            return false;
        }

        var now = _clock.GetUtcNow();
        if (_lastReaction.TryGetValue(roomSeat, out var last) && now - last < _options.ReactionInterval)
        {
            return false;
        }

        _lastReaction[roomSeat] = now;
        var rulesSeat = Array.IndexOf(_handSeats, roomSeat);
        await _outbox.ReactionAsync(Room.Id, rulesSeat < 0 ? roomSeat : rulesSeat, reaction);
        return true;
    }

    // ------------------------------------------------------------------ the clock

    /// <summary>Called a few times a second: bots' moves, turn timers, players who are gone, the next hand.</summary>
    public async Task TickAsync(int minSeats, CancellationToken cancellationToken)
    {
        if (IsClosed)
        {
            return;
        }

        var now = _clock.GetUtcNow();
        if (Room.Status == RoomStatus.Playing && _state is not null && _rules is not null)
        {
            // A player gone longer than the grace period: a bot plays for them until they are back.
            foreach (var (seat, since) in _goneSince)
            {
                if (Room.BotsTakeOver && BotLevel is not null && now - since >= TimeSpan.FromSeconds(_options.GraceSeconds)
                    && _handSeats.Contains(seat) && _takenOver.Add(seat))
                {
                    await _outbox.RoomChangedAsync(this);
                    await ScheduleAsync();
                }
            }

            if (_botAt is { } botAt && now >= botAt)
            {
                _botAt = null;
                await BotMoveAsync();
            }
            else if (_turnDeadline is { } deadline && now >= deadline)
            {
                _turnDeadline = null;
                var turn = JsonNode.Parse(_rules.Status(_state))!["turn"]?.AsArray().FirstOrDefault()?.GetValue<int>() ?? 0;
                await ApplyAsync(turn, _rules.Timeout(_state, turn));
            }
        }
        else if (Room.Status == RoomStatus.Between && _nextHandAt is { } next && now >= next)
        {
            _nextHandAt = null;
            if (Enumerable.Range(0, _seats.Count).Any(IsConnected))
            {
                await StartHandAsync(minSeats, cancellationToken);
            }
        }

        var anyone = _seats.Select((_, index) => index).Any(IsConnected);
        if (!anyone && now - _lastActivity >= TimeSpan.FromMinutes(_options.IdleMinutes))
        {
            await CloseAsync("idle");
        }
    }

    private async Task BotMoveAsync()
    {
        var status = JsonNode.Parse(_rules!.Status(_state!))!;
        if (status["over"]?.GetValue<bool>() == true)
        {
            return;
        }

        // A bot that may chop out of turn goes first, if it wants to.
        foreach (var node in status["chop"]?.AsArray() ?? [])
        {
            var seat = node!.GetValue<int>();
            if (BotOf(_handSeats[seat]) is not { } level)
            {
                continue;
            }

            var chop = BotDecision(seat, level) ?? "null";
            if (chop != "null" && await ApplyAsync(seat, chop) is null)
            {
                return;
            }
        }

        var turn = status["turn"]?.AsArray().FirstOrDefault()?.GetValue<int>() ?? 0;
        if (BotOf(_handSeats[turn]) is not { } turnLevel)
        {
            PlanTurn(status);
            return;
        }

        var action = BotDecision(turn, turnLevel) ?? "null";
        if (action == "null" || await ApplyAsync(turn, action) is not null)
        {
            await ApplyAsync(turn, _rules.Timeout(_state!, turn));
        }
    }

    /// <summary>
    /// A bot's action, or null when its look-ahead failed or ran out of time (a busy server): the caller then plays the
    /// turn timer's move, so a table never stops on a slow bot.
    /// </summary>
    private string? BotDecision(int seat, string level)
    {
        try
        {
            return _rules!.Bot(_state!, seat, level, _seq * 31 + seat);
        }
        catch (RulesException)
        {
            return null;
        }
    }

    private void Touch() => _lastActivity = _clock.GetUtcNow();

    private int _ticking;

    /// <summary>False while a tick of this room is still running (a bot thinking): the clock skips it.</summary>
    public bool TryBeginTick() => Interlocked.CompareExchange(ref _ticking, 1, 0) == 0;

    public void EndTick() => Interlocked.Exchange(ref _ticking, 0);

    private Task SaveAsync()
    {
        Room.SeatList = JsonSerializer.Serialize(_seats);
        Room.UpdatedAt = _clock.GetUtcNow();
        return _outbox.SaveRoomAsync(Room);
    }
}
