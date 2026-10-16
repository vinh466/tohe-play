using System.ComponentModel.DataAnnotations;
using System.Text.Json;

namespace Tohe.Api.Modules.Rooms;

/// <param name="Seats">Seats at the table, within the game's range.</param>
/// <param name="IsPublic">Listed in the lobby; otherwise the code or the link only.</param>
/// <param name="HouseholdOnly">Only the host's household may join.</param>
/// <param name="BotsFill">Empty seats get a bot when a hand starts.</param>
/// <param name="BotLevel">One of the game's bot levels; the game's middle level when left out.</param>
/// <param name="BotsTakeOver">A bot plays for a player whose phone is gone longer than the grace period.</param>
/// <param name="TurnSeconds">Seconds per turn; 0 for none.</param>
/// <param name="Options">The game's options (house rules) by id; missing ones take the game's defaults.</param>
public sealed record CreateRoomRequest(
    [Required, StringLength(40)] string GameId,
    [Range(2, 8)] int Seats = 4,
    bool IsPublic = true,
    bool HouseholdOnly = false,
    bool BotsFill = true,
    [StringLength(16)] string? BotLevel = null,
    bool BotsTakeOver = true,
    [Range(0, 120)] int TurnSeconds = 20,
    JsonElement? Options = null);

/// <summary>What the host may change before a hand starts; fields left out stay as they are.</summary>
public sealed record UpdateRoomRequest(
    [Range(2, 8)] int? Seats = null,
    bool? IsPublic = null,
    bool? HouseholdOnly = null,
    bool? Locked = null,
    bool? BotsFill = null,
    [StringLength(16)] string? BotLevel = null,
    bool? BotsTakeOver = null,
    [Range(0, 120)] int? TurnSeconds = null,
    JsonElement? Options = null);

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
/// <param name="MySeat">The active profile's seat, or null if it is not at the table.</param>
public sealed record RoomView(
    Guid Id,
    string Code,
    string GameId,
    string GameVersion,
    string Status,
    Guid HostProfileId,
    bool IsPublic,
    bool HouseholdOnly,
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
    int? MySeat);

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
    bool Mine);

/// <summary>Machine-readable reasons a room operation is refused, shown by the hub in Vietnamese.</summary>
public static class RoomErrors
{
    public const string NotFound = "room_not_found";
    public const string Closed = "room_closed";
    public const string Full = "room_full";
    public const string Locked = "room_locked";
    public const string HouseholdOnly = "room_household_only";
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
}
