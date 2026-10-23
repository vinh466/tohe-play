using System.Text.Json.Serialization;
using Scalar.AspNetCore;
using Tohe.Api.Infrastructure;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Infrastructure.Security;
using Tohe.Api.Modules.Admin;
using Tohe.Api.Modules.Agents;
using Tohe.Api.Modules.Dev;
using Tohe.Api.Modules.Email;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Integrity;
using Tohe.Api.Modules.Links;
using Tohe.Api.Modules.Platform;
using Tohe.Api.Modules.Progress;
using Tohe.Api.Modules.Registry;
using Tohe.Api.Modules.Rooms;
using Tohe.Api.Modules.Telemetry;

var builder = WebApplication.CreateBuilder(args);

if (!builder.Environment.IsDevelopment())
{
    builder.Logging.ClearProviders().AddJsonConsole();
}

builder.Services.AddProblemDetails();
builder.Services.AddValidation();
// Numbers are numbers: keeps the OpenAPI schema (and the generated TypeScript types) exact.
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict);
builder.Services.AddOpenApi(options => options.AddDocumentTransformer((document, _, _) =>
{
    document.Info.Title = "Tò He Platform API";
    document.Info.Description = "Backend for the Tò He hub. Games never call it directly; see docs/contracts.";
    return Task.CompletedTask;
}));

builder.AddDatabase();
builder.AddPlatformModule();
builder.AddEmailModule();
builder.AddIdentityModule();
builder.AddRegistryModule();
builder.AddProgressModule();
builder.AddIntegrityModule();
builder.AddTelemetryModule();
builder.AddRoomsModule();
builder.AddLinksModule();
builder.AddAgentsModule();
builder.AddAdminModule();

var app = builder.Build();

// `dotnet Tohe.Api.dll admin …` inside the API's container: platform roles from the command line (ADR 0027).
if (AdminCommand.Matches(args))
{
    return await AdminCommand.RunAsync(app.Services, args, Console.Out, Console.Error);
}

// `dotnet Tohe.Api.dll dev seed`: demo data for a development database; refuses outside the Development environment.
if (DevCommand.Matches(args))
{
    return await DevCommand.RunAsync(app.Services, args, Console.Out, Console.Error);
}

app.UseForwardedHeaders();
app.UsePublicUrl();
app.UseExceptionHandler();
app.UseStatusCodePages();
// The console's routes on the console's host alone, and nothing else there (ADR 0042).
app.UseConsoleRoutes();
app.UseSameOriginGuard();
app.UseRoomsOriginGuard();
app.UseTelemetryBodyLimit();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

await app.MigrateDatabaseIfConfiguredAsync();

// The API reference — Scalar at /api/docs and the OpenAPI documents under /api/openapi/ — only where it is switched
// on: by default in Development, nowhere else (ADR 0042). The build writes the documents to openapi/ without them.
if (app.Configuration.GetValue("Api:Reference:Enabled", app.Environment.IsDevelopment()))
{
    app.MapOpenApi("/api/openapi/{documentName}.json");
    app.MapScalarApiReference("/api/docs", options => options
        .WithTitle("Tò He Platform API")
        .WithOpenApiRoutePattern("/api/openapi/{documentName}.json"));
}

var api = app.MapGroup("/api");
api.MapHealthChecks("/health");
api.MapPlatformEndpoints();
api.MapIdentityEndpoints();
api.MapRegistryEndpoints();
api.MapProgressEndpoints();
api.MapIntegrityEndpoints();
api.MapTelemetryEndpoints();
api.MapRoomsEndpoints(app);
api.MapLinksEndpoints();
api.MapAdminEndpoints();

await app.RunAsync();
return 0;

/// <summary>Entry point; public so integration tests can host it with WebApplicationFactory.</summary>
public partial class Program;
