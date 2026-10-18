using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Admin;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Tests;

/// <summary>
/// The console's users (ADR 0027): finding accounts, suspending one — no way in, sessions over — renaming a profile with
/// its names kept, roles from the console; nobody on their own account or on a role as strong as theirs.
/// </summary>
public sealed class AdminUsersTests(ApiFactory factory) : IClassFixture<ApiFactory>, IAsyncDisposable
{
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    // Sessions are checked against the security stamp on every request, so "they end" is seen at once.
    private readonly WebApplicationFactory<Program> _strict =
        factory.WithWebHostBuilder(builder => builder.UseSetting("Identity:SessionCheckInterval", "00:00:00"));

    public ValueTask DisposeAsync() => _strict.DisposeAsync();

    [Fact]
    public async Task Accounts_are_found_by_address_name_or_profile_id()
    {
        var admin = await Admins.NewAsync(factory, "moderator");
        var email = $"tim-{Guid.NewGuid():N}@tohe.test";
        var found = await Accounts.SignUpAsync(factory, factory.CreateClient(), "Bé Bông Lau", email);
        var publicId = found.Profiles[0].PublicId;

        foreach (var q in (string[])[email[..10], "bông lau", publicId[..6], $"{publicId[..4]} {publicId[4..8]}"])
        {
            var hits = (await admin.Client.GetFromJsonAsync<List<AccountSummary>>(Url($"/api/admin/users?q={Uri.EscapeDataString(q)}"), Ct))!;
            var hit = Assert.Single(hits, account => account.Id == found.Account.Id);
            Assert.Equal((email, 1, false, null), (hit.Email, hit.Profiles, hit.Suspended, hit.Role));
        }

        Assert.Empty((await admin.Client.GetFromJsonAsync<List<AccountSummary>>(Url("/api/admin/users?q=%25_%25"), Ct))!);
        var detail = (await admin.Client.GetFromJsonAsync<AccountDetail>(Url($"/api/admin/users/{found.Account.Id}"), Ct))!;
        Assert.Equal(("Bé Bông Lau", publicId), (detail.Profiles[0].Name, detail.Profiles[0].PublicId));
        Assert.Equal(["Bé Bông Lau"], detail.Profiles[0].Names.Select(name => name.Name));
    }

    [Fact]
    public async Task A_suspended_account_has_no_way_in_and_its_sessions_end()
    {
        var admin = await Admins.NewAsync(factory, "admin", _strict);
        var email = Accounts.NewEmail();
        var phone = _strict.CreateClient();
        var player = await Accounts.SignUpAsync(factory, phone, "Người chơi", email);

        var noReason = await admin.Client.PostAsJsonAsync(Url($"/api/admin/users/{player.Account.Id}/suspend"), new { reason = " " }, Ct);
        Assert.Contains("reason_required", (await ErrorsAsync(noReason))["reason"]);
        var suspended = await admin.Client.PostAsJsonAsync(
            Url($"/api/admin/users/{player.Account.Id}/suspend"), new { reason = "Tên phản cảm, nhắc ba lần" }, Ct);
        var detail = (await suspended.Content.ReadFromJsonAsync<AccountDetail>(Ct))!;
        Assert.Equal("Tên phản cảm, nhắc ba lần", detail.SuspendedReason);
        Assert.NotNull(detail.SuspendedAt);

        // Its session is over; signing in again says why only to whoever knows the password.
        Assert.Equal(HttpStatusCode.NoContent, (await phone.GetAsync(Url("/api/auth/me"), Ct)).StatusCode);
        var wrong = await _strict.CreateClient().PostAsJsonAsync(Url("/api/auth/login"), new { email, password = "sai-mat-khau" }, Ct);
        Assert.Equal("invalid_credentials", await CodeOfAsync(wrong));
        var right = await _strict.CreateClient().PostAsJsonAsync(Url("/api/auth/login"), new { email, password = Accounts.Password }, Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "account_suspended"), (right.StatusCode, await CodeOfAsync(right)));

        var lifted = await admin.Client.DeleteAsync(Url($"/api/admin/users/{player.Account.Id}/suspend"), Ct);
        Assert.Null((await lifted.Content.ReadFromJsonAsync<AccountDetail>(Ct))!.SuspendedAt);
        Assert.Equal(HttpStatusCode.OK, (await _strict.CreateClient().PostAsJsonAsync(Url("/api/auth/login"), new { email, password = Accounts.Password }, Ct)).StatusCode);

