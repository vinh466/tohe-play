using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Platform;

namespace Tohe.Api.Modules.Admin;

public sealed class AdminOptions
{
    public const string Section = "Admin";

    /// <summary>The token that claims a new deployment. Unset, the API makes one up when it starts and logs it.</summary>
    public string? SetupToken { get; set; }

    /// <summary>When set, only these addresses may claim a new deployment.</summary>
    public string[] BootstrapEmails { get; set; } = [];
}

/// <summary>Whether the deployment waits for its first owner, and whether only some addresses may become it.</summary>
public sealed record SetupView(bool Open, bool OnlySomeEmails);

public sealed record ClaimSetupRequest(string Token);

/// <summary>
/// Setup mode (ADR 0027): open while the deployment has never had an owner. The token is the configured one or, by
/// default, one made up when the API starts — eight characters, logged once.
/// </summary>
internal sealed class SetupToken(IOptions<AdminOptions> options)
{
    private const string Alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

    private readonly Lazy<string> _token = new(() => options.Value.SetupToken is { Length: > 0 } configured
        ? configured.Trim()
        : $"{RandomNumberGenerator.GetString(Alphabet, 4)}-{RandomNumberGenerator.GetString(Alphabet, 4)}");

    public string Value => _token.Value;

    public bool FromConfiguration => options.Value.SetupToken is { Length: > 0 };

    /// <summary>Compared in constant time, ignoring case, spaces and dashes.</summary>
    public bool Matches(string? given) =>
        given is not null
        && CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(Plain(given)), Encoding.UTF8.GetBytes(Plain(Value)));

    private static string Plain(string token) =>
        string.Concat(token.Where(c => !char.IsWhiteSpace(c) && c != '-')).ToUpperInvariant();
}

/// <summary>Setup's end, kept in the database so that losing every owner later never opens it again.</summary>
internal sealed class SetupState(ToheDbContext db, PlatformRoles roles)
{
    public const string CompletedKey = "setup.completed_at";

    public async Task<bool> IsOpenAsync(CancellationToken ct) =>
        !await db.PlatformSettings.AnyAsync(setting => setting.Key == CompletedKey, ct)
        && !await roles.AnyOwnerAsync(ct);

    /// <summary>Ends setup for good; false when it had ended already — another claim got there first.</summary>
    public async Task<bool> CloseAsync(DateTimeOffset now, CancellationToken ct) =>
        await db.Database.ExecuteSqlAsync(
            $"INSERT INTO admin.settings (key, value, updated_at) VALUES ({CompletedKey}, {now.ToString("O")}, {now}) ON CONFLICT (key) DO NOTHING",
            ct) == 1;
}

/// <summary>Logs, once when the API starts, how to claim a deployment that has no owner yet.</summary>
internal sealed partial class SetupAnnouncer(
    IServiceScopeFactory scopes, SetupToken token, IOptions<AppOptions> app, ILogger<SetupAnnouncer> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            await using var scope = scopes.CreateAsyncScope();
            if (!await scope.ServiceProvider.GetRequiredService<SetupState>().IsOpenAsync(cancellationToken))
            {
                return;
            }

            var where = app.Value.PublicUrl is { } hub ? new Uri(hub, HubPaths.ConsoleSetup).ToString() : $"{HubPaths.ConsoleSetup} on the hub";
            if (token.FromConfiguration)
            {
                LogOpenConfigured(where);
            }
            else
            {
                LogOpen(where, token.Value);
            }
        }
        catch (Exception error) when (error is not OperationCanceledException)
        {
            // The database may not be up yet: the console still tells whether setup is open.
            LogUnknown(error);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    [LoggerMessage(Level = LogLevel.Warning, Message = "No platform owner yet: open {Where} and give the setup token {Token}")]
    private partial void LogOpen(string where, string token);

    [LoggerMessage(Level = LogLevel.Warning, Message = "No platform owner yet: open {Where} and give the token from Admin:SetupToken")]
    private partial void LogOpenConfigured(string where);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Could not tell whether the platform has an owner yet")]
    private partial void LogUnknown(Exception error);
}

/// <summary>The first owner claims a new deployment (ADR 0027, D-08).</summary>
internal static partial class SetupEndpoints
{
    public static void Map(RouteGroupBuilder admin)
    {
        admin.MapGet("/setup", GetAsync)
            .RequirePermission(AdminPermissions.SignedIn)
            .WithName("GetAdminSetup")
            .WithSummary("Whether the deployment still waits for its first owner.");

        admin.MapPost("/setup/claim", ClaimAsync)
            .RequirePermission(AdminPermissions.SignedIn)
            .RequireRateLimiting(IdentityModule.GateRateLimit)
            .WithName("ClaimAdminSetup")
            .WithSummary("With the setup token, the signed-in account becomes the platform's first owner; setup ends for good.");
    }

    private static async Task<Ok<SetupView>> GetAsync(SetupState state, IOptions<AdminOptions> options, CancellationToken ct) =>
        TypedResults.Ok(new SetupView(await state.IsOpenAsync(ct), options.Value.BootstrapEmails.Length > 0));

    private static async Task<Results<Ok<AdminMeView>, UnauthorizedHttpResult, ProblemHttpResult>> ClaimAsync(
        ClaimSetupRequest request,
        HttpContext http,
        UserManager<Account> users,
        SetupState state,
        SetupToken token,
        PlatformRoles roles,
        AdminAudit audit,
        IOptions<AdminOptions> options,
        ToheDbContext db,
        TimeProvider clock,
        ILoggerFactory logs,
        CancellationToken ct)
    {
        if (await users.GetUserAsync(http.User) is not { } account)
        {
            return TypedResults.Unauthorized();
        }

        // The owner is reached by email: an account from before email sign-in adds one first.
        if (account.Email is not { } email || !account.EmailConfirmed)
        {
            return Problems.Of(StatusCodes.Status403Forbidden, "email_required", "The account needs a confirmed email first");
        }

        if (!await state.IsOpenAsync(ct))
        {
            return SetupClosed();
        }

        if (!token.Matches(request.Token))
        {
            return Problems.Of(StatusCodes.Status403Forbidden, "setup_token_invalid", "Wrong setup token");
        }

        var allowed = options.Value.BootstrapEmails;
        if (allowed.Length > 0 && !allowed.Contains(email.Trim(), StringComparer.OrdinalIgnoreCase))
        {
            return Problems.Of(StatusCodes.Status403Forbidden, "setup_email_not_allowed", "This address may not claim the platform");
        }

        await using (var transaction = await db.Database.BeginTransactionAsync(ct))
        {
            if (!await state.CloseAsync(clock.GetUtcNow(), ct))
            {
                return SetupClosed();
            }

            await roles.SetAsync(account, PlatformRole.Owner);
            audit.Add(AdminActor.Of(account, http), AuditActions.SetupClaim, email);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }

        LogClaimed(logs.CreateLogger(typeof(SetupEndpoints)), email);
        return TypedResults.Ok(AdminEndpoints.MeView(account, PlatformRole.Owner, http.User, clock.GetUtcNow()));
    }

    private static ProblemHttpResult SetupClosed() =>
        Problems.Of(StatusCodes.Status409Conflict, "setup_closed", "The platform has an owner already");

    [LoggerMessage(Level = LogLevel.Warning, Message = "The platform's first owner is {Email}; setup mode is over")]
    private static partial void LogClaimed(ILogger logger, string email);
}
