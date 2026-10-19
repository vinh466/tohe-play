using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Tohe.Api.Modules.Admin;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Platform;

namespace Tohe.Api.Tests;

/// <summary>
/// The proof-of-work before a code by email (ADR 0037): off until the console turns it on; then signing up and a
/// password reset take a solved challenge of the API's, once.
/// </summary>
public sealed class ProofOfWorkTests(ApiFactory factory) : IClassFixture<ApiFactory>, IAsyncDisposable
{
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    // An easy puzzle: the test solves it by brute force.
    private readonly WebApplicationFactory<Program> _app =
        factory.WithWebHostBuilder(builder => builder.UseSetting("Identity:ProofOfWorkMaxNumber", "2000"));

    public ValueTask DisposeAsync() => _app.DisposeAsync();

    [Fact]
    public async Task With_the_switch_on_signing_up_and_a_reset_take_a_solved_challenge_once()
    {
        var client = _app.CreateClient();
        Assert.False((await ConfigAsync(client)).ProofOfWork);
        Assert.Equal(HttpStatusCode.Accepted, (await SignUpAsync(client, Accounts.NewEmail(), proof: null)).StatusCode);

        var owner = await Admins.NewAsync(factory, "owner", _app);
        var saved = await owner.Client.PutAsJsonAsync(Url("/api/admin/settings"), new { proofOfWork = true }, Ct);
        Assert.True((await saved.Content.ReadFromJsonAsync<SignInSettingsView>(Ct))!.ProofOfWork);
        Assert.True((await ConfigAsync(client)).ProofOfWork);

        // No answer, a wrong one, or one with a token not of this API: refused before any email.
        var email = Accounts.NewEmail();
        Assert.Equal("proof_of_work_required", await CodeOfAsync(await SignUpAsync(client, email, proof: null)));
        var challenge = await ChallengeAsync(client);
        Assert.Equal(("SHA-256", 2000), (challenge.Algorithm, challenge.MaxNumber));
        var answer = Solve(challenge);
        Assert.Equal("proof_of_work_required", await CodeOfAsync(await SignUpAsync(client, email, answer with { Number = answer.Number + 1 })));
        Assert.Equal("proof_of_work_required", await CodeOfAsync(await SignUpAsync(client, email, answer with { Token = "not-a-token" })));

        // Solved: accepted — once.
        Assert.Equal(HttpStatusCode.Accepted, (await SignUpAsync(client, email, answer)).StatusCode);
        Assert.Equal("proof_of_work_required", await CodeOfAsync(await SignUpAsync(client, Accounts.NewEmail(), answer)));

        // A forgotten password asks the same, of any address.
        var forgot = (ProofOfWorkSolution? proof) =>
            client.PostAsJsonAsync(Url("/api/auth/password/forgot"), new { email = Accounts.NewEmail(), proof }, Ct);
        Assert.Equal("proof_of_work_required", await CodeOfAsync(await forgot(null)));
        Assert.Equal(HttpStatusCode.Accepted, (await forgot(Solve(await ChallengeAsync(client)))).StatusCode);

        // Off again: nothing asked.
        await owner.Client.PutAsJsonAsync(Url("/api/admin/settings"), new { proofOfWork = false }, Ct);
        Assert.Equal(HttpStatusCode.Accepted, (await SignUpAsync(client, Accounts.NewEmail(), proof: null)).StatusCode);
    }

    private static ProofOfWorkSolution Solve(ProofOfWorkChallenge challenge) =>
        new(challenge.Token, Enumerable.Range(0, challenge.MaxNumber + 1).First(n => ProofOfWork.Hash(challenge.Salt, n) == challenge.Challenge));

    private static async Task<ProofOfWorkChallenge> ChallengeAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<ProofOfWorkChallenge>(Url("/api/auth/challenge"), Ct))!;

    private static async Task<ClientConfig> ConfigAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<ClientConfig>(Url("/api/config"), Ct))!;

    private static Task<HttpResponseMessage> SignUpAsync(HttpClient client, string email, ProofOfWorkSolution? proof) =>
        client.PostAsJsonAsync(
            Url("/api/auth/register"),
            new { email, password = Accounts.Password, displayName = "Bố", acceptTerms = true, termsVersion = Accounts.TermsVersion, proof },
            Ct);

    private static async Task<string?> CodeOfAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return document.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    private static Uri Url(string path) => new(path, UriKind.Relative);
}
