using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Telemetry;

/// <summary>
/// Device telemetry (ADR 0015): technical data from players' devices, sent by the hub, and a report an operator reads
/// with a token. Anonymous by design: batches carry a random device id and nothing tied to an account.
/// </summary>
internal static class TelemetryModule
{
    public const string RateLimit = "telemetry";
    public const string OperatorHeader = "X-Tohe-Operator";

    public static WebApplicationBuilder AddTelemetryModule(this WebApplicationBuilder builder)
    {
        builder.Services.AddOptions<TelemetryOptions>()
            .BindConfiguration(TelemetryOptions.Section)
            .ValidateDataAnnotations();
        builder.Services.TryAddSingleton(TimeProvider.System);
        builder.Services.AddScoped<TelemetryReports>();
        builder.Services.AddScoped<TelemetryMaintenance>();
        if (builder.Configuration.GetValue($"{TelemetryOptions.Section}:MaintenanceEnabled", defaultValue: true)
            && !BuildTime.IsGeneratingOpenApi)
        {
            builder.Services.AddHostedService<TelemetryMaintenanceWorker>();
        }

        builder.Services.AddRateLimiter(options => options.AddPolicy(RateLimit, context =>
        {
            var limit = context.RequestServices.GetRequiredService<IOptions<TelemetryOptions>>().Value.RequestsPerMinute;
            return RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = limit, Window = TimeSpan.FromMinutes(1) });
        }));
        return builder;
    }

    /// <summary>
    /// Refuses telemetry batches over 32 KB before anything reads them: by their Content-Length (413), and by capping
    /// the body Kestrel will read for a chunked one. Runs before routing, because the body is parsed before endpoint
    /// filters run.
    /// </summary>
    public static IApplicationBuilder UseTelemetryBodyLimit(this IApplicationBuilder app) =>
        app.Use(async (context, next) =>
        {
            var request = context.Request;
            if (HttpMethods.IsPost(request.Method) && request.Path.Equals("/api/telemetry", StringComparison.Ordinal))
            {
                if (request.ContentLength > TelemetryRules.MaxBatchBytes)
                {
                    await Problems.Of(StatusCodes.Status413PayloadTooLarge, "batch_too_large", "A batch is at most 32 KB")
                        .ExecuteAsync(context);
                    return;
                }

                if (context.Features.Get<IHttpMaxRequestBodySizeFeature>() is { IsReadOnly: false } limit)
                {
                    limit.MaxRequestBodySize = TelemetryRules.MaxBatchBytes;
                }
            }

            await next(context);
        });

    public static IEndpointRouteBuilder MapTelemetryEndpoints(this IEndpointRouteBuilder api)
    {
        var telemetry = api.MapGroup("/telemetry").WithTags("Telemetry");

        telemetry.MapPost("/", RecordAsync)
            .AllowAnonymous()
            .RequireRateLimiting(RateLimit)
            .ProducesProblem(StatusCodes.Status413PayloadTooLarge)
            .ProducesProblem(StatusCodes.Status429TooManyRequests)
            .WithName("RecordTelemetry")
            .WithSummary("Store a batch of technical telemetry from a device (sent by the hub with sendBeacon).");

        telemetry.MapGet("/report", ReportAsync)
            .WithName("GetTelemetryReport")
            .WithSummary("Errors, frame times, metrics and counts per game version over the last days (operator token).");

        return api;
    }

    private static async Task<Results<Accepted, NoContent, ValidationProblem>> RecordAsync(
        TelemetryBatch batch,
        HttpContext http,
        ToheDbContext db,
        IOptions<TelemetryOptions> options,
        TimeProvider clock,
        CancellationToken ct)
    {
        if (!options.Value.Enabled)
        {
            return TypedResults.NoContent();
        }

        if (TelemetryRules.Problem(batch) is { } problem)
        {
            return Problems.Field(problem.Field, problem.Code);
        }

        var now = clock.GetUtcNow();
        var agent = UserAgents.Reduce(http.Request.Headers.UserAgent.ToString());
        var context = batch.Context;
        var cores = context.Cores is { } count ? Math.Min(count, 16) : (int?)null;
        var pixelRatio = Math.Round(context.PixelRatio, 2);
        // One statement, so batches of one session that arrive together (the hub sends on hide and on pagehide) find
        // or create the same row instead of racing to insert it twice.
        var sessionId = (await db.Database.SqlQuery<long>(
                $"""
                INSERT INTO telemetry.sessions (device_id, client_session_id, first_seen_at, last_seen_at, hub_version,
                    os, os_version, browser, browser_version, device_class, viewport_width, viewport_height,
                    pixel_ratio, cores, memory_gb, display_mode, theme, locale)
                VALUES ({batch.DeviceId}, {batch.SessionId}, {now}, {now}, {context.HubVersion}, {agent.Os},
                    {agent.OsVersion}, {agent.Browser}, {agent.BrowserVersion}, {context.DeviceClass},
                    {context.ViewportWidth}, {context.ViewportHeight}, {pixelRatio}, {cores}, {context.MemoryGb},
                    {context.DisplayMode}, {context.Theme}, {context.Locale})
                ON CONFLICT (device_id, client_session_id) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at
                RETURNING id AS "Value"
                """)
            .ToListAsync(ct))[0];

        db.TelemetryRecords.AddRange(batch.Events.Select(e => TelemetryRules.ToRecord(e, sessionId, now)));
        await db.SaveChangesAsync(ct);
        return TypedResults.Accepted((string?)null);
    }

    private static async Task<Results<Ok<TelemetryReport>, ProblemHttpResult>> ReportAsync(
        HttpContext http,
        TelemetryReports reports,
        IOptions<TelemetryOptions> options,
        CancellationToken ct,
        int days = 7,
        bool includeHeadless = false)
    {
        var expected = options.Value.OperatorToken;
        if (expected.Length == 0)
        {
            return Problems.Of(StatusCodes.Status404NotFound, "report_disabled", "No operator token is configured");
        }

        var given = http.Request.Headers[OperatorHeader].ToString();
        if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(given), Encoding.UTF8.GetBytes(expected)))
        {
            return Problems.Of(StatusCodes.Status401Unauthorized, "operator_token_required", "Send the operator token");
        }

        return TypedResults.Ok(await reports.BuildAsync(days, includeHeadless, ct));
    }
}
