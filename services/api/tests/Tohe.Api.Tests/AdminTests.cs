using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure;
using Tohe.Api.Modules.Admin;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Registry;
using Tohe.Api.Modules.Telemetry;

namespace Tohe.Api.Tests;

/// <summary>
/// The admin console's API (ADR 0027): the role is read from the database on every request, every endpoint declares
/// its permission, and the pages put together what each module tells.
/// </summary>
public sealed class AdminTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    [Fact]
    public async Task Only_an_account_with_a_role_gets_in_and_losing_it_works_at_once()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync(Url("/api/admin/overview"), Ct)).StatusCode);

        var email = Accounts.NewEmail();
        var client = factory.CreateClient();
        var me = await Accounts.SignUpAsync(factory, client, "Bố", email);
        Assert.Null(me.Account.Role);
        var player = (await client.GetFromJsonAsync<AdminMeView>(Url("/api/admin/me"), Ct))!;
        Assert.Null(player.Role);
        Assert.Empty(player.Permissions);
        var refused = await client.GetAsync(Url("/api/admin/overview"), Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "admin_required"), (refused.StatusCode, await CodeOfAsync(refused)));

        Assert.Equal(0, (await CommandAsync("admin", "grant", email, "--role", "viewer")).Exit);
        var admin = (await client.GetFromJsonAsync<AdminMeView>(Url("/api/admin/me"), Ct))!;
        Assert.Equal(("viewer", "Bố"), (admin.Role, admin.DisplayName));
        Assert.Equal([AdminPermissions.Read], admin.Permissions);
        Assert.Equal("viewer", (await client.GetFromJsonAsync<MeView>(Url("/api/auth/me"), Ct))!.Account.Role);

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(Url("/api/admin/overview"), Ct)).StatusCode);

        // The same session, its role taken away: the very next request is refused.
        Assert.Equal(0, (await CommandAsync("admin", "revoke", email)).Exit);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync(Url("/api/admin/overview"), Ct)).StatusCode);
        Assert.Null((await client.GetFromJsonAsync<AdminMeView>(Url("/api/admin/me"), Ct))!.Role);
    }

    [Fact]
    public void Every_admin_endpoint_declares_the_permission_it_needs()
    {
        var endpoints = factory.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .OfType<RouteEndpoint>()
            .Where(endpoint => endpoint.RoutePattern.RawText?.StartsWith("/api/admin", StringComparison.Ordinal) == true)
            .ToList();
        Assert.Equal(5, endpoints.Count);
        Assert.All(endpoints, endpoint => Assert.NotNull(endpoint.Metadata.GetMetadata<AdminPermission>()));
    }

    [Fact]
    public async Task The_overview_and_the_games_put_together_what_the_modules_tell()
    {
        factory.Catalog.Json = """
            { "generatedAt": "2026-10-18T00:00:00Z", "games": [{
              "manifest": { "id": "hello", "name": "Xin chào", "version": "1.2.0", "protocol": 1, "description": "",
                "entry": "index.html", "icon": "icon.svg", "orientation": "portrait", "capabilities": ["save"],
                "minAge": 0, "tags": [], "sizeBudgetKb": 3000 },
              "path": "hello/1.2.0/", "sizeKb": 12 }] }
            """;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            await scope.ServiceProvider.GetRequiredService<CatalogSync>().RunAsync(Ct);
        }

        var (client, _) = await AdminAsync();
        var player = factory.CreateClient();
        await Accounts.SignUpAsync(factory, player, "Na");
        var saved = await player.PutAsJsonAsync(Url("/api/progress/saves/hello"), new { data = new { level = 2 } }, Ct);
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);

        var overview = (await client.GetFromJsonAsync<AdminOverview>(Url("/api/admin/overview"), Ct))!;
        Assert.True(overview.Accounts.LastDay >= 2, "both accounts are new");
        Assert.True(overview.Accounts.Total >= overview.Accounts.LastWeek && overview.Accounts.LastWeek >= overview.Accounts.LastDay);
        Assert.True(overview.Profiles.LastDay >= 2);
        Assert.True(overview.Players.LastDay >= 1 && overview.Players.LastWeek >= overview.Players.LastDay);
        Assert.Equal(1, overview.Catalog.Listed);
        Assert.NotNull(overview.ErrorsLastDay);
        Assert.True(overview.Email.Enabled);

        var hello = Assert.Single((await client.GetFromJsonAsync<List<AdminGame>>(Url("/api/admin/games"), Ct))!);
        Assert.Equal(("hello", "Xin chào", "1.2.0", true, false), (hello.Id, hello.Name, hello.Version, hello.Listed, hello.Online));
        Assert.Equal((1, 0), (hello.PlayersLastWeek, hello.OpenRooms));
    }

    [Fact]
    public async Task The_health_page_is_the_device_telemetry_report()
    {
        var (client, _) = await AdminAsync();
        var report = (await client.GetFromJsonAsync<TelemetryReport>(Url("/api/admin/health?days=3"), Ct))!;
        Assert.Equal(3, (report.To - report.From).TotalDays, 3);
    }

    [Fact]
    public async Task The_system_page_shows_the_workers_and_no_secret()
    {
        var (client, _) = await AdminAsync();
        var work = factory.Services.GetRequiredService<BackgroundWork>();
        work.Succeeded(BackgroundWork.CatalogSync);
        work.Failed(BackgroundWork.EmailDelivery, new InvalidOperationException("relay down"));

        var raw = await client.GetStringAsync(Url("/api/admin/system"), Ct);
        var system = JsonSerializer.Deserialize<AdminSystem>(raw, JsonSerializerOptions.Web)!;
        Assert.True(system.Database.Applied > 0);
        Assert.Empty(system.Database.Pending);
        var email = Assert.Single(system.Workers, worker => worker.Name == BackgroundWork.EmailDelivery);
        Assert.Equal(("InvalidOperationException: relay down", 1), (email.LastError, email.FailuresInARow));
        Assert.Null(Assert.Single(system.Workers, worker => worker.Name == BackgroundWork.CatalogSync).LastError);
        Assert.Equal(("Smtp", "https://games.example.test", true), (system.Settings.EmailMode, system.Settings.GamesOrigin, system.Settings.OperatorReport));
        Assert.DoesNotContain(ApiFactory.TelemetryToken, raw, StringComparison.Ordinal);
    }

    [Fact]
    public async Task The_command_grants_lists_and_refuses_what_it_cannot_do()
    {
        var email = Accounts.NewEmail();
        await Accounts.SignUpAsync(factory, factory.CreateClient(), "Chủ", email);

        Assert.Equal(2, (await CommandAsync("admin", "grant", email, "--role", "king")).Exit);
        Assert.Equal(1, (await CommandAsync("admin", "grant", "nobody@tohe.test", "--role", "owner")).Exit);
        Assert.Equal(2, (await CommandAsync("admin", "promote", email)).Exit);

        var granted = await CommandAsync("admin", "grant", email, "--role", "Owner");
        Assert.Equal(0, granted.Exit);
        Assert.Contains("is now owner", granted.Output, StringComparison.Ordinal);
        Assert.Contains($"owner     {email} (Chủ)", (await CommandAsync("admin", "list")).Output, StringComparison.Ordinal);
    }

    [Fact]
    public async Task The_admin_api_has_an_openapi_document_of_its_own()
    {
        var client = factory.CreateClient();
        var admin = await client.GetStringAsync(Url("/api/openapi/admin.json"), Ct);
        var hub = await client.GetStringAsync(Url("/api/openapi/v1.json"), Ct);
        Assert.Contains("/api/admin/overview", admin, StringComparison.Ordinal);
        Assert.DoesNotContain("/api/auth/login", admin, StringComparison.Ordinal);
        Assert.DoesNotContain("/api/admin", hub, StringComparison.Ordinal);
    }

    // ------------------------------------------------------------------ helpers

    /// <summary>A new account holding a role, signed in on the returned client.</summary>
    private async Task<(HttpClient Client, string Email)> AdminAsync(string role = "viewer")
    {
        var email = Accounts.NewEmail();
        var client = factory.CreateClient();
        await Accounts.SignUpAsync(factory, client, "Cô Ba", email);
        Assert.Equal(0, (await CommandAsync("admin", "grant", email, "--role", role)).Exit);
        return (client, email);
    }

    private async Task<(int Exit, string Output)> CommandAsync(params string[] args)
    {
        using var output = new StringWriter();
        using var error = new StringWriter();
        var exit = await AdminCommand.RunAsync(factory.Services, args, output, error);
        return (exit, output.ToString() + error);
    }

    private static async Task<string?> CodeOfAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    private static Uri Url(string path) => new(path, UriKind.Relative);
}
