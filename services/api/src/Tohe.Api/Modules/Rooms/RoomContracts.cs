using System.ComponentModel.DataAnnotations;
using System.Text.Json;

namespace Tohe.Api.Modules.Rooms;

/// <param name="Seats">Seats at the table, within the game's range.</param>
/// <param name="IsPublic">Listed in the lobby; otherwise the code or the link only.</param>
/// <param name="Entry">Who may sit (ADR 0043): <c>named</c> — anyone with a name, a device profile too, the default —
/// <c>account</c> — profiles of accounts — or <c>own</c> — the host's account's profiles.</param>
/// <param name="BotsFill">Empty seats get a bot when a hand starts.</param>
/// <param name="BotLevel">One of the game's bot levels; the game's middle level when left out.</param>
/// <param name="BotsTakeOver">A bot plays for a player whose phone is gone longer than the grace period.</param>
/// <param name="TurnSeconds">Seconds per turn; 0 for none.</param>
/// <param name="Options">The game's options (house rules) by id; missing ones take the game's defaults.</param>
/// <param name="AccountOnly">Deprecated — a hub from before ADR 0043 still sends it; remove after the next release. Read
/// only when <paramref name="Entry"/> is left out: <c>true</c> is <c>own</c>, <c>false</c> is <c>account</c>.</param>
/// <param name="Language">The language the host's hub speaks: <c>vi</c> (the default) or <c>en</c> (ADR 0047). A listed
/// table's preview card speaks it; the table's code carries none.</param>
public sealed record CreateRoomRequest(
    [Required, StringLength(40)] string GameId,
    [Range(2, 8)] int Seats = 4,
    bool IsPublic = true,
    [StringLength(8)] string? Entry = null,
    bool BotsFill = true,
    [StringLength(16)] string? BotLevel = null,
    bool BotsTakeOver = true,
    [Range(0, 120)] int TurnSeconds = 20,
    JsonElement? Options = null,
    bool Spectators = false,
    bool? AccountOnly = null,
    string? Language = null)
{
    /// <summary>The entry asked for: <see cref="Entry"/>, else the old hub's <see cref="AccountOnly"/>, else <c>named</c>.</summary>
    public string EntryAsked() => Entry ?? RoomEntries.FromAccountOnly(AccountOnly) ?? "named";
}

/// <summary>What the host may change before a hand starts; fields left out stay as they are.</summary>
/// <param name="AccountOnly">Deprecated, as on <see cref="CreateRoomRequest"/>; read only when <paramref name="Entry"/>
/// is left out. Remove after the next release.</param>
public sealed record UpdateRoomRequest(
    [Range(2, 8)] int? Seats = null,
    bool? IsPublic = null,
    [StringLength(8)] string? Entry = null,
    bool? Locked = null,
    bool? BotsFill = null,
    [StringLength(16)] string? BotLevel = null,
    bool? BotsTakeOver = null,
    [Range(0, 120)] int? TurnSeconds = null,
    JsonElement? Options = null,
    bool? Spectators = null,
    bool? AccountOnly = null)
{
    /// <summary>The entry asked for, if any: <see cref="Entry"/>, else the old hub's <see cref="AccountOnly"/>.</summary>
    public string? EntryAsked() => Entry ?? RoomEntries.FromAccountOnly(AccountOnly);
}

/// <param name="Bot">A bot level to seat a bot; null to empty the seat (removing a bot or a player).</param>
public sealed record SetSeatRequest([StringLength(16)] string? Bot);

/// <summary>A seat as the hub shows it.</summary>
/// <param name="Bot">The bot's level when a bot plays this seat (from the start, or for a player who left or lost the connection).</param>
/// <param name="Connected">The player's phone is connected now; always true for bots.</param>
/// <param name="Ready">Ready for the next hand.</param>
public sealed record SeatView(
    int Seat,
    Guid? ProfileId,
    string? Name,
    string? Avatar,
    string? Bot,
    bool Connected,
    bool Ready);

