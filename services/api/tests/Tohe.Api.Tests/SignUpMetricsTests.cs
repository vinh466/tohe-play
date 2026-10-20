using System.Diagnostics.Metrics;
using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Tests;

/// <summary>
/// <c>tohe_sign_ups</c> (docs/architecture/metrics.md): counted by method when a sign-up starts and when the account
/// exists. In the metrics tests' collection, so it runs alone (the meter is process-wide) — but on a database of its
/// own, so the emails it makes do not disturb the exact numbers of <see cref="MetricsTests"/>.
/// </summary>
[Collection(nameof(MetricsTests))]
public sealed class SignUpMetricsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Sign_ups_are_counted_when_started_and_when_the_account_exists_by_method()
    {
        await using var app = factory.WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services =>
            {
                services.AddAuthentication().AddRemoteScheme<FakeProviderOptions, FakeProviderHandler>("fake", "Fake", o =>
                    o.SignInScheme = IdentityConstants.ExternalScheme);
                services.AddSingleton(new ExternalProviderCatalog([new ExternalProvider("fake", "Fake")]));
            }));
        using var counted = new SignUpListener();
        var client = app.CreateClient();

        // Password: the code sent is "started", the account made by the code is "completed".
        var email = Accounts.NewEmail();
        var attempt = await Accounts.StartSignUpAsync(client, email);
        Assert.Equal(["password/started"], counted.Taken());
        var confirmed = await client.PostAsJsonAsync(
            Url("/api/auth/register/confirm"), new { attemptId = attempt, code = await factory.CodeSentToAsync(email) }, Ct);
        Assert.Equal(HttpStatusCode.OK, confirmed.StatusCode);
        Assert.Equal(["password/completed"], counted.Taken());

        // An address that has an account is sent the way back in, not a code to sign up with: nothing starts.
        await AgeAttemptsAsync(email);
        await Accounts.StartSignUpAsync(client, email);
        Assert.Empty(counted.Taken());

        // A provider: a new identity back from it is "started"; its name and the terms make the account.
        var browser = app.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        var providerEmail = Accounts.NewEmail();
        await FakeProvider.ComeBackAsync(browser, Guid.NewGuid().ToString("N"), providerEmail, verified: true);
        Assert.Equal(["fake/started"], counted.Taken());
        var done = await browser.PostAsJsonAsync(
            Url("/api/auth/external/pending/signup"),
            new { displayName = "Cáo Nhanh", acceptTerms = true, termsVersion = Accounts.TermsVersion },
            Ct);
        Assert.Equal(HttpStatusCode.OK, done.StatusCode);
        Assert.Equal(["fake/completed"], counted.Taken());

        // A provider that vouches for the address of an existing account is a link, not a sign-up.
        await FakeProvider.ComeBackAsync(app.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false }),
            Guid.NewGuid().ToString("N"), email, verified: true);
        Assert.Empty(counted.Taken());
    }

    private async Task AgeAttemptsAsync(string email)
    {
        using var scope = factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<ToheDbContext>().AuthAttempts
            .Where(a => a.NormalizedEmail == email.ToUpperInvariant())
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.CreatedAt, DateTimeOffset.UtcNow.AddMinutes(-2)), Ct);
    }

    /// <summary>Hears <c>tohe_sign_ups</c> from the meter itself, as <c>method/outcome</c>.</summary>
    private sealed class SignUpListener : IDisposable
    {
        private readonly MeterListener _listener = new();
        private readonly List<string> _heard = [];

        public SignUpListener()
        {
            _listener.InstrumentPublished = (instrument, listener) =>
            {
                if (instrument.Meter.Name == ToheMetrics.MeterName && instrument.Name == "sign_ups")
                {
                    listener.EnableMeasurementEvents(instrument);
                }
            };
            _listener.SetMeasurementEventCallback<long>((_, _, tags, _) =>
            {
                var pairs = tags.ToArray().ToDictionary(t => t.Key, t => t.Value?.ToString() ?? "");
                lock (_heard)
                {
                    _heard.Add($"{pairs["method"]}/{pairs["outcome"]}");
                }
            });
            _listener.Start();
        }

        /// <summary>What was counted since the last call.</summary>
        public string[] Taken()
        {
            lock (_heard)
            {
                var taken = _heard.ToArray();
                _heard.Clear();
                return taken;
            }
        }

        public void Dispose() => _listener.Dispose();
    }

    private static Uri Url(string path) => new(path, UriKind.Relative);
}
