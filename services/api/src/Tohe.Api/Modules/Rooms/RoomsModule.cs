using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Registry;

namespace Tohe.Api.Modules.Rooms;

/// <summary>
/// Online rooms for turn-based games (ADR 0016): REST for the lobby and the host's controls, SignalR for what happens
/// at the table. Tables live in memory, one actor each, and every accepted action is stored so a restart rebuilds
/// them. See docs/architecture/rooms.md.
/// </summary>
internal static class RoomsModule
{
    public const string CodeRateLimit = "room-codes";
    public const string HubPath = "/api/rooms/hub";

    /// <summary>
    /// A player at a table: an account's session, or — when the request names a device profile — the device key alone
    /// (ADR 0043). The players' scheme picks one; never both.
    /// </summary>
    public static readonly AuthorizationPolicy PlayerPolicy =
        new AuthorizationPolicyBuilder(DeviceKey.PlayerScheme).RequireAuthenticatedUser().Build();

    public static WebApplicationBuilder AddRoomsModule(this WebApplicationBuilder builder)
    {
        var services = builder.Services;
        services.AddOptions<RoomsOptions>().BindConfiguration(RoomsOptions.Section);
        services.TryAddSingleton(TimeProvider.System);
        services.AddHttpClient<RulesSource>(client => client.Timeout = TimeSpan.FromSeconds(10));
        services.AddSingleton<RoomRegistry>();
        // Open tables by their code, for link previews (ADR 0044).
        services.AddSingleton<IRoomPreviews>(provider => provider.GetRequiredService<RoomRegistry>());
        services.AddSingleton<RoomInvitations>();
        // Deleted profiles leave the tables, and finished hands keep nothing of them (ADR 0034).
        services.AddScoped<RoomsProfileData>();
        services.AddScoped<IProfileData>(provider => provider.GetRequiredService<RoomsProfileData>());
        // A device profile brought into an account takes its seats and results with it (ADR 0043).
        services.AddScoped<IProfileMoves>(provider => provider.GetRequiredService<RoomsProfileData>());
        services.AddScoped<IKeptChildren>(provider => provider.GetRequiredService<RoomsProfileData>());
        services.AddScoped<IProfileNames>(provider => provider.GetRequiredService<RoomsProfileData>());
        services.AddSignalR(options => options.MaximumReceiveMessageSize = 16 * 1024);
        if (builder.Configuration.GetValue($"{RoomsOptions.Section}:ClockEnabled", defaultValue: true) && !BuildTime.IsGeneratingOpenApi)
        {
            services.AddHostedService<RoomClock>();
        }

        services.AddRateLimiter(options => options.AddPolicy(CodeRateLimit, context =>
        {
            var limit = context.RequestServices.GetRequiredService<IOptions<RoomsOptions>>().Value.CodeLookupsPerMinute;
            var key = SessionClaims.ProfileId(context.User)?.ToString() ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            return RateLimitPartition.GetFixedWindowLimiter(
                key,
                _ => new FixedWindowRateLimiterOptions { PermitLimit = limit, Window = TimeSpan.FromMinutes(1) });
        }));
        return builder;
    }

    /// <summary>
    /// The WebSocket to the hub carries the session cookie, and browsers do not stop other pages from opening one: only
    /// pages of the hub's own origin may (cross-site WebSocket hijacking). Unsafe HTTP requests are covered by
    /// <c>SameOriginGuard</c>.
    /// </summary>
    public static IApplicationBuilder UseRoomsOriginGuard(this IApplicationBuilder app) =>
        app.Use(async (context, next) =>
        {
            var request = context.Request;
            if (request.Path.StartsWithSegments(HubPath, StringComparison.Ordinal)
                && request.Headers.Origin is [{ } origin]
                && (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)
                    || !string.Equals(uri.Authority, request.Host.Value, StringComparison.OrdinalIgnoreCase)))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return;
            }

