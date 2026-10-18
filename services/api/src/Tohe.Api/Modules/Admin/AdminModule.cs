using Tohe.Api.Infrastructure;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Admin;

/// <summary>
/// The admin console's API, <c>/api/admin/*</c> (ADR 0027): its own OpenAPI document, so the hub's generated types never
/// carry an admin endpoint; every endpoint needs a platform role that grants its permission.
/// </summary>
internal static class AdminModule
{
    /// <summary>The OpenAPI document of the admin API, served at <c>/api/openapi/admin.json</c>.</summary>
    public const string Document = "admin";

    public static WebApplicationBuilder AddAdminModule(this WebApplicationBuilder builder)
    {
        builder.Services.AddOptions<AdminOptions>().BindConfiguration(AdminOptions.Section);
        builder.Services.AddSingleton<SetupToken>();
        builder.Services.AddScoped<SetupState>();
        builder.Services.AddScoped<AdminAudit>();
        // The console's switches of ADR 0028, which the Identity module asks through ISignInSettings.
        builder.Services.AddSingleton<RuntimeSettings>();
        builder.Services.AddSingleton<ISignInSettings>(services => services.GetRequiredService<RuntimeSettings>());
        if (!BuildTime.IsGeneratingOpenApi)
        {
            // Tells, when the API starts, how to claim a deployment without an owner: needs the database.
            builder.Services.AddHostedService<SetupAnnouncer>();
        }

        builder.Services.AddOpenApi(Document, options =>
        {
            // By default a document also takes every endpoint without a group, i.e. all of the hub's.
            options.ShouldInclude = description => description.GroupName == Document;
            options.AddDocumentTransformer((document, _, _) =>
            {
                document.Info.Title = "Tò He Admin API";
                document.Info.Description = "The admin console's API (ADR 0027). Every endpoint needs a platform role.";
                return Task.CompletedTask;
            });
        });
        return builder;
    }

    public static IEndpointRouteBuilder MapAdminEndpoints(this IEndpointRouteBuilder api)
    {
        AdminEndpoints.Map(api);
        return api;
    }
}
