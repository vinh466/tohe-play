using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Platform;

namespace Tohe.Api.Tests;

/// <summary>
/// Email identifies an account (ADR 0024): verified before it is created, codes bound to the attempt they were sent
/// for, and nothing that tells anyone whose address has an account.
/// </summary>
public sealed class EmailSignInTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string Password = Accounts.Password;
    private const string NewPassword = "mat-khau-moi-cua-bo";

    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    [Fact]
    public async Task The_account_exists_only_once_the_code_comes_back()
    {
        var client = factory.CreateClient();
        var email = Accounts.NewEmail();
        var attempt = await Accounts.StartSignUpAsync(client, email, "Cá Heo Nhanh");
        Assert.False(await HasAccountAsync(email));
        var code = await factory.CodeSentToAsync(email);

        var wrong = await ConfirmSignUpAsync(client, attempt, Other(code));
        Assert.Equal(("code_invalid", 4), await CodeAndTriesAsync(wrong));
        Assert.False(await HasAccountAsync(email));

        // As the email shows it, with a space in the middle.
        var right = await ConfirmSignUpAsync(client, attempt, $"{code[..3]} {code[3..]}");
        Assert.Equal(HttpStatusCode.OK, right.StatusCode);
        var me = (await right.Content.ReadFromJsonAsync<MeView>(Ct))!;
        Assert.Equal((email, (string?)null), (me.Account.Email, me.Account.Username));
        var profile = Assert.Single(me.Profiles);
        Assert.Equal(("Cá Heo Nhanh", profile.Id), (profile.Name, me.ActiveProfileId));

        var again = await ConfirmSignUpAsync(factory.CreateClient(), attempt, code);
        Assert.Equal("attempt_closed", await CodeOfAsync(again));
    }

    [Fact]
    public async Task A_code_opens_only_the_attempt_it_was_sent_for()
    {
        // Someone else started signing up with the same address first: the owner's code does not open their attempt.
        var email = Accounts.NewEmail();
        var stranger = factory.CreateClient();
        var theirs = await Accounts.StartSignUpAsync(stranger, email, "Kẻ lạ");
        await AgeAttemptsAsync(email);
        var owner = factory.CreateClient();
        var mine = await Accounts.StartSignUpAsync(owner, email, "Chủ thật");
        var code = await factory.CodeSentToAsync(email);

        Assert.Equal("code_invalid", await CodeOfAsync(await ConfirmSignUpAsync(stranger, theirs, code)));
        var made = await ConfirmSignUpAsync(owner, mine, code);
        Assert.Equal("Chủ thật", (await made.Content.ReadFromJsonAsync<MeView>(Ct))!.Profiles[0].Name);
    }

    [Fact]
    public async Task Five_wrong_codes_close_the_attempt_for_good()
    {
        var client = factory.CreateClient();
        var email = Accounts.NewEmail();
        var attempt = await Accounts.StartSignUpAsync(client, email);
        var code = await factory.CodeSentToAsync(email);

        for (var left = 4; left >= 1; left--)
        {
            Assert.Equal(("code_invalid", left), await CodeAndTriesAsync(await ConfirmSignUpAsync(client, attempt, Other(code))));
        }

        Assert.Equal("attempt_closed", await CodeOfAsync(await ConfirmSignUpAsync(client, attempt, Other(code))));
        Assert.Equal("attempt_closed", await CodeOfAsync(await ConfirmSignUpAsync(client, attempt, code)));
        Assert.False(await HasAccountAsync(email));
    }

    [Fact]
    public async Task A_code_lasts_fifteen_minutes()
    {
        var client = factory.CreateClient();
        var email = Accounts.NewEmail();
        var attempt = await Accounts.StartSignUpAsync(client, email);
        var code = await factory.CodeSentToAsync(email);
        await WithDbAsync(db => db.AuthAttempts.Where(a => a.Id == attempt)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.ExpiresAt, DateTimeOffset.UtcNow.AddSeconds(-1)), Ct));

        Assert.Equal("attempt_closed", await CodeOfAsync(await ConfirmSignUpAsync(client, attempt, code)));
    }

    [Fact]
    public async Task A_code_typed_twice_at_once_makes_one_account()
    {
        var email = Accounts.NewEmail();
        var attempt = await Accounts.StartSignUpAsync(factory.CreateClient(), email);
        var code = await factory.CodeSentToAsync(email);

        var answers = await Task.WhenAll(Enumerable.Range(0, 4)
            .Select(_ => ConfirmSignUpAsync(factory.CreateClient(), attempt, code)));

        Assert.Single(answers, answer => answer.StatusCode == HttpStatusCode.OK);
        Assert.True(await HasAccountAsync(email));
    }

    [Fact]
    public async Task Signing_up_with_an_address_that_has_an_account_looks_the_same_and_sends_the_way_back_in()
    {
        var email = Accounts.NewEmail();
        await Accounts.SignUpAsync(factory, factory.CreateClient(), "Bố", email);
        await AgeAttemptsAsync(email);

        var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync(
            Url("/api/auth/register"),
            new { email = email.ToUpperInvariant(), password = "mat-khau-cua-ke-la", displayName = "Kẻ lạ" },
            Ct);

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var mail = await factory.MailSentToAsync(email);
        Assert.Contains("đã có tài khoản", mail, StringComparison.Ordinal);
        Assert.DoesNotMatch(@"\b\d{3} \d{3}\b", mail);
        Assert.Equal("code_invalid", await CodeOfAsync(await ConfirmSignUpAsync(client, await AttemptOfAsync(response), "000000")));
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(email, Password)).StatusCode);
    }

    [Fact]
    public async Task One_address_gets_a_code_a_minute_and_five_an_hour()
    {
        var client = factory.CreateClient();
        var email = Accounts.NewEmail();
        await Accounts.StartSignUpAsync(client, email);
        var soon = await StartAgainAsync(client, email);
        Assert.Equal((HttpStatusCode.TooManyRequests, "code_cooldown"), (soon.StatusCode, await CodeOfAsync(soon)));

        for (var code = 2; code <= 5; code++)
        {
            await AgeAttemptsAsync(email);
            await Accounts.StartSignUpAsync(client, email);
        }

        await AgeAttemptsAsync(email);
        Assert.Equal("too_many_codes", await CodeOfAsync(await StartAgainAsync(client, email)));
        var forgot = await client.PostAsJsonAsync(Url("/api/auth/password/forgot"), new { email }, Ct);
        Assert.Equal("too_many_codes", await CodeOfAsync(forgot));
    }

    [Fact]
    public async Task An_account_from_before_email_signs_in_with_its_username_until_it_adds_an_email()
    {
        var username = $"bo{Guid.NewGuid():N}"[..12];
        await LegacyAccountAsync(username);
        var client = factory.CreateClient();

        var signedIn = await client.PostAsJsonAsync(Url("/api/auth/login"), new { email = username.ToUpperInvariant(), password = Password }, Ct);
        var me = (await signedIn.Content.ReadFromJsonAsync<MeView>(Ct))!;
        Assert.Equal(((string?)null, username), (me.Account.Email, me.Account.Username));

        // Right after signing in, the password it just typed proves the owner: no parent gate needed.
        var email = Accounts.NewEmail();
        var started = await client.PostAsJsonAsync(Url("/api/account/email"), new { email, password = Password }, Ct);
        var confirmed = await ConfirmEmailAsync(client, await AttemptOfAsync(started), await factory.CodeSentToAsync(email));
        var after = (await confirmed.Content.ReadFromJsonAsync<MeView>(Ct))!;
        Assert.Equal((email, (string?)null), (after.Account.Email, after.Account.Username));

        Assert.Equal("invalid_credentials", await CodeOfAsync(await LoginAsync(username, Password)));
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(email, Password)).StatusCode);
    }

    [Fact]
    public async Task A_forgotten_password_is_reset_with_a_code_and_every_other_session_ends()
    {
        await using var strict = factory.WithWebHostBuilder(builder => builder.UseSetting("Identity:SessionCheckInterval", "00:00:00"));
        var email = Accounts.NewEmail();
        var phone = strict.CreateClient();
        await Accounts.SignUpAsync(factory, phone, "Bố", email);
        await AgeAttemptsAsync(email);

        var laptop = strict.CreateClient();
        var forgot = await laptop.PostAsJsonAsync(Url("/api/auth/password/forgot"), new { email }, Ct);
        var attempt = await AttemptOfAsync(forgot);
        var code = await factory.CodeSentToAsync(email);

        // A weak password costs no try.
        var weak = await laptop.PostAsJsonAsync(Url("/api/auth/password/reset"), new { attemptId = attempt, code, password = "ngan" }, Ct);
        Assert.Contains("password_too_short", (await ErrorsAsync(weak))["password"]);
        var reset = await laptop.PostAsJsonAsync(Url("/api/auth/password/reset"), new { attemptId = attempt, code, password = NewPassword }, Ct);
        Assert.Equal(HttpStatusCode.OK, reset.StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await laptop.GetAsync(Url("/api/auth/me"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await phone.GetAsync(Url("/api/auth/me"), Ct)).StatusCode);
        Assert.Contains("Mật khẩu đã đổi", await factory.MailSentToAsync(email), StringComparison.Ordinal);
        Assert.Equal("invalid_credentials", await CodeOfAsync(await LoginAsync(email, Password)));
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(email, NewPassword)).StatusCode);
    }

    [Fact]
    public async Task A_forgotten_password_for_an_unknown_address_answers_the_same_and_sends_nothing()
    {
        var email = Accounts.NewEmail();

        var forgot = await factory.CreateClient().PostAsJsonAsync(Url("/api/auth/password/forgot"), new { email }, Ct);

        Assert.Equal(HttpStatusCode.Accepted, forgot.StatusCode);
        Assert.False(await WithDbAsync(db => db.EmailOutbox.AnyAsync(e => e.To == email, Ct)));
        var reset = await factory.CreateClient().PostAsJsonAsync(
            Url("/api/auth/password/reset"),
            new { attemptId = await AttemptOfAsync(forgot), code = "123456", password = NewPassword },
            Ct);
        Assert.Equal("code_invalid", await CodeOfAsync(reset));
    }

    [Fact]
    public async Task Moving_the_account_to_another_address_needs_the_password_and_a_code_sent_there()
    {
        var old = Accounts.NewEmail();
        var client = factory.CreateClient();
        await Accounts.SignUpAsync(factory, client, "Bố", old);
        var email = Accounts.NewEmail();

        var noProof = await client.PostAsJsonAsync(Url("/api/account/email"), new { email }, Ct);
        Assert.Equal("parent_gate_required", await CodeOfAsync(noProof));
        var wrongProof = await client.PostAsJsonAsync(Url("/api/account/email"), new { email, password = "sai-mat-khau" }, Ct);
        Assert.Equal("password_invalid", await CodeOfAsync(wrongProof));
        await client.PostAsJsonAsync(Url("/api/session/parent-gate"), new { password = Password }, Ct);
        var same = await client.PostAsJsonAsync(Url("/api/account/email"), new { email = old.ToUpperInvariant() }, Ct);
        Assert.Contains("email_unchanged", (await ErrorsAsync(same))["email"]);

        var started = await client.PostAsJsonAsync(Url("/api/account/email"), new { email }, Ct);
        var attempt = await AttemptOfAsync(started);
        var code = await factory.CodeSentToAsync(email);

        // Only the account that asked can use it.
        var stranger = factory.CreateClient();
        await Accounts.SignUpAsync(factory, stranger, "Người lạ");
        Assert.Equal("attempt_closed", await CodeOfAsync(await ConfirmEmailAsync(stranger, attempt, code)));

        var confirmed = await ConfirmEmailAsync(client, attempt, code);
        Assert.Equal(email, (await confirmed.Content.ReadFromJsonAsync<MeView>(Ct))!.Account.Email);

        // The old address hears about it, without learning the new one in full.
        var notice = await factory.MailSentToAsync(old);
        Assert.Contains("đã đổi", notice, StringComparison.Ordinal);
        Assert.DoesNotContain(email, notice, StringComparison.Ordinal);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(email, Password)).StatusCode);
        Assert.Equal("invalid_credentials", await CodeOfAsync(await LoginAsync(old, Password)));
    }

    [Fact]
    public async Task Moving_to_an_address_another_account_has_changes_nothing()
    {
        var taken = Accounts.NewEmail();
        await Accounts.SignUpAsync(factory, factory.CreateClient(), "Người khác", taken);
        await AgeAttemptsAsync(taken);
        var client = factory.CreateClient();
        var me = await Accounts.SignUpAsync(factory, client, "Bố");

        var started = await client.PostAsJsonAsync(Url("/api/account/email"), new { email = taken, password = Password }, Ct);

        Assert.Equal(HttpStatusCode.Accepted, started.StatusCode);
        Assert.Contains("đã có tài khoản", await factory.MailSentToAsync(taken), StringComparison.Ordinal);
        Assert.Equal("code_invalid", await CodeOfAsync(await ConfirmEmailAsync(client, await AttemptOfAsync(started), "000000")));
        Assert.Equal(me.Account.Email, (await client.GetFromJsonAsync<MeView>(Url("/api/auth/me"), Ct))!.Account.Email);
    }

    [Fact]
    public async Task Resetting_the_password_cancels_a_pending_email_change()
    {
        var email = Accounts.NewEmail();
        var client = factory.CreateClient();
        await Accounts.SignUpAsync(factory, client, "Bố", email);
        var target = Accounts.NewEmail();
        var change = await AttemptOfAsync(await client.PostAsJsonAsync(Url("/api/account/email"), new { email = target, password = Password }, Ct));
        var changeCode = await factory.CodeSentToAsync(target);

        await AgeAttemptsAsync(email);
        var forgot = await factory.CreateClient().PostAsJsonAsync(Url("/api/auth/password/forgot"), new { email }, Ct);
        var reset = await factory.CreateClient().PostAsJsonAsync(
            Url("/api/auth/password/reset"),
            new { attemptId = await AttemptOfAsync(forgot), code = await factory.CodeSentToAsync(email), password = NewPassword },
            Ct);
        Assert.Equal(HttpStatusCode.OK, reset.StatusCode);

        Assert.Equal("attempt_closed", await CodeOfAsync(await ConfirmEmailAsync(client, change, changeCode)));
    }

    [Fact]
    public async Task Without_email_nothing_that_needs_a_code_starts()
    {
        await using var silent = factory.WithWebHostBuilder(builder => builder.UseSetting("Email:Mode", "Disabled"));
        var client = silent.CreateClient();

        Assert.False((await client.GetFromJsonAsync<ClientConfig>(Url("/api/config"), Ct))!.Email);
        var register = await client.PostAsJsonAsync(
            Url("/api/auth/register"), new { email = Accounts.NewEmail(), password = Password, displayName = "Bố" }, Ct);
        Assert.Equal((HttpStatusCode.ServiceUnavailable, "email_unavailable"), (register.StatusCode, await CodeOfAsync(register)));
        var forgot = await client.PostAsJsonAsync(Url("/api/auth/password/forgot"), new { email = Accounts.NewEmail() }, Ct);
        Assert.Equal("email_unavailable", await CodeOfAsync(forgot));
    }

    [Fact]
    public async Task A_code_comes_with_a_link_to_the_hub_page_that_takes_it()
    {
        await using var hub = factory.WithWebHostBuilder(builder => builder.UseSetting("App:PublicUrl", "https://tohe.example.test"));
        var email = Accounts.NewEmail();

        var attempt = await Accounts.StartSignUpAsync(hub.CreateClient(), email);

        var code = await factory.CodeSentToAsync(email);
        Assert.Contains(
            $"https://tohe.example.test/register/confirm?attempt={attempt}&code={code}",
            await factory.MailSentToAsync(email),
            StringComparison.Ordinal);
    }

    // ------------------------------------------------------------------ helpers

    private static Task<HttpResponseMessage> ConfirmSignUpAsync(HttpClient client, Guid attempt, string code) =>
        client.PostAsJsonAsync(Url("/api/auth/register/confirm"), new { attemptId = attempt, code }, Ct);

    private static Task<HttpResponseMessage> ConfirmEmailAsync(HttpClient client, Guid attempt, string code) =>
        client.PostAsJsonAsync(Url("/api/account/email/confirm"), new { attemptId = attempt, code }, Ct);

    private static Task<HttpResponseMessage> StartAgainAsync(HttpClient client, string email) =>
        client.PostAsJsonAsync(Url("/api/auth/register"), new { email, password = Password, displayName = "Bố" }, Ct);

    private Task<HttpResponseMessage> LoginAsync(string email, string password) =>
        factory.CreateClient().PostAsJsonAsync(Url("/api/auth/login"), new { email, password }, Ct);

    /// <summary>A code that is not <paramref name="code"/>.</summary>
    private static string Other(string code) =>
        ((int.Parse(code, CultureInfo.InvariantCulture) + 1) % 1_000_000).ToString("D6", CultureInfo.InvariantCulture);

    /// <summary>Moves the address's attempts two minutes back, past the minute between codes.</summary>
    private Task AgeAttemptsAsync(string email) => WithDbAsync(db => db.AuthAttempts
        .Where(a => a.NormalizedEmail == email.ToUpperInvariant())
        .ExecuteUpdateAsync(s => s.SetProperty(a => a.CreatedAt, DateTimeOffset.UtcNow.AddMinutes(-2)), Ct));

    private Task<bool> HasAccountAsync(string email) =>
        WithDbAsync(db => db.Users.AnyAsync(a => a.NormalizedEmail == email.ToUpperInvariant(), Ct));

    /// <summary>An account as they were before email sign-in: a username, a password, one profile.</summary>
    private async Task LegacyAccountAsync(string username)
    {
        using var scope = factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<Account>>();
        var account = new Account { Id = Guid.CreateVersion7(), UserName = username, DisplayName = "Bố cũ", CreatedAt = DateTimeOffset.UtcNow };
        Assert.True((await users.CreateAsync(account, Password)).Succeeded);
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        db.Profiles.Add(new Profile
        {
            Id = Guid.CreateVersion7(),
            AccountId = account.Id,
            PublicId = ProfileIds.New(),
            Name = "Bố cũ",
            Avatar = ProfileOptions.Avatars[0],
            Kind = ProfileKind.Adult,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync(Ct);
    }

    private async Task<T> WithDbAsync<T>(Func<ToheDbContext, Task<T>> work)
    {
        using var scope = factory.Services.CreateScope();
        return await work(scope.ServiceProvider.GetRequiredService<ToheDbContext>());
    }

    private static async Task<Guid> AttemptOfAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<AttemptView>(Ct))!.AttemptId;
    }

    private static async Task<string?> CodeOfAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    private static async Task<(string? Code, int TriesLeft)> CodeAndTriesAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return (json.RootElement.GetProperty("code").GetString(), json.RootElement.GetProperty("triesLeft").GetInt32());
    }

    private static async Task<Dictionary<string, string[]>> ErrorsAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.GetProperty("errors").Deserialize<Dictionary<string, string[]>>()!;
    }

    private static Uri Url(string path) => new(path, UriKind.Relative);
}