            await next(context);
        });

    public static IEndpointRouteBuilder MapRoomsEndpoints(this IEndpointRouteBuilder api, WebApplication app)
    {
        app.MapHub<RoomsHub>(HubPath, options => options.AllowStatefulReconnects = true);

        var rooms = api.MapGroup("/rooms")
            .WithTags("Rooms")
            .RequireAuthorization(PlayerPolicy)
            .AddEndpointFilter(async (context, next) =>
            {
                var http = context.HttpContext;
                var (player, problem) = await ResolveAsync(
                    http,
                    http.RequestServices.GetRequiredService<IActiveProfile>(),
                    http.RequestServices.GetRequiredService<IDevicePlayers>(),
                    http.RequestAborted);
                if (player is null)
                {
                    return problem;
                }

                context.HttpContext.Items[typeof(Player)] = player;
                return await next(context);
            })
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status412PreconditionFailed);

        rooms.MapGet("/", async (string game, HttpContext http, RoomRegistry registry, IRegistryGames games, CancellationToken ct) =>
            {
                var player = PlayerOf(http);
                var known = await games.GetAsync(game, ct);
                if (known?.Rooms is null || known.MinAge > player.MaxGameMinAge)
                {
                    return new List<RoomSummary>();
                }

                return registry.All
                    .Where(room => !room.IsClosed && room.Room.GameId == game && (room.SeatOf(player.ProfileId) is not null || Listed(room, player)))
                    .OrderByDescending(room => room.SeatOf(player.ProfileId) is not null)
                    .ThenByDescending(room => room.Room.CreatedAt)
                    .Select(room => room.Summary(player.ProfileId))
                    .ToList();
            })
            .WithName("ListRooms")
            .WithSummary("Rooms of a game the active profile may see: public ones it may join, and the ones it sits at.");

        rooms.MapGet("/mine", (HttpContext http, RoomRegistry registry) =>
            {
                var player = PlayerOf(http);
                return registry.All
                    .Where(room => !room.IsClosed && room.SeatOf(player.ProfileId) is not null)
                    .Select(room => room.Summary(player.ProfileId))
                    .ToList();
            })
            .WithName("ListMyRooms")
            .WithSummary("Open rooms the active profile sits at, to go back to one.");

        RoomStats.Map(rooms, PlayerOf);

        rooms.MapPost("/", CreateAsync)
            .WithName("CreateRoom")
            .WithSummary("Open a room for a game; the active profile hosts it and takes the first seat.");

        rooms.MapGet("/code/{code}", Results<Ok<RoomView>, NotFound> (string code, HttpContext http, RoomRegistry registry) =>
            {
                var normalized = new string([.. code.Where(char.IsDigit)]);
                return registry.FindByCode(normalized) is { } room
                    ? TypedResults.Ok(room.View(PlayerOf(http).ProfileId))
                    : TypedResults.NotFound();
            })
            .RequireRateLimiting(CodeRateLimit)
            .WithName("FindRoomByCode")
            .WithSummary("A room by its 6-digit code (spaces ignored), to preview before joining; rate limited.");

        rooms.MapGet("/{id:guid}", Results<Ok<RoomView>, NotFound> (Guid id, HttpContext http, RoomRegistry registry) =>
            {
                var player = PlayerOf(http);
                return registry.Find(id) is { } room && (room.IsMember(player.ProfileId) || Listed(room, player) || room.InvitationFor(player.ProfileId) is not null)
                    ? TypedResults.Ok(room.View(player.ProfileId))
                    : TypedResults.NotFound();
            })
            .WithName("GetRoom")
            .WithSummary("A room the active profile sits at, or may see in the lobby.");

        rooms.MapPost("/{id:guid}/join", async Task<Results<Ok<RoomView>, NotFound, ProblemHttpResult>> (
                Guid id, HttpContext http, RoomRegistry registry, IRegistryGames games, IKeptProfiles kept, CancellationToken ct) =>
            {
                var player = PlayerOf(http);
                if (registry.Find(id) is not { } room)
                {
                    return TypedResults.NotFound();
                }

                var game = await games.GetAsync(room.Room.GameId, ct);
                if (game is not null && game.MinAge > player.MaxGameMinAge)
                {
                    return Refused(RoomErrors.TooYoung);
                }

                var problem = await room.RunAsync(async () => await room.JoinAsync(player, await KeptNowAsync(room, player, kept, ct)));
                return problem is null ? TypedResults.Ok(room.View(player.ProfileId)) : Refused(problem);
            })
            .WithName("JoinRoom")
            .WithSummary("Sit at a room: an empty seat, or between hands a bot's.");

        rooms.MapPost("/{id:guid}/watch", async Task<Results<Ok<RoomView>, NotFound, ProblemHttpResult>> (
                Guid id, HttpContext http, RoomRegistry registry, IRegistryGames games, IKeptProfiles kept, CancellationToken ct) =>
            {
                var player = PlayerOf(http);
                if (registry.Find(id) is not { } room)
                {
                    return TypedResults.NotFound();
                }

                var game = await games.GetAsync(room.Room.GameId, ct);
                if (game is not null && game.MinAge > player.MaxGameMinAge)
                {
                    return Refused(RoomErrors.TooYoung);
                }

                var problem = await room.RunAsync(async () => await room.WatchAsync(player, await KeptNowAsync(room, player, kept, ct)));
                return problem is null ? TypedResults.Ok(room.View(player.ProfileId)) : Refused(problem);
            })
            .WithName("WatchRoom")
            .WithSummary("Watch a table without a seat, if its host allows spectators: only what is public is shown.");

        rooms.MapPost("/{id:guid}/invite", async Task<Results<NoContent, NotFound, ProblemHttpResult>> (
                Guid id,
                InviteRequest request,
                HttpContext http,
                RoomRegistry registry,
                IAccountProfiles profiles,
                IProfileDirectory directory,
                RoomInvitations invitations,
                IProfileAliases aliases,
                IOptions<RoomsOptions> options,
                ToheDbContext db,
                CancellationToken ct) =>
            {
                var player = PlayerOf(http);
                if (registry.Find(id) is not { } room)
                {
                    return TypedResults.NotFound();
                }

                // An id merged into another profile asks that profile (ADR 0043's merge aliases).
                request = request with { ProfileId = await aliases.ResolveAsync(request.ProfileId, ct) };

                // Asking by ID stays an account's (ADR 0043): a device profile asks nobody.
                if (player.AccountId is not { } accountId)
                {
                    return Refused(RoomErrors.AccountRequired);
                }

                if (request.ProfileId == player.ProfileId)
                {
                    return Refused(RoomErrors.NotInAccount);
                }

                // The account's other profiles, as always; another account's as its owner allows (ADR 0033).
                var own = await profiles.ListAsync(accountId, ct);
                if (own.All(profile => profile.Id != request.ProfileId)
                    && await BeyondAccountAsync(room, player, request.ProfileId, registry, directory, invitations, options.Value, db, ct) is { } refused)
                {
                    return refused;
                }

                var problem = await room.RunAsync(() => Task.FromResult(room.Invite(player.ProfileId, request.ProfileId)));
                return problem is null ? TypedResults.NoContent() : Refused(problem);
            })
            .WithName("InviteToRoom")
            .WithSummary("Ask a profile to the table — of the account, or another account's as its owner allows (ADR 0033): it shows in their hub for 10 minutes.");

        rooms.MapGet("/invites", (HttpContext http, RoomRegistry registry) =>
            {
                var player = PlayerOf(http);
                return registry.All
                    .Select(room => (Room: room, From: room.InvitationFor(player.ProfileId)))
                    .Where(entry => entry.From is not null)
                    .Select(entry => new RoomInvite(
                        entry.Room.Id,
                        entry.Room.Room.GameId,
                        entry.Room.Room.Code,
                        entry.From!.Name ?? "",
                        entry.From.Avatar ?? "",
                        entry.Room.InvitationUntil(player.ProfileId) ?? DateTimeOffset.MinValue))
                    .ToList();
            })
            .WithName("ListRoomInvites")
            .WithSummary("Tables someone asked the active profile to — by its ID, or from its own account — for the next 10 minutes.");

        rooms.MapPost("/{id:guid}/leave", async Task<Results<NoContent, NotFound, ProblemHttpResult>> (Guid id, HttpContext http, RoomRegistry registry) =>
            {
                if (registry.Find(id) is not { } room)
                {
                    return TypedResults.NotFound();
                }

                var problem = await room.RunAsync(() => room.LeaveAsync(PlayerOf(http).ProfileId));
                return problem is null ? TypedResults.NoContent() : Refused(problem);
            })
            .WithName("LeaveRoom")
            .WithSummary("Leave the seat; during a hand a bot finishes it. The room closes when the last person leaves.");

        rooms.MapPatch("/{id:guid}", async Task<Results<Ok<RoomView>, NotFound, ProblemHttpResult>> (
                Guid id, UpdateRoomRequest request, HttpContext http, RoomRegistry registry, IRegistryGames games, CancellationToken ct) =>
            {
                var player = PlayerOf(http);
                if (registry.Find(id) is not { } room || await games.GetAsync(room.Room.GameId, ct) is not { Rooms: { } spec })
                {
                    return TypedResults.NotFound();
                }

                string? options = null;
                if (request.Options is { } given)
                {
                    var (json, invalid) = spec.Normalize(given);
                    if (invalid is not null)
                    {
                        return Refused(RoomErrors.InvalidOptions);
                    }

                    options = json;
                }

                RoomEntry? entry = null;
                if (request.EntryAsked() is { } asked)
                {
                    if (!RoomEntries.TryParse(asked, out var parsed))
                    {
                        return Refused(RoomErrors.InvalidOptions);
                    }

                    entry = parsed;
                }

                // A child the account's owner has not allowed keeps the table within the account; a device profile hosts
                // only a table it may sit at itself.
                if (!player.MayPlayWithOthers)
                {
                    entry = RoomEntry.Own;
                }
                else if (player.IsDevice && entry is not (null or RoomEntry.Named))
                {
                    return Refused(RoomErrors.AccountRequired);
                }

                var problem = await room.RunAsync(() => room.UpdateAsync(player.ProfileId, request, entry, options, spec.Bots, (spec.MinSeats, spec.MaxSeats)));
                return problem is null ? TypedResults.Ok(room.View(player.ProfileId)) : Refused(problem);
            })
            .WithName("UpdateRoom")
            .WithSummary("The host changes the room before a hand: seats, visibility, lock, bots, timer, house rules.");

        rooms.MapPut("/{id:guid}/seats/{seat:int}", async Task<Results<Ok<RoomView>, NotFound, ProblemHttpResult>> (
                Guid id, int seat, SetSeatRequest request, HttpContext http, RoomRegistry registry, IRegistryGames games, CancellationToken ct) =>
            {
                var player = PlayerOf(http);
                if (registry.Find(id) is not { } room || await games.GetAsync(room.Room.GameId, ct) is not { Rooms: { } spec })
                {
                    return TypedResults.NotFound();
                }

                var problem = await room.RunAsync(() => room.SetSeatAsync(player.ProfileId, seat, request.Bot, spec.Bots));
                return problem is null ? TypedResults.Ok(room.View(player.ProfileId)) : Refused(problem);
            })
            .WithName("SetRoomSeat")
            .WithSummary("The host seats a bot, or empties a seat (removing a bot or a player).");

        rooms.MapPost("/{id:guid}/start", async Task<Results<Ok<RoomView>, NotFound, ProblemHttpResult>> (
                Guid id, HttpContext http, RoomRegistry registry, CancellationToken ct) =>
            {
                var player = PlayerOf(http);
                if (registry.Find(id) is not { } room)
                {
                    return TypedResults.NotFound();
                }

                var problem = await room.RunAsync(() => room.StartAsync(player.ProfileId, registry.MinSeats(id), ct));
                return problem is null ? TypedResults.Ok(room.View(player.ProfileId)) : Refused(problem);
            })
            .WithName("StartRoom")
            .WithSummary("The host starts the first hand; empty seats get bots if the room fills them.");

        return api;
    }

    private static Player PlayerOf(HttpContext http) => (Player)http.Items[typeof(Player)]!;

    /// <summary>
    /// For a device profile coming in: the children at the table kept to their accounts as their accounts say now
    /// (ADR 0043). Read inside the room's turn, so nobody sits down meanwhile.
    /// </summary>
    private static async Task<IReadOnlySet<Guid>?> KeptNowAsync(RoomActor room, Player player, IKeptProfiles kept, CancellationToken ct) =>
        player.IsDevice ? await kept.KeptAsync(room.AccountMembers(), ct) : null;

    /// <summary>
    /// The player a request acts as (ADR 0043): with the device key, the device profile it names — of that device, with
    /// the terms the hub shows accepted — else the account session's active profile. Or the problem to answer.
    /// </summary>
    internal static async Task<(Player? Player, ProblemHttpResult? Problem)> ResolveAsync(
        HttpContext http, IActiveProfile active, IDevicePlayers devices, CancellationToken ct)
    {
        if (DeviceKey.DeviceOf(http.User) is not null)
        {
            var found = await devices.FindAsync(http, ct);
            return found.Player is { } device
                ? (Player.From(device), null)
                : (null, Problems.Of(found.Status, found.Code ?? "profile_required", (found.Code ?? "profile_required").Replace('_', ' ')));
        }

        var profile = await active.GetAsync(http.User, ct);
        return profile is null
            ? (null, Problems.Of(StatusCodes.Status403Forbidden, "profile_required", "Choose a profile first"))
            : (Player.From(profile), null);
    }

    /// <summary>
    /// Why a profile of another account may not be asked to this table (ADR 0033), or null: it must be found — never a
    /// child of another account, nor a suspended account's — the table open to other accounts, the profile's owner must
    /// let the asker in, and the limits of D-17 hold. The invitation is counted when it may go.
    /// </summary>
    private static async Task<ProblemHttpResult?> BeyondAccountAsync(
        RoomActor room,
        Player player,
        Guid profileId,
        RoomRegistry registry,
        IProfileDirectory directory,
        RoomInvitations invitations,
        RoomsOptions options,
        ToheDbContext db,
        CancellationToken ct)
    {
        var accountId = player.AccountId!.Value;
        if (await directory.FindAsync(profileId, accountId, ct) is not { } target)
        {
            return Refused(RoomErrors.ProfileNotFound);
        }

        if (room.Room.Entry == RoomEntry.Own)
        {
            return Refused(RoomErrors.AccountOnly);
        }

        var open = target.Invites switch
        {
            InviteScope.Anyone => true,
            InviteScope.PlayedWith => await Tables.PlayedTogetherAsync(db, player.ProfileId, target.ProfileId, ct),
            _ => false,
        };
        if (!open)
        {
            return Refused(RoomErrors.InvitesClosed);
        }

        // Asking again to this table renews the invitation rather than adding one.
        var waiting = registry.All.Count(other => other.Id != room.Id && other.InvitationFor(target.ProfileId) is not null);
        if (waiting >= options.InvitationsWaitingPerProfile)
        {
            return Refused(RoomErrors.InviteeLimit);
        }

        return invitations.TryTake(accountId, options.InvitationsPerHour) ? null : Refused(RoomErrors.InviteLimit);
    }

    /// <summary>Shown in the lobby to this player: public, and a table it may join (its door, ADR 0043).</summary>
    private static bool Listed(RoomActor room, Player player)
    {
        var settings = room.Room;
        var sameAccount = player.AccountId is { } account && account == settings.HostAccountId;
        return settings.IsPublic
            && (settings.Entry != RoomEntry.Own || sameAccount)
            && (settings.Entry != RoomEntry.Account || !player.IsDevice)
            && (player.MayPlayWithOthers || (settings.Entry == RoomEntry.Own && sameAccount))
            && (!player.IsDevice || !room.Seats.Any(seat => seat.Kept))
            && (player.MayPlayWithOthers || !room.Seats.Any(seat => seat.IsDeviceProfile()));
    }

    private static async Task<Results<Ok<RoomView>, ValidationProblem, ProblemHttpResult>> CreateAsync(
        CreateRoomRequest request,
        HttpContext http,
        RoomRegistry registry,
        IRegistryGames games,
        IOptions<RoomsOptions> options,
        TimeProvider clock,
        CancellationToken ct)
    {
        var player = PlayerOf(http);
        var game = await games.GetAsync(request.GameId, ct);
        if (game?.Rooms is not { } spec)
        {
            return Refused(RoomErrors.GameNotRooms);
        }

        if (game.MinAge > player.MaxGameMinAge)
        {
            return Refused(RoomErrors.TooYoung);
        }

        if (request.Seats < spec.MinSeats || request.Seats > spec.MaxSeats)
        {
            return Problems.Field("seats", RoomErrors.InvalidOptions);
        }

        if (request.BotLevel is { } level && !spec.Bots.Contains(level))
        {
            return Problems.Field("botLevel", RoomErrors.InvalidOptions);
        }

        if (!RoomEntries.TryParse(request.EntryAsked(), out var entry))
        {
            return Problems.Field("entry", RoomErrors.InvalidOptions);
        }

        // A device profile opens only a table it may sit at itself: one for anyone named (ADR 0043).
        if (player.IsDevice && entry != RoomEntry.Named)
        {
            return Refused(RoomErrors.AccountRequired);
        }

        var (optionsJson, invalid) = spec.Normalize(request.Options);
        if (invalid is not null)
        {
            return Problems.Field($"options.{invalid}", RoomErrors.InvalidOptions);
        }

        var hosting = registry.All.Count(room => !room.IsClosed && room.Room.HostProfileId == player.ProfileId);
        if (hosting >= options.Value.MaxRoomsPerHost)
        {
            return Refused(RoomErrors.TooManyRooms);
        }

        var now = clock.GetUtcNow();
        var seats = Enumerable.Range(0, request.Seats)
            .Select(index => index == 0
                ? new SeatRecord(player.ProfileId, player.AccountId, player.Name, player.Avatar, null, Kept: !player.MayPlayWithOthers)
                : SeatRecord.Empty)
            .ToList();
        var room = new Room
        {
            Id = Guid.CreateVersion7(),
            Code = "000000",
            GameId = game.Id,
            GameVersion = game.Version,
            RulesPath = game.Path + spec.Rules,
            HostProfileId = player.ProfileId,
            HostAccountId = player.AccountId,
            IsPublic = request.IsPublic,
            // A child the account's owner has not allowed only opens tables for the account's own profiles.
            Entry = player.MayPlayWithOthers ? entry : RoomEntry.Own,
            Seats = request.Seats,
            BotsFill = request.BotsFill && spec.Bots.Count > 0,
            BotLevel = request.BotLevel ?? spec.DefaultBot,
            BotsTakeOver = request.BotsTakeOver && spec.Bots.Count > 0,
            TurnSeconds = request.TurnSeconds,
            AllowSpectators = request.Spectators,
            Options = optionsJson!,
            SeatList = System.Text.Json.JsonSerializer.Serialize(seats),
            Status = RoomStatus.Waiting,
            Scores = System.Text.Json.JsonSerializer.Serialize(new int[request.Seats]),
            CreatedAt = now,
            UpdatedAt = now,
        };
        var actor = await registry.CreateAsync(room, spec.MinSeats, ct);
        return TypedResults.Ok(actor.View(player.ProfileId));
    }

    private static ProblemHttpResult Refused(string code) => Problems.Of(
        code switch
        {
            RoomErrors.Full or RoomErrors.HandInProgress or RoomErrors.NotEnoughPlayers or RoomErrors.TooManyRooms
                or RoomErrors.Closed => StatusCodes.Status409Conflict,
            RoomErrors.RulesUnavailable => StatusCodes.Status503ServiceUnavailable,
            RoomErrors.InvalidOptions or RoomErrors.GameNotRooms => StatusCodes.Status400BadRequest,
            RoomErrors.NotSeated or RoomErrors.ProfileNotFound => StatusCodes.Status404NotFound,
            RoomErrors.SpectatorsOff or RoomErrors.NotInAccount => StatusCodes.Status403Forbidden,
            RoomErrors.InviteLimit or RoomErrors.InviteeLimit => StatusCodes.Status429TooManyRequests,
            _ => StatusCodes.Status403Forbidden,
        },
        code,
        code.Replace('_', ' '));
}
