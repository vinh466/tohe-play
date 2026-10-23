using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Admin;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Agents;

/// <summary>A token as the console shows it: never the token itself, which was shown once.</summary>
/// <param name="Scopes">Names from the scopes the API knows (<c>GET /api/admin/agents/scopes</c>).</param>
/// <param name="LastUsedAt">Its last request, to the minute; none yet.</param>
public sealed record AgentTokenView(
    Guid Id,
    IReadOnlyList<string> Scopes,
    DateTimeOffset CreatedAt,
    DateTimeOffset ExpiresAt,
    DateTimeOffset? RevokedAt,
    DateTimeOffset? LastUsedAt);

/// <summary>An agent and its tokens, the newest first.</summary>
/// <param name="DisabledAt">When it was disabled, which revoked its tokens; none while it is enabled.</param>
public sealed record AgentView(
    Guid Id,
    string Name,
    string? Note,
    DateTimeOffset CreatedAt,
    DateTimeOffset? DisabledAt,
    IReadOnlyList<AgentTokenView> Tokens);

/// <param name="Name">1 to 60 characters, unique, e.g. "studio-agent on the workstation".</param>
/// <param name="Note">At most 200 characters.</param>
public sealed record CreateAgentRequest(string? Name, string? Note);

/// <param name="Scopes">One or more of the scopes the API knows.</param>
/// <param name="Days">How long it lasts: 1 to 90 days; none, 30.</param>
public sealed record CreateAgentTokenRequest(IReadOnlyList<string>? Scopes, int? Days);

/// <summary>A new token: shown this once, never again — only its hash is kept.</summary>
/// <param name="Token"><c>tohe_at_…</c>, sent as <c>Authorization: Bearer</c>.</param>
public sealed record NewAgentTokenView(string Token, AgentTokenView Details, AgentView Agent);

/// <summary>One use of a token: the scope the endpoint names, what it called, the status it got.</summary>
/// <param name="Action">The method and the route, e.g. <c>POST /api/studio/drafts</c>.</param>
/// <param name="Result">The status code of the answer: 401 and 403 are refusals.</param>
public sealed record AgentAuditEntryView(long Id, DateTimeOffset At, Guid TokenId, string Scope, string Action, int Result);

/// <summary>A page of an agent's audit, newest first.</summary>
/// <param name="Before">Ask with <c>before</c> set to this for the next, older page; none at the start.</param>
public sealed record AgentAuditPage(IReadOnlyList<AgentAuditEntryView> Entries, long? Before);

/// <summary>
/// Agents in the console (ADR 0052): owners and admins read them, their tokens — never a token itself — and each
/// agent's audit; only the owner makes and disables agents and makes and revokes tokens, behind step-up level 2, each
/// change in the console's audit log in the same transaction.
/// </summary>
internal static class AgentsConsoleEndpoints
{
    public static void Map(RouteGroupBuilder admin)
    {
        var agents = admin.MapGroup("/agents").WithTags("Agents");

        agents.MapGet("/", ListAsync)
            .RequirePermission(AdminPermissions.AgentsRead)
            .WithName("GetAdminAgents")
            .WithSummary("Every agent and its tokens — scopes, made, expiry, revoked, last used — never a token itself.");

        agents.MapGet("/scopes", () => TypedResults.Ok(AgentScopes.All))
            .RequirePermission(AdminPermissions.AgentsRead)
            .WithName("GetAdminAgentScopes")
            .WithSummary("The scopes an agent token may hold, and what each allows.");

        agents.MapPost("/", CreateAsync)
            .RequirePermission(AdminPermissions.AgentsWrite)
            .RequireStepUp()
            .WithName("CreateAdminAgent")
            .WithSummary("A new agent: a unique name and a note.");

        agents.MapPost("/{id:guid}/disable", DisableAsync)
            .RequirePermission(AdminPermissions.AgentsWrite)
            .RequireStepUp()
            .WithName("DisableAdminAgent")
            .WithSummary("Disable an agent: every one of its tokens is revoked at once, and it gets no new one.");

        agents.MapPost("/{id:guid}/tokens", CreateTokenAsync)
            .RequirePermission(AdminPermissions.AgentsWrite)
            .RequireStepUp()
            .WithName("CreateAdminAgentToken")
            .WithSummary("A new token for the agent, with scopes and an expiry: shown in this answer once, never again.");

        agents.MapPost("/{id:guid}/tokens/{tokenId:guid}/revoke", RevokeTokenAsync)
            .RequirePermission(AdminPermissions.AgentsWrite)
            .RequireStepUp()
            .WithName("RevokeAdminAgentToken")
            .WithSummary("Revoke a token: its next request is refused.");

        agents.MapGet("/{id:guid}/audit", AuditAsync)
            .RequirePermission(AdminPermissions.AgentsRead)
            .WithName("GetAdminAgentAudit")
            .WithSummary("Every use of the agent's tokens, refusals too, newest first, a page at a time.");
    }

