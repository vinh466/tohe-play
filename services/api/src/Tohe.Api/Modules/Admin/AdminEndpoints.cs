using System.Diagnostics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Email;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Integrity;
using Tohe.Api.Modules.Platform;
using Tohe.Api.Modules.Progress;
using Tohe.Api.Modules.Registry;
using Tohe.Api.Modules.Rooms;
using Tohe.Api.Modules.Telemetry;

namespace Tohe.Api.Modules.Admin;

/// <summary>The account signed in to the console, its role and what the role may do.</summary>
/// <param name="Role"><c>owner</c>, <c>admin</c>, <c>moderator</c> or <c>viewer</c>.</param>
/// <param name="OpenUntil">The console session ends then: twelve hours after signing in.</param>
/// <param name="SecureUntil">Step-up level 2 is open in this console session until then (ADR 0025).</param>
public sealed record AdminMeView(
    Guid AccountId,
    string DisplayName,
    string? Email,
    string Role,
    IReadOnlyList<string> Permissions,
    DateTimeOffset OpenUntil,
    DateTimeOffset? SecureUntil);

/// <summary>One entry of the audit log.</summary>
/// <param name="Details">More about it, as JSON.</param>
public sealed record AuditEntryView(long Id, DateTimeOffset At, string Actor, string Action, string? Target, string? Details, string? Address);

/// <summary>A page of the audit log, newest first.</summary>
/// <param name="Before">Ask with <c>before</c> set to this for the next, older page; none at the start of the log.</param>
public sealed record AuditPage(IReadOnlyList<AuditEntryView> Entries, long? Before);

/// <summary>The platform at a glance.</summary>
/// <param name="Players">Profiles that saved a game or recorded a score.</param>
/// <param name="ErrorsLastDay">Errors devices reported in the last day; none while telemetry is off.</param>
/// <param name="HeldResults">Results the integrity engine held, waiting for a person (ADR 0029).</param>
/// <param name="DeletionsDue">Accounts whose seven days are over, waiting for an admin to delete them (ADR 0038).</param>
public sealed record AdminOverview(
    DateTimeOffset At,
    string Version,
    Growth Accounts,
    Growth Profiles,
    ActivePlayers Players,
    AdminRooms Rooms,
    int? ErrorsLastDay,
    AdminCatalog Catalog,
    OutboxState Email,
    int HeldResults,
    int DeletionsDue);

/// <param name="Online">Profiles connected to an open room right now.</param>
public sealed record AdminRooms(int Open, int Playing, int Online);

/// <param name="LastSyncAt">When the catalog last synced well; none since the API started.</param>
/// <param name="LastError">Why the last sync failed, while it does.</param>
public sealed record AdminCatalog(int Listed, int Unlisted, DateTimeOffset? LastSyncAt, string? LastError);

/// <summary>A game in the registry, with how much it is played.</summary>
/// <param name="PlayersLastWeek">Profiles that saved it or recorded a score in it during the last week.</param>
/// <param name="OpenRooms">Its open tables right now.</param>
/// <param name="IdentityPlay">What opening its current build asks for (ADR 0045): <c>any</c>, <c>named</c> or <c>account</c>.</param>
/// <param name="IdentityRooms">The least a table of it asks for, for a game with rooms; else null.</param>
/// <param name="Entries">The kinds of entry its current build opens itself: <c>share</c>, or none.</param>
public sealed record AdminGame(
    string Id,
    string Name,
    string Version,
    bool Listed,
    int MinAge,
    IReadOnlyList<string> Capabilities,
    IReadOnlyList<string> Tags,
    bool Online,
    int SizeKb,
    DateTimeOffset FirstSeenAt,
    DateTimeOffset UpdatedAt,
    int PlayersLastWeek,
    int OpenRooms,
    string IdentityPlay,
    string? IdentityRooms,
    IReadOnlyList<string> Entries);

/// <summary>The running deployment.</summary>
/// <param name="Environment">ASP.NET Core's environment name, e.g. <c>Production</c>.</param>
/// <param name="StartedAt">When this API process started.</param>
/// <param name="Workers">What each background worker last did, since the API started.</param>
public sealed record AdminSystem(
    string Version,
    string Environment,
    DateTimeOffset StartedAt,
    AdminDatabase Database,
    IReadOnlyList<WorkerStatus> Workers,
    AdminSettings Settings);

/// <param name="Applied">Migrations applied to the database.</param>
/// <param name="Pending">Migrations this build has that the database does not.</param>
/// <param name="Latest">The last migration applied.</param>
public sealed record AdminDatabase(int Applied, IReadOnlyList<string> Pending, string? Latest);

