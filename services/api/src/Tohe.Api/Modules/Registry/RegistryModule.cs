using System.Text.Json;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Platform;

namespace Tohe.Api.Modules.Registry;

public sealed class RegistryOptions
{
    public const string Section = "Registry";

    /// <summary>Run the background catalog sync. Tests turn it off and call <c>CatalogSync</c> directly.</summary>
    public bool SyncEnabled { get; set; } = true;

    public TimeSpan SyncInterval { get; set; } = TimeSpan.FromMinutes(5);
}

/// <summary>How a game is played at a table (ADR 0016): seats, bot levels, and the options the hub draws.</summary>
/// <param name="Options">The manifest's <c>rooms.options</c> (see RoomOption in packages/contract).</param>
public sealed record GameRoomsView(int MinSeats, int MaxSeats, IReadOnlyList<string> Bots, JsonElement Options);

/// <summary>What a game asks of its player (ADR 0045).</summary>
/// <param name="Play">What opening the game asks for: <c>any</c>, <c>named</c> or <c>account</c>.</param>
/// <param name="Rooms">The least a table of it asks for — <c>named</c> or <c>account</c> — for a game with rooms; else
/// null. A table asks for the highest of <paramref name="Play"/>, this and its door.</param>
public sealed record GameIdentityView(string Play, string? Rooms);

/// <summary>A playable game as shown in the hub.</summary>
/// <param name="EntryUrl">Absolute URL to load in the game iframe.</param>
/// <param name="IconUrl">Absolute icon URL, if the game ships one.</param>
/// <param name="Rooms">Set for games played online at a table.</param>
/// <param name="Identity">What the game asks of its player (ADR 0045).</param>
/// <param name="Entries">The kinds of entry the build opens itself: <c>share</c>, or none (ADR 0045).</param>
public sealed record GameSummary(
    string Id,
    string Name,
    string Version,
    string Description,
    string EntryUrl,
    string? IconUrl,
    string Orientation,
    IReadOnlyList<string> Capabilities,
    IReadOnlyList<string> Tags,
    int MinAge,
    int SizeKb,
    GameRoomsView? Rooms,
    GameIdentityView Identity,
    IReadOnlyList<string> Entries);

internal static class RegistryModule
{
    public static WebApplicationBuilder AddRegistryModule(this WebApplicationBuilder builder)
    {
        builder.Services.AddOptions<RegistryOptions>().BindConfiguration(RegistryOptions.Section);
        builder.Services.TryAddSingleton(TimeProvider.System);
        builder.Services.AddHttpClient<CatalogSync>(client => client.Timeout = TimeSpan.FromSeconds(10));
        builder.Services.AddScoped<IRegistryGames, RegistryGames>();
        builder.Services.AddScoped<RegistryFacts>();
        if (builder.Configuration.GetValue($"{RegistryOptions.Section}:SyncEnabled", defaultValue: true)
            && !BuildTime.IsGeneratingOpenApi)
        {
            builder.Services.AddHostedService<CatalogSyncWorker>();
        }

        return builder;
    }

    public static IEndpointRouteBuilder MapRegistryEndpoints(this IEndpointRouteBuilder api)
    {
        var games = api.MapGroup("/games").WithTags("Registry");

        games.MapGet("/", async (
                ToheDbContext db, IActiveProfile activeProfile, HttpContext http, IOptions<GamesOptions> options, CancellationToken ct) =>
            {
                var maxMinAge = (await activeProfile.GetAsync(http.User, ct))?.MaxGameMinAge ?? int.MaxValue;
                var listed = await db.Games.AsNoTracking()
                    .Where(game => game.Listed && game.MinAge <= maxMinAge)
                    .OrderBy(game => game.Name)
                    .ToListAsync(ct);
                return listed.Select(game => ToSummary(game, options.Value.PublicOrigin)).ToList();
            })
            .WithName("ListGames")
            .WithSummary("Games available in the hub, filtered by the active profile's age band.");

        games.MapGet("/{id}", async Task<Results<Ok<GameSummary>, NotFound>> (
                string id,
                ToheDbContext db,
                IActiveProfile activeProfile,
                HttpContext http,
                IOptions<GamesOptions> options,
                CancellationToken ct) =>
            {
                var maxMinAge = (await activeProfile.GetAsync(http.User, ct))?.MaxGameMinAge ?? int.MaxValue;
                var game = await db.Games.AsNoTracking()
                    .FirstOrDefaultAsync(g => g.Id == id && g.Listed && g.MinAge <= maxMinAge, ct);
                return game is null ? TypedResults.NotFound() : TypedResults.Ok(ToSummary(game, options.Value.PublicOrigin));
            })
            .WithName("GetGame")
            .WithSummary("One game by id (not found if the active profile is too young for it).");

        return api;
    }

    private static GameSummary ToSummary(Game game, Uri origin)
    {
        var root = new Uri(origin, game.Path);
        return new GameSummary(
            game.Id,
            game.Name,
            game.Version,
            game.Description,
            new Uri(root, game.Entry).ToString(),
            game.Icon is null ? null : new Uri(root, game.Icon).ToString(),
            game.Orientation,
            game.Capabilities,
            game.Tags,
            game.MinAge,
            game.SizeKb,
            game.Rooms is { } rooms ? GameRooms.Parse(rooms).ToView() : null,
            new GameIdentityView(game.IdentityPlay, game.IdentityRooms),
            game.Entries);
    }
}
