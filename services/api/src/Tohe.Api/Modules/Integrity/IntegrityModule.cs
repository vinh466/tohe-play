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
                var name = hands ? IntegrityEngine.HandsBoard : board;
                var (rows, listed) = await read.RankAsync(profile.Id, gameId, name, hands, community, since, ct);
                return TypedResults.Ok(PublicBoards.View(gameId, name, scope, period, since, hands, listed, rows, profile.Id));
            })
            .WithName("GetPublicBoard")
            .WithSummary("A community's or the server's board of a game: the first 50 and the viewer's place, by trust.");

        return api;
    }
}
