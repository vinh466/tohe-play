using Microsoft.Extensions.DependencyInjection.Extensions;
using Tohe.Api.Infrastructure;

namespace Tohe.Api.Modules.Studio;

/// <summary>
/// The Asset Studio (ADR 0051), in the <c>studio</c> schema: who holds a studio role, the Studio's own session, and the
/// library — styles, packs, drafts, review, object storage — under <c>/api/studio</c>, with its own OpenAPI document, so
/// neither the hub's nor the console's generated types carry a Studio endpoint. An endpoint of the Studio is mapped on the group <see cref="MapStudioEndpoints"/> makes and declares its
/// permission with <c>.RequireStudioPermission(StudioPermissions.X)</c>; the console gives and takes studio roles through
/// <see cref="StudioConsoleEndpoints"/>, under the console's routes. See docs/architecture/asset-studio.md.
/// </summary>
internal static class StudioModule
{
    /// <summary>The OpenAPI document of the Studio's API, served at <c>/api/openapi/studio.json</c>.</summary>
    public const string Document = "studio";

    public static WebApplicationBuilder AddStudioModule(this WebApplicationBuilder builder)
    {
        builder.Services.TryAddSingleton(TimeProvider.System);
        builder.Services.AddScoped<StudioRoles>();
        StudioSession.Add(builder.Services);

        // The library: object storage (503 on every endpoint of it while unconfigured), the checks, the drafts' clean-up.
        builder.Services.AddOptions<StudioOptions>().BindConfiguration(StudioOptions.Section);
        builder.Services.AddSingleton<IStudioStorage, S3StudioStorage>();
        builder.Services.TryAddScoped<IStudioChecks, PassingStudioChecks>();
        builder.Services.AddScoped<StudioDraftCleanup>();
        if (builder.Configuration.GetValue($"{StudioOptions.Section}:DraftCleanupEnabled", defaultValue: true)
            && !BuildTime.IsGeneratingOpenApi)
        {
            builder.Services.AddHostedService<StudioDraftCleanupWorker>();
        }

        builder.Services.AddOpenApi(Document, options =>
        {
            // By default a document also takes every endpoint without a group, i.e. all of the hub's.
            options.ShouldInclude = description => description.GroupName == Document;
            options.AddDocumentTransformer((document, _, _) =>
            {
                document.Info.Title = "Tò He Studio API";
                document.Info.Description = "The Asset Studio's API (ADR 0051), with its own session. Every endpoint past the sign-in needs a studio role.";
                return Task.CompletedTask;
            });
        });
        return builder;
    }

    /// <summary>The Studio's routes, <c>/api/studio/…</c>: the Studio's session alone authenticates them.</summary>
    public static IEndpointRouteBuilder MapStudioEndpoints(this IEndpointRouteBuilder api)
    {
        var studio = api.MapGroup("/studio")
            .WithGroupName(Document)
            .WithTags("Studio")
            .RequireAuthorization(StudioSession.Policy);
        StudioSessionEndpoints.Map(studio);
        StudioLibraryEndpoints.Map(studio);
        return api;
    }
}
