using Microsoft.AspNetCore.Http.HttpResults;
using Tohe.Api.Infrastructure;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Registry;

namespace Tohe.Api.Modules.Integrity;

/// <param name="Since">Where the period starts — Monday 00:00 in Việt Nam for <c>week</c>; null for <c>all</c>.</param>
public sealed record AccountBoardView(string GameId, string Board, string Period, DateTimeOffset? Since, IReadOnlyList<BoardRow> Rows);

/// <summary>
/// The integrity engine and the boards that read by trust (ADR 0029). Progress and Rooms hand it their results through
/// <see cref="IResults"/>; boards come from here.
/// </summary>
internal static class IntegrityModule
{
    public static WebApplicationBuilder AddIntegrityModule(this WebApplicationBuilder builder)
    {
        builder.Services.AddScoped<IntegrityEngine>();
        builder.Services.AddScoped<IResults>(services => services.GetRequiredService<IntegrityEngine>());
        builder.Services.AddScoped<Boards>();
        builder.Services.AddScoped<IBoards>(services => services.GetRequiredService<Boards>());
        builder.Services.AddScoped<PublicBoards>();
        // People's decisions about held results, for the admin console (ADR 0029).
        builder.Services.AddScoped<IntegrityReview>();
        // A deleted profile's results and ranked runs go with it (ADR 0034).
        builder.Services.AddScoped<IntegrityProfileData>();
        builder.Services.AddScoped<IProfileData>(provider => provider.GetRequiredService<IntegrityProfileData>());
        builder.Services.AddScoped<IProfileMoves>(provider => provider.GetRequiredService<IntegrityProfileData>());
        // Ranked runs (ADR 0030): dealt and taken in by the API, replayed in the background.
        builder.Services.AddOptions<IntegrityOptions>().BindConfiguration(IntegrityOptions.Section);
        builder.Services.AddScoped<RankedRuns>();
        builder.Services.AddScoped<RankedReplays>();
        var options = builder.Configuration.GetSection(IntegrityOptions.Section).Get<IntegrityOptions>() ?? new IntegrityOptions();
        if (options.Replays && !BuildTime.IsGeneratingOpenApi)
        {
            builder.Services.AddHostedService<RankedReplayWorker>();
        }

        return builder;
    }

