using System.ComponentModel.DataAnnotations;
using System.Reflection;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure;
using Tohe.Api.Modules.Email;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Telemetry;

namespace Tohe.Api.Modules.Platform;

/// <summary>Where games are served from. <c>PublicOrigin</c> is what browsers use; <c>CatalogUrl</c> what the API fetches.</summary>
public sealed class GamesOptions
{
    public const string Section = "Games";

    [Required]
    public Uri PublicOrigin { get; set; } = null!;

    [Required]
    public Uri CatalogUrl { get; set; } = null!;
}

/// <summary>The deployment itself: which build runs, and where people reach it (ADR 0021).</summary>
public sealed class AppOptions
{
    public const string Section = "App";

    /// <summary>The commit a deployment built (deploy/uat/deploy.sh, the chart); empty in development.</summary>
    public string? Version { get; set; }

    /// <summary>
    /// The hub's public URL, e.g. <c>https://tohe.example.org</c> — the origin people type, which also serves
    /// <c>/api</c>. Unset in local development.
    /// </summary>
    public Uri? PublicUrl { get; set; }

    /// <summary>
    /// The console's public URL, e.g. <c>https://console.tohe.example.org</c> — a host of its own (ADR 0042), whose
    /// Caddy site proxies the API's console routes. Unset, those routes answer 404.
    /// </summary>
    public Uri? ConsoleUrl { get; set; }

    internal bool HasValidPublicUrl() => IsOrigin(PublicUrl);

    internal bool HasValidConsoleUrl() =>
        IsOrigin(ConsoleUrl)
        && (ConsoleUrl is null || !IsOrigin(PublicUrl) || PublicUrl is null || ConsoleUrl.Authority != PublicUrl.Authority);

    private static bool IsOrigin(Uri? url) =>
        url is null
        || (url.IsAbsoluteUri
            && (url.Scheme == Uri.UriSchemeHttps || url.Scheme == Uri.UriSchemeHttp)
            && url.AbsolutePath == "/"
            && url.Query.Length == 0);
}

/// <summary>Runtime configuration the hub needs before it can launch games.</summary>
/// <param name="GamesOrigin">Origin game iframes are loaded from; the hub only accepts messages from it.</param>
/// <param name="ApiVersion">Informational version of the running API.</param>
/// <param name="Telemetry">The server collects device telemetry (ADR 0015); off, the hub sends none.</param>
/// <param name="Email">The server sends email (ADR 0022): signing up, forgotten passwords and email changes work.</param>
/// <param name="Providers">The sign-in providers this deployment offers and the console has on (ADR 0026, 0028), in the
/// order to show them.</param>
/// <param name="PasswordSignIn">Email and password are on: signing in with them, and signing up by email (ADR 0028).</param>
/// <param name="Registration"><c>open</c>, <c>invite</c> — signing up needs an invite code — or <c>closed</c>.</param>
/// <param name="ProofOfWork">Signing up and asking for a password reset take a solved challenge from
/// <c>GET /api/auth/challenge</c> (ADR 0037).</param>
public sealed record ClientConfig(
    string GamesOrigin,
    string ApiVersion,
    bool Telemetry,
    bool Email,
    IReadOnlyList<ExternalProvider> Providers,
    bool PasswordSignIn,
    string Registration,
    bool ProofOfWork);

internal static class PlatformModule
{
    public static WebApplicationBuilder AddPlatformModule(this WebApplicationBuilder builder)
    {
        // What the background workers last did, for the admin console (ADR 0027).
        builder.Services.AddSingleton<BackgroundWork>();
        builder.AddMetrics();
        var options = builder.Services.AddOptions<GamesOptions>()
            .BindConfiguration(GamesOptions.Section)
            .ValidateDataAnnotations();
        var app = builder.Services.AddOptions<AppOptions>()
            .BindConfiguration(AppOptions.Section)
            .Validate(o => o.HasValidPublicUrl(), "App:PublicUrl must be an absolute http(s) URL with no path, e.g. https://tohe.example.org")
            .Validate(
                o => o.HasValidConsoleUrl(),
                "App:ConsoleUrl must be an absolute http(s) URL with no path on a host (or port) of its own, e.g. https://console.tohe.example.org");
        if (!BuildTime.IsGeneratingOpenApi)
        {
            options.ValidateOnStart();
            app.ValidateOnStart();
        }

        return builder;
    }