/// <summary>A room in full, for the people in it and for a preview before joining.</summary>
/// <param name="Status"><c>waiting</c>, <c>playing</c>, <c>between</c> or <c>closed</c>.</param>
/// <param name="Scores">Points of each seat over the room's hands.</param>
/// <param name="HandSeats">The room seat of each seat of the game's current (or last) hand, in the game's order.</param>
/// <param name="Spectators">People may watch without a seat.</param>
/// <param name="Watchers">Profiles watching the table now.</param>
/// <param name="MySeat">The active profile's seat, or null if it is not at the table.</param>
/// <param name="Entry">Who may sit: <c>named</c>, <c>account</c> or <c>own</c> (ADR 0043).</param>
/// <param name="AccountOnly">Deprecated — <c>entry</c> is <c>own</c> — for a hub from before ADR 0043; remove after the
/// next release.</param>
public sealed record RoomView(
    Guid Id,
    string Code,
    string GameId,
    string GameVersion,
    string Status,
    Guid HostProfileId,
    bool IsPublic,
    string Entry,
    bool Locked,
    int Seats,
    bool BotsFill,
    string? BotLevel,
    bool BotsTakeOver,
    int TurnSeconds,
    JsonElement Options,
    IReadOnlyList<SeatView> SeatList,
    IReadOnlyList<int> Scores,
    int Hand,
    IReadOnlyList<int> HandSeats,
    int? MySeat,
    bool Spectators,
    IReadOnlyList<Guid> Watchers,
    bool AccountOnly);

/// <summary>A room in the lobby list.</summary>
public sealed record RoomSummary(
    Guid Id,
    string GameId,
    string Status,
    string HostName,
    string HostAvatar,
    int Taken,
    int Seats,
    bool Locked,
    int TurnSeconds,
    bool Mine,
    bool Spectators);

/// <param name="ProfileId">Another profile of the inviting player's account, or one of another account found by its
/// public ID (<c>GET /api/profiles/by-id/{publicId}</c>, ADR 0033).</param>
public sealed record InviteRequest(Guid ProfileId);

/// <summary>
/// Someone at a table asked the active profile to it — another profile of the account, or anyone by its ID (ADR 0033);
/// valid for 10 minutes.
/// </summary>
public sealed record RoomInvite(Guid RoomId, string GameId, string Code, string FromName, string FromAvatar, DateTimeOffset ExpiresAt);

/// <summary>Machine-readable reasons a room operation is refused, shown by the hub in Vietnamese.</summary>
public static class RoomErrors
{
    public const string NotFound = "room_not_found";
    public const string Closed = "room_closed";
    public const string Full = "room_full";
    public const string Locked = "room_locked";
    public const string AccountOnly = "room_account_only";

    /// <summary>The table is for accounts only, or the action is (an invitation by ID): a device profile is refused (ADR 0043).</summary>
    public const string AccountRequired = "account_required";
    public const string ParentPermission = "parent_permission";
    public const string TooYoung = "game_too_young";
    public const string GameNotRooms = "game_not_rooms";
    public const string NotHost = "not_host";
    public const string NotSeated = "not_seated";
    public const string HandInProgress = "hand_in_progress";
    public const string NotEnoughPlayers = "not_enough_players";
    public const string TooManyRooms = "too_many_rooms";
    public const string InvalidOptions = "options_invalid";
    public const string RulesUnavailable = "rules_unavailable";
    public const string ActionInvalid = "action_invalid";
    public const string SpectatorsOff = "spectators_off";
    public const string NotInAccount = "not_in_account";

    /// <summary>No such profile this player may ask: none, a child of another account, a suspended account's.</summary>
    public const string ProfileNotFound = "profile_not_found";

    /// <summary>Its owner lets only people it played with, or only its account, ask it to a table.</summary>
    public const string InvitesClosed = "invites_closed";

    /// <summary>This account asked as many profiles of other accounts as it may in an hour.</summary>
    public const string InviteLimit = "invite_limit";

    /// <summary>That profile has as many invitations waiting as it may.</summary>
    public const string InviteeLimit = "invitee_limit";
}
