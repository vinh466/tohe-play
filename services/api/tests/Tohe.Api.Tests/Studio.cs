using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Studio;

namespace Tohe.Api.Tests;

/// <summary>
/// The Studio's people, as tests need them (ADR 0051). <see cref="WithProbe"/> hosts the API with probe endpoints that
/// each ask for one permission alone — <c>studio.read</c>, <c>studio.contribute</c>, or <c>studio.review</c> with
/// step-up — behind the Studio's session as every Studio endpoint is; nothing outside tests ever maps them.
/// </summary>
internal static class Studio
{
    public const string ProbeRead = "/api/studio/probe/read";
    public const string ProbeContribute = "/api/studio/probe/contribute";
    public const string ProbeReview = "/api/studio/probe/review";
    public const string ProbeUndeclared = "/api/studio/probe/undeclared";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    /// <param name="Key">The authenticator key, when two-factor authentication is on: to make codes.</param>
    public sealed record Member(string Email, Guid AccountId, string? Key);

    /// <summary>
    /// A new account, signed up in the hub, with <paramref name="role"/> written straight into <c>studio.members</c> —
    /// or none — and, when asked, two-factor authentication turned on in Identity's stores. The hub lets only an account
    /// with a platform role add an authenticator, so tests add it as Identity does.
    /// </summary>
    public static async Task<Member> NewAsync(ApiFactory factory, StudioRole? role, bool twoFactor)
    {
        var email = Accounts.NewEmail();
        var me = await Accounts.SignUpAsync(factory, factory.CreateClient(), "Người vẽ", email);
        var key = twoFactor ? await TwoFactorAsync(factory, me.Account.Id) : null;
        if (role is { } given)
        {
            await GrantAsync(factory, me.Account.Id, given);
        }

        return new Member(email, me.Account.Id, key);
    }

    /// <summary>Turns two-factor authentication on, with a new authenticator key; returns the key.</summary>
    public static async Task<string> TwoFactorAsync(ApiFactory factory, Guid accountId)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<Account>>();
        var account = (await users.FindByIdAsync(accountId.ToString()))!;
        await users.ResetAuthenticatorKeyAsync(account);
        await users.SetTwoFactorEnabledAsync(account, true);
        await users.GenerateNewTwoFactorRecoveryCodesAsync(account, 10);
        return (await users.GetAuthenticatorKeyAsync(account))!;
    }

    /// <summary>New recovery codes for the account.</summary>
    public static async Task<IReadOnlyList<string>> RecoveryCodesAsync(ApiFactory factory, Guid accountId)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<Account>>();
        var account = (await users.FindByIdAsync(accountId.ToString()))!;
        return [.. (await users.GenerateNewTwoFactorRecoveryCodesAsync(account, 10))!];
    }

    /// <summary>The role straight into <c>studio.members</c>, as a grant in the console leaves it.</summary>
    public static async Task GrantAsync(ApiFactory factory, Guid accountId, StudioRole role)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        db.StudioMembers.Add(new StudioMember { AccountId = accountId, Role = role, GrantedBy = accountId, GrantedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync(Ct);
    }

    /// <summary>
    /// What the Studio's sign-in sends: the email, the password and, with a key, the code of the given step. A code works
    /// once, so each sign-in of one account takes the code of another 30 seconds.
    /// </summary>
    public static object SignIn(Member member, int step = 0) =>
        member.Key is null
            ? new { email = member.Email, password = Accounts.Password }
            : new { email = member.Email, password = Accounts.Password, code = Code(member, step) };

    /// <summary>The authenticator's code of now, plus <paramref name="step"/> steps of 30 seconds.</summary>
    public static string Code(Member member, int step = 0) =>
        Totp.Code(member.Key!, DateTimeOffset.UtcNow.AddSeconds(30 * step));

    /// <summary>A new browser signed in to the Studio.</summary>
    public static async Task<HttpClient> SignInAsync(WebApplicationFactory<Program> app, Member member, int step = 0)
    {
        var client = app.CreateClient();
        var signedIn = await client.PostAsJsonAsync(Url("/api/studio/session"), SignIn(member, step), Ct);
        Assert.Equal(HttpStatusCode.OK, signedIn.StatusCode);
        return client;
    }

    /// <summary>The API with the probe endpoints, mapped by a startup filter ahead of the app's own pipeline.</summary>
    public static WebApplicationFactory<Program> WithProbe(ApiFactory factory) =>
        factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.AddSingleton<IStartupFilter, ProbeStartup>()));

    private static Uri Url(string path) => new(path, UriKind.Relative);

    /// <summary>
    /// Maps the probes before the app's pipeline, with the authentication and authorization they need: a probe is
    /// answered there, every other request goes on.
    /// </summary>
    private sealed class ProbeStartup : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.UseRouting();
            app.UseAuthentication();
            app.UseAuthorization();
            app.UseEndpoints(routes =>
            {
                var probes = routes.MapGroup("/api/studio/probe")
                    .RequireAuthorization(StudioSession.Policy)
                    .RequireStudioSession();
                probes.MapGet("/read", (HttpContext http) => TypedResults.Ok(StudioRoles.NameOf(StudioCaller.Of(http).Role)))
                    .RequireStudioPermission(StudioPermissions.Read);
                probes.MapPost("/contribute", () => TypedResults.Ok())
                    .RequireStudioPermission(StudioPermissions.Contribute);
                probes.MapPost("/review", () => TypedResults.Ok())
                    .RequireStudioPermission(StudioPermissions.Review)
                    .RequireStudioStepUp();
                probes.MapGet("/undeclared", () => TypedResults.Ok());
            });
            next(app);
        };
    }
}
