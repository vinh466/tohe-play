using System.Diagnostics;
using System.Security.Claims;
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

/// <summary>The account using the console, its role and what the role may do.</summary>
/// <param name="Role"><c>owner</c>, <c>admin</c>, <c>moderator</c> or <c>viewer</c>; none for a player, who may do nothing here.</param>
/// <param name="TwoFactorEnabled">Two-factor authentication is on: the console opens with a code on each device.</param>
/// <param name="OpenUntil">The console is open on this device until then — two-factor authentication passed.</param>
/// <param name="SecureUntil">Step-up level 2 is open on this device until then (ADR 0025).</param>
/// <param name="HasPassword">Step-up level 2 may use the password; otherwise a code by email.</param>
public sealed record AdminMeView(
    Guid AccountId,
    string DisplayName,
    string? Email,
    string? Role,
    IReadOnlyList<string> Permissions,
    bool TwoFactorEnabled,
    DateTimeOffset? OpenUntil,
    DateTimeOffset? SecureUntil,
    bool HasPassword);

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
    int HeldResults);

/// <param name="Online">Profiles connected to an open room right now.</param>
public sealed record AdminRooms(int Open, int Playing, int Online);

/// <param name="LastSyncAt">When the catalog last synced well; none since the API started.</param>
/// <param name="LastError">Why the last sync failed, while it does.</param>
public sealed record AdminCatalog(int Listed, int Unlisted, DateTimeOffset? LastSyncAt, string? LastError);

/// <summary>A game in the registry, with how much it is played.</summary>
/// <param name="PlayersLastWeek">Profiles that saved it or recorded a score in it during the last week.</param>
/// <param name="OpenRooms">Its open tables right now.</param>
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
    int OpenRooms);

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
/// <param name="EmailMode"><c>Smtp</c> or <c>Disabled</c>.</param>
/// <param name="Providers">The sign-in providers it offers (ADR 0026).</param>
/// <param name="OperatorReport">An operator token is set, so <c>GET /api/telemetry/report</c> answers.</param>
public sealed record AdminSettings(
    string? PublicUrl,
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

    public static void Map(IEndpointRouteBuilder api)
    {
        var admin = api.MapGroup("/admin")
            .WithGroupName(AdminModule.Document)
            .WithTags("Admin")
            .RequireAuthorization()
            .AddEndpointFilter<AdminAccess>();

        admin.MapGet("/me", MeAsync)
            .RequirePermission(AdminPermissions.SignedIn)
            .WithName("GetAdminMe")
            .WithSummary("The account using the console: its role, if any, and what the role may do.");

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

        SetupEndpoints.Map(admin);
        TwoFactorEndpoints.Map(admin);
        UsersEndpoints.Map(admin);
        SettingsEndpoints.Map(admin);
        ReviewEndpoints.Map(admin);
    }

    /// <summary>The account, its role and what the role may do, and the console's state on this device.</summary>
    public static AdminMeView MeView(Account account, PlatformRole? role, ClaimsPrincipal user, DateTimeOffset now) => new(
        account.Id,
        account.DisplayName,
        account.Email,
        role is { } held ? PlatformRoles.NameOf(held) : null,
        AdminPermissions.Of(role),
        account.TwoFactorEnabled,
        SessionClaims.IsAdminOpen(user, now) ? SessionClaims.AdminOpenUntil(user) : null,
        SessionClaims.IsSecure(user, now) ? SessionClaims.SecureUnlockedUntil(user) : null,
        account.PasswordHash is not null);

    private static async Task<Results<Ok<AdminMeView>, UnauthorizedHttpResult>> MeAsync(
        HttpContext http, UserManager<Account> users, TimeProvider clock)
    {
        var caller = AdminCaller.Of(http);
        if (await users.FindByIdAsync(caller.AccountId.ToString()) is not { } account)
        {
            return TypedResults.Unauthorized();
        }

        return TypedResults.Ok(MeView(account, caller.Role, http.User, clock.GetUtcNow()));
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
            await review.HeldCountAsync(ct)));
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
            open.GetValueOrDefault(game.Id)))]);
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
