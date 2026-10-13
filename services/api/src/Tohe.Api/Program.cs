using System.Text.Json.Serialization;
using Scalar.AspNetCore;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Platform;
using Tohe.Api.Modules.Registry;

var builder = WebApplication.CreateBuilder(args);

if (!builder.Environment.IsDevelopment())
{
    builder.Logging.ClearProviders().AddJsonConsole();
}

builder.Services.AddProblemDetails();
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
builder.AddRegistryModule();

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

await app.MigrateDatabaseIfConfiguredAsync();

app.MapOpenApi("/api/openapi/{documentName}.json");
app.MapScalarApiReference("/api/docs", options => options
    .WithTitle("Tò He Platform API")
    .WithOpenApiRoutePattern("/api/openapi/{documentName}.json"));

var api = app.MapGroup("/api");
api.MapHealthChecks("/health");
api.MapPlatformEndpoints();
api.MapRegistryEndpoints();

await app.RunAsync();

/// <summary>Entry point; public so integration tests can host it with WebApplicationFactory.</summary>
public partial class Program;
