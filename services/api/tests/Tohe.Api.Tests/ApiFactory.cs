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

    public const string TelemetryToken = "test-operator-token";

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
        builder.UseSetting("Telemetry:RequestsPerMinute", "10000");
        builder.UseSetting("Telemetry:OperatorToken", TelemetryToken);
        // Tests run maintenance themselves, with the data they need.
        builder.UseSetting("Telemetry:MaintenanceEnabled", "false");
        // Rooms: quick bots and clock, so a whole hand plays in a test.
        builder.UseSetting("Rooms:BotThinkMinMs", "5");
        builder.UseSetting("Rooms:BotThinkMaxMs", "10");
        builder.UseSetting("Rooms:BotChopMs", "5");
        builder.UseSetting("Rooms:Tick", "00:00:00.020");
        builder.UseSetting("Rooms:NextHandSeconds", "1");
        builder.UseSetting("Rooms:GraceSeconds", "1");
        builder.UseSetting("Rooms:CodeLookupsPerMinute", "10000");
        builder.ConfigureServices(services =>
        {
            services.AddHttpClient<Modules.Registry.CatalogSync>().ConfigurePrimaryHttpMessageHandler(() => Catalog);
            services.AddHttpClient<Modules.Rooms.RulesSource>().ConfigurePrimaryHttpMessageHandler(() => Catalog);
        });
    }
}

/// <summary>Keeps the session cookie of one person, for both HTTP requests and the rooms hub's connection.</summary>
public sealed class CookieJar : DelegatingHandler
{
    private readonly CookieContainer _cookies = new();

    public CookieJar(HttpMessageHandler inner) => InnerHandler = inner;

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var uri = request.RequestUri!;
        var header = _cookies.GetCookieHeader(uri);
        if (header.Length > 0)
        {
            request.Headers.Remove("Cookie");
            request.Headers.Add("Cookie", header);
        }

        var response = await base.SendAsync(request, cancellationToken);
        if (response.Headers.TryGetValues("Set-Cookie", out var values))
        {
            foreach (var value in values)
            {
                _cookies.SetCookies(uri, value);
            }
        }

        return response;
    }
}

/// <summary>
/// Serves the files a test put in <see cref="Files"/> by path (e.g. a rules module), and whatever JSON it put in
/// <see cref="Json"/> for anything else (the catalog).
/// </summary>
public sealed class FakeCatalog : HttpMessageHandler
{
    public string Json { get; set; } = """{ "generatedAt": "2026-10-13T00:00:00Z", "games": [] }""";

    public Dictionary<string, string> Files { get; } = new(StringComparer.Ordinal);

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var path = request.RequestUri?.AbsolutePath ?? "";
        if (Files.TryGetValue(path, out var file))
        {
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(file, Encoding.UTF8, "text/javascript"),
            });
        }

        return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(Json, Encoding.UTF8, "application/json"),
        });
    }
}
