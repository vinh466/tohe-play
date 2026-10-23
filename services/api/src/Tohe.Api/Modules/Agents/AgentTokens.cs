using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Agents;

/// <summary>The agent calling an endpoint that names a scope, with the token it called with and what that token holds.</summary>
internal sealed record AgentCaller(Guid AgentId, Guid TokenId, IReadOnlyList<string> Scopes)
{
    public static AgentCaller Of(HttpContext http) => (AgentCaller)http.Items[typeof(AgentCaller)]!;
}

/// <summary>The scope an endpoint opens to agents (ADR 0052); an endpoint without one refuses every agent token.</summary>
internal sealed record AgentScopeRequired(AgentScope Scope);

/// <summary>What <see cref="AgentTokens.AuthenticateAsync"/> found: the agent, or the answer that refuses it.</summary>
internal sealed record AgentAuthentication(AgentCaller? Caller, IResult? Refusal);

/// <summary>
/// Agent tokens (ADR 0052): made — <c>tohe_at_</c> and 32 random bytes in base64url, of which only the SHA-256 is
/// kept — and checked. A token is sent as <c>Authorization: Bearer tohe_at_…</c>; the token, its agent and its expiry
/// are read from the database on every request, so a revocation holds at the next one. It is never a session: only an
/// endpoint that names a scope reads it.
/// </summary>
internal sealed class AgentTokens(ToheDbContext db, IServiceScopeFactory scopes, TimeProvider clock)
{
    /// <summary>What every token starts with, so secret scanners can find a leaked one.</summary>
    public const string Prefix = "tohe_at_";

    /// <summary>The days a token lasts when the owner does not choose.</summary>
    public const int DefaultDays = 30;

    /// <summary>The most days a token may last.</summary>
    public const int MaxDays = 90;

    /// <summary>The random bytes in a token: 32, which base64url writes in 43 characters.</summary>
    private const int RandomBytes = 32;

    private static readonly int Length = Prefix.Length + Base64Url.GetEncodedLength(RandomBytes);

    /// <summary>A token's last use is written at most this often.</summary>
    private static readonly TimeSpan LastUsedEvery = TimeSpan.FromMinutes(1);

