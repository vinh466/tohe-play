using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Registry;

namespace Tohe.Api.Tests;

public sealed class IdentityTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string Password = "mat-khau-cua-bo";
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    [Fact]
    public async Task Register_creates_an_account_with_its_first_profile_and_signs_in()
    {
        var (client, me) = await RegisterAsync("Bố Vinh 🦊");

        var profile = Assert.Single(me.Profiles);
        Assert.Equal(("adult", "Bố Vinh 🦊"), (profile.Kind, profile.Name));
        Assert.True(ProfileIds.TryNormalize(profile.PublicId, out _), profile.PublicId);
        Assert.True(me.Account.Telemetry);
        Assert.Equal(profile.Id, me.ActiveProfileId); // nobody else to choose: it plays at once
        Assert.Null(me.ParentUnlockedUntil);

        var again = await client.GetFromJsonAsync<MeView>(Url("/api/auth/me"), Ct);
        Assert.Equal(me.Account.Id, again!.Account.Id);
    }

    [Fact]
    public async Task Login_accepts_the_right_password_only_and_logout_ends_the_session()
    {
        var (_, me) = await RegisterAsync("Mẹ");
        var client = factory.CreateClient();

        var wrong = await client.PostAsJsonAsync(Url("/api/auth/login"), new { email = me.Account.Email, password = "sai-mat-khau" }, Ct);
        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);
        Assert.Equal("invalid_credentials", await CodeAsync(wrong));

        var right = await client.PostAsJsonAsync(Url("/api/auth/login"), new { email = me.Account.Email!.ToUpperInvariant(), password = Password }, Ct);
        Assert.Equal(HttpStatusCode.OK, right.StatusCode);
        Assert.Equal(me.Profiles[0].Id, (await right.Content.ReadFromJsonAsync<MeView>(Ct))!.ActiveProfileId);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(Url("/api/auth/me"), Ct)).StatusCode);

        await client.PostAsync(Url("/api/auth/logout"), null, Ct);
        Assert.Equal(HttpStatusCode.NoContent, (await client.GetAsync(Url("/api/auth/me"), Ct)).StatusCode);
    }

    [Fact]
    public async Task Signing_in_plays_the_only_profile_at_once_but_asks_when_there_is_a_choice()
    {
        var (owner, me) = await RegisterAsync("Bố");
        await UnlockAsync(owner);
        var credentials = new { email = me.Account.Email, password = Password };
        async Task<Guid?> SignInAsync() =>
            (await (await factory.CreateClient().PostAsJsonAsync(Url("/api/auth/login"), credentials, Ct))
                .Content.ReadFromJsonAsync<MeView>(Ct))!.ActiveProfileId;

        // Its PIN has to be typed by someone.
        var locked = await owner.PatchAsJsonAsync(Url($"/api/profiles/{me.Profiles[0].Id}"), new { pin = "1234" }, Ct);
        Assert.Equal(HttpStatusCode.OK, locked.StatusCode);
        Assert.Null(await SignInAsync());

        // Two profiles: someone has to choose.
        await owner.PatchAsJsonAsync(Url($"/api/profiles/{me.Profiles[0].Id}"), new { removePin = true }, Ct);
        await AddChildAsync(owner, "Na");
        Assert.Null(await SignInAsync());
    }

    [Theory]
    [InlineData("khong-phai-email", "mat-khau-cua-bo", "Bố", "email", "email_invalid")]
    [InlineData("Bố <bo@tohe.test>", "mat-khau-cua-bo", "Bố", "email", "email_invalid")]
    [InlineData("bo@localhost", "mat-khau-cua-bo", "Bố", "email", "email_invalid")]
    [InlineData("{0}", "ngan", "Bố", "password", "password_too_short")]
    [InlineData("{0}", "mat-khau-cua-bo", "   ", "displayName", "name_required")]
    [InlineData("{0}", "mat-khau-cua-bo", "Bố", "acceptTerms", "terms_required")] // 16 or older, and the terms
    public async Task Invalid_input_is_rejected_before_anything_is_sent(
        string email, string password, string displayName, string field, string error)
    {
        var address = string.Format(System.Globalization.CultureInfo.InvariantCulture, email, Accounts.NewEmail());

        var response = await factory.CreateClient().PostAsJsonAsync(
            Url("/api/auth/register"),
            new { email = address, password, displayName },
            Ct);

        Assert.Contains(error, (await ErrorsAsync(response))[field]);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        Assert.False(await db.EmailOutbox.AnyAsync(e => e.To == address, Ct));
    }

    [Fact]
    public async Task Managing_profiles_needs_the_parent_gate()
    {
        var (client, _) = await RegisterAsync("Bố");

        var locked = await client.PostAsJsonAsync(Url("/api/profiles"), NewChild("Na"), Ct);
        Assert.Equal(HttpStatusCode.Forbidden, locked.StatusCode);
        Assert.Equal("parent_gate_required", await CodeAsync(locked));

        var noPin = await client.PostAsJsonAsync(Url("/api/session/parent-gate"), new { pin = "123456" }, Ct);
        Assert.Equal("manage_pin_not_set", await CodeAsync(noPin));
        var wrong = await client.PostAsJsonAsync(Url("/api/session/step-up"), new { password = "khong-dung" }, Ct);
        Assert.Equal("password_invalid", await CodeAsync(wrong));

        var unlocked = await UnlockAsync(client);
        Assert.NotNull(unlocked.ParentUnlockedUntil);

        var created = await client.PostAsJsonAsync(Url("/api/profiles"), NewChild("Na", pin: "1234"), Ct);
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        var child = Assert.Single((await created.Content.ReadFromJsonAsync<MeView>(Ct))!.Profiles, p => p.Kind == "child");
        Assert.Equal(("Na", "3-5", true), (child.Name, child.AgeBand, child.HasPin));
    }

    [Fact]
    public async Task A_child_profile_with_a_pin_needs_the_right_pin_and_choosing_it_locks_management()
    {
        var (client, _) = await RegisterAsync("Bố");
        await UnlockAsync(client);
        var child = await AddChildAsync(client, "Bin", pin: "2468");

        var noPin = await client.PutAsJsonAsync(Url("/api/session/profile"), new { profileId = child.Id }, Ct);
        Assert.Equal("pin_required", await CodeAsync(noPin));
        var wrongPin = await client.PutAsJsonAsync(Url("/api/session/profile"), new { profileId = child.Id, pin = "0000" }, Ct);
        Assert.Equal("pin_invalid", await CodeAsync(wrongPin));

        var chosen = await client.PutAsJsonAsync(Url("/api/session/profile"), new { profileId = child.Id, pin = "2468" }, Ct);
        var me = (await chosen.Content.ReadFromJsonAsync<MeView>(Ct))!;
        Assert.Equal(child.Id, me.ActiveProfileId);
        Assert.Null(me.ParentUnlockedUntil);

        var afterwards = await client.PostAsJsonAsync(Url("/api/profiles"), NewChild("Mít"), Ct);
        Assert.Equal(HttpStatusCode.Forbidden, afterwards.StatusCode);
    }

    [Fact]
    public async Task An_account_sees_and_manages_only_its_own_profiles()
    {
        var (bo, meBo) = await RegisterAsync("Bố");
        await UnlockAsync(bo);
        var na = await AddChildAsync(bo, "Na");
        var (me, meMe) = await RegisterAsync("Mẹ");
        await UnlockAsync(me);

        Assert.DoesNotContain(meMe.Profiles, p => p.Id == na.Id || p.Id == meBo.Profiles[0].Id);
        var edit = await me.PatchAsJsonAsync(Url($"/api/profiles/{na.Id}"), new { name = "Hack" }, Ct);
        Assert.Equal(HttpStatusCode.NotFound, edit.StatusCode);
        var delete = await me.DeleteAsync(Url($"/api/profiles/{meBo.Profiles[0].Id}"), Ct);
        Assert.Equal(HttpStatusCode.NotFound, delete.StatusCode);
        var play = await me.PutAsJsonAsync(Url("/api/session/profile"), new { profileId = na.Id }, Ct);
        Assert.Equal(HttpStatusCode.NotFound, play.StatusCode);
    }

    [Fact]
    public async Task An_account_owns_at_most_five_profiles_and_adults_can_be_added_too()
    {
        var (client, _) = await RegisterAsync("Bố");
        await UnlockAsync(client);
        var adult = await client.PostAsJsonAsync(Url("/api/profiles"), new { name = "Mẹ", avatar = ProfileOptions.Avatars[2] }, Ct);
        var mum = Assert.Single((await adult.Content.ReadFromJsonAsync<MeView>(Ct))!.Profiles, p => p.Name == "Mẹ");
        Assert.Equal(("adult", (string?)null, true), (mum.Kind, mum.AgeBand, mum.PlayWithOthers));
        await AddChildAsync(client, "Na");
        await AddChildAsync(client, "Bin");

        var fifth = await client.PostAsJsonAsync(Url("/api/profiles"), NewChild("Mít"), Ct);
        var me = (await fifth.Content.ReadFromJsonAsync<MeView>(Ct))!;
        Assert.Equal(5, me.Profiles.Count);
        Assert.Equal(5, me.Profiles.Select(p => p.PublicId).Distinct().Count());

        var sixth = await client.PostAsJsonAsync(Url("/api/profiles"), NewChild("Bơ"), Ct);
        Assert.Contains("too_many_profiles", (await ErrorsAsync(sixth))[""]);

        // The hub learns the limit instead of knowing it.
        var options = await client.GetFromJsonAsync<ProfileOptionsView>(Url("/api/profiles/options"), Ct);
        Assert.Equal(5, options!.MaxProfiles);
    }

    [Fact]
    public async Task Requests_at_the_same_time_cannot_pass_the_limits_together()
    {
        var (client, _) = await RegisterAsync("Bố");
        await UnlockAsync(client);

        var creates = await Task.WhenAll(Enumerable.Range(0, 8)
            .Select(i => client.PostAsJsonAsync(Url("/api/profiles"), NewChild($"Bé {i}"), Ct)));
        Assert.Equal(4, creates.Count(response => response.StatusCode == HttpStatusCode.OK));
        var me = (await client.GetFromJsonAsync<MeView>(Url("/api/auth/me"), Ct))!;
        Assert.Equal(5, me.Profiles.Count);

        // Every profile at once, and the first one twice: one stays, and nothing fails on the way.
        var deletes = await Task.WhenAll(me.Profiles.Append(me.Profiles[0])
            .Select(profile => client.DeleteAsync(Url($"/api/profiles/{profile.Id}"), Ct)));
        Assert.All(deletes, response => Assert.True((int)response.StatusCode < 500, response.StatusCode.ToString()));
        Assert.Equal(4, deletes.Count(response => response.StatusCode == HttpStatusCode.OK));
        Assert.Single((await client.GetFromJsonAsync<MeView>(Url("/api/auth/me"), Ct))!.Profiles);
    }

    [Fact]
    public async Task Any_profile_can_be_removed_but_the_last_one()
    {
        var (client, me) = await RegisterAsync("Bố");
        await UnlockAsync(client);
        var child = await AddChildAsync(client, "Na");

        var first = await client.DeleteAsync(Url($"/api/profiles/{me.Profiles[0].Id}"), Ct);
        var left = Assert.Single((await first.Content.ReadFromJsonAsync<MeView>(Ct))!.Profiles);
        Assert.Equal(child.Id, left.Id);

        var last = await client.DeleteAsync(Url($"/api/profiles/{child.Id}"), Ct);
        Assert.Equal((HttpStatusCode.Conflict, "last_profile"), (last.StatusCode, await CodeAsync(last)));
    }

    [Theory]
    [InlineData("Admin", "name_reserved")]
    [InlineData("tò  HE", "name_reserved")]
    [InlineData("Na\u202Eevil", "name_invalid_character")]
    [InlineData("   ", "name_required")]
    [InlineData("1234567890123456789012345", "name_too_long")]
    public async Task Profile_names_are_free_but_not_reserved_invisible_or_endless(string name, string error)
    {
        var (client, _) = await RegisterAsync("Bố");
        await UnlockAsync(client);

        var response = await client.PostAsJsonAsync(
            Url("/api/profiles"),
            new { name = System.Text.RegularExpressions.Regex.Unescape(name), avatar = ProfileOptions.Avatars[1], ageBand = "6-8" },
            Ct);

        Assert.Contains(error, (await ErrorsAsync(response))["name"]);
    }

    [Fact]
    public async Task A_name_keeps_its_vietnamese_marks_and_emoji_and_loses_extra_spaces()
    {
        var (client, _) = await RegisterAsync("Bố");
        await UnlockAsync(client);

        var child = await AddChildAsync(client, "  Bé   Na 👧🏻  ", expectedName: "Bé Na 👧🏻");

        Assert.Equal("Bé Na 👧🏻", child.Name);
    }

    [Fact]
    public async Task A_young_child_only_sees_games_for_their_age()
    {
        factory.Catalog.Json = """
            { "generatedAt": "2026-10-13T00:00:00Z", "games": [
              { "manifest": { "id": "hello", "name": "Hello", "version": "1.0.0", "protocol": 1, "minAge": 3 }, "path": "hello/1.0.0/", "sizeKb": 1 },
              { "manifest": { "id": "chess-club", "name": "Chess", "version": "1.0.0", "protocol": 1, "minAge": 9 }, "path": "chess-club/1.0.0/", "sizeKb": 1 }
            ] }
            """;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            await scope.ServiceProvider.GetRequiredService<CatalogSync>().RunAsync(Ct);
        }

        var (client, _) = await RegisterAsync("Bố");
        Assert.Equal(["chess-club", "hello"], (await GamesAsync(client)).Order());

        await UnlockAsync(client);
        var child = await AddChildAsync(client, "Na");
        await client.PutAsJsonAsync(Url("/api/session/profile"), new { profileId = child.Id }, Ct);

        Assert.Equal(["hello"], await GamesAsync(client));
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(Url("/api/games/chess-club"), Ct)).StatusCode);
    }

    [Fact]
    public async Task Cross_site_writes_are_rejected()
    {
        var request = new HttpRequestMessage(HttpMethod.Post, Url("/api/auth/login"))
        {
            Content = JsonContent.Create(new { email = "x@tohe.test", password = "y" }),
        };
        request.Headers.Add("Sec-Fetch-Site", "same-site");

        var response = await factory.CreateClient().SendAsync(request, Ct);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("cross_origin", await CodeAsync(response));
    }

    [Fact]
    public async Task Session_cookie_is_http_only_and_lax()
    {
        var client = factory.CreateClient(new() { HandleCookies = false });
        var response = await Accounts.SignUpResponseAsync(factory, client, "Bố");

        var cookie = Assert.Single(response.Headers.GetValues("Set-Cookie"), c => c.StartsWith("tohe.session=", StringComparison.Ordinal));
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("secure", cookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task On_an_https_deployment_the_session_cookie_is_secure_and_host_locked()
    {
        // Behind the TLS-terminating edge the request reaches the API as plain HTTP (TestServer's default too):
        // App:PublicUrl is what makes it HTTPS.
        await using var https = factory.WithWebHostBuilder(builder => builder.UseSetting("App:PublicUrl", "https://tohe.example.test"));
        var client = https.CreateClient(new() { HandleCookies = false });
        var response = await Accounts.SignUpResponseAsync(factory, client, "Bố");

        var cookie = Assert.Single(response.Headers.GetValues("Set-Cookie"), c => c.StartsWith("__Host-tohe.session=", StringComparison.Ordinal));
        Assert.Contains("secure", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("domain=", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
    }

    // ------------------------------------------------------------------ helpers

    private async Task<(HttpClient Client, MeView Me)> RegisterAsync(string displayName)
    {
        var client = factory.CreateClient();
        return (client, await Accounts.SignUpAsync(factory, client, displayName));
    }

    private static async Task<MeView> UnlockAsync(HttpClient client)
    {
        return await Accounts.StepUpAsync(client);
    }

    private static async Task<ProfileView> AddChildAsync(HttpClient client, string name, string? pin = null, string? expectedName = null)
    {
        var response = await client.PostAsJsonAsync(Url("/api/profiles"), NewChild(name, pin), Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<MeView>(Ct))!.Profiles.Single(p => p.Name == (expectedName ?? name));
    }

    private static async Task<List<string>> GamesAsync(HttpClient client) =>
        [.. (await client.GetFromJsonAsync<List<GameSummary>>(Url("/api/games"), Ct))!.Select(g => g.Id)];

    private static object NewChild(string name, string? pin = null) =>
        new { name, avatar = ProfileOptions.Avatars[1], ageBand = "3-5", pin };

    private static Uri Url(string path) => new(path, UriKind.Relative);

    private static async Task<string?> CodeAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    private static async Task<Dictionary<string, string[]>> ErrorsAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.GetProperty("errors").Deserialize<Dictionary<string, string[]>>()!;
    }
}
