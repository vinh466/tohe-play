using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Net.Sockets;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure;
using Tohe.Api.Modules.Admin;

namespace Tohe.Api.Tests;

/// <summary>/metrics on a port of its own (ADR 0036): Tò He's numbers with ASP.NET Core's, and nothing on the API's port.</summary>
public sealed class MetricsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Metrics_are_served_on_their_own_port_from_the_first_request_on()
    {
        var port = FreePort();
        await using var app = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Metrics:Enabled", "true");
            builder.UseSetting("Metrics:Port", port.ToString(CultureInfo.InvariantCulture));
        });
        var client = app.CreateClient();

        // Before any scrape: a refused sign-in, a request, a worker's failed run.
        var refused = await client.PostAsJsonAsync(Url("/api/auth/login"), new { email = "nobody@tohe.test", password = "wrong-password" }, Ct);
        Assert.Equal(HttpStatusCode.Unauthorized, refused.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(Url("/api/health"), Ct)).StatusCode);
        app.Services.GetRequiredService<BackgroundWork>().Failed(BackgroundWork.EmailDelivery, new InvalidOperationException("relay down"));
        await using (var scope = app.Services.CreateAsyncScope())
        {
            await scope.ServiceProvider.GetRequiredService<MetricsSample>().RunAsync(Ct);
        }

        using var scraper = new HttpClient();
        var text = await scraper.GetStringAsync(new Uri($"http://localhost:{port}/metrics"), Ct);

        foreach (var line in (string[])
                 [
                     "tohe_database_up 1",
                     "tohe_rooms_open 0",
                     "tohe_email_outbox_waiting 0",
                     "tohe_integrity_held 0",
                     "tohe_ranked_replays_waiting 0",
                     "tohe_account_deletions_due 0",
                     "tohe_sign_ins{method=\"password\",outcome=\"refused\"} 1",
                     "tohe_worker_failures_in_row{worker=\"email-delivery\"} 1",
                 ])
        {
            Assert.True(text.Contains(line, StringComparison.Ordinal), $"no \"{line}\" in:\n{text}");
        }

        // ASP.NET Core's requests by route and status, with the seconds' buckets.
        Assert.Contains("http_server_request_duration_bucket{", text, StringComparison.Ordinal);
        Assert.Contains("http_response_status_code=\"401\"", text, StringComparison.Ordinal);
        Assert.Contains("le=\"0.25\"", text, StringComparison.Ordinal);
        // Never on the API's own port.
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(Url("/metrics"), Ct)).StatusCode);
    }

    private static int FreePort()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        return ((IPEndPoint)listener.LocalEndpoint).Port;
    }

    private static Uri Url(string path) => new(path, UriKind.Relative);
}
