using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Modules.Agents;

namespace Tohe.Api.Tests;

/// <summary>
/// Agents and their tokens as tests need them (ADR 0052). No endpoint of the API names a scope yet, so tests add their
/// own: <see cref="WithProbe"/> hosts the API with probe endpoints that do, which nothing outside tests ever maps.
/// </summary>
internal static class Agents
{
    /// <summary>A probe that names <c>studio.draft</c> and answers the agent that called it.</summary>
    public const string Probe = "/api/agent-probe";

    /// <summary>A probe that names <c>studio.draft</c> and refuses what it is sent: 422, written to the audit as such.</summary>
    public const string ProbeRefusing = "/api/agent-probe/refusing";

    /// <summary>A probe under the console's routes: the forbidden-areas check must find it.</summary>
    public const string ProbeInConsole = "/api/admin/agent-probe";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    /// <summary>What the probe answers: the agent and token it was called with.</summary>
    public sealed record ProbeAnswer(Guid AgentId, Guid TokenId, IReadOnlyList<string> Scopes);

    /// <summary>
    /// The API with the probe endpoints, mapped by a startup filter ahead of the app's own pipeline. Their routing joins
    /// the app's, so the probes are among the endpoints the app lists.
    /// </summary>
    public static WebApplicationFactory<Program> WithProbe(ApiFactory factory) =>
        factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.AddSingleton<IStartupFilter, ProbeStartup>()));

    /// <summary>A new agent, made by the owner in the console.</summary>
    public static async Task<AgentView> CreateAsync(HttpClient owner, string? name = null)
    {
        var response = await owner.PostAsJsonAsync(Url("/api/admin/agents"), new { name = name ?? $"agent {Guid.NewGuid():N}", note = "trong bài kiểm tra" }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<AgentView>(Ct))!;
    }

    /// <summary>A new token for the agent, holding <c>studio.draft</c>.</summary>
    public static async Task<NewAgentTokenView> TokenAsync(HttpClient owner, Guid agentId, int? days = null)
    {
        var response = await owner.PostAsJsonAsync(Url($"/api/admin/agents/{agentId}/tokens"), new { scopes = new[] { AgentScopes.StudioDraft.Name }, days }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<NewAgentTokenView>(Ct))!;
    }

    /// <summary>A request to <paramref name="path"/> with the token as <c>Authorization: Bearer</c>.</summary>
    public static async Task<HttpResponseMessage> CallAsync(HttpClient client, string token, string path = Probe, HttpMethod? method = null)
    {
        using var request = new HttpRequestMessage(method ?? HttpMethod.Get, Url(path));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await client.SendAsync(request, Ct);
    }

    private static Uri Url(string path) => new(path, UriKind.Relative);

    /// <summary>Maps the probes before the app's pipeline: a probe is answered there, every other request goes on.</summary>
    private sealed class ProbeStartup : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.UseRouting();
            app.UseEndpoints(routes =>
            {
                routes.MapGet(Probe, (HttpContext http) =>
                    {
                        var caller = AgentCaller.Of(http);
                        return TypedResults.Ok(new ProbeAnswer(caller.AgentId, caller.TokenId, caller.Scopes));
                    })
                    .RequireAgentScope(AgentScopes.StudioDraft);
                routes.MapPost(ProbeRefusing, () => TypedResults.Problem(statusCode: StatusCodes.Status422UnprocessableEntity))
                    .RequireAgentScope(AgentScopes.StudioDraft);
                routes.MapGet(ProbeInConsole, () => TypedResults.Ok())
                    .RequireAgentScope(AgentScopes.StudioDraft);
            });
            next(app);
        };
    }
}
