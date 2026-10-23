using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Tohe.Api.Modules.Agents;

/// <summary>
/// Agents and their tokens (ADR 0052), in the <c>agents</c> schema: an endpoint opens itself to agents holding a scope
/// with <c>.RequireAgentScope(AgentScopes.X)</c>, and refuses them otherwise. The owner manages agents in the console,
/// whose endpoints <see cref="AgentsConsoleEndpoints"/> maps under the console's routes. See
/// docs/architecture/agent-tokens.md.
/// </summary>
internal static class AgentsModule
{
    public static WebApplicationBuilder AddAgentsModule(this WebApplicationBuilder builder)
    {
        builder.Services.TryAddSingleton(TimeProvider.System);
        builder.Services.AddScoped<AgentTokens>();
        return builder;
    }
}