    private static async Task<Ok<IReadOnlyList<AgentView>>> ListAsync(ToheDbContext db, CancellationToken ct)
    {
        var agents = await db.Agents.AsNoTracking().OrderByDescending(agent => agent.CreatedAt).ToListAsync(ct);
        var tokens = (await db.AgentTokens.AsNoTracking().OrderByDescending(token => token.CreatedAt).ToListAsync(ct))
            .ToLookup(token => token.AgentId);
        return TypedResults.Ok<IReadOnlyList<AgentView>>([.. agents.Select(agent => ViewOf(agent, tokens[agent.Id]))]);
    }

    private static async Task<Results<Ok<AgentView>, ValidationProblem, ProblemHttpResult>> CreateAsync(
        CreateAgentRequest request,
        HttpContext http,
        UserManager<Account> users,
        AdminAudit audit,
        ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        var name = string.Join(' ', (request.Name ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        if (name.Length == 0)
        {
            return Problems.Field("name", "name_required");
        }

        if (name.Length > Agent.MaxName)
        {
            return Problems.Field("name", "name_too_long");
        }

        var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        if (note is { Length: > Agent.MaxNote })
        {
            return Problems.Field("note", "note_too_long");
        }

        if (await db.Agents.AnyAsync(agent => agent.Name == name, ct))
        {
            return AgentExists();
        }

        var caller = AdminCaller.Of(http);
        var agent = new Agent
        {
            Id = Guid.CreateVersion7(),
            Name = name,
            Note = note,
            CreatedAt = clock.GetUtcNow(),
            CreatedBy = caller.AccountId,
        };
        db.Agents.Add(agent);
        audit.Add(await ActorAsync(http, users), AuditActions.AgentCreate, Target(agent), new { id = agent.Id });
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return AgentExists();
        }

        return TypedResults.Ok(ViewOf(agent, []));
    }

    private static async Task<Results<Ok<AgentView>, NotFound>> DisableAsync(
        Guid id,
        HttpContext http,
        UserManager<Account> users,
        AdminAudit audit,
        ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        if (await db.Agents.FindAsync([id], ct) is not { } agent)
        {
            return TypedResults.NotFound();
        }

        var tokens = await db.AgentTokens.Where(token => token.AgentId == id).OrderByDescending(token => token.CreatedAt).ToListAsync(ct);
        // Disabling again changes nothing and logs nothing.
        if (agent.DisabledAt is null)
        {
            var now = clock.GetUtcNow();
            agent.DisabledAt = now;
            var revoked = 0;
            foreach (var token in tokens.Where(token => token.RevokedAt is null))
            {
                token.RevokedAt = now;
                revoked++;
            }

            audit.Add(await ActorAsync(http, users), AuditActions.AgentDisable, Target(agent), new { id = agent.Id, tokensRevoked = revoked });
            await db.SaveChangesAsync(ct);
        }

        return TypedResults.Ok(ViewOf(agent, tokens));
    }

    private static async Task<Results<Ok<NewAgentTokenView>, NotFound, ValidationProblem, ProblemHttpResult>> CreateTokenAsync(
        Guid id,
        CreateAgentTokenRequest request,
        HttpContext http,
        UserManager<Account> users,
        AdminAudit audit,
        ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        if (await db.Agents.FindAsync([id], ct) is not { } agent)
        {
            return TypedResults.NotFound();
        }

        var scopes = (request.Scopes ?? []).Distinct(StringComparer.Ordinal).ToArray();
        if (scopes.Length == 0)
        {
            return Problems.Field("scopes", "scopes_required");
        }

        if (scopes.Any(scope => AgentScopes.Find(scope) is null))
        {
            return Problems.Field("scopes", "scope_unknown");
        }

        var days = request.Days ?? AgentTokens.DefaultDays;
        if (days is < 1 or > AgentTokens.MaxDays)
        {
            return Problems.Field("days", "days_invalid");
        }

        if (agent.DisabledAt is not null)
        {
            return Problems.Of(StatusCodes.Status409Conflict, "agent_disabled", "This agent is disabled: it gets no new token");
        }

        var now = clock.GetUtcNow();
        var secret = AgentTokens.New();
        var token = new AgentToken
        {
            Id = Guid.CreateVersion7(),
            AgentId = agent.Id,
            TokenHash = AgentTokens.Hash(secret),
            Scopes = scopes,
            CreatedAt = now,
            CreatedBy = AdminCaller.Of(http).AccountId,
            ExpiresAt = now.AddDays(days),
        };
        db.AgentTokens.Add(token);
        // The audit names the token by its id, never by the token itself.
        audit.Add(
            await ActorAsync(http, users),
            AuditActions.AgentTokenCreate,
            Target(agent),
            new { id = agent.Id, token = token.Id, scopes, expiresAt = token.ExpiresAt });
        await db.SaveChangesAsync(ct);

        var tokens = await db.AgentTokens.AsNoTracking().Where(held => held.AgentId == id).OrderByDescending(held => held.CreatedAt).ToListAsync(ct);
        return TypedResults.Ok(new NewAgentTokenView(secret, ViewOf(token), ViewOf(agent, tokens)));
    }

    private static async Task<Results<Ok<AgentView>, NotFound>> RevokeTokenAsync(
        Guid id,
        Guid tokenId,
        HttpContext http,
        UserManager<Account> users,
        AdminAudit audit,
        ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        if (await db.Agents.FindAsync([id], ct) is not { } agent)
        {
            return TypedResults.NotFound();
        }

        var tokens = await db.AgentTokens.Where(token => token.AgentId == id).OrderByDescending(token => token.CreatedAt).ToListAsync(ct);
        if (tokens.FirstOrDefault(token => token.Id == tokenId) is not { } revoked)
        {
            return TypedResults.NotFound();
        }

        // Revoking again changes nothing and logs nothing.
        if (revoked.RevokedAt is null)
        {
            revoked.RevokedAt = clock.GetUtcNow();
            audit.Add(await ActorAsync(http, users), AuditActions.AgentTokenRevoke, Target(agent), new { id = agent.Id, token = revoked.Id });
            await db.SaveChangesAsync(ct);
        }

        return TypedResults.Ok(ViewOf(agent, tokens));
    }

    private static async Task<Results<Ok<AgentAuditPage>, NotFound>> AuditAsync(
        Guid id, ToheDbContext db, CancellationToken ct, long? before = null, int limit = 50)
    {
        if (!await db.Agents.AnyAsync(agent => agent.Id == id, ct))
        {
            return TypedResults.NotFound();
        }

        limit = Math.Clamp(limit, 1, 200);
        var entries = await db.AgentAudit.AsNoTracking()
            .Where(entry => entry.AgentId == id && (before == null || entry.Id < before))
            .OrderByDescending(entry => entry.Id)
            .Take(limit)
            .Select(entry => new AgentAuditEntryView(entry.Id, entry.At, entry.TokenId, entry.Scope, entry.Action, entry.Result))
            .ToListAsync(ct);
        return TypedResults.Ok(new AgentAuditPage(entries, entries.Count == limit ? entries[^1].Id : null));
    }

    private static AgentView ViewOf(Agent agent, IEnumerable<AgentToken> tokens) =>
        new(agent.Id, agent.Name, agent.Note, agent.CreatedAt, agent.DisabledAt, [.. tokens.Select(ViewOf)]);

    private static AgentTokenView ViewOf(AgentToken token) =>
        new(token.Id, token.Scopes, token.CreatedAt, token.ExpiresAt, token.RevokedAt, token.LastUsedAt);

    private static string Target(Agent agent) => $"agent {agent.Name}";

    private static ProblemHttpResult AgentExists() =>
        Problems.Of(StatusCodes.Status409Conflict, "agent_exists", "An agent has this name already");

    private static async Task<AdminActor> ActorAsync(HttpContext http, UserManager<Account> users) =>
        AdminActor.Of((await users.FindByIdAsync(AdminCaller.Of(http).AccountId.ToString()))!, http);
}
