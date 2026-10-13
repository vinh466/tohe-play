using System.ComponentModel.DataAnnotations;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Progress;

/// <param name="Data">The game's save, any JSON up to 64 KB.</param>
public sealed record PutSaveRequest(JsonElement Data);

/// <param name="UpdatedAt">Server time of the last write.</param>
public sealed record SavedGameView(string GameId, JsonElement Data, DateTimeOffset UpdatedAt);

/// <param name="ClientId">Chosen by the device; a score sent again with the same id is stored once.</param>
/// <param name="AchievedAt">When the run ended, by the device's clock.</param>
public sealed record ScoreInput(
    Guid ClientId,
    [Required, StringLength(40)] string GameId,
    [Required, StringLength(40)] string Board,
    double Value,
    DateTimeOffset AchievedAt);

public sealed record RecordScoresRequest([Required, MaxLength(200)] IReadOnlyList<ScoreInput> Scores);

/// <param name="Recorded">Scores stored by this request (repeats excluded).</param>
public sealed record RecordScoresResult(int Recorded);

/// <summary>A profile's best score on a board.</summary>
public sealed record LeaderboardEntry(Guid ProfileId, string Name, string Avatar, double Value, DateTimeOffset AchievedAt);

/// <summary>
/// Saves and scores of the active profile, synced by the hub in the background (M2, ADR 0005), and the household
/// leaderboard. Offline, the hub keeps writing to the device and pushes when the API is back.
/// </summary>
internal static partial class ProgressModule
{
    /// <summary>The Game Contract's save limit (MAX_SAVE_BYTES).</summary>
    public const int MaxSaveBytes = 64 * 1024;

    [GeneratedRegex("^[a-z][a-z0-9-]{1,38}[a-z0-9]$")]
    private static partial Regex GameIdPattern();

    public static IEndpointRouteBuilder MapProgressEndpoints(this IEndpointRouteBuilder api)
    {
        var progress = api.MapGroup("/progress")
            .WithTags("Progress")
            .RequireAuthorization()
            .AddEndpointFilter(async (context, next) =>
            {
                var reader = context.HttpContext.RequestServices.GetRequiredService<IActiveProfile>();
                var profile = await reader.GetAsync(context.HttpContext.User, context.HttpContext.RequestAborted);
                if (profile is null)
                {
                    return Problems.Of(StatusCodes.Status403Forbidden, "profile_required", "Choose a profile first");
                }

                context.HttpContext.Items[typeof(ActiveProfile)] = profile;
                return await next(context);
            })
            .ProducesProblem(StatusCodes.Status403Forbidden);

        progress.MapGet("/saves", async (HttpContext http, ToheDbContext db, CancellationToken ct) =>
            {
                var profile = Active(http);
                var saves = await db.SavedGames.AsNoTracking()
                    .Where(save => save.ProfileId == profile.Id)
                    .OrderBy(save => save.GameId)
                    .ToListAsync(ct);
                return saves.Select(ToView).ToList();
            })
            .WithName("ListSaves")
            .WithSummary("Every save of the active profile, for a device to catch up.");

        progress.MapPut("/saves/{gameId}", async Task<Results<Ok<SavedGameView>, ValidationProblem>> (
                string gameId, PutSaveRequest request, HttpContext http, ToheDbContext db, TimeProvider clock, CancellationToken ct) =>
            {
                if (!GameIdPattern().IsMatch(gameId))
                {
                    return Problems.Field("gameId", "game_invalid");
                }

                var data = request.Data.GetRawText();
                if (Encoding.UTF8.GetByteCount(data) > MaxSaveBytes)
                {
                    return Problems.Field("data", "save_too_large");
                }

                var profile = Active(http);
                var now = clock.GetUtcNow();
                var save = await db.SavedGames.FirstOrDefaultAsync(s => s.ProfileId == profile.Id && s.GameId == gameId, ct);
                if (save is null)
                {
                    save = new SavedGame { ProfileId = profile.Id, GameId = gameId, Data = data, UpdatedAt = now };
                    db.SavedGames.Add(save);
                }
                else
                {
                    // Last writer wins; the version it replaces is kept for one restore (ADR 0005).
                    save.PreviousData = save.Data;
                    save.PreviousUpdatedAt = save.UpdatedAt;
                    save.Data = data;
                    save.UpdatedAt = now;
                }

                await db.SaveChangesAsync(ct);
                return TypedResults.Ok(ToView(save));
            })
            .WithName("PutSave")
            .WithSummary("Store the active profile's save of a game; the last write wins.");

        progress.MapPost("/scores", async Task<Results<Ok<RecordScoresResult>, ValidationProblem>> (
                RecordScoresRequest request, HttpContext http, ToheDbContext db, TimeProvider clock, CancellationToken ct) =>
            {
                if (request.Scores.Any(s => !GameIdPattern().IsMatch(s.GameId) || !double.IsFinite(s.Value)))
                {
                    return Problems.Field("scores", "score_invalid");
                }

                var profile = Active(http);
                var ids = request.Scores.Select(s => s.ClientId).Distinct().ToList();
                var known = await db.Scores.AsNoTracking()
                    .Where(s => s.ProfileId == profile.Id && ids.Contains(s.ClientId))
                    .Select(s => s.ClientId)
                    .ToListAsync(ct);
                var fresh = request.Scores
                    .Where(s => !known.Contains(s.ClientId))
                    .DistinctBy(s => s.ClientId)
                    .Select(s => new ScoreEntry
                    {
                        ProfileId = profile.Id,
                        GameId = s.GameId,
                        Board = s.Board,
                        Value = s.Value,
                        AchievedAt = s.AchievedAt,
                        RecordedAt = clock.GetUtcNow(),
                        ClientId = s.ClientId,
                    })
                    .ToList();
                db.Scores.AddRange(fresh);
                await db.SaveChangesAsync(ct);
                return TypedResults.Ok(new RecordScoresResult(fresh.Count));
            })
            .WithName("RecordScores")
            .WithSummary("Record finished runs of the active profile; repeats (same clientId) are ignored.");

        progress.MapGet("/leaderboard/{gameId}", async (
                string gameId,
                HttpContext http,
                ToheDbContext db,
                IHouseholdProfiles household,
                CancellationToken ct,
                string board = "default") =>
            {
                var players = await household.ListAsync(Active(http).HouseholdId, ct);
                var ids = players.Select(p => p.Id).ToList();
                var best = await db.Scores.AsNoTracking()
                    .Where(s => s.GameId == gameId && s.Board == board && ids.Contains(s.ProfileId))
                    .GroupBy(s => s.ProfileId)
                    .Select(g => g.OrderByDescending(s => s.Value).ThenBy(s => s.AchievedAt).First())
                    .ToListAsync(ct);
                return best
                    .Join(players, s => s.ProfileId, p => p.Id, (s, p) => new LeaderboardEntry(p.Id, p.Name, p.Avatar, s.Value, s.AchievedAt))
                    .OrderByDescending(entry => entry.Value)
                    .ThenBy(entry => entry.AchievedAt)
                    .ToList();
            })
            .WithName("GetLeaderboard")
            .WithSummary("Best score of each household member on a game's board.");

        return api;
    }

    private static ActiveProfile Active(HttpContext http) => (ActiveProfile)http.Items[typeof(ActiveProfile)]!;

    private static SavedGameView ToView(SavedGame save)
    {
        using var json = JsonDocument.Parse(save.Data);
        return new SavedGameView(save.GameId, json.RootElement.Clone(), save.UpdatedAt);
    }
}
