using System.Net;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;

namespace Tohe.Api.Tests;

/// <summary>
/// Hosts the API against a throwaway PostgreSQL container (never a shared database) and a fake games origin
/// whose catalog.json each test can replace through <see cref="Catalog"/>.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:18-alpine").Build();

    public FakeCatalog Catalog { get; } = new();

    public async ValueTask InitializeAsync() => await _postgres.StartAsync();

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Database", _postgres.GetConnectionString());
        builder.UseSetting("Database:MigrateOnStartup", "true");
        builder.UseSetting("Games:PublicOrigin", "https://games.example.test");
        builder.UseSetting("Games:CatalogUrl", "http://games-internal/catalog.json");
        builder.UseSetting("Registry:SyncEnabled", "false");
        // Tests sign in many times from one client address; the real limit is covered by its own configuration.
        builder.UseSetting("Identity:AuthRequestsPerMinute", "10000");
        builder.ConfigureServices(services => services
            .AddHttpClient<Modules.Registry.CatalogSync>()
            .ConfigurePrimaryHttpMessageHandler(() => Catalog));
    }
}

/// <summary>Serves whatever JSON the test put in <see cref="Json"/> for any request.</summary>
public sealed class FakeCatalog : HttpMessageHandler
{
    public string Json { get; set; } = """{ "generatedAt": "2026-10-13T00:00:00Z", "games": [] }""";

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
        Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(Json, Encoding.UTF8, "application/json"),
        });
}
