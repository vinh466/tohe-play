using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Rooms;

/// <summary>
/// The live side of rooms (ADR 0016), at <c>/api/rooms/hub</c>. The hub is its only client: it relays views to the
/// game iframe and actions back. Expected refusals come back as an error code (null when accepted); only broken
/// requests throw.
/// </summary>
/// <remarks>
/// Server to client: <c>Room(RoomView)</c>, <c>View(roomId, view, events, seq, turnMs)</c>,
/// <c>Reaction(roomId, seat, reaction)</c>, <c>Closed(roomId, reason)</c>, <c>LobbyChanged(gameId)</c>.
/// </remarks>
[Authorize(AuthenticationSchemes = DeviceKey.PlayerScheme)]
internal sealed class RoomsHub(RoomRegistry registry, IActiveProfile activeProfile, IDevicePlayers devicePlayers) : Hub
{
    /// <summary>The largest action a phone may send; Tiến lên's are a few dozen bytes.</summary>
    private const int MaxActionBytes = 4096;

    private static readonly HashSet<string> Reactions = ["wave", "laugh", "wow", "clap", "hurry", "gg", "sad", "heart"];

    /// <summary>
    /// The player this connection acts as: an account's active profile, or the device profile its address names, with
    /// its device's key (ADR 0043). The connection's request is read again on every call, as the session's profile can
    /// change and a device profile can be deleted or asked for the terms again.
    /// </summary>
    private async Task<Player> ProfileAsync()
    {
        var http = Context.GetHttpContext() ?? throw new HubException("profile_required");
        var (player, problem) = await RoomsModule.ResolveAsync(http, activeProfile, devicePlayers, Context.ConnectionAborted);
        return player ?? throw new HubException(CodeOf(problem));
    }

    private static string CodeOf(Microsoft.AspNetCore.Http.HttpResults.ProblemHttpResult? problem) =>
        problem?.ProblemDetails.Extensions.TryGetValue("code", out var code) == true && code is string text ? text : "profile_required";

    private HashSet<Guid> Entered()
    {
        if (Context.Items["rooms"] is not HashSet<Guid> rooms)
        {
            rooms = [];
            Context.Items["rooms"] = rooms;
        }

        return rooms;
    }

    /// <summary>This phone sits at the table: it receives the room, its seat's views and reactions.</summary>
    public async Task<RoomView?> Enter(Guid roomId)
    {
        var profile = await ProfileAsync();
        if (registry.Find(roomId) is not { } room || !room.IsMember(profile.ProfileId))
        {
            return null;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, RoomOutbox.RoomGroup(roomId));
        await Groups.AddToGroupAsync(Context.ConnectionId, RoomOutbox.PlayerGroup(roomId, profile.ProfileId));
        Entered().Add(roomId);
        return await room.RunAsync(async () =>
        {
            await room.ConnectedAsync(profile.ProfileId, Context.ConnectionId);
            return room.View(profile.ProfileId);
        });
    }

    /// <summary>This phone stops showing the table (the seat stays; leaving it is <c>POST /api/rooms/{id}/leave</c>).</summary>
    public async Task Exit(Guid roomId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, RoomOutbox.RoomGroup(roomId));
        var profile = await ProfileAsync();
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, RoomOutbox.PlayerGroup(roomId, profile.ProfileId));
        if (Entered().Remove(roomId) && registry.Find(roomId) is { } room)
        {
            await room.RunAsync(() => room.DisconnectedAsync(Context.ConnectionId));
        }
    }

    public async Task<string?> Act(Guid roomId, JsonElement action)
    {
        var profile = await ProfileAsync();
        var raw = action.GetRawText();
        if (raw.Length > MaxActionBytes)
        {
            return RoomErrors.ActionInvalid;
        }

        if (registry.Find(roomId) is not { } room)
        {
            return RoomErrors.NotFound;
        }

        return await room.RunAsync(() => room.ActAsync(profile.ProfileId, raw));
    }

    /// <summary>Ready for the next hand.</summary>
    public async Task<string?> Next(Guid roomId)
    {
        var profile = await ProfileAsync();
        if (registry.Find(roomId) is not { } room)
        {
            return RoomErrors.NotFound;
        }

        return await room.RunAsync(() => room.NextAsync(profile.ProfileId, registry.MinSeats(roomId), Context.ConnectionAborted));
    }

    /// <summary>One of the preset reactions; at most one every 1.5 s per seat.</summary>
    public async Task React(Guid roomId, string reaction)
    {
        var profile = await ProfileAsync();
        if (Reactions.Contains(reaction) && registry.Find(roomId) is { } room)
        {
            await room.RunAsync(() => room.ReactAsync(profile.ProfileId, reaction));
        }
    }

    /// <summary>Get told when a game's lobby changes (then fetch <c>GET /api/rooms?game=</c>).</summary>
    public Task WatchLobby(string gameId) => Groups.AddToGroupAsync(Context.ConnectionId, RoomOutbox.LobbyGroup(gameId));

    public Task UnwatchLobby(string gameId) => Groups.RemoveFromGroupAsync(Context.ConnectionId, RoomOutbox.LobbyGroup(gameId));

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        foreach (var roomId in Entered())
        {
            if (registry.Find(roomId) is { } room)
            {
                await room.RunAsync(() => room.DisconnectedAsync(Context.ConnectionId));
            }
        }

        await base.OnDisconnectedAsync(exception);
    }
}
