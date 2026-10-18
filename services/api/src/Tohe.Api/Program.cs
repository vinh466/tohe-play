using System.Text.Json.Serialization;
using Scalar.AspNetCore;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Infrastructure.Security;
using Tohe.Api.Modules.Identity;
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
builder.AddIdentityModule();
builder.AddRegistryModule();
builder.AddTelemetryModule();
builder.AddRoomsModule();

var app = builder.Build();

app.UseForwardedHeaders();
app.UsePublicUrl();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseSameOriginGuard();
app.UseRoomsOriginGuard();
app.UseTelemetryBodyLimit();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

await app.MigrateDatabaseIfConfiguredAsync();

app.MapOpenApi("/api/openapi/{documentName}.json");
app.MapScalarApiReference("/api/docs", options => options
    .WithTitle("Tò He Platform API")
    .WithOpenApiRoutePattern("/api/openapi/{documentName}.json"));

var api = app.MapGroup("/api");
api.MapHealthChecks("/health");
api.MapPlatformEndpoints();
api.MapIdentityEndpoints();
api.MapRegistryEndpoints();
api.MapProgressEndpoints();
api.MapTelemetryEndpoints();
api.MapRoomsEndpoints(app);

await app.RunAsync();

/// <summary>Entry point; public so integration tests can host it with WebApplicationFactory.</summary>
public partial class Program;
