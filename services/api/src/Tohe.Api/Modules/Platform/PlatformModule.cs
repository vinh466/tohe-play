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

    internal bool HasValidPublicUrl() =>
        PublicUrl is null
        || (PublicUrl.IsAbsoluteUri
            && (PublicUrl.Scheme == Uri.UriSchemeHttps || PublicUrl.Scheme == Uri.UriSchemeHttp)
            && PublicUrl.AbsolutePath == "/"
            && PublicUrl.Query.Length == 0);
}

/// <summary>Runtime configuration the hub needs before it can launch games.</summary>
/// <param name="GamesOrigin">Origin game iframes are loaded from; the hub only accepts messages from it.</param>
/// <param name="ApiVersion">Informational version of the running API.</param>
/// <param name="Telemetry">The server collects device telemetry (ADR 0015); off, the hub sends none.</param>
/// <param name="Email">The server sends email (ADR 0022): signing up, forgotten passwords and email changes work.</param>
/// <param name="Providers">The sign-in providers this deployment offers (ADR 0026), in the order to show them.</param>
public sealed record ClientConfig(
    string GamesOrigin,
    string ApiVersion,
    bool Telemetry,
    bool Email,
    IReadOnlyList<ExternalProvider> Providers);

internal static class PlatformModule
{
    public static WebApplicationBuilder AddPlatformModule(this WebApplicationBuilder builder)
    {
        // What the background workers last did, for the admin console (ADR 0027).
        builder.Services.AddSingleton<BackgroundWork>();
        var options = builder.Services.AddOptions<GamesOptions>()
            .BindConfiguration(GamesOptions.Section)
            .ValidateDataAnnotations();
        var app = builder.Services.AddOptions<AppOptions>()
            .BindConfiguration(AppOptions.Section)
            .Validate(o => o.HasValidPublicUrl(), "App:PublicUrl must be an absolute http(s) URL with no path, e.g. https://tohe.example.org");
        if (!BuildTime.IsGeneratingOpenApi)
        {
            options.ValidateOnStart();
            app.ValidateOnStart();
        }

        return builder;
    }

    /// <summary>
    /// Makes every request carry the scheme of <see cref="AppOptions.PublicUrl"/>. Behind a TLS-terminating edge
    /// (Cloudflare, then an ingress, then the hub's Caddy) the API sees HTTP whatever the visitor used, and the
    /// edge's <c>X-Forwarded-Proto</c> does not survive every hop. The configured URL decides instead, so cookies,
    /// links and redirects use the scheme people actually see. Unset, requests stay as they arrive.
    /// </summary>
    public static IApplicationBuilder UsePublicUrl(this IApplicationBuilder app)
    {
        var publicUrl = app.ApplicationServices.GetRequiredService<IOptions<AppOptions>>().Value.PublicUrl;
        return publicUrl is null
            ? app
            : app.Use((context, next) =>
            {
                context.Request.Scheme = publicUrl.Scheme;
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
                (IOptions<GamesOptions> games, IOptions<TelemetryOptions> telemetry, IEmailOutbox email, ExternalProviderCatalog providers) =>
                    new ClientConfig(
                        games.Value.PublicOrigin.GetLeftPart(UriPartial.Authority),
                        version,
                        telemetry.Value.Enabled,
                        email.Enabled,
                        providers.Providers))
            .WithName("GetConfig")
            .WithTags("Platform")
            .WithSummary("Runtime configuration for the hub.");
        return api;
    }
}
