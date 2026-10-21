using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Platform;

namespace Tohe.Api.Modules.Registry;

internal sealed record SyncResult(int Added, int Updated, int Unlisted, int Skipped);

/// <summary>Fetches catalog.json from the games origin and upserts it into the registry.</summary>
internal sealed partial class CatalogSync(
    HttpClient http,
    ToheDbContext db,
    IOptions<GamesOptions> games,
    TimeProvider clock,
    ILogger<CatalogSync> logger)
{
    public async Task<SyncResult> RunAsync(CancellationToken cancellationToken)
    {
        var catalog = await http.GetFromJsonAsync<CatalogDocument>(games.Value.CatalogUrl, cancellationToken)
            ?? throw new InvalidOperationException("catalog.json was empty");

        var now = clock.GetUtcNow();
        var known = await db.Games.ToDictionaryAsync(game => game.Id, cancellationToken);
        var seen = new HashSet<string>(StringComparer.Ordinal);
        int added = 0, updated = 0, skipped = 0;

        foreach (var entry in catalog.Games)
        {
            var problem = entry.Manifest is null ? "missing manifest" : CatalogRules.Problem(entry.Manifest, entry.Path);
            if (problem is not null || entry.Manifest is not { } manifest)
            {
                LogSkipped(entry.Manifest?.Id ?? "?", problem ?? "missing manifest");
                skipped++;
                continue;
            }

            seen.Add(manifest.Id);
            if (!known.TryGetValue(manifest.Id, out var game))
            {
                game = new Game
                {
                    Id = manifest.Id,
                    Version = manifest.Version,
                    Name = manifest.Name,
                    Path = entry.Path,
                    Entry = manifest.Entry ?? "index.html",
                    Orientation = manifest.Orientation ?? "portrait",
                    FirstSeenAt = now,
                };
                db.Games.Add(game);
                added++;
            }
            else if (game.Version != manifest.Version || !game.Listed)
            {
                updated++;
            }

            game.Version = manifest.Version;
            game.Name = manifest.Name;
            game.Description = manifest.Description ?? "";
            game.Path = entry.Path;
            game.Entry = manifest.Entry ?? "index.html";
            game.Icon = manifest.Icon;
            game.Orientation = manifest.Orientation ?? "portrait";
            game.Capabilities = [.. manifest.Capabilities ?? []];
            game.Tags = [.. manifest.Tags ?? []];
            game.MinAge = manifest.MinAge ?? 0;
            game.SizeKb = entry.SizeKb;
            game.Rooms = manifest.Rooms is { ValueKind: System.Text.Json.JsonValueKind.Object } rooms
                && (manifest.Capabilities ?? []).Contains("rooms")
                ? rooms.GetRawText()
                : null;
            game.Ranked = manifest.Ranked is { ValueKind: System.Text.Json.JsonValueKind.Object } ranked
                && (manifest.Capabilities ?? []).Contains("ranked")
                ? ranked.GetRawText()
                : null;
            (game.IdentityPlay, game.IdentityRooms) = IdentityOf(manifest);
            game.Entries = [.. (manifest.Entries ?? []).Where(kind => kind == GameLevels.ShareEntry).Distinct(StringComparer.Ordinal)];
            game.Listed = true;
            game.UpdatedAt = now;
        }

        var unlisted = 0;
        foreach (var game in known.Values.Where(game => game.Listed && !seen.Contains(game.Id)))
        {
            game.Listed = false;
            game.UpdatedAt = now;
            unlisted++;
        }

        await db.SaveChangesAsync(cancellationToken);
        var result = new SyncResult(added, updated, unlisted, skipped);
        if (added + updated + unlisted + skipped > 0)
        {
            LogSynced(result.Added, result.Updated, result.Unlisted, result.Skipped);
        }

        return result;
    }

    /// <summary>
    /// The manifest's <c>identity</c> (ADR 0045): <c>play</c> (<c>any</c> by default) and, for a game with rooms,
    /// <c>rooms</c> (<c>named</c> by default). The catalog passed the contract's validation; anything else reads as the
    /// defaults.
    /// </summary>
    private static (string Play, string? Rooms) IdentityOf(GameManifestDocument manifest)
    {
        var identity = manifest.Identity is { ValueKind: System.Text.Json.JsonValueKind.Object } given ? given : default;
        string? Read(string name) =>
            identity.ValueKind == System.Text.Json.JsonValueKind.Object
            && identity.TryGetProperty(name, out var value)
            && value.ValueKind == System.Text.Json.JsonValueKind.String
                ? value.GetString()
                : null;
        var play = Read("play") is { } level && GameLevels.IsLevel(level) ? level : GameLevels.Any;
        string? rooms = null;
        if ((manifest.Capabilities ?? []).Contains("rooms"))
        {
            rooms = Read("rooms") is GameLevels.Account ? GameLevels.Account : GameLevels.Named;
        }

        return (play, rooms);
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Catalog entry {GameId} skipped: {Problem}")]
    private partial void LogSkipped(string gameId, string problem);

    [LoggerMessage(Level = LogLevel.Information,
        Message = "Catalog synced: {Added} added, {Updated} updated, {Unlisted} unlisted, {Skipped} skipped")]
    private partial void LogSynced(int added, int updated, int unlisted, int skipped);
}

/// <summary>Runs <see cref="CatalogSync"/> at startup and then every <c>Registry:SyncInterval</c>.</summary>
internal sealed partial class CatalogSyncWorker(
    IServiceScopeFactory scopes,
    IOptions<RegistryOptions> options,
    BackgroundWork work,
    ILogger<CatalogSyncWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(options.Value.SyncInterval);
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<CatalogSync>().RunAsync(stoppingToken);
                work.Succeeded(BackgroundWork.CatalogSync);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                // The games origin or the database may not be up yet; the next tick retries.
                work.Failed(BackgroundWork.CatalogSync, exception);
                LogFailed(exception);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Catalog sync failed; will retry")]
    private partial void LogFailed(Exception exception);
}