        var actions = await AuditAsync(email);
        Assert.Equal([AuditActions.UserLift, AuditActions.UserSuspend], actions);
    }

    [Fact]
    public async Task A_suspended_account_neither_renews_a_session_it_still_holds_nor_resets_its_way_back_in()
    {
        var admin = await Admins.NewAsync(factory, "admin");
        var email = Accounts.NewEmail();
        // The usual session check: the phone's session is not checked again for a few minutes.
        var phone = factory.CreateClient();
        var player = await Accounts.SignUpAsync(factory, phone, "Người chơi", email);
        await admin.Client.PostAsJsonAsync(Url($"/api/admin/users/{player.Account.Id}/suspend"), new { reason = "Thử" }, Ct);

        // Anything that would re-issue the session ends it instead.
        var renew = await phone.DeleteAsync(Url("/api/session/profile"), Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "account_suspended"), (renew.StatusCode, await CodeOfAsync(renew)));
        Assert.Equal(HttpStatusCode.NoContent, (await phone.GetAsync(Url("/api/auth/me"), Ct)).StatusCode);

        // A new password by email is no way in either: it says why once the code proved the address, and changes nothing.
        await AgeAttemptsAsync(email);
        var laptop = factory.CreateClient();
        var forgot = await laptop.PostAsJsonAsync(Url("/api/auth/password/forgot"), new { email }, Ct);
        var attempt = (await forgot.Content.ReadFromJsonAsync<AttemptView>(Ct))!.AttemptId;
        var reset = await laptop.PostAsJsonAsync(
            Url("/api/auth/password/reset"),
            new { attemptId = attempt, code = await factory.CodeSentToAsync(email), password = "mat-khau-moi-cua-bo" },
            Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "account_suspended"), (reset.StatusCode, await CodeOfAsync(reset)));
        Assert.Equal(HttpStatusCode.NoContent, (await laptop.GetAsync(Url("/api/auth/me"), Ct)).StatusCode);

        await admin.Client.DeleteAsync(Url($"/api/admin/users/{player.Account.Id}/suspend"), Ct);
        var login = await factory.CreateClient().PostAsJsonAsync(Url("/api/auth/login"), new { email, password = Accounts.Password }, Ct);
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
    }

    [Fact]
    public async Task Signing_out_everywhere_ends_every_session_of_the_account()
    {
        var admin = await Admins.NewAsync(factory, "admin", _strict);
        var phone = _strict.CreateClient();
        var player = await Accounts.SignUpAsync(factory, phone, "Người chơi");
        Assert.Equal(HttpStatusCode.OK, (await admin.Client.PostAsync(Url($"/api/admin/users/{player.Account.Id}/sign-out"), null, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await phone.GetAsync(Url("/api/auth/me"), Ct)).StatusCode);
    }

    [Fact]
    public async Task An_owner_renames_a_profile_five_times_a_day_never_to_a_rude_name_and_a_moderator_still_can()
    {
        var moderator = await Admins.NewAsync(factory, "moderator");
        var client = factory.CreateClient();
        var player = await Accounts.SignUpAsync(factory, client, "Mèo");
        var profile = player.Profiles[0].Id;
        await Accounts.StepUpAsync(client);
        var rename = (string name) => client.PatchAsJsonAsync(Url($"/api/profiles/{profile}"), new { name }, Ct);

        var rude = await rename("Thằng Lồn");
        Assert.Contains("name_inappropriate", (await ErrorsAsync(rude))["name"]);
        foreach (var name in (string[])["Mèo 1", "Mèo 2", "Mèo 3", "Mèo 4", "Mèo 5"])
        {
            Assert.Equal(HttpStatusCode.OK, (await rename(name)).StatusCode);
        }

        var sixth = await rename("Mèo 6");
        Assert.Equal((HttpStatusCode.TooManyRequests, "rename_limit"), (sixth.StatusCode, await CodeOfAsync(sixth)));
        // Saving the profile with its name as it is renames nothing.
        Assert.Equal(HttpStatusCode.OK, (await rename("Mèo 5")).StatusCode);
        // A moderator is not held by the owner's limit.
        var fixedName = await moderator.Client.PatchAsJsonAsync(Url($"/api/admin/profiles/{profile}"), new { name = "Mèo Con" }, Ct);
        Assert.Equal(HttpStatusCode.OK, fixedName.StatusCode);
    }

    [Fact]
    public async Task A_moderator_renames_a_profile_under_the_name_rules_and_the_history_keeps_both_names()
    {
        var moderator = await Admins.NewAsync(factory, "moderator");
        var player = await Accounts.SignUpAsync(factory, factory.CreateClient(), "Tên Xấu Xí");
        var profile = player.Profiles[0].Id;

        var reserved = await moderator.Client.PatchAsJsonAsync(Url($"/api/admin/profiles/{profile}"), new { name = "Admin" }, Ct);
        Assert.Contains("name_reserved", (await ErrorsAsync(reserved))["name"]);
        var renamed = await moderator.Client.PatchAsJsonAsync(Url($"/api/admin/profiles/{profile}"), new { name = "Người chơi 7" }, Ct);
        var names = Assert.Single((await renamed.Content.ReadFromJsonAsync<AccountDetail>(Ct))!.Profiles).Names;
        Assert.Equal(["Người chơi 7", "Tên Xấu Xí"], names.Select(name => name.Name));

        // A moderator finds and renames; suspending is beyond it.
        var suspend = await moderator.Client.PostAsJsonAsync(Url($"/api/admin/users/{player.Account.Id}/suspend"), new { reason = "x" }, Ct);
        Assert.Equal("admin_required", await CodeOfAsync(suspend));

        await using var scope = factory.Services.CreateAsyncScope();
        var entry = await scope.ServiceProvider.GetRequiredService<ToheDbContext>().AuditLog
            .SingleAsync(e => e.Action == AuditActions.ProfileRename && e.Actor == moderator.Email, Ct);
        Assert.Contains("Tên Xấu Xí", entry.Details!, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Nobody_acts_on_their_own_account_or_on_a_role_as_strong_and_only_owners_give_roles()
    {
        var owner = await Admins.NewAsync(factory, "owner");
        var admin = await Admins.NewAsync(factory, "admin");
        var player = await Accounts.SignUpAsync(factory, factory.CreateClient(), "Người chơi");

        Assert.Equal("admin_self", await CodeOfAsync(await admin.Client.PostAsync(Url($"/api/admin/users/{admin.AccountId}/sign-out"), null, Ct)));
        Assert.Equal("admin_rank", await CodeOfAsync(await admin.Client.PostAsJsonAsync(Url($"/api/admin/users/{owner.AccountId}/suspend"), new { reason = "x" }, Ct)));
        Assert.Equal("admin_required", await CodeOfAsync(await admin.Client.PutAsJsonAsync(Url($"/api/admin/users/{player.Account.Id}/role"), new { role = "viewer" }, Ct)));

        var invalid = await owner.Client.PutAsJsonAsync(Url($"/api/admin/users/{player.Account.Id}/role"), new { role = "king" }, Ct);
        Assert.Contains("role_invalid", (await ErrorsAsync(invalid))["role"]);
        var given = await owner.Client.PutAsJsonAsync(Url($"/api/admin/users/{player.Account.Id}/role"), new { role = "moderator" }, Ct);
        Assert.Equal("moderator", (await given.Content.ReadFromJsonAsync<AccountDetail>(Ct))!.Role);
        var taken = await owner.Client.PutAsJsonAsync(Url($"/api/admin/users/{player.Account.Id}/role"), new { role = (string?)null }, Ct);
        Assert.Null((await taken.Content.ReadFromJsonAsync<AccountDetail>(Ct))!.Role);
        Assert.Equal("admin_self", await CodeOfAsync(await owner.Client.PutAsJsonAsync(Url($"/api/admin/users/{owner.AccountId}/role"), new { role = "admin" }, Ct)));

        // Every change needs step-up level 2 on the device, which a fresh session lacks.
        var laptop = await Admins.SignInAsync(factory, owner.Email);
        await laptop.PostAsJsonAsync(Url("/api/admin/two-factor/verify"), new { code = Totp.Code(owner.Key, DateTimeOffset.UtcNow.AddSeconds(30)) }, Ct);
        Assert.Equal("step_up_required", await CodeOfAsync(await laptop.PostAsync(Url($"/api/admin/users/{player.Account.Id}/sign-out"), null, Ct)));
    }

    [Fact]
    public async Task A_suspended_account_does_not_sign_in_with_its_provider_either()
    {
        await using var app = factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            services.AddAuthentication().AddRemoteScheme<FakeProviderOptions, FakeProviderHandler>("fake", "Fake", o =>
                o.SignInScheme = Microsoft.AspNetCore.Identity.IdentityConstants.ExternalScheme);
            services.AddSingleton(new ExternalProviderCatalog([new ExternalProvider("fake", "Fake")]));
        }));
        var subject = Guid.NewGuid().ToString("N");
        var first = app.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        await FakeProvider.ComeBackAsync(first, subject, Accounts.NewEmail(), verified: true);
        var me = (await (await first.PostAsJsonAsync(
                Url("/api/auth/external/pending/signup"),
                new { displayName = "Cáo", acceptTerms = true, termsVersion = Accounts.TermsVersion },
                Ct))
            .Content.ReadFromJsonAsync<ExternalOutcome>(Ct))!.Me!;

        var admin = await Admins.NewAsync(factory, "admin");
        await admin.Client.PostAsJsonAsync(Url($"/api/admin/users/{me.Account.Id}/suspend"), new { reason = "Thử" }, Ct);

        var again = app.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        Assert.Equal("/welcome?external=suspended", await FakeProvider.ComeBackAsync(again, subject, null, verified: false));
    }

    // ------------------------------------------------------------------ helpers

    /// <summary>Moves the address's attempts two minutes back, past the minute between codes.</summary>
    private async Task AgeAttemptsAsync(string email)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<ToheDbContext>().AuthAttempts
            .Where(a => a.NormalizedEmail == email.ToUpperInvariant())
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.CreatedAt, DateTimeOffset.UtcNow.AddMinutes(-2)), Ct);
    }

    private async Task<List<string>> AuditAsync(string email)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<ToheDbContext>().AuditLog
            .Where(entry => entry.Target != null && entry.Target.StartsWith(email))
            .OrderByDescending(entry => entry.Id)
            .Select(entry => entry.Action)
            .ToListAsync(Ct);
    }

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
