using Tohe.Api.Modules.Agents;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Studio;

/// <summary>
/// Who calls the Studio's library: an agent — by its token — or an account, by its Studio session. Exactly one is set.
/// A draft belongs to who made it, so <see cref="Made"/> says whether this caller made something.
/// </summary>
internal sealed record StudioActor(Guid? AgentId, Guid? AccountId)
{
    public static StudioActor Of(HttpContext http) => (StudioActor)http.Items[typeof(StudioActor)]!;

    public bool Made(Guid? agentId, Guid? accountId) =>
        AgentId is { } agent ? agent == agentId : AccountId is { } account && account == accountId;
}

/// <summary>An endpoint of the library an agent token with <c>studio.draft</c> may call as well as a person.</summary>
internal sealed record StudioAgentsAllowed;

/// <summary>
/// Guards every endpoint of the Studio's library (docs/architecture/asset-studio.md#who-calls). A request with an
/// <c>Authorization</c> header is an agent's: where the endpoint lets agents in, its token must hold
/// <c>studio.draft</c> (<see cref="AgentTokens.AuthenticateAsync"/>), and every use is written to the agents' audit with
/// the status it got; the Studio session is not read. Any other request is a person's, checked as every Studio endpoint
/// is (<see cref="StudioAccess"/>). Then, without storage, <c>503 studio_storage_not_configured</c>.
/// </summary>
internal sealed class StudioLibraryAccess : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var http = context.HttpContext;
        var agentsAllowed = http.GetEndpoint()?.Metadata.GetMetadata<StudioAgentsAllowed>() is not null;
        if (agentsAllowed && http.Request.Headers.Authorization.Count > 0)
        {
            return await AsAgentAsync(context, next);
        }

        if (await StudioAccess.RefuseAsync(http) is { } refused)
        {
            return refused;
        }

        if (StorageMissing(http) is { } missing)
        {
            return missing;
        }

        http.Items[typeof(StudioActor)] = new StudioActor(null, StudioCaller.Of(http).AccountId);
        return await next(context);
    }

    private static async Task<object?> AsAgentAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var http = context.HttpContext;
        var tokens = http.RequestServices.GetRequiredService<AgentTokens>();
        var scope = AgentScopes.StudioDraft;
        var outcome = await tokens.AuthenticateAsync(http, scope);
        if (outcome.Caller is not { } caller)
        {
            return outcome.Refusal;
        }

        object? result;
        try
        {
            result = StorageMissing(http);
            if (result is null)
            {
                http.Items[typeof(StudioActor)] = new StudioActor(caller.AgentId, null);
                result = await next(context);
            }
        }
        catch
        {
            await tokens.RecordAsync(http, caller, scope, StatusCodes.Status500InternalServerError);
            throw;
        }

        await tokens.RecordAsync(http, caller, scope, StatusOf(result, http));
        return result;
    }

    private static IResult? StorageMissing(HttpContext http) =>
        http.RequestServices.GetRequiredService<IStudioStorage>().IsConfigured
            ? null
            : Problems.Of(
                StatusCodes.Status503ServiceUnavailable,
                "studio_storage_not_configured",
                "The Studio's storage is not configured on this server");

    /// <summary>The status a handler's result will answer with.</summary>
    private static int StatusOf(object? result, HttpContext http) => result switch
    {
        INestedHttpResult nested => StatusOf(nested.Result, http),
        IStatusCodeHttpResult { StatusCode: { } status } => status,
        null => http.Response.StatusCode,
        _ => StatusCodes.Status200OK,
    };
}

internal static class StudioLibraryAccessExtensions
{
    /// <summary>
    /// Lets an agent token with <c>studio.draft</c> call the endpoint as well as a person with the permission it
    /// declares. Named in the endpoint's metadata as <see cref="AgentScopeRequired"/> too, so the test of the areas no
    /// agent may reach (ADR 0052) sees it.
    /// </summary>
    public static RouteHandlerBuilder AllowStudioAgents(this RouteHandlerBuilder endpoint) =>
        endpoint.WithMetadata(new StudioAgentsAllowed(), new AgentScopeRequired(AgentScopes.StudioDraft));
}
