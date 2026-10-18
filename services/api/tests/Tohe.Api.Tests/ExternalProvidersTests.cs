using Microsoft.AspNetCore.Authentication.OAuth;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Tests;

/// <summary>Which providers a deployment offers, and how GitHub is called — no provider needed (ADR 0026).</summary>
public sealed class ExternalProvidersTests
{
    [Fact]
    public void A_provider_exists_only_with_its_secrets()
    {
        var catalog = ExternalProviders.Add(new ServiceCollection().AddAuthentication(), Configuration(new()
        {
            ["Auth:Providers:Google:ClientId"] = "only-an-id",
            ["Auth:Providers:GitHub:ClientId"] = "github-id",
            ["Auth:Providers:GitHub:ClientSecret"] = "github-secret",
            ["Auth:Providers:Oidc:ClientId"] = "oidc-id",
            ["Auth:Providers:Oidc:ClientSecret"] = "oidc-secret",
            ["Auth:Providers:Oidc:Authority"] = "https://auth.example.org",
            ["Auth:Providers:Oidc:DisplayName"] = " Cộng đồng ",
        }));

        Assert.Equal([new ExternalProvider("github", "GitHub"), new ExternalProvider("oidc", "Cộng đồng")], catalog.Providers);
        Assert.Empty(ExternalProviders.Add(new ServiceCollection().AddAuthentication(), Configuration(new())).Providers);
    }

    [Fact]
    public void GitHub_is_asked_for_the_addresses_with_pkce_and_answers_on_its_callback()
    {
        var services = new ServiceCollection().AddLogging().AddDataProtection().Services;
        ExternalProviders.Add(services.AddAuthentication(), Configuration(new()
        {
            ["Auth:Providers:GitHub:ClientId"] = "github-id",
            ["Auth:Providers:GitHub:ClientSecret"] = "github-secret",
        }));
        using var provider = services.BuildServiceProvider();

        var github = provider.GetRequiredService<IOptionsMonitor<OAuthOptions>>().Get(ExternalProviders.GitHub);
        Assert.True(github.UsePkce);
        Assert.Equal("/api/auth/external/github/callback", github.CallbackPath);
        Assert.Contains("user:email", github.Scope);
    }

    private static IConfiguration Configuration(Dictionary<string, string?> values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values).Build();
}