    /// <summary>A new token, to show once.</summary>
    public static string New() => Prefix + Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(RandomBytes));

    /// <summary>What the database keeps of a token: the SHA-256 of its UTF-8 bytes.</summary>
    public static byte[] Hash(string token) => SHA256.HashData(Encoding.UTF8.GetBytes(token));

    /// <summary>
    /// The agent behind the request's bearer token, when the token holds <paramref name="scope"/>: 401
    /// <c>agent_token_invalid</c> for no token, an unknown, expired or revoked one, or one of a disabled agent; 403
    /// <c>agent_scope_missing</c> when the token lacks the scope. A refusal of a token the database knows is in the
    /// agent's audit; a use that passes is written there by <see cref="RecordAsync"/> once it is answered.
    /// </summary>
    public async Task<AgentAuthentication> AuthenticateAsync(HttpContext http, AgentScope scope)
    {
        if (Bearer(http.Request) is not { } token)
        {
            return new(null, Invalid());
        }

        var hash = Hash(token);
        var found = await db.AgentTokens.AsNoTracking()
            .Where(candidate => candidate.TokenHash == hash)
            .Join(db.Agents, candidate => candidate.AgentId, agent => agent.Id, (candidate, agent) => new { Token = candidate, agent.DisabledAt })
            .FirstOrDefaultAsync(http.RequestAborted);
        if (found is null)
        {
            return new(null, Invalid());
        }

        var now = clock.GetUtcNow();
        var caller = new AgentCaller(found.Token.AgentId, found.Token.Id, found.Token.Scopes);
        if (found.Token.RevokedAt is not null || found.Token.ExpiresAt <= now || found.DisabledAt is not null)
        {
            await RecordAsync(http, caller, scope, StatusCodes.Status401Unauthorized);
            return new(null, Invalid());
        }

        if (!found.Token.Scopes.Contains(scope.Name, StringComparer.Ordinal))
        {
            await RecordAsync(http, caller, scope, StatusCodes.Status403Forbidden);
            return new(null, Problems.Of(StatusCodes.Status403Forbidden, "agent_scope_missing", "This agent token does not hold the scope this needs"));
        }

        if (found.Token.LastUsedAt is not { } last || now - last >= LastUsedEvery)
        {
            var since = now - LastUsedEvery;
            await db.AgentTokens
                .Where(used => used.Id == found.Token.Id && (used.LastUsedAt == null || used.LastUsedAt <= since))
                .ExecuteUpdateAsync(set => set.SetProperty(used => used.LastUsedAt, now), http.RequestAborted);
        }

        http.Items[typeof(AgentCaller)] = caller;
        return new(caller, null);
    }

    /// <summary>
    /// Writes one use of a token to the agent's audit: the scope, the method and route pattern, and the status code. In
    /// a unit of work of its own, so it never saves what the endpoint left unsaved, and is written even when the request
    /// was aborted.
    /// </summary>
    public async Task RecordAsync(HttpContext http, AgentCaller caller, AgentScope scope, int status)
    {
        var route = (http.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText ?? http.Request.Path.Value ?? "";
        var action = $"{http.Request.Method} {route}";
        await using var unit = scopes.CreateAsyncScope();
        var audit = unit.ServiceProvider.GetRequiredService<ToheDbContext>();
        audit.AgentAudit.Add(new AgentAuditEntry
        {
            AgentId = caller.AgentId,
            TokenId = caller.TokenId,
            Scope = scope.Name,
            Action = action.Length > 320 ? action[..320] : action,
            Result = status,
            At = clock.GetUtcNow(),
        });
        await audit.SaveChangesAsync(CancellationToken.None);
    }

    /// <summary>The token of an <c>Authorization: Bearer tohe_at_…</c> header, when it has a token's shape.</summary>
    private static string? Bearer(HttpRequest request)
    {
        var header = request.Headers.Authorization.ToString();
        const string scheme = "Bearer ";
        if (!header.StartsWith(scheme, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var token = header[scheme.Length..].Trim();
        return token.Length == Length
            && token.StartsWith(Prefix, StringComparison.Ordinal)
            && Base64Url.IsValid(token.AsSpan(Prefix.Length))
            ? token
            : null;
    }

    private static IResult Invalid() =>
        Problems.Of(StatusCodes.Status401Unauthorized, "agent_token_invalid", "No agent token, or an unknown, expired or revoked one");
}

/// <summary>
/// Opens an endpoint to agents holding its scope (ADR 0052): authenticates the bearer token, refuses it without the
/// scope, and writes every use — the status the endpoint answered, or 500 when it threw — to the agent's audit.
/// </summary>
internal sealed class AgentAccess : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var http = context.HttpContext;
        var scope = http.GetEndpoint()!.Metadata.GetRequiredMetadata<AgentScopeRequired>().Scope;
        var tokens = http.RequestServices.GetRequiredService<AgentTokens>();
        var outcome = await tokens.AuthenticateAsync(http, scope);
        if (outcome.Caller is not { } caller)
        {
            return outcome.Refusal;
        }

        object? result;
        try
        {
            result = await next(context);
        }
        catch
        {
            await tokens.RecordAsync(http, caller, scope, StatusCodes.Status500InternalServerError);
            throw;
        }

        await tokens.RecordAsync(http, caller, scope, StatusOf(result, http));
        return result;
    }

    /// <summary>The status a handler's result will answer with.</summary>
    private static int StatusOf(object? result, HttpContext http) => result switch
    {
        INestedHttpResult nested => StatusOf(nested.Result, http),
        IStatusCodeHttpResult { StatusCode: { } status } => status,
        null => http.Response.StatusCode,
        _ => StatusCodes.Status200OK,
    };
}

internal static class AgentAccessExtensions
{
    /// <summary>
    /// Opens the endpoint to agent tokens that hold <paramref name="scope"/> (ADR 0052) — one of <see cref="AgentScopes"/>,
    /// never a scope made up elsewhere. Every other endpoint refuses agent tokens: nothing is open to agents by default.
    /// </summary>
    public static TBuilder RequireAgentScope<TBuilder>(this TBuilder endpoint, AgentScope scope)
        where TBuilder : IEndpointConventionBuilder
    {
        if (!AgentScopes.All.Contains(scope))
        {
            throw new ArgumentException($"{scope.Name} is not one of AgentScopes", nameof(scope));
        }

        endpoint.WithMetadata(new AgentScopeRequired(scope));
        return endpoint.AddEndpointFilter<TBuilder, AgentAccess>();
    }
}