/// <summary>How the deployment is configured — never its secrets.</summary>
/// <param name="PublicUrl">The hub's public URL (<c>App:PublicUrl</c>).</param>
/// <param name="ConsoleUrl">The console's public URL (<c>App:ConsoleUrl</c>).</param>
/// <param name="EmailMode"><c>Smtp</c> or <c>Disabled</c>.</param>
/// <param name="Providers">The sign-in providers it offers (ADR 0026).</param>
/// <param name="OperatorReport">An operator token is set, so <c>GET /api/telemetry/report</c> answers.</param>
public sealed record AdminSettings(
    string? PublicUrl,
    string? ConsoleUrl,
    string GamesOrigin,
    string EmailMode,
    string? EmailFrom,
    IReadOnlyList<string> Providers,
    bool Telemetry,
    bool OperatorReport);

/// <summary>
/// The admin console's read-only pages (ADR 0027). Each module tells what it knows — counts, live rooms, the outbox —
/// and this module only puts it together.
/// </summary>
internal static class AdminEndpoints
{
    private static readonly DateTimeOffset StartedAt = ProcessStart();

    /// <summary>The console's session, and nothing else, authenticates the console's routes (ADR 0042).</summary>
    private static readonly AuthorizationPolicy ConsolePolicy =
        new AuthorizationPolicyBuilder(ConsoleSession.Scheme).RequireAuthenticatedUser().Build();

    public static void Map(IEndpointRouteBuilder api)
    {
        // ConsolePaths.Api: /api/admin.
        var console = api.MapGroup("/admin")
            .WithGroupName(AdminModule.Document)
            .WithTags("Admin")
            .RequireAuthorization(ConsolePolicy);

        // Before a console session: what the console needs first, who is signed in, signing in and out, and a new
        // deployment's setup.
        ConsoleSessionEndpoints.MapOpen(console);
        SetupEndpoints.Map(console);

        // "Nobody signed in" is a normal state of the console, not an error: 204 rather than 401, as the hub's
        // /api/auth/me, so browsers do not log a failed request on every visit.
        console.MapGet("/me", MeAsync)
            .AllowAnonymous()
            .WithName("GetAdminMe")
            .WithSummary("The account signed in to the console: its role, what the role may do, and its session; 204 when nobody is.");

        var admin = console.MapGroup("").AddEndpointFilter<AdminAccess>();

        admin.MapGet("/overview", OverviewAsync)
            .RequirePermission(AdminPermissions.Read)
            .WithName("GetAdminOverview")
            .WithSummary("Accounts, players, rooms, errors, the catalog and the outbox at a glance.");

        admin.MapGet("/games", GamesAsync)
            .RequirePermission(AdminPermissions.Read)
            .WithName("GetAdminGames")
            .WithSummary("Every game in the registry, listed or not, with its players in the last week and open rooms.");

        admin.MapGet("/health", HealthAsync)
            .RequirePermission(AdminPermissions.Read)
            .WithName("GetAdminHealth")
            .WithSummary("Device telemetry over the last days (1 to 30): errors, frames, metrics per game version.");

        admin.MapGet("/system", SystemAsync)
            .RequirePermission(AdminPermissions.Read)
            .WithName("GetAdminSystem")
            .WithSummary("The running build, its database migrations, background workers and settings without secrets.");

        admin.MapGet("/audit", AuditAsync)
            .RequirePermission(AdminPermissions.AuditRead)
            .WithName("GetAdminAudit")
            .WithSummary("The audit log, newest first, a page at a time.");

        ConsoleSessionEndpoints.Map(admin);
        TwoFactorEndpoints.MapConsole(admin);
        UsersEndpoints.Map(admin);
        SettingsEndpoints.Map(admin);
        ReviewEndpoints.Map(admin);
        LinksEndpoints.Map(admin);
    }

    /// <summary>The account, its role and what the role may do, and the console session.</summary>
    public static AdminMeView MeView(Account account, PlatformRole role, DateTimeOffset until, DateTimeOffset? secureUntil) => new(
        account.Id,
        account.DisplayName,
        account.Email,
        PlatformRoles.NameOf(role),
        AdminPermissions.Of(role),
        until,
        secureUntil);

    private static async Task<Results<Ok<AdminMeView>, NoContent>> MeAsync(HttpContext http, TimeProvider clock)
    {
        if (await AdminAccess.CallerAsync(http) is not var (account, role) || ConsoleSession.Until(http.User) is not { } until)
        {
            return TypedResults.NoContent();
        }

        var now = clock.GetUtcNow();
        var secure = SessionClaims.IsSecure(http.User, now) ? SessionClaims.SecureUnlockedUntil(http.User) : null;
        return TypedResults.Ok(MeView(account, role, until, secure));
    }

