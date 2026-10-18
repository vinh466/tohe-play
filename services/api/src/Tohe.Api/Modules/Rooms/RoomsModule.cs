using System.Threading.RateLimiting;
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

    public static WebApplicationBuilder AddRoomsModule(this WebApplicationBuilder builder)
    {
        var services = builder.Services;
        services.AddOptions<RoomsOptions>().BindConfiguration(RoomsOptions.Section);
        services.TryAddSingleton(TimeProvider.System);
        services.AddHttpClient<RulesSource>(client => client.Timeout = TimeSpan.FromSeconds(10));
        services.AddSingleton<RoomRegistry>();
        services.AddSingleton<InviteLimits>();
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
            .RequireAuthorization()
            .AddEndpointFilter(async (context, next) =>
            {
                var reader = context.HttpContext.RequestServices.GetRequiredService<IActiveProfile>();
                var profile = await reader.GetAsync(context.HttpContext.User, context.HttpContext.RequestAborted);
                if (profile is null)
                {
                    return Problems.Of(StatusCodes.Status403Forbidden, "profile_required", "Choose a profile first");
                }

                context.HttpContext.Items[typeof(Player)] = Player.From(profile);
                return await next(context);
            })
            .ProducesProblem(StatusCodes.Status403Forbidden);

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
                Guid id, HttpContext http, RoomRegistry registry, IRegistryGames games, CancellationToken ct) =>
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

                var problem = await room.RunAsync(() => room.JoinAsync(player));
                return problem is null ? TypedResults.Ok(room.View(player.ProfileId)) : Refused(problem);
            })
            .WithName("JoinRoom")
            .WithSummary("Sit at a room: an empty seat, or between hands a bot's.");

        rooms.MapPost("/{id:guid}/watch", async Task<Results<Ok<RoomView>, NotFound, ProblemHttpResult>> (
                Guid id, HttpContext http, RoomRegistry registry, IRegistryGames games, CancellationToken ct) =>
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

                var problem = await room.RunAsync(() => room.WatchAsync(player));
                return problem is null ? TypedResults.Ok(room.View(player.ProfileId)) : Refused(problem);
            })
            .WithName("WatchRoom")
            .WithSummary("Watch a table without a seat, if its host allows spectators: only what is public is shown.");

        rooms.MapPost("/{id:guid}/invite", async Task<Results<NoContent, NotFound, ProblemHttpResult>> (
                Guid id, InviteRequest request, HttpContext http, RoomRegistry registry, IAccountProfiles profiles, CancellationToken ct) =>
            {
                var player = PlayerOf(http);
                if (registry.Find(id) is not { } room)
                {
                    return TypedResults.NotFound();
                }

                // Only the account's other profiles: the invitation shows in their hub, by name.
                var own = await profiles.ListAsync(player.AccountId, ct);
                if (own.All(profile => profile.Id != request.ProfileId) || request.ProfileId == player.ProfileId)
                {
                    return Refused(RoomErrors.NotInAccount);
                }

                var problem = await room.RunAsync(() => Task.FromResult(room.Invite(player.ProfileId, request.ProfileId)));
                return problem is null ? TypedResults.NoContent() : Refused(problem);
            })
            .WithName("InviteToRoom")
            .WithSummary("Ask another of the account's profiles to the table: it shows in their hub for 10 minutes.");

        rooms.MapPost("/{id:guid}/invite/by-id", InviteByIdAsync)
            .WithName("InviteToRoomById")
            .WithSummary("Ask a profile to the table by its 12-digit ID, if its owner lets you: it shows in their hub for 10 minutes.");

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

                // A child the account's owner has not allowed keeps the table within the account.
                var update = player.MayPlayWithOthers ? request : request with { AccountOnly = true };
                var problem = await room.RunAsync(() => room.UpdateAsync(player.ProfileId, update, options, spec.Bots, (spec.MinSeats, spec.MaxSeats)));
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
    /// An invitation by public ID (ADR 0033): within the account as before; beyond it only to a table open to other
    /// accounts, as the invitee's owner allows — anyone, or people it played with — within the limits of D-17.
    /// </summary>
    private static async Task<Results<Ok<InvitedPlayer>, NotFound, ValidationProblem, ProblemHttpResult>> InviteByIdAsync(
        Guid id,
        InviteByIdRequest request,
        HttpContext http,
        RoomRegistry registry,
        IProfileDirectory directory,
        InviteLimits limits,
        ToheDbContext db,
        CancellationToken ct)
    {
        var player = PlayerOf(http);
        if (!ProfileIds.TryNormalize(request.PublicId, out var publicId))
        {
            return Problems.Field("publicId", "profile_id_invalid");
        }

        if (registry.Find(id) is not { } room)
        {
            return TypedResults.NotFound();
        }

        // Every lookup counts, found or not: IDs cannot be walked.
        if (!limits.TryTake(player.AccountId))
        {
            return Refused(RoomErrors.InviteLimit);
        }

        if (await directory.FindAsync(publicId, player.AccountId, ct) is not { } target || target.ProfileId == player.ProfileId)
        {
            return Refused(RoomErrors.ProfileNotFound);
        }

        if (target.AccountId != player.AccountId)
        {
            if (room.Room.AccountOnly)
            {
                return Refused(RoomErrors.AccountOnly);
            }

            var allowed = target.Invites switch
            {
                InviteScope.Anyone => true,
                InviteScope.PlayedWith => await Tables.PlayedTogetherAsync(db, player.ProfileId, target.ProfileId, ct),
                _ => false,
            };
            if (!allowed)
            {
                return Refused(RoomErrors.InviteNotAllowed);
            }

            // Asking again to this table renews the invitation rather than adding one.
            var waiting = registry.All.Count(other => other.Id != room.Id && other.InvitationFor(target.ProfileId) is not null);
            if (waiting >= limits.WaitingPerProfile)
            {
                return Refused(RoomErrors.InviteeLimit);
            }
        }

        var problem = await room.RunAsync(() => Task.FromResult(room.Invite(player.ProfileId, target.ProfileId)));
        return problem is null ? TypedResults.Ok(new InvitedPlayer(target.Name, target.Avatar)) : Refused(problem);
    }

    /// <summary>Shown in the lobby to this player: public, and a table it may join.</summary>
    private static bool Listed(RoomActor room, Player player)
    {
        var settings = room.Room;
        var sameAccount = settings.HostAccountId == player.AccountId;
        return settings.IsPublic
            && (!settings.AccountOnly || sameAccount)
            && (player.MayPlayWithOthers || (settings.AccountOnly && sameAccount));
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
                ? new SeatRecord(player.ProfileId, player.AccountId, player.Name, player.Avatar, null)
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
            AccountOnly = request.AccountOnly || !player.MayPlayWithOthers,
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
