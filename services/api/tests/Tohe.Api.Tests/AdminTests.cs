using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
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
/// The console's API (ADR 0027, 0042): the role is read from the database on every request, every endpoint declares
/// its permission, each browser signs in with its own code from the authenticator, and every change is audited.
/// </summary>
public sealed class AdminTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    [Fact]
    public async Task Only_an_account_with_a_role_and_an_authenticator_gets_in_and_losing_the_role_works_at_once()
    {
        var console = Admins.ConsoleClient(factory);
        Assert.Equal(HttpStatusCode.Unauthorized, (await console.GetAsync(Url("/api/admin/overview"), Ct)).StatusCode);

        var email = Accounts.NewEmail();
        var player = factory.CreateClient();
        var me = await Accounts.SignUpAsync(factory, player, "Bố", email);
        Assert.Null(me.Account.Role);
        Assert.Null(me.Account.ConsoleUrl);
        // A player adds no authenticator: the hub's page for it serves the console.
        Assert.Equal("admin_required", await CodeOfAsync(await player.GetAsync(Url("/api/account/two-factor"), Ct)));

        Assert.Equal(0, (await CommandAsync("admin", "grant", email, "--role", "viewer")).Exit);
        var granted = (await player.GetFromJsonAsync<MeView>(Url("/api/auth/me"), Ct))!;
        Assert.Equal(("viewer", Admins.ConsoleUrl.GetLeftPart(UriPartial.Authority)), (granted.Account.Role, granted.Account.ConsoleUrl));
        Assert.False((await player.GetFromJsonAsync<AccountTwoFactorView>(Url("/api/account/two-factor"), Ct))!.Enabled);

        // A role is not enough: the console's sign-in asks for a code from an authenticator added in the hub.
        var noAuthenticator = await console.PostAsJsonAsync(Url("/api/admin/session"), new { email, password = Accounts.Password, code = "123456" }, Ct);
        Assert.Equal("invalid_credentials", await CodeOfAsync(noAuthenticator));
        var key = await EnrolAsync(player);
        Assert.True((await player.GetFromJsonAsync<AccountTwoFactorView>(Url("/api/account/two-factor"), Ct))!.Enabled);
        var signedIn = await console.PostAsJsonAsync(Url("/api/admin/session"), Admins.SignIn(email, key), Ct);
        var admin = (await signedIn.Content.ReadFromJsonAsync<AdminMeView>(Ct))!;
        Assert.Equal(("viewer", "Bố"), (admin.Role, admin.DisplayName));
        Assert.Equal([AdminPermissions.Read], admin.Permissions);
        Assert.Equal(HttpStatusCode.OK, (await console.GetAsync(Url("/api/admin/overview"), Ct)).StatusCode);

        // The same session, its role taken away: the very next request ends it.
        Assert.Equal(0, (await CommandAsync("admin", "revoke", email)).Exit);
        Assert.Equal(HttpStatusCode.Unauthorized, (await console.GetAsync(Url("/api/admin/overview"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await console.GetAsync(Url("/api/admin/me"), Ct)).StatusCode);
    }

    [Fact]
    public void Every_admin_endpoint_declares_the_permission_it_needs_but_the_few_before_a_console_session()
    {
        var endpoints = factory.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .OfType<RouteEndpoint>()
            .Where(endpoint => endpoint.RoutePattern.RawText?.StartsWith("/api/admin", StringComparison.Ordinal) == true)
            .ToList();
        Assert.True(endpoints.Count >= 14, $"{endpoints.Count} admin endpoints");
        var open = endpoints.Where(endpoint => endpoint.Metadata.GetMetadata<AdminPermission>() is null).ToList();
        Assert.Equal(
            ["ClaimAdminSetup", "GetAdminMe", "GetAdminSetup", "GetConsoleConfig", "SignInToConsole", "SignOutOfConsole"],
            open.Select(endpoint => endpoint.Metadata.GetMetadata<IEndpointNameMetadata>()?.EndpointName).Order(StringComparer.Ordinal));
        Assert.All(open, endpoint => Assert.NotNull(endpoint.Metadata.GetMetadata<IAllowAnonymous>()));
    }

    [Fact]
    public async Task Each_browser_signs_in_with_its_own_code_and_a_code_works_once()
    {
        var admin = await AdminAsync();
        var laptop = Admins.ConsoleClient(factory);
        var wrong = await laptop.PostAsJsonAsync(Url("/api/admin/session"), new { email = admin.Email, password = Accounts.Password, code = "000000" }, Ct);
        Assert.Equal((HttpStatusCode.Unauthorized, "invalid_credentials"), (wrong.StatusCode, await CodeOfAsync(wrong)));

        var code = Admins.SignIn(admin.Email, admin.Key, step: 2);
        var opened = await laptop.PostAsJsonAsync(Url("/api/admin/session"), code, Ct);
        var view = (await opened.Content.ReadFromJsonAsync<AdminMeView>(Ct))!;
        Assert.InRange(view.OpenUntil, DateTimeOffset.UtcNow.AddHours(11.9), DateTimeOffset.UtcNow.AddHours(12));
        Assert.Null(view.SecureUntil);
        Assert.Equal(HttpStatusCode.OK, (await laptop.GetAsync(Url("/api/admin/overview"), Ct)).StatusCode);

        // Seen over a shoulder, the same code opens nothing on another browser.
        var phone = Admins.ConsoleClient(factory);
        Assert.Equal("invalid_credentials", await CodeOfAsync(await phone.PostAsJsonAsync(Url("/api/admin/session"), code, Ct)));

        // A recovery code signs in once.
        var codes = (await (await admin.Client.PostAsync(Url("/api/admin/two-factor/recovery-codes"), null, Ct))
            .Content.ReadFromJsonAsync<RecoveryCodesView>(Ct))!.Codes;
        Assert.Equal(10, codes.Count);
        var recovery = new { email = admin.Email, password = Accounts.Password, recoveryCode = codes[0] };
        Assert.Equal(HttpStatusCode.OK, (await phone.PostAsJsonAsync(Url("/api/admin/session"), recovery, Ct)).StatusCode);
        var again = Admins.ConsoleClient(factory);
        Assert.Equal("invalid_credentials", await CodeOfAsync(await again.PostAsJsonAsync(Url("/api/admin/session"), recovery, Ct)));
        Assert.Equal(9, (await phone.GetFromJsonAsync<TwoFactorView>(Url("/api/admin/two-factor"), Ct))!.RecoveryCodesLeft);
    }

    [Fact]
    public async Task Adding_an_authenticator_needs_step_up_in_the_hub_and_turning_it_off_ends_the_console_everywhere()
    {
        var email = Accounts.NewEmail();
        var player = factory.CreateClient();
        await Accounts.SignUpAsync(factory, player, "Cô Ba", email);
        Assert.Equal(0, (await CommandAsync("admin", "grant", email, "--role", "admin")).Exit);
        Assert.Equal("step_up_required", await CodeOfAsync(await player.PostAsync(Url("/api/account/two-factor/setup"), null, Ct)));

        var key = await EnrolAsync(player);
        // Told to the account's address, as every change to how it signs in (ADR 0024, 0026).
        Assert.Contains("Đã bật xác thực hai lớp", await factory.MailSentToAsync(email), StringComparison.Ordinal);
        Assert.Equal("two_factor_enabled", await CodeOfAsync(await player.PostAsync(Url("/api/account/two-factor/setup"), null, Ct)));
        var desk = await Admins.SignInAsync(factory, email, key);
        var laptop = await Admins.SignInAsync(factory, email, key, step: 2);
        Assert.Equal(HttpStatusCode.OK, (await laptop.GetAsync(Url("/api/admin/overview"), Ct)).StatusCode);

        // Turning it off needs step-up level 2 in the console session, and ends every console session at once.
        Assert.Equal("step_up_required", await CodeOfAsync(await desk.DeleteAsync(Url("/api/admin/two-factor"), Ct)));
        await Admins.StepUpAsync(desk);
        Assert.Equal(HttpStatusCode.NoContent, (await desk.DeleteAsync(Url("/api/admin/two-factor"), Ct)).StatusCode);
        Assert.Contains("Đã tắt xác thực hai lớp", await factory.MailSentToAsync(email), StringComparison.Ordinal);
        Assert.Equal(HttpStatusCode.Unauthorized, (await desk.GetAsync(Url("/api/admin/overview"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await laptop.GetAsync(Url("/api/admin/overview"), Ct)).StatusCode);
        var signIn = await Admins.ConsoleClient(factory).PostAsJsonAsync(Url("/api/admin/session"), Admins.SignIn(email, key, step: -1), Ct);
        Assert.Equal("invalid_credentials", await CodeOfAsync(signIn));

        // The audit log tells the story; an owner may read it, a viewer may not.
        var auditor = await AdminAsync("owner");
        var page = (await auditor.Client.GetFromJsonAsync<AuditPage>(Url("/api/admin/audit?limit=200"), Ct))!;
        var actions = page.Entries.Where(entry => entry.Actor == email || entry.Target?.StartsWith(email, StringComparison.Ordinal) == true)
            .Select(entry => entry.Action).ToList();
        Assert.Equal(
            [AuditActions.TwoFactorDisable, AuditActions.ConsoleOpen, AuditActions.ConsoleOpen, AuditActions.TwoFactorEnable, AuditActions.RoleGrant],
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
    public async Task The_audit_log_keeps_a_year_and_nothing_younger_goes()
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        await db.Database.ExecuteSqlRawAsync(
            """
            INSERT INTO admin.audit_log (at, actor, action) VALUES
                (now() - interval '400 days', 'test', 'test.past-the-year'),
                (now() - interval '300 days', 'test', 'test.within-the-year')
            """,
            Ct);

        Assert.True(await scope.ServiceProvider.GetRequiredService<AuditRetention>().RunAsync(Ct) >= 1);

        Assert.False(await db.AuditLog.AnyAsync(entry => entry.Action == "test.past-the-year", Ct));
        Assert.True(await db.AuditLog.AnyAsync(entry => entry.Action == "test.within-the-year", Ct));
        // The retention's way out opens only for entries past the year.
        await using var transaction = await db.Database.BeginTransactionAsync(Ct);
        await db.Database.ExecuteSqlRawAsync("SELECT set_config('tohe.purge', 'audit', true)", Ct);
        var refused = await Assert.ThrowsAsync<PostgresException>(
            () => db.Database.ExecuteSqlRawAsync("DELETE FROM admin.audit_log WHERE action = 'test.within-the-year'", Ct));
        Assert.Contains("append-only", refused.MessageText, StringComparison.Ordinal);
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
        Assert.False((await Admins.ConsoleClient(factory).GetFromJsonAsync<SetupView>(Url("/api/admin/setup"), Ct))!.Open);
    }

    [Fact]
    public async Task The_admin_api_has_an_openapi_document_of_its_own()
    {
        // The documents are served only with the API reference switched on (ADR 0042).
        using var reference = factory.WithWebHostBuilder(builder => builder.UseSetting("Api:Reference:Enabled", "true"));
        var client = reference.CreateClient();
        var admin = await client.GetStringAsync(Url("/api/openapi/admin.json"), Ct);
        var hub = await client.GetStringAsync(Url("/api/openapi/v1.json"), Ct);
        Assert.Contains("/api/admin/overview", admin, StringComparison.Ordinal);
        Assert.Contains("/api/admin/session", admin, StringComparison.Ordinal);
        Assert.DoesNotContain("/api/auth/login", admin, StringComparison.Ordinal);
        Assert.DoesNotContain("/api/account/two-factor", admin, StringComparison.Ordinal);
        Assert.DoesNotContain("/api/admin", hub, StringComparison.Ordinal);
        Assert.Contains("/api/account/two-factor/setup", hub, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Only_an_account_with_a_role_a_password_and_step_up_adds_an_authenticator()
    {
        var email = Accounts.NewEmail();
        var player = factory.CreateClient();
        var me = await Accounts.SignUpAsync(factory, player, "Bố", email);
        var enable = new { code = "123456" };

        // A player, even within step-up level 2: no authenticator.
        await Accounts.StepUpAsync(player);
        Assert.Equal("admin_required", await CodeOfAsync(await player.PostAsync(Url("/api/account/two-factor/setup"), null, Ct)));
        Assert.Equal("admin_required", await CodeOfAsync(await player.PostAsJsonAsync(Url("/api/account/two-factor/enable"), enable, Ct)));

        // A role, on a device without step-up level 2.
        Assert.Equal(0, (await CommandAsync("admin", "grant", email, "--role", "moderator")).Exit);
        var other = factory.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await other.PostAsJsonAsync(Url("/api/auth/login"), new { email, password = Accounts.Password }, Ct)).StatusCode);
        Assert.Equal("step_up_required", await CodeOfAsync(await other.PostAsync(Url("/api/account/two-factor/setup"), null, Ct)));
        Assert.Equal("step_up_required", await CodeOfAsync(await other.PostAsJsonAsync(Url("/api/account/two-factor/enable"), enable, Ct)));

        // An account that signs in only with a provider: the console's sign-in asks for a password, so one comes first.
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            await scope.ServiceProvider.GetRequiredService<ToheDbContext>().Users.Where(a => a.Id == me.Account.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.PasswordHash, (string?)null), Ct);
        }

        var setup = await player.PostAsync(Url("/api/account/two-factor/setup"), null, Ct);
        Assert.Equal((HttpStatusCode.Conflict, "password_required"), (setup.StatusCode, await CodeOfAsync(setup)));
        Assert.Equal("password_required", await CodeOfAsync(await player.PostAsJsonAsync(Url("/api/account/two-factor/enable"), enable, Ct)));
        Assert.False((await player.GetFromJsonAsync<AccountTwoFactorView>(Url("/api/account/two-factor"), Ct))!.Enabled);
    }

    // ------------------------------------------------------------------ helpers

    private Task<Admins.Admin> AdminAsync(string role = "viewer") => Admins.NewAsync(factory, role);

    private static Task<string> EnrolAsync(HttpClient player) => Admins.EnrolAsync(player);

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
