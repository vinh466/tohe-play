using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Admin;
using Tohe.Api.Modules.Agents;

namespace Tohe.Api.Tests;

/// <summary>
/// Agent tokens (ADR 0052): made once in the console by the owner, behind step-up; read again on every request, so a
/// revocation, an expiry or a disabled agent holds at once; refused where the endpoint names no scope or the token lacks
/// it; every use in the agent's audit. And the rule no scope may break: no endpoint in players' data, signing in, roles,
/// the console or agents opens itself to agents, and no scope is named in a forbidden family.
/// </summary>
public sealed class AgentTokensTests(ApiFactory factory) : IClassFixture<ApiFactory>, IAsyncDisposable
{
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    private readonly WebApplicationFactory<Program> _app = Agents.WithProbe(factory);

    public ValueTask DisposeAsync() => _app.DisposeAsync();

    [Fact]
    public async Task A_token_is_shown_once_and_only_its_hash_is_kept()
    {
        var owner = await Admins.NewAsync(factory, "owner", _app);
        var agent = await Agents.CreateAsync(owner.Client, "studio-agent trên máy trạm");
        var made = await Agents.TokenAsync(owner.Client, agent.Id);

        Assert.StartsWith(AgentTokens.Prefix, made.Token, StringComparison.Ordinal);
        Assert.Equal(AgentTokens.Prefix.Length + 43, made.Token.Length);
        Assert.Equal([AgentScopes.StudioDraft.Name], made.Details.Scopes);
        Assert.Equal(TimeSpan.FromDays(30), made.Details.ExpiresAt - made.Details.CreatedAt);
        Assert.Equal(made.Details.Id, Assert.Single(made.Agent.Tokens).Id);

        // Nowhere again: not in the list, not in the console's audit log; the database keeps its SHA-256 alone.
        var listed = await owner.Client.GetStringAsync(Url("/api/admin/agents"), Ct);
        Assert.DoesNotContain(made.Token, listed, StringComparison.Ordinal);
        Assert.Contains(made.Details.Id.ToString(), listed, StringComparison.Ordinal);
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var kept = await db.AgentTokens.SingleAsync(token => token.Id == made.Details.Id, Ct);
        Assert.Equal(AgentTokens.Hash(made.Token), kept.TokenHash);
        Assert.Equal(owner.AccountId, kept.CreatedBy);
        var log = await db.AuditLog.Where(entry => entry.Target == $"agent {agent.Name}").OrderBy(entry => entry.Id).ToListAsync(Ct);
        Assert.Equal([AuditActions.AgentCreate, AuditActions.AgentTokenCreate], log.Select(entry => entry.Action));
        Assert.All(log, entry => Assert.Equal(owner.Email, entry.Actor));
        Assert.All(log, entry => Assert.DoesNotContain(made.Token, entry.Details ?? "", StringComparison.Ordinal));
        Assert.Contains(made.Details.Id.ToString(), log[1].Details!, StringComparison.Ordinal);

        // Two tokens never share a value.
        var second = await Agents.TokenAsync(owner.Client, agent.Id, days: 90);
        Assert.NotEqual(made.Token, second.Token);
        Assert.Equal(TimeSpan.FromDays(90), second.Details.ExpiresAt - second.Details.CreatedAt);
    }

