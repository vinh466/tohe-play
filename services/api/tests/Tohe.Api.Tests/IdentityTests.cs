using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Registry;

namespace Tohe.Api.Tests;

public sealed class IdentityTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string Password = "mat-khau-cua-bo";
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    [Fact]
    public async Task Register_creates_a_household_with_the_adults_profile_and_signs_in()
    {
        var (client, me) = await RegisterAsync("Bố Vinh");

        Assert.Equal("Nhà Bố Vinh", me.Household.Name);
        var profile = Assert.Single(me.Profiles);
        Assert.Equal(("adult", true, "Bố Vinh"), (profile.Kind, profile.IsMine, profile.Name));
        Assert.Null(me.ActiveProfileId);
        Assert.Null(me.ParentUnlockedUntil);

        var again = await client.GetFromJsonAsync<MeView>(Url("/api/auth/me"), Ct);
        Assert.Equal(me.Account.Id, again!.Account.Id);
    }

    [Fact]
    public async Task Login_accepts_the_right_password_only_and_logout_ends_the_session()
    {
        var (_, me) = await RegisterAsync("Mẹ");
        var client = factory.CreateClient();

        var wrong = await client.PostAsJsonAsync(Url("/api/auth/login"), new { username = me.Account.Username, password = "sai-mat-khau" }, Ct);
        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);
        Assert.Equal("invalid_credentials", await CodeAsync(wrong));

        var right = await client.PostAsJsonAsync(Url("/api/auth/login"), new { username = me.Account.Username.ToUpperInvariant(), password = Password }, Ct);
        Assert.Equal(HttpStatusCode.OK, right.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(Url("/api/auth/me"), Ct)).StatusCode);

        await client.PostAsync(Url("/api/auth/logout"), null, Ct);
        Assert.Equal(HttpStatusCode.NoContent, (await client.GetAsync(Url("/api/auth/me"), Ct)).StatusCode);
    }

    [Fact]
    public async Task A_taken_username_is_reported_on_the_username_field()
    {
        var (_, me) = await RegisterAsync("Bố");

        var response = await factory.CreateClient().PostAsJsonAsync(
            Url("/api/auth/register"),
            new { displayName = "Ai đó", username = me.Account.Username, password = Password },
            Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("username_taken", (await ErrorsAsync(response))["username"]);
    }

    [Fact]
    public async Task Invalid_input_is_rejected_before_anything_is_created()
    {
        var response = await factory.CreateClient().PostAsJsonAsync(
            Url("/api/auth/register"),
            new { displayName = "", username = "a b", password = "short" },
            Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = await ErrorsAsync(response);
        Assert.True(errors.ContainsKey("password") || errors.ContainsKey("Password"), string.Join(",", errors.Keys));
    }

    [Fact]
    public async Task Managing_the_household_needs_the_parent_gate()
    {
        var (client, _) = await RegisterAsync("Bố");

        var locked = await client.PostAsJsonAsync(Url("/api/household/profiles"), NewChild("Na"), Ct);
        Assert.Equal(HttpStatusCode.Forbidden, locked.StatusCode);
        Assert.Equal("parent_gate_required", await CodeAsync(locked));

        var wrong = await client.PostAsJsonAsync(Url("/api/session/parent-gate"), new { password = "khong-dung" }, Ct);
        Assert.Equal("password_invalid", await CodeAsync(wrong));

        var unlocked = await UnlockAsync(client);
        Assert.NotNull(unlocked.ParentUnlockedUntil);

        var created = await client.PostAsJsonAsync(Url("/api/household/profiles"), NewChild("Na", pin: "1234"), Ct);
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

        var afterwards = await client.PostAsJsonAsync(Url("/api/household/profiles"), NewChild("Mít"), Ct);
        Assert.Equal(HttpStatusCode.Forbidden, afterwards.StatusCode);
    }

    [Fact]
    public async Task An_invite_lets_another_adult_join_the_household()
    {
        var (parentA, _) = await RegisterAsync("Bố");
        await UnlockAsync(parentA);
        await AddChildAsync(parentA, "Na");
        var invited = await (await parentA.PostAsync(Url("/api/household/invite"), null, Ct)).Content.ReadFromJsonAsync<MeView>(Ct);
        var code = invited!.Household.Invite!.Code;

        var typed = $"{code[..4].ToLowerInvariant()}-{code[4..]}";
        var (parentB, meB) = await RegisterAsync("Mẹ", inviteCode: typed);

        Assert.Equal(invited.Household.Id, meB.Household.Id);
        Assert.Equal(2, meB.Household.Members.Count);
        Assert.Contains(meB.Profiles, p => p.Name == "Na");

        // B cannot edit A's adult profile.
        await UnlockAsync(parentB);
        var profileOfA = meB.Profiles.Single(p => p is { Kind: "adult", IsMine: false });
        var edit = await parentB.PatchAsJsonAsync(Url($"/api/household/profiles/{profileOfA.Id}"), new { name = "Hack" }, Ct);
        Assert.Equal("not_your_profile", await CodeAsync(edit));
    }

    [Fact]
    public async Task A_wrong_invite_code_is_rejected()
    {
        var response = await factory.CreateClient().PostAsJsonAsync(
            Url("/api/auth/register"),
            new { displayName = "Ai", username = NewUsername(), password = Password, inviteCode = "NOPE2345" },
            Ct);

        Assert.Contains("invite_invalid", (await ErrorsAsync(response))["inviteCode"]);
    }

    [Fact]
    public async Task Adult_profiles_cannot_be_deleted_but_child_profiles_can()
    {
        var (client, me) = await RegisterAsync("Bố");
        await UnlockAsync(client);
        var child = await AddChildAsync(client, "Na");

        var adult = await client.DeleteAsync(Url($"/api/household/profiles/{me.Profiles[0].Id}"), Ct);
        Assert.Equal("adult_profile", await CodeAsync(adult));

        var removed = await client.DeleteAsync(Url($"/api/household/profiles/{child.Id}"), Ct);
        Assert.DoesNotContain((await removed.Content.ReadFromJsonAsync<MeView>(Ct))!.Profiles, p => p.Id == child.Id);
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
            Content = JsonContent.Create(new { username = "x", password = "y" }),
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
        var response = await client.PostAsJsonAsync(
            Url("/api/auth/register"),
            new { displayName = "Bố", username = NewUsername(), password = Password },
            Ct);

        var cookie = Assert.Single(response.Headers.GetValues("Set-Cookie"), c => c.StartsWith("tohe.session=", StringComparison.Ordinal));
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", cookie, StringComparison.OrdinalIgnoreCase);
    }

    // ------------------------------------------------------------------ helpers

    private async Task<(HttpClient Client, MeView Me)> RegisterAsync(string displayName, string? inviteCode = null)
    {
        var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync(
            Url("/api/auth/register"),
            new { displayName, username = NewUsername(), password = Password, inviteCode },
            Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (client, (await response.Content.ReadFromJsonAsync<MeView>(Ct))!);
    }

    private static async Task<MeView> UnlockAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync(Url("/api/session/parent-gate"), new { password = Password }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<MeView>(Ct))!;
    }

    private static async Task<ProfileView> AddChildAsync(HttpClient client, string name, string? pin = null)
    {
        var response = await client.PostAsJsonAsync(Url("/api/household/profiles"), NewChild(name, pin), Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<MeView>(Ct))!.Profiles.Single(p => p.Name == name);
    }

    private static async Task<List<string>> GamesAsync(HttpClient client) =>
        [.. (await client.GetFromJsonAsync<List<GameSummary>>(Url("/api/games"), Ct))!.Select(g => g.Id)];

    private static object NewChild(string name, string? pin = null) =>
        new { name, avatar = ProfileOptions.Avatars[1], ageBand = "3-5", pin };

    private static string NewUsername() => $"u{Guid.NewGuid():N}"[..16];

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
