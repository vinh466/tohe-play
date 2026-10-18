using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Tohe.Api.Infrastructure;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Admin;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Registry;
using Tohe.Api.Modules.Telemetry;

namespace Tohe.Api.Tests;

/// <summary>
/// The admin console's API (ADR 0027): the role is read from the database on every request, every endpoint declares
/// its permission, two-factor authentication opens the console on each device, and every change is audited.
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
        Assert.Equal("admin_required", await CodeOfAsync(await client.GetAsync(Url("/api/admin/overview"), Ct)));

        Assert.Equal(0, (await CommandAsync("admin", "grant", email, "--role", "viewer")).Exit);
        var admin = (await client.GetFromJsonAsync<AdminMeView>(Url("/api/admin/me"), Ct))!;
        Assert.Equal(("viewer", "Bố", false), (admin.Role, admin.DisplayName, admin.TwoFactorEnabled));
        Assert.Equal([AdminPermissions.Read], admin.Permissions);
        Assert.Equal("viewer", (await client.GetFromJsonAsync<MeView>(Url("/api/auth/me"), Ct))!.Account.Role);

        // A role is not enough: the console opens behind two-factor authentication.
        Assert.Equal("two_factor_setup_required", await CodeOfAsync(await client.GetAsync(Url("/api/admin/overview"), Ct)));
        await EnrolAsync(client);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(Url("/api/admin/overview"), Ct)).StatusCode);

        // The same session, its role taken away: the very next request is refused.
        Assert.Equal(0, (await CommandAsync("admin", "revoke", email)).Exit);
        Assert.Equal("admin_required", await CodeOfAsync(await client.GetAsync(Url("/api/admin/overview"), Ct)));
        Assert.Null((await client.GetFromJsonAsync<AdminMeView>(Url("/api/admin/me"), Ct))!.Role);
    }

    [Fact]
    public void Every_admin_endpoint_declares_the_permission_it_needs()
    {
        var endpoints = factory.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .OfType<RouteEndpoint>()
            .Where(endpoint => endpoint.RoutePattern.RawText?.StartsWith("/api/admin", StringComparison.Ordinal) == true)
            .ToList();
        Assert.True(endpoints.Count >= 14, $"{endpoints.Count} admin endpoints");
        Assert.All(endpoints, endpoint => Assert.NotNull(endpoint.Metadata.GetMetadata<AdminPermission>()));
    }

    [Fact]
    public async Task Each_device_opens_the_console_with_its_own_code_and_a_code_works_once()
    {
        var admin = await AdminAsync();
        var laptop = await SignInAsync(admin.Email);
        Assert.Equal("two_factor_required", await CodeOfAsync(await laptop.GetAsync(Url("/api/admin/overview"), Ct)));
        Assert.Null((await laptop.GetFromJsonAsync<AdminMeView>(Url("/api/admin/me"), Ct))!.OpenUntil);

        var wrong = await laptop.PostAsJsonAsync(Url("/api/admin/two-factor/verify"), new { code = "000000" }, Ct);
        Assert.Contains("code_invalid", (await ErrorsAsync(wrong))["code"]);

        var code = Totp.Code(admin.Key, DateTimeOffset.UtcNow.AddSeconds(30));
        var opened = await laptop.PostAsJsonAsync(Url("/api/admin/two-factor/verify"), new { code }, Ct);
        var view = (await opened.Content.ReadFromJsonAsync<TwoFactorView>(Ct))!;
        Assert.True(view.Enabled);
        Assert.True(view.OpenUntil > DateTimeOffset.UtcNow.AddHours(11));
        Assert.Equal(HttpStatusCode.OK, (await laptop.GetAsync(Url("/api/admin/overview"), Ct)).StatusCode);

        // Seen over a shoulder, the same code opens nothing on another device.
        var phone = await SignInAsync(admin.Email);
        var replay = await phone.PostAsJsonAsync(Url("/api/admin/two-factor/verify"), new { code }, Ct);
        Assert.Contains("code_used", (await ErrorsAsync(replay))["code"]);

        // A recovery code opens it once.
        var codes = (await (await admin.Client.PostAsync(Url("/api/admin/two-factor/recovery-codes"), null, Ct))
            .Content.ReadFromJsonAsync<RecoveryCodesView>(Ct))!.Codes;
        Assert.Equal(10, codes.Count);
        Assert.Equal(HttpStatusCode.OK, (await phone.PostAsJsonAsync(Url("/api/admin/two-factor/verify"), new { recoveryCode = codes[0] }, Ct)).StatusCode);
        var again = await SignInAsync(admin.Email);
        var used = await again.PostAsJsonAsync(Url("/api/admin/two-factor/verify"), new { recoveryCode = codes[0] }, Ct);
        Assert.Contains("code_invalid", (await ErrorsAsync(used))["recoveryCode"]);
    }

    [Fact]
    public async Task Changing_two_factor_needs_step_up_and_turning_it_off_closes_the_console_everywhere()
    {
        var email = Accounts.NewEmail();
        var client = factory.CreateClient();
        await Accounts.SignUpAsync(factory, client, "Cô Ba", email);
        Assert.Equal(0, (await CommandAsync("admin", "grant", email, "--role", "admin")).Exit);
        Assert.Equal("step_up_required", await CodeOfAsync(await client.PostAsync(Url("/api/admin/two-factor/setup"), null, Ct)));

        var key = await EnrolAsync(client);
        var laptop = await SignInAsync(email);
        await laptop.PostAsJsonAsync(Url("/api/admin/two-factor/verify"), new { code = Totp.Code(key, DateTimeOffset.UtcNow.AddSeconds(30)) }, Ct);
        Assert.Equal(HttpStatusCode.OK, (await laptop.GetAsync(Url("/api/admin/overview"), Ct)).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await client.DeleteAsync(Url("/api/admin/two-factor"), Ct)).StatusCode);
        Assert.Equal("two_factor_setup_required", await CodeOfAsync(await client.GetAsync(Url("/api/admin/overview"), Ct)));
        Assert.Equal("two_factor_setup_required", await CodeOfAsync(await laptop.GetAsync(Url("/api/admin/overview"), Ct)));

        // The audit log tells the story; an admin may read it, a viewer may not.
        var auditor = await AdminAsync("owner");
        var page = (await auditor.Client.GetFromJsonAsync<AuditPage>(Url("/api/admin/audit?limit=200"), Ct))!;
        var actions = page.Entries.Where(entry => entry.Actor == email || entry.Target?.StartsWith(email, StringComparison.Ordinal) == true)
            .Select(entry => entry.Action).ToList();
        Assert.Equal(
            [AuditActions.TwoFactorDisable, AuditActions.ConsoleOpen, AuditActions.TwoFactorEnable, AuditActions.RoleGrant],
            actions);
        Assert.Equal("command line", page.Entries.First(entry => entry.Action == AuditActions.RoleGrant && entry.Target!.StartsWith(email, StringComparison.Ordinal)).Actor);
        var viewer = await AdminAsync("viewer");
        Assert.Equal("admin_required", await CodeOfAsync(await viewer.Client.GetAsync(Url("/api/admin/audit"), Ct)));
    }

    [Fact]
    public async Task The_audit_log_cannot_be_changed_or_emptied()
    {
        var admin = await AdminAsync();
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        Assert.True(await db.AuditLog.AnyAsync(entry => entry.Actor == admin.Email, Ct));

        foreach (var sql in (string[])["UPDATE admin.audit_log SET actor = 'someone else'", "DELETE FROM admin.audit_log", "TRUNCATE admin.audit_log"])
        {
            var refused = await Assert.ThrowsAsync<PostgresException>(() => db.Database.ExecuteSqlRawAsync(sql, Ct));
            Assert.Contains("append-only", refused.MessageText, StringComparison.Ordinal);
        }
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

        var admin = await AdminAsync();
        var player = factory.CreateClient();
        await Accounts.SignUpAsync(factory, player, "Na");
        var saved = await player.PutAsJsonAsync(Url("/api/progress/saves/hello"), new { data = new { level = 2 } }, Ct);
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);

        var overview = (await admin.Client.GetFromJsonAsync<AdminOverview>(Url("/api/admin/overview"), Ct))!;
        Assert.True(overview.Accounts.LastDay >= 2, "both accounts are new");
        Assert.True(overview.Accounts.Total >= overview.Accounts.LastWeek && overview.Accounts.LastWeek >= overview.Accounts.LastDay);
        Assert.True(overview.Profiles.LastDay >= 2);
        Assert.True(overview.Players.LastDay >= 1 && overview.Players.LastWeek >= overview.Players.LastDay);
        Assert.Equal(1, overview.Catalog.Listed);
        Assert.NotNull(overview.ErrorsLastDay);
        Assert.True(overview.Email.Enabled);

        var hello = Assert.Single((await admin.Client.GetFromJsonAsync<List<AdminGame>>(Url("/api/admin/games"), Ct))!);
        Assert.Equal(("hello", "Xin chào", "1.2.0", true, false), (hello.Id, hello.Name, hello.Version, hello.Listed, hello.Online));
        Assert.Equal((1, 0), (hello.PlayersLastWeek, hello.OpenRooms));
    }

    [Fact]
    public async Task The_health_page_is_the_device_telemetry_report()
    {
        var admin = await AdminAsync();
        var report = (await admin.Client.GetFromJsonAsync<TelemetryReport>(Url("/api/admin/health?days=3"), Ct))!;
        Assert.Equal(3, (report.To - report.From).TotalDays, 3);
    }

    [Fact]
    public async Task The_system_page_shows_the_workers_and_no_secret()
    {
        var admin = await AdminAsync();
        var work = factory.Services.GetRequiredService<BackgroundWork>();
        work.Succeeded(BackgroundWork.CatalogSync);
        work.Failed(BackgroundWork.EmailDelivery, new InvalidOperationException("relay down"));

        var raw = await admin.Client.GetStringAsync(Url("/api/admin/system"), Ct);
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

        // An owner from the command line ends setup mode for good.
        var setup = (await factory.CreateClient().GetAsync(Url("/api/admin/setup"), Ct)).StatusCode;
        Assert.Equal(HttpStatusCode.Unauthorized, setup);
        var someone = factory.CreateClient();
        await Accounts.SignUpAsync(factory, someone, "Ai đó");
        Assert.False((await someone.GetFromJsonAsync<SetupView>(Url("/api/admin/setup"), Ct))!.Open);
    }

    [Fact]
    public async Task The_admin_api_has_an_openapi_document_of_its_own()
    {
        var client = factory.CreateClient();
        var admin = await client.GetStringAsync(Url("/api/openapi/admin.json"), Ct);
        var hub = await client.GetStringAsync(Url("/api/openapi/v1.json"), Ct);
        Assert.Contains("/api/admin/overview", admin, StringComparison.Ordinal);
        Assert.Contains("/api/admin/two-factor/verify", admin, StringComparison.Ordinal);
        Assert.DoesNotContain("/api/auth/login", admin, StringComparison.Ordinal);
        Assert.DoesNotContain("/api/admin", hub, StringComparison.Ordinal);
    }

    // ------------------------------------------------------------------ helpers

    private Task<Admins.Admin> AdminAsync(string role = "viewer") => Admins.NewAsync(factory, role);

    private static Task<string> EnrolAsync(HttpClient client) => Admins.EnrolAsync(client);

    private Task<HttpClient> SignInAsync(string email) => Admins.SignInAsync(factory, email);

    private Task<(int Exit, string Output)> CommandAsync(params string[] args) => Admins.CommandAsync(factory, args);

    private static async Task<string?> CodeOfAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    private static async Task<Dictionary<string, string[]>> ErrorsAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.GetProperty("errors").Deserialize<Dictionary<string, string[]>>()!;
    }

    private static Uri Url(string path) => new(path, UriKind.Relative);
}