    [Fact]
    public async Task A_token_with_the_scope_reaches_its_endpoint_and_every_use_is_audited()
    {
        var owner = await Admins.NewAsync(factory, "owner", _app);
        var agent = await Agents.CreateAsync(owner.Client);
        var made = await Agents.TokenAsync(owner.Client, agent.Id);
        var client = _app.CreateClient();

        var answer = await Agents.CallAsync(client, made.Token);
        Assert.Equal(HttpStatusCode.OK, answer.StatusCode);
        var probed = (await answer.Content.ReadFromJsonAsync<Agents.ProbeAnswer>(Ct))!;
        Assert.Equal((agent.Id, made.Details.Id), (probed.AgentId, probed.TokenId));
        Assert.Equal([AgentScopes.StudioDraft.Name], probed.Scopes);

        // A refusal of the endpoint's own is a use too, with its status.
        var refused = await Agents.CallAsync(client, made.Token, Agents.ProbeRefusing, HttpMethod.Post);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, refused.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Agents.CallAsync(client, made.Token)).StatusCode);

        var audit = (await owner.Client.GetFromJsonAsync<AgentAuditPage>(Url($"/api/admin/agents/{agent.Id}/audit"), Ct))!;
        Assert.Equal(
            [("GET /api/agent-probe", 200), ("POST /api/agent-probe/refusing", 422), ("GET /api/agent-probe", 200)],
            audit.Entries.Select(entry => (entry.Action, entry.Result)));
        Assert.All(audit.Entries, entry => Assert.Equal((made.Details.Id, AgentScopes.StudioDraft.Name), (entry.TokenId, entry.Scope)));
        Assert.Null(audit.Before);

        // A page at a time, newest first.
        var first = (await owner.Client.GetFromJsonAsync<AgentAuditPage>(Url($"/api/admin/agents/{agent.Id}/audit?limit=2"), Ct))!;
        Assert.Equal(2, first.Entries.Count);
        var rest = (await owner.Client.GetFromJsonAsync<AgentAuditPage>(Url($"/api/admin/agents/{agent.Id}/audit?limit=2&before={first.Before}"), Ct))!;
        Assert.Equal(audit.Entries[2].Id, Assert.Single(rest.Entries).Id);

        // Its last use, written at most once a minute.
        var listed = (await owner.Client.GetFromJsonAsync<List<AgentView>>(Url("/api/admin/agents"), Ct))!;
        var used = listed.Single(view => view.Id == agent.Id).Tokens.Single().LastUsedAt;
        Assert.NotNull(used);
        Assert.InRange(DateTimeOffset.UtcNow - used.Value, TimeSpan.Zero, TimeSpan.FromMinutes(1));
    }

    [Fact]
    public async Task No_token_an_unknown_one_or_a_session_is_refused_and_nothing_is_audited()
    {
        var owner = await Admins.NewAsync(factory, "owner", _app);
        var client = _app.CreateClient();
        var before = await AuditCountAsync();

        var none = await client.GetAsync(Url(Agents.Probe), Ct);
        Assert.Equal((HttpStatusCode.Unauthorized, "agent_token_invalid"), (none.StatusCode, await CodeOfAsync(none)));
        var unknown = await Agents.CallAsync(client, AgentTokens.New());
        Assert.Equal((HttpStatusCode.Unauthorized, "agent_token_invalid"), (unknown.StatusCode, await CodeOfAsync(unknown)));
        var misshapen = await Agents.CallAsync(client, "tohe_at_short");
        Assert.Equal((HttpStatusCode.Unauthorized, "agent_token_invalid"), (misshapen.StatusCode, await CodeOfAsync(misshapen)));

        // A person's session is no agent: the owner signed in to the hub gets nothing here.
        var session = await owner.Player.GetAsync(Url(Agents.Probe), Ct);
        Assert.Equal(HttpStatusCode.Unauthorized, session.StatusCode);

        // No token the database knows, so no agent to write it to.
        Assert.Equal(before, await AuditCountAsync());
    }

    [Fact]
    public async Task A_token_is_never_a_session()
    {
        var owner = await Admins.NewAsync(factory, "owner", _app);
        var agent = await Agents.CreateAsync(owner.Client);
        var made = await Agents.TokenAsync(owner.Client, agent.Id);
        var client = _app.CreateClient();

        // The hub's endpoints know only sessions: a token there signs nobody in.
        Assert.Equal(HttpStatusCode.NoContent, (await Agents.CallAsync(client, made.Token, "/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Agents.CallAsync(client, made.Token, "/api/progress/saves")).StatusCode);
        // Nor on the console's.
        var console = Admins.ConsoleClient(_app);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Agents.CallAsync(console, made.Token, "/api/admin/agents")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Agents.CallAsync(console, made.Token, "/api/admin/me")).StatusCode);
    }

    [Fact]
    public async Task Revoked_expired_or_of_a_disabled_agent_a_token_is_refused_at_once_and_the_refusal_audited()
    {
        var owner = await Admins.NewAsync(factory, "owner", _app);
        var agent = await Agents.CreateAsync(owner.Client);
        var revoked = await Agents.TokenAsync(owner.Client, agent.Id);
        var expired = await Agents.TokenAsync(owner.Client, agent.Id);
        var client = _app.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await Agents.CallAsync(client, revoked.Token)).StatusCode);

        var revoking = await owner.Client.PostAsync(Url($"/api/admin/agents/{agent.Id}/tokens/{revoked.Details.Id}/revoke"), null, Ct);
        Assert.NotNull((await revoking.Content.ReadFromJsonAsync<AgentView>(Ct))!.Tokens.Single(token => token.Id == revoked.Details.Id).RevokedAt);
        var afterRevoke = await Agents.CallAsync(client, revoked.Token);
        Assert.Equal((HttpStatusCode.Unauthorized, "agent_token_invalid"), (afterRevoke.StatusCode, await CodeOfAsync(afterRevoke)));
        // Revoking again changes nothing and logs nothing.
        Assert.Equal(HttpStatusCode.OK, (await owner.Client.PostAsync(Url($"/api/admin/agents/{agent.Id}/tokens/{revoked.Details.Id}/revoke"), null, Ct)).StatusCode);

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
            await db.AgentTokens.Where(token => token.Id == expired.Details.Id)
                .ExecuteUpdateAsync(set => set.SetProperty(token => token.ExpiresAt, DateTimeOffset.UtcNow.AddSeconds(-1)), Ct);
        }

        Assert.Equal(HttpStatusCode.Unauthorized, (await Agents.CallAsync(client, expired.Token)).StatusCode);

        // Disabling the agent revokes the rest; a token whose agent was disabled is refused even unrevoked.
        var live = await Agents.TokenAsync(owner.Client, agent.Id);
        Assert.Equal(HttpStatusCode.OK, (await Agents.CallAsync(client, live.Token)).StatusCode);
        var disabled = (await (await owner.Client.PostAsync(Url($"/api/admin/agents/{agent.Id}/disable"), null, Ct)).Content.ReadFromJsonAsync<AgentView>(Ct))!;
        Assert.NotNull(disabled.DisabledAt);
        Assert.All(disabled.Tokens, token => Assert.NotNull(token.RevokedAt));
        Assert.Equal(HttpStatusCode.Unauthorized, (await Agents.CallAsync(client, live.Token)).StatusCode);
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
            await db.AgentTokens.Where(token => token.Id == live.Details.Id)
                .ExecuteUpdateAsync(set => set.SetProperty(token => token.RevokedAt, (DateTimeOffset?)null), Ct);
        }

        Assert.Equal(HttpStatusCode.Unauthorized, (await Agents.CallAsync(client, live.Token)).StatusCode);

        // A disabled agent gets no new token.
        var refused = await owner.Client.PostAsJsonAsync(Url($"/api/admin/agents/{agent.Id}/tokens"), new { scopes = new[] { AgentScopes.StudioDraft.Name } }, Ct);
        Assert.Equal((HttpStatusCode.Conflict, "agent_disabled"), (refused.StatusCode, await CodeOfAsync(refused)));

        var audit = (await owner.Client.GetFromJsonAsync<AgentAuditPage>(Url($"/api/admin/agents/{agent.Id}/audit"), Ct))!;
        Assert.Equal(
            [
                (live.Details.Id, 401), (live.Details.Id, 401), (live.Details.Id, 200),
                (expired.Details.Id, 401), (revoked.Details.Id, 401), (revoked.Details.Id, 200),
            ],
            audit.Entries.Select(entry => (entry.TokenId, entry.Result)));

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
            var actions = await db.AuditLog.Where(entry => entry.Target == $"agent {agent.Name}").OrderBy(entry => entry.Id).Select(entry => entry.Action).ToListAsync(Ct);
            Assert.Equal(
                [
                    AuditActions.AgentCreate, AuditActions.AgentTokenCreate, AuditActions.AgentTokenCreate,
                    AuditActions.AgentTokenRevoke, AuditActions.AgentTokenCreate, AuditActions.AgentDisable,
                ],
                actions);
        }
    }

    [Fact]
    public async Task A_token_without_the_scope_is_refused_and_the_refusal_audited()
    {
        var owner = await Admins.NewAsync(factory, "owner", _app);
        var agent = await Agents.CreateAsync(owner.Client);
        var made = await Agents.TokenAsync(owner.Client, agent.Id);

        // The console makes tokens only of scopes that exist, and studio.draft is the only one: this token holds a scope
        // since removed, as one made by an older build would.
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
            await db.AgentTokens.Where(token => token.Id == made.Details.Id)
                .ExecuteUpdateAsync(set => set.SetProperty(token => token.Scopes, new[] { "ops.read" }), Ct);
        }

        var response = await Agents.CallAsync(_app.CreateClient(), made.Token);
        Assert.Equal((HttpStatusCode.Forbidden, "agent_scope_missing"), (response.StatusCode, await CodeOfAsync(response)));
        var audit = (await owner.Client.GetFromJsonAsync<AgentAuditPage>(Url($"/api/admin/agents/{agent.Id}/audit"), Ct))!;
        var entry = Assert.Single(audit.Entries);
        Assert.Equal((AgentScopes.StudioDraft.Name, "GET /api/agent-probe", 403), (entry.Scope, entry.Action, entry.Result));
    }

    [Fact]
    public async Task Only_the_owner_changes_agents_admins_read_them_and_every_change_asks_for_step_up()
    {
        var owner = await Admins.NewAsync(factory, "owner", _app);
        var agent = await Agents.CreateAsync(owner.Client);
        var made = await Agents.TokenAsync(owner.Client, agent.Id);

        var admin = await Admins.NewAsync(factory, "admin", _app);
        var listed = (await admin.Client.GetFromJsonAsync<List<AgentView>>(Url("/api/admin/agents"), Ct))!;
        Assert.Contains(listed, view => view.Id == agent.Id);
        Assert.Equal(HttpStatusCode.OK, (await admin.Client.GetAsync(Url($"/api/admin/agents/{agent.Id}/audit"), Ct)).StatusCode);
        Assert.Equal(
            [AgentScopes.StudioDraft.Name],
            (await admin.Client.GetFromJsonAsync<List<AgentScope>>(Url("/api/admin/agents/scopes"), Ct))!.Select(scope => scope.Name));
        foreach (var write in new (string Path, object Body)[]
                 {
                     ("/api/admin/agents", new { name = "của admin" }),
                     ($"/api/admin/agents/{agent.Id}/disable", new { }),
                     ($"/api/admin/agents/{agent.Id}/tokens", new { scopes = new[] { AgentScopes.StudioDraft.Name } }),
                     ($"/api/admin/agents/{agent.Id}/tokens/{made.Details.Id}/revoke", new { }),
                 })
        {
            var response = await admin.Client.PostAsJsonAsync(Url(write.Path), write.Body, Ct);
            Assert.Equal((HttpStatusCode.Forbidden, "admin_required"), (response.StatusCode, await CodeOfAsync(response)));
        }

        var moderator = await Admins.NewAsync(factory, "moderator", _app);
        Assert.Equal(HttpStatusCode.Forbidden, (await moderator.Client.GetAsync(Url("/api/admin/agents"), Ct)).StatusCode);

        // The owner on another browser, step-up not open there: nothing changes.
        var laptop = await Admins.SignInAsync(_app, owner.Email, owner.Key, step: 2);
        Assert.Equal(HttpStatusCode.OK, (await laptop.GetAsync(Url("/api/admin/agents"), Ct)).StatusCode);
        foreach (var path in new[] { $"/api/admin/agents/{agent.Id}/disable", $"/api/admin/agents/{agent.Id}/tokens/{made.Details.Id}/revoke" })
        {
            Assert.Equal("step_up_required", await CodeOfAsync(await laptop.PostAsync(Url(path), null, Ct)));
        }

        Assert.Equal("step_up_required", await CodeOfAsync(await laptop.PostAsJsonAsync(Url("/api/admin/agents"), new { name = "không bước thêm" }, Ct)));
        Assert.Equal("step_up_required", await CodeOfAsync(await laptop.PostAsJsonAsync(Url($"/api/admin/agents/{agent.Id}/tokens"), new { scopes = new[] { AgentScopes.StudioDraft.Name } }, Ct)));

        var after = (await owner.Client.GetFromJsonAsync<List<AgentView>>(Url("/api/admin/agents"), Ct))!.Single(view => view.Id == agent.Id);
        Assert.Null(after.DisabledAt);
        Assert.Null(Assert.Single(after.Tokens).RevokedAt);
        Assert.Equal(HttpStatusCode.OK, (await Agents.CallAsync(_app.CreateClient(), made.Token)).StatusCode);
    }

    [Fact]
    public async Task What_the_console_is_asked_is_checked()
    {
        var owner = await Admins.NewAsync(factory, "owner", _app);
        Assert.Equal("name_required", await FieldAsync(await owner.Client.PostAsJsonAsync(Url("/api/admin/agents"), new { name = "   " }, Ct), "name"));
        Assert.Equal("name_too_long", await FieldAsync(await owner.Client.PostAsJsonAsync(Url("/api/admin/agents"), new { name = new string('a', 61) }, Ct), "name"));
        Assert.Equal("note_too_long", await FieldAsync(await owner.Client.PostAsJsonAsync(Url("/api/admin/agents"), new { name = "ghi chú dài", note = new string('a', 201) }, Ct), "note"));

        var agent = await Agents.CreateAsync(owner.Client);
        Assert.Equal("khoảng trắng", (await Agents.CreateAsync(owner.Client, "  khoảng   trắng  ")).Name);
        var twin = await owner.Client.PostAsJsonAsync(Url("/api/admin/agents"), new { name = agent.Name }, Ct);
        Assert.Equal((HttpStatusCode.Conflict, "agent_exists"), (twin.StatusCode, await CodeOfAsync(twin)));

        var tokens = $"/api/admin/agents/{agent.Id}/tokens";
        Assert.Equal("scopes_required", await FieldAsync(await owner.Client.PostAsJsonAsync(Url(tokens), new { scopes = Array.Empty<string>() }, Ct), "scopes"));
        Assert.Equal("scope_unknown", await FieldAsync(await owner.Client.PostAsJsonAsync(Url(tokens), new { scopes = new[] { "players.read" } }, Ct), "scopes"));
        foreach (var days in new[] { 0, 91, -3 })
        {
            Assert.Equal("days_invalid", await FieldAsync(await owner.Client.PostAsJsonAsync(Url(tokens), new { scopes = new[] { AgentScopes.StudioDraft.Name }, days }, Ct), "days"));
        }

        Assert.Equal(HttpStatusCode.NotFound, (await owner.Client.PostAsJsonAsync(Url($"/api/admin/agents/{Guid.NewGuid()}/tokens"), new { scopes = new[] { AgentScopes.StudioDraft.Name } }, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.Client.PostAsync(Url($"/api/admin/agents/{agent.Id}/tokens/{Guid.NewGuid()}/revoke"), null, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.Client.GetAsync(Url($"/api/admin/agents/{Guid.NewGuid()}/audit"), Ct)).StatusCode);
    }

    /// <summary>
    /// Where agents may never call (ADR 0052): the route prefixes of players' data, signing in, roles, the console and
    /// agents, as the modules map them. Each but <c>/api/agents</c> — kept free for good — must still match endpoints of
    /// the API, so a module that moves its routes moves them here too.
    /// </summary>
    private static readonly string[] ForbiddenPrefixes =
    [
        "/api/admin", // the console: roles, users, settings, and agents themselves (Admin module, ConsolePaths.Api)
        "/api/agents", // agents and their tokens: no agent manages agents
        "/api/auth", // signing in, signing up, passwords, providers (Identity)
        "/api/session", // the session's profile, step-up, the parent gate (Identity)
        "/api/account", // accounts: email, password, manage PIN, two-factor, sign-in methods, deletion (Identity, Admin)
        "/api/profiles", // profiles (Identity)
        "/api/devices", // device profiles and their transfers (Identity)
        "/api/progress", // saved games and scores (Progress)
        "/api/boards", // score boards (Integrity)
        "/api/runs", // ranked runs, scores in the making (Integrity)
        "/api/rooms", // tables and the rooms hub (Rooms)
        "/api/links", // share links (Links)
        "/api/previews", // link previews of rooms and share links (Links)
    ];

    [Fact]
    public void No_endpoint_in_a_forbidden_area_opens_itself_to_agents_and_every_scope_is_allowed()
    {
        var endpoints = Endpoints(factory);
        foreach (var prefix in ForbiddenPrefixes.Where(prefix => prefix != "/api/agents"))
        {
            Assert.True(endpoints.Any(endpoint => Under(endpoint, prefix)), $"no endpoint under {prefix}: has its module moved its routes?");
        }

        Assert.Empty(Forbidden(endpoints));
        Assert.All(
            endpoints.Select(endpoint => endpoint.Metadata.GetMetadata<AgentScopeRequired>()).OfType<AgentScopeRequired>(),
            required => Assert.Contains(required.Scope, AgentScopes.All));
        Assert.NotEmpty(AgentScopes.All);
        Assert.All(AgentScopes.All, scope => Assert.True(AgentScopes.IsAllowedName(scope.Name), scope.Name));
        Assert.Equal(AgentScopes.All.Count, AgentScopes.All.Select(scope => scope.Name).Distinct(StringComparer.Ordinal).Count());
    }

    [Fact]
    public void The_check_finds_an_endpoint_in_a_forbidden_area()
    {
        var endpoints = Endpoints(_app);
        Assert.Contains(endpoints, endpoint => endpoint.RoutePattern.RawText == Agents.Probe);
        Assert.Equal([Agents.ProbeInConsole], Forbidden(endpoints));
    }

    [Theory]
    [InlineData("studio.draft")]
    [InlineData("ops.read")]
    [InlineData("assets.upload")]
    public void A_scope_outside_the_forbidden_families_is_allowed(string name) => Assert.True(AgentScopes.IsAllowedName(name));

    [Theory]
    [InlineData("players.read")]
    [InlineData("accounts.read")]
    [InlineData("profiles.rename")]
    [InlineData("progress.read")]
    [InlineData("scores.write")]
    [InlineData("rooms.join")]
    [InlineData("links.make")]
    [InlineData("identity.read")]
    [InlineData("auth.login")]
    [InlineData("sessions.end")]
    [InlineData("roles.grant")]
    [InlineData("agents.create")]
    [InlineData("admin.read")]
    [InlineData("secrets.read")]
    [InlineData("settings.write")]
    [InlineData("studio.delete")]
    [InlineData("studio.approve")]
    [InlineData("assets.deprecate")]
    [InlineData("assets.withdraw")]
    [InlineData("delete.drafts")]
    [InlineData("Studio.Draft")]
    [InlineData("studio")]
    [InlineData("studio.draft.extra")]
    [InlineData("studio.draft ")]
    [InlineData("")]
    public void A_scope_in_a_forbidden_family_or_of_another_shape_is_not(string name) => Assert.False(AgentScopes.IsAllowedName(name));

    [Fact]
    public void Only_a_scope_of_the_list_can_open_an_endpoint()
    {
        var made = new AgentScope("players.read", "made up");
        Assert.Throws<ArgumentException>(() => new ConventionsOnly().RequireAgentScope(made));
    }

    private static List<RouteEndpoint> Endpoints(WebApplicationFactory<Program> app) =>
        [.. app.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()];

    /// <summary>The routes of endpoints that name an agent scope under a forbidden prefix.</summary>
    private static List<string?> Forbidden(IEnumerable<RouteEndpoint> endpoints) =>
    [
        .. endpoints
            .Where(endpoint => endpoint.Metadata.GetMetadata<AgentScopeRequired>() is not null)
            .Where(endpoint => ForbiddenPrefixes.Any(prefix => Under(endpoint, prefix)))
            .Select(endpoint => endpoint.RoutePattern.RawText),
    ];

    private static bool Under(RouteEndpoint endpoint, string prefix) =>
        new PathString(Normalized(endpoint.RoutePattern.RawText)).StartsWithSegments(prefix, StringComparison.OrdinalIgnoreCase);

    private static string Normalized(string? route) => route is null ? "/" : route.StartsWith('/') ? route : "/" + route;

    private static async Task<string?> CodeOfAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    private static async Task<string?> FieldAsync(HttpResponseMessage response, string field)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.GetProperty("errors").GetProperty(field)[0].GetString();
    }

    private async Task<int> AuditCountAsync()
    {
        await using var scope = factory.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<ToheDbContext>().AgentAudit.CountAsync(Ct);
    }

    private static Uri Url(string path) => new(path, UriKind.Relative);

    /// <summary>An endpoint builder that builds nothing: enough to see what <c>RequireAgentScope</c> accepts.</summary>
    private sealed class ConventionsOnly : IEndpointConventionBuilder
    {
        public void Add(Action<EndpointBuilder> convention)
        {
        }
    }
}
