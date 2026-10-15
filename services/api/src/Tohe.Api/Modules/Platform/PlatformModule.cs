using System.ComponentModel.DataAnnotations;
using System.Reflection;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure;
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

/// <summary>Runtime configuration the hub needs before it can launch games.</summary>
/// <param name="GamesOrigin">Origin game iframes are loaded from; the hub only accepts messages from it.</param>
/// <param name="ApiVersion">Informational version of the running API.</param>
/// <param name="Telemetry">The server collects device telemetry (ADR 0015); off, the hub sends none.</param>
public sealed record ClientConfig(string GamesOrigin, string ApiVersion, bool Telemetry);

internal static class PlatformModule
{
    public static WebApplicationBuilder AddPlatformModule(this WebApplicationBuilder builder)
    {
        var options = builder.Services.AddOptions<GamesOptions>()
            .BindConfiguration(GamesOptions.Section)
            .ValidateDataAnnotations();
        if (!BuildTime.IsGeneratingOpenApi)
        {
            options.ValidateOnStart();
        }

        return builder;
    }

    public static IEndpointRouteBuilder MapPlatformEndpoints(this IEndpointRouteBuilder api)
    {
        // Deployments set App:Version to the git commit they built (deploy/uat/deploy.sh).
        var configuration = api.ServiceProvider.GetRequiredService<IConfiguration>();
        var version = configuration["App:Version"] is { Length: > 0 } deployed
            ? deployed
            : typeof(PlatformModule).Assembly
                .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "dev";

        api.MapGet("/config", (IOptions<GamesOptions> games, IOptions<TelemetryOptions> telemetry) =>
                new ClientConfig(
                    games.Value.PublicOrigin.GetLeftPart(UriPartial.Authority), version, telemetry.Value.Enabled))
            .WithName("GetConfig")
            .WithTags("Platform")
            .WithSummary("Runtime configuration for the hub.");
        return api;
    }
}