    private static async Task<Ok<AuditPage>> AuditAsync(ToheDbContext db, CancellationToken ct, long? before = null, int limit = 50)
    {
        limit = Math.Clamp(limit, 1, 200);
        var entries = await db.AuditLog.AsNoTracking()
            .Where(entry => before == null || entry.Id < before)
            .OrderByDescending(entry => entry.Id)
            .Take(limit)
            .Select(entry => new AuditEntryView(entry.Id, entry.At, entry.Actor, entry.Action, entry.Target, entry.Details, entry.Address))
            .ToListAsync(ct);
        return TypedResults.Ok(new AuditPage(entries, entries.Count == limit ? entries[^1].Id : null));
    }

    private static async Task<Ok<AdminOverview>> OverviewAsync(
        IdentityFacts identity,
        ProgressFacts progress,
        RoomRegistry rooms,
        TelemetryFacts telemetry,
        RegistryFacts registry,
        EmailFacts email,
        IntegrityReview review,
        BackgroundWork work,
        IOptions<AppOptions> app,
        IOptions<TelemetryOptions> telemetryOptions,
        TimeProvider clock,
        CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var live = rooms.Live();
        var games = await registry.GamesAsync(ct);
        var catalog = work.Of(BackgroundWork.CatalogSync);
        return TypedResults.Ok(new AdminOverview(
            now,
            PlatformModule.VersionOf(app.Value),
            await identity.AccountsAsync(now, ct),
            await identity.ProfilesAsync(now, ct),
            await progress.PlayersAsync(now, ct),
            new AdminRooms(live.Open, live.Playing, live.Online),
            telemetryOptions.Value.Enabled ? await telemetry.ErrorsSinceAsync(now.AddDays(-1), ct) : null,
            new AdminCatalog(games.Count(game => game.Listed), games.Count(game => !game.Listed), catalog?.LastSuccessAt, catalog?.LastError),
            await email.StateAsync(now, ct),
            await review.HeldCountAsync(ct),
            await identity.DeletionsDueAsync(now, ct)));
    }

    private static async Task<Ok<IReadOnlyList<AdminGame>>> GamesAsync(
        RegistryFacts registry, ProgressFacts progress, RoomRegistry rooms, TimeProvider clock, CancellationToken ct)
    {
        var players = await progress.PlayersByGameAsync(clock.GetUtcNow().AddDays(-7), ct);
        var open = rooms.Live().OpenByGame;
        var games = await registry.GamesAsync(ct);
        return TypedResults.Ok<IReadOnlyList<AdminGame>>([.. games.Select(game => new AdminGame(
            game.Id,
            game.Name,
            game.Version,
            game.Listed,
            game.MinAge,
            game.Capabilities,
            game.Tags,
            game.Online,
            game.SizeKb,
            game.FirstSeenAt,
            game.UpdatedAt,
            players.GetValueOrDefault(game.Id),
            open.GetValueOrDefault(game.Id),
            game.IdentityPlay,
            game.IdentityRooms,
            game.Entries))]);
    }

    private static async Task<Ok<TelemetryReport>> HealthAsync(TelemetryReports reports, CancellationToken ct, int days = 7) =>
        TypedResults.Ok(await reports.BuildAsync(days, includeHeadless: false, ct));

    private static async Task<Ok<AdminSystem>> SystemAsync(
        ToheDbContext db,
        BackgroundWork work,
        IHostEnvironment environment,
        IOptions<AppOptions> app,
        IOptions<GamesOptions> games,
        IOptions<EmailOptions> email,
        IOptions<TelemetryOptions> telemetry,
        ExternalProviderCatalog providers,
        CancellationToken ct)
    {
        var applied = (await db.Database.GetAppliedMigrationsAsync(ct)).ToList();
        var pending = (await db.Database.GetPendingMigrationsAsync(ct)).ToList();
        var sends = email.Value.Mode != EmailMode.Disabled;
        return TypedResults.Ok(new AdminSystem(
            PlatformModule.VersionOf(app.Value),
            environment.EnvironmentName,
            StartedAt,
            new AdminDatabase(applied.Count, pending, applied.LastOrDefault()),
            work.All,
            new AdminSettings(
                app.Value.PublicUrl?.GetLeftPart(UriPartial.Authority),
                app.Value.ConsoleUrl?.GetLeftPart(UriPartial.Authority),
                games.Value.PublicOrigin.GetLeftPart(UriPartial.Authority),
                email.Value.Mode.ToString(),
                sends ? email.Value.From : null,
                [.. providers.Providers.Select(provider => provider.Name)],
                telemetry.Value.Enabled,
                telemetry.Value.OperatorToken.Length > 0)));
    }

    private static DateTimeOffset ProcessStart()
    {
        using var process = Process.GetCurrentProcess();
        return new DateTimeOffset(process.StartTime.ToUniversalTime(), TimeSpan.Zero);
    }
}