    public static IEndpointRouteBuilder MapIntegrityEndpoints(this IEndpointRouteBuilder api)
    {
        var boards = api.MapGroup("/boards")
            .WithTags("Boards")
            .RequireAuthorization()
            .ProducesProblem(StatusCodes.Status403Forbidden);

        boards.MapGet("/{gameId}", async Task<Results<Ok<AccountBoardView>, ValidationProblem, ProblemHttpResult>> (
                string gameId,
                HttpContext http,
                IActiveProfile active,
                Boards read,
                TimeProvider clock,
                CancellationToken ct,
                string board = "default",
                string period = "week") =>
            {
                if (await active.GetAsync(http.User, ct) is not { } profile)
                {
                    return Problems.Of(StatusCodes.Status403Forbidden, "profile_required", "Choose a profile first");
                }

                if (period is not ("week" or "all"))
                {
                    return Problems.Field("period", "period_invalid");
                }

                DateTimeOffset? since = period == "week" ? Weeks.StartOf(clock.GetUtcNow()) : null;
                var rows = await read.AccountRunsAsync(profile.AccountId, profile.Id, gameId, board, since, ct);
                return TypedResults.Ok(new AccountBoardView(gameId, board, period, since, rows));
            })
            .WithName("GetAccountBoard")
            .WithSummary("The account's board of a game: each profile's best this week or of all time.");

        boards.MapGet("/{gameId}/public", async Task<Results<Ok<PublicBoardView>, ValidationProblem, ProblemHttpResult, NotFound>> (
                string gameId,
                HttpContext http,
                IActiveProfile active,
                IBoardAudience audience,
                IRegistryGames registry,
                PublicBoards read,
                TimeProvider clock,
                CancellationToken ct,
                string scope = "server",
                string board = "default",
                string period = "week") =>
            {
                if (await active.GetAsync(http.User, ct) is not { } profile)
                {
                    return Problems.Of(StatusCodes.Status403Forbidden, "profile_required", "Choose a profile first");
                }

                if (scope is not ("community" or "server"))
                {
                    return Problems.Field("scope", "scope_invalid");
                }

                if (period is not ("week" or "all"))
                {
                    return Problems.Field("period", "period_invalid");
                }

                if (await registry.GetAsync(gameId, ct) is not { } game)
                {
                    return TypedResults.NotFound();
                }

                Guid? community = null;
                if (scope == "community" && (community = await audience.CommunityOfAsync(profile.AccountId, ct)) is null)
                {
                    return Problems.Of(StatusCodes.Status404NotFound, "no_community", "The account came with no community");
                }

                DateTimeOffset? since = period == "week" ? Weeks.StartOf(clock.GetUtcNow()) : null;
                var hands = game.Rooms is not null;
                var reproducible = game.Ranked is not null;
                var name = hands ? IntegrityEngine.HandsBoard : board;
                var (rows, listed) = await read.RankAsync(profile.Id, gameId, name, hands, reproducible, community, since, ct);
                return TypedResults.Ok(PublicBoards.View(gameId, name, scope, period, since, hands, reproducible, listed, rows, profile.Id));
            })
            .WithName("GetPublicBoard")
            .WithSummary("A community's or the server's board of a game: the first 50 and the viewer's place, by trust.");

        var runs = api.MapGroup("/runs")
            .WithTags("Boards")
            .RequireAuthorization()
            .ProducesProblem(StatusCodes.Status403Forbidden);

        runs.MapPost("/", async Task<Results<Ok<RankedRunView>, ProblemHttpResult>> (
                StartRankedRunRequest request,
                HttpContext http,
                IActiveProfile active,
                IRegistryGames registry,
                RankedRuns ranked,
                CancellationToken ct) =>
            {
                if (await active.GetAsync(http.User, ct) is not { } profile)
                {
                    return Problems.Of(StatusCodes.Status403Forbidden, "profile_required", "Choose a profile first");
                }

                if (await registry.GetAsync(request.GameId, ct) is not { Ranked: { } rules } game)
                {
                    return Problems.Of(StatusCodes.Status404NotFound, "not_ranked", "The catalog has no ranked game by that id");
                }

                if (await ranked.StartAsync(profile, game, rules, ct) is not { } run)
                {
                    return Problems.Of(StatusCodes.Status429TooManyRequests, "too_many_runs", "Too many runs started just now");
                }

                return TypedResults.Ok(new RankedRunView(run.Id.ToString("N"), run.Seed));
            })
            .WithName("StartRankedRun")
            .WithSummary("Open a ranked run of a game (ADR 0030): its id and the seed to play it from; it closes the last one.");

        runs.MapPost("/{id}/finish", async Task<Results<Accepted, ValidationProblem, ProblemHttpResult>> (
                string id,
                FinishRankedRunRequest request,
                HttpContext http,
                IActiveProfile active,
                RankedRuns ranked,
                CancellationToken ct) =>
            {
                if (await active.GetAsync(http.User, ct) is not { } profile)
                {
                    return Problems.Of(StatusCodes.Status403Forbidden, "profile_required", "Choose a profile first");
                }

                var refused = Guid.TryParse(id, out var run)
                    ? await ranked.FinishAsync(profile.Id, run, request.Moves, request.Score, ct)
                    : "not_found";
                return refused switch
                {
                    null => TypedResults.Accepted((string?)null),
                    "not_found" => Problems.Of(StatusCodes.Status404NotFound, "not_found", "No such run of this profile"),
                    "run_closed" or "run_finished" => Problems.Of(StatusCodes.Status409Conflict, refused, "The run takes no moves now"),
                    "score_invalid" => Problems.Field("score", refused),
                    _ => Problems.Field("moves", refused),
                };
            })
            .WithName("FinishRankedRun")
            .WithSummary("Hand a ranked run's moves and score in; the server replays them with the game's verify module.");

        return api;
    }
}
