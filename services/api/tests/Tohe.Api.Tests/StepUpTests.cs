using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Tests;

/// <summary>
/// Two levels of step-up (ADR 0025): the manage PIN opens profile management; the password or a code by email opens
/// account security, and profile management with it.
/// </summary>
public sealed class StepUpTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string Pin = "246810";

    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    [Fact]
    public async Task The_manage_pin_is_set_after_proving_the_owner_and_then_opens_profile_management()
    {
        var client = factory.CreateClient();
        await Accounts.SignUpAsync(factory, client, "Bố");

        Assert.Equal("manage_pin_not_set", await CodeOfAsync(await UnlockAsync(client, Pin)));
        Assert.Equal("step_up_required", await CodeOfAsync(await SetPinAsync(client, Pin)));

        var secure = await Accounts.StepUpAsync(client);
        Assert.NotNull(secure.SecureUntil);
        Assert.NotNull(secure.ParentUnlockedUntil); // level 2 opens level 1 too
        Assert.Contains("manage_pin_invalid", (await ErrorsAsync(await SetPinAsync(client, "1234")))["pin"]);
        var set = await SetPinAsync(client, Pin);
        Assert.True((await set.Content.ReadFromJsonAsync<MeView>(Ct))!.Account.HasManagePin);

        // Locked again, the PIN alone opens profile management — and nothing more.
        await client.DeleteAsync(Url("/api/session/parent-gate"), Ct);
        var opened = await UnlockAsync(client, Pin);
        var me = (await opened.Content.ReadFromJsonAsync<MeView>(Ct))!;
        Assert.NotNull(me.ParentUnlockedUntil);
        Assert.Null(me.SecureUntil);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync(Url("/api/profiles"), NewChild("Na"), Ct)).StatusCode);
        Assert.Equal("step_up_required", await CodeOfAsync(await SetPinAsync(client, "135790")));
    }

    [Fact]
    public async Task Five_wrong_manage_pins_lock_it_for_five_minutes()
    {
        var client = factory.CreateClient();
        var account = await Accounts.SignUpAsync(factory, client, "Bố");
        await Accounts.StepUpAsync(client);
        await SetPinAsync(client, Pin);
        await client.DeleteAsync(Url("/api/session/parent-gate"), Ct);

        for (var wrong = 1; wrong < ManagePins.Tries; wrong++)
        {
            Assert.Equal("pin_invalid", await CodeOfAsync(await UnlockAsync(client, "000000")));
        }

        Assert.Equal("locked_out", await CodeOfAsync(await UnlockAsync(client, "000000")));
        Assert.Equal("locked_out", await CodeOfAsync(await UnlockAsync(client, Pin)));

        await WithDbAsync(db => db.Users.Where(a => a.Id == account.Account.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.ManagePinLockedUntil, DateTimeOffset.UtcNow.AddSeconds(-1)), Ct));
        Assert.Equal(HttpStatusCode.OK, (await UnlockAsync(client, Pin)).StatusCode);
    }

    [Fact]
    public async Task An_account_steps_up_with_a_code_by_email_instead_of_the_password()
    {
        var email = Accounts.NewEmail();
        var client = factory.CreateClient();
        await Accounts.SignUpAsync(factory, client, "Bố", email);
        await AgeAttemptsAsync(email);

        var started = await client.PostAsync(Url("/api/session/step-up/code"), null, Ct);
        Assert.Equal(HttpStatusCode.Accepted, started.StatusCode);
        var attempt = (await started.Content.ReadFromJsonAsync<AttemptView>(Ct))!.AttemptId;
        var code = await factory.CodeSentToAsync(email);

        // Only this account can use it.
        var stranger = factory.CreateClient();
        await Accounts.SignUpAsync(factory, stranger, "Người lạ");
        Assert.Equal("attempt_closed", await CodeOfAsync(await ConfirmAsync(stranger, attempt, code)));

        var confirmed = await ConfirmAsync(client, attempt, code);
        var me = (await confirmed.Content.ReadFromJsonAsync<MeView>(Ct))!;
        Assert.NotNull(me.SecureUntil);
        Assert.Equal(HttpStatusCode.OK, (await SetPinAsync(client, Pin)).StatusCode);
    }

    [Fact]
    public async Task Choosing_who_plays_closes_both_levels()
    {
        var client = factory.CreateClient();
        var me = await Accounts.SignUpAsync(factory, client, "Bố");
        await Accounts.StepUpAsync(client);

        var playing = await client.PutAsJsonAsync(Url("/api/session/profile"), new { profileId = me.Profiles[0].Id }, Ct);

        var after = (await playing.Content.ReadFromJsonAsync<MeView>(Ct))!;
        Assert.Equal(((DateTimeOffset?)null, (DateTimeOffset?)null), (after.ParentUnlockedUntil, after.SecureUntil));
    }

    [Fact]
    public async Task A_new_password_needs_level_two_and_ends_every_other_session()
    {
        await using var strict = factory.WithWebHostBuilder(builder => builder.UseSetting("Identity:SessionCheckInterval", "00:00:00"));
        var email = Accounts.NewEmail();
        var phone = strict.CreateClient();
        await Accounts.SignUpAsync(factory, phone, "Bố", email);
        var laptop = strict.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await laptop.PostAsJsonAsync(Url("/api/auth/login"), new { email, password = Accounts.Password }, Ct)).StatusCode);

        Assert.Equal("step_up_required", await CodeOfAsync(await SetPasswordAsync(laptop, "mat-khau-moi-cua-bo")));
        await Accounts.StepUpAsync(laptop);
        Assert.Contains("password_too_short", (await ErrorsAsync(await SetPasswordAsync(laptop, "ngan")))["password"]);
        Assert.Equal(HttpStatusCode.OK, (await SetPasswordAsync(laptop, "mat-khau-moi-cua-bo")).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await laptop.GetAsync(Url("/api/auth/me"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await phone.GetAsync(Url("/api/auth/me"), Ct)).StatusCode);
        Assert.Contains("Mật khẩu đã đổi", await factory.MailSentToAsync(email), StringComparison.Ordinal);
        var signIn = await factory.CreateClient().PostAsJsonAsync(Url("/api/auth/login"), new { email, password = "mat-khau-moi-cua-bo" }, Ct);
        Assert.Equal(HttpStatusCode.OK, signIn.StatusCode);
    }

    [Fact]
    public async Task Signing_up_records_the_terms_and_newer_ones_are_accepted_again()
    {
        var client = factory.CreateClient();
        var me = await Accounts.SignUpAsync(factory, client, "Bố");
        Assert.Equal(Accounts.TermsVersion, me.Account.TermsVersion);

        Assert.Contains("terms_required", (await ErrorsAsync(await AcceptAsync(client, "phiên bản mới")))["version"]);
        var accepted = await AcceptAsync(client, "2027-01-01");
        Assert.Equal("2027-01-01", (await accepted.Content.ReadFromJsonAsync<MeView>(Ct))!.Account.TermsVersion);
    }

    // ------------------------------------------------------------------ helpers

    private static Task<HttpResponseMessage> UnlockAsync(HttpClient client, string pin) =>
        client.PostAsJsonAsync(Url("/api/session/parent-gate"), new { pin }, Ct);

    private static Task<HttpResponseMessage> SetPinAsync(HttpClient client, string pin) =>
        client.PutAsJsonAsync(Url("/api/account/manage-pin"), new { pin }, Ct);

    private static Task<HttpResponseMessage> SetPasswordAsync(HttpClient client, string password) =>
        client.PutAsJsonAsync(Url("/api/account/password"), new { password }, Ct);

    private static Task<HttpResponseMessage> AcceptAsync(HttpClient client, string version) =>
        client.PostAsJsonAsync(Url("/api/account/terms"), new { version }, Ct);

    private static Task<HttpResponseMessage> ConfirmAsync(HttpClient client, Guid attempt, string code) =>
        client.PostAsJsonAsync(Url("/api/session/step-up/confirm"), new { attemptId = attempt, code }, Ct);

    private static object NewChild(string name) => new { name, avatar = ProfileOptions.Avatars[1], ageBand = "6-8" };

    /// <summary>Moves the address's attempts two minutes back, past the minute between codes.</summary>
    private Task AgeAttemptsAsync(string email) => WithDbAsync(db => db.AuthAttempts
        .Where(a => a.NormalizedEmail == email.ToUpperInvariant())
        .ExecuteUpdateAsync(s => s.SetProperty(a => a.CreatedAt, DateTimeOffset.UtcNow.AddMinutes(-2)), Ct));

    private async Task<T> WithDbAsync<T>(Func<ToheDbContext, Task<T>> work)
    {
        using var scope = factory.Services.CreateScope();
        return await work(scope.ServiceProvider.GetRequiredService<ToheDbContext>());
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