    /// <summary>
    /// Tò He's metrics and <c>/metrics</c> on a port of its own (ADR 0036): prometheus-net exports every .NET meter —
    /// ASP.NET Core's requests by route and status, the runtime's, Npgsql's pool, and <see cref="ToheMetrics"/>. The
    /// runtime's event counters are left out: the runtime's meter says the same.
    /// </summary>
    private static void AddMetrics(this WebApplicationBuilder builder)
    {
        builder.Services.AddOptions<MetricsOptions>().BindConfiguration(MetricsOptions.Section);
        builder.Services.AddSingleton<ToheMetrics>();
        var options = builder.Configuration.GetSection(MetricsOptions.Section).Get<MetricsOptions>() ?? new MetricsOptions();
        if (options.Enabled && !BuildTime.IsGeneratingOpenApi)
        {
            Prometheus.Metrics.SuppressDefaultMetrics(new Prometheus.SuppressDefaultMetricOptions { SuppressEventCounters = true });
            // Durations in seconds get the buckets ASP.NET Core advises for its own, not 25 exponential ones per series.
            Prometheus.Metrics.ConfigureMeterAdapter(adapter => adapter.ResolveHistogramBuckets = instrument =>
                instrument.Unit == "s" ? SecondsBuckets : Prometheus.MeterAdapterOptions.DefaultHistogramBuckets);
            Prometheus.KestrelMetricServerExtensions.AddMetricServer(builder.Services, server => server.Port = (ushort)options.Port);
            builder.Services.AddHostedService<MetricsStart>();
        }
    }

    private static readonly double[] SecondsBuckets = [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10];

    /// <summary>
    /// prometheus-net starts listening to the .NET meters at its first collection: one when the API starts, so what is
    /// counted before the first scrape — a sign-in, an email — is not lost.
    /// </summary>
    private sealed class MetricsStart : IHostedService
    {
        public Task StartAsync(CancellationToken cancellationToken) =>
            Prometheus.Metrics.DefaultRegistry.CollectAndExportAsTextAsync(Stream.Null, cancellationToken);

        public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }

    /// <summary>
    /// Makes every request carry the scheme of <see cref="AppOptions.PublicUrl"/> — or, for the console's routes, of
    /// <see cref="AppOptions.ConsoleUrl"/>. Behind a TLS-terminating edge (Cloudflare, then an ingress, then the hub
    /// image's Caddy) the API sees HTTP whatever the visitor used, and the edge's <c>X-Forwarded-Proto</c> does not
    /// survive every hop. The configured URL decides instead, so cookies, links and redirects use the scheme people
    /// actually see. Unset, requests stay as they arrive.
    /// </summary>
    public static IApplicationBuilder UsePublicUrl(this IApplicationBuilder app)
    {
        var options = app.ApplicationServices.GetRequiredService<IOptions<AppOptions>>().Value;
        var (publicUrl, consoleUrl) = (options.PublicUrl, options.ConsoleUrl);
        return publicUrl is null && consoleUrl is null
            ? app
            : app.Use((context, next) =>
            {
                var url = ConsoleRoutes.Covers(context.Request.Path) ? consoleUrl : publicUrl;
                if (url is not null)
                {
                    context.Request.Scheme = url.Scheme;
                }

                return next(context);
            });
    }

    /// <summary>The build that runs: the commit a deployment built (deploy/uat/deploy.sh, the chart), else the assembly's.</summary>
    internal static string VersionOf(AppOptions app) =>
        app.Version is { Length: > 0 } deployed
            ? deployed
            : typeof(PlatformModule).Assembly
                .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "dev";

    public static IEndpointRouteBuilder MapPlatformEndpoints(this IEndpointRouteBuilder api)
    {
        var version = VersionOf(api.ServiceProvider.GetRequiredService<IOptions<AppOptions>>().Value);

        api.MapGet(
                "/config",
                async (
                    IOptions<GamesOptions> games,
                    IOptions<TelemetryOptions> telemetry,
                    IEmailOutbox email,
                    ExternalProviderCatalog providers,
                    ISignInSettings settings,
                    CancellationToken ct) =>
                {
                    var on = new List<ExternalProvider>();
                    foreach (var provider in providers.Providers)
                    {
                        if (await settings.IsOnAsync(provider.Id, ct))
                        {
                            on.Add(provider);
                        }
                    }

                    return new ClientConfig(
                        games.Value.PublicOrigin.GetLeftPart(UriPartial.Authority),
                        version,
                        telemetry.Value.Enabled,
                        email.Enabled,
                        on,
                        await settings.IsOnAsync(SignInMethods.Password, ct),
                        (await settings.RegistrationAsync(ct)) switch
                        {
                            RegistrationMode.Invite => "invite",
                            RegistrationMode.Closed => "closed",
                            _ => "open",
                        },
                        await settings.ProofOfWorkAsync(ct));
                })
            .WithName("GetConfig")
            .WithTags("Platform")
            .WithSummary("Runtime configuration for the hub.");
        return api;
    }
}
