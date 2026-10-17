using System.ComponentModel.DataAnnotations;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Integrity;

namespace Tohe.Api.Modules.Progress;

/// <param name="Data">The game's save, any JSON up to 64 KB.</param>
public sealed record PutSaveRequest(JsonElement Data);

/// <param name="UpdatedAt">Server time of the last write.</param>
public sealed record SavedGameView(string GameId, JsonElement Data, DateTimeOffset UpdatedAt);

/// <param name="ClientId">Chosen by the device; the same id again updates that score instead of adding one.</param>
/// <param name="AchievedAt">When the score was reached, by the device's clock.</param>
/// <param name="Final">False while a long run goes on (ADR 0014).</param>
public sealed record ScoreInput(
    Guid ClientId,
    [Required, StringLength(40)] string GameId,
    [Required, StringLength(40)] string Board,
    double Value,
    DateTimeOffset AchievedAt,
    bool Final = true);

public sealed record RecordScoresRequest([Required, MaxLength(200)] IReadOnlyList<ScoreInput> Scores);

/// <param name="Recorded">Scores added or raised by this request (repeats that change nothing excluded).</param>
public sealed record RecordScoresResult(int Recorded);

/// <summary>
/// Saves and scores of the active profile, synced by the hub in the background (M2, ADR 0005). Offline, the hub keeps
/// writing to the device and pushes when the API is back. Every run also goes to the integrity engine, whose boards
/// rank them (ADR 0029).
/// </summary>
internal static partial class ProgressModule
{
    /// <summary>The Game Contract's save limit (MAX_SAVE_BYTES).</summary>
    public const int MaxSaveBytes = 64 * 1024;

    [GeneratedRegex("^[a-z][a-z0-9-]{1,38}[a-z0-9]$")]
    private static partial Regex GameIdPattern();

    public static WebApplicationBuilder AddProgressModule(this WebApplicationBuilder builder)
    {
        // What the admin console counts about play (ADR 0027).
        builder.Services.AddScoped<ProgressFacts>();
        return builder;
    }

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
                var now = ToDatabasePrecision(clock.GetUtcNow());
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
                RecordScoresRequest request, HttpContext http, ToheDbContext db, IResults results, TimeProvider clock, CancellationToken ct) =>
            {
                if (request.Scores.Any(s => !GameIdPattern().IsMatch(s.GameId) || !double.IsFinite(s.Value)))
                {
                    return Problems.Field("scores", "score_invalid");
                }

                var profile = Active(http);
                var ids = request.Scores.Select(s => s.ClientId).Distinct().ToList();
                var known = await db.Scores
                    .Where(s => s.ProfileId == profile.Id && ids.Contains(s.ClientId))
                    .ToDictionaryAsync(s => s.ClientId, ct);
                var changed = new List<ScoreEntry>();
                foreach (var input in request.Scores)
                {
                    if (known.TryGetValue(input.ClientId, out var entry))
                    {
                        // A long run reporting again: keep its highest score; once final it stays final.
                        if (input.Value <= entry.Value && (entry.Final || !input.Final))
                        {
                            continue;
                        }

                        if (input.Value > entry.Value)
                        {
                            entry.Value = input.Value;
                            entry.AchievedAt = input.AchievedAt;
                        }

                        entry.Final |= input.Final;
                        entry.RecordedAt = clock.GetUtcNow();
                    }
                    else
                    {
                        entry = new ScoreEntry
                        {
                            ProfileId = profile.Id,
                            GameId = input.GameId,
                            Board = input.Board,
                            Value = input.Value,
                            AchievedAt = input.AchievedAt,
                            RecordedAt = clock.GetUtcNow(),
                            ClientId = input.ClientId,
                            Final = input.Final,
                        };
                        db.Scores.Add(entry);
                        known[input.ClientId] = entry;
                    }

                    changed.Add(entry);
                }

                // The engine decides how far each can be trusted, saved with the scores (ADR 0029).
                await results.SubmitRunsAsync(
                    profile.Id,
                    profile.AccountId,
                    [.. changed.Select(entry => new RunClaim(entry.ClientId, entry.GameId, entry.Board, entry.Value, entry.Final, entry.AchievedAt))],
                    ct);
                await db.SaveChangesAsync(ct);
                return TypedResults.Ok(new RecordScoresResult(changed.Count));
            })
            .WithName("RecordScores")
            .WithSummary("Record runs of the active profile; the same clientId again raises that run's score.");

        return api;
    }

    /// <summary>
    /// PostgreSQL keeps microseconds; .NET has 100 ns ticks. Rounding first makes the time in a PUT's answer equal to
    /// the one a later GET reads, which devices compare.
    /// </summary>
    private static DateTimeOffset ToDatabasePrecision(DateTimeOffset time) =>
        new(time.Ticks - (time.Ticks % 10), time.Offset);

    private static ActiveProfile Active(HttpContext http) => (ActiveProfile)http.Items[typeof(ActiveProfile)]!;

    private static SavedGameView ToView(SavedGame save)
    {
        using var json = JsonDocument.Parse(save.Data);
        return new SavedGameView(save.GameId, json.RootElement.Clone(), save.UpdatedAt);
    }
}
