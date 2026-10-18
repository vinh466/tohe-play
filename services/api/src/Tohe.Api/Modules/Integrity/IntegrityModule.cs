using Microsoft.AspNetCore.Http.HttpResults;
using Tohe.Api.Infrastructure;
using Tohe.Api.Modules.Identity;

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

        return api;
    }
}
