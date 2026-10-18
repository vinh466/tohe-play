using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Platform;
using Tohe.Api.Modules.Telemetry;

namespace Tohe.Api.Tests;

public sealed class TelemetryTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string Password = "mat-khau-cua-bo";
    private const string AndroidChrome =
        "Mozilla/5.0 (Linux; Android 15; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";
    private const string IPhoneSafari =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1";
    private const string Headless =
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.0.0 Safari/537.36";
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    private static readonly TelemetryContext Phone = new("64d9ff6", "phone", 400, 850, 2.625, 8, 8);

    [Fact]
    public async Task A_batch_is_stored_with_the_platform_reduced_from_the_user_agent()
    {
        var device = Guid.NewGuid();
        var response = await SendAsync(AndroidChrome, Batch(device, Guid.NewGuid(),
            new TelemetryEventInput("error", "game", "tap-merge", "0.4.1", Message: "TypeError: cell 3 missing", Stack: "at tap (/tap-merge/0.4.1/assets/index.js:1:200)"),
            new TelemetryEventInput("count", "game", "tap-merge", "0.4.1", Name: "kit.renderer.webgl", Count: 1),
            new TelemetryEventInput("metric", "game", "tap-merge", "0.4.1", Name: "kit.first-frame-ms", Value: 812),
            new TelemetryEventInput("frames", "game", "tap-merge", "0.4.1", Buckets: [3500, 20, 5, 1, 0, 0], SlowestMs: 48, StepP50Ms: 1.2, StepP95Ms: 3.4, Renderer: "webgl")));

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var session = await db.TelemetrySessions.SingleAsync(s => s.DeviceId == device, Ct);
        Assert.Equal(("Android", "15", "Chrome", "141"), (session.Os, session.OsVersion, session.Browser, session.BrowserVersion));
        Assert.Equal(8, session.Cores);
        var events = await db.TelemetryRecords.Where(e => e.SessionId == session.Id).ToListAsync(Ct);
        Assert.Equal(4, events.Count);
        var error = events.Single(e => e.Kind == "error");
        Assert.Equal("TypeError: cell # missing|at tap (/tap-merge/#.#.#/assets/index.js)", error.Fingerprint);
        Assert.Equal([3500, 20, 5, 1, 0, 0], events.Single(e => e.Kind == "frames").Buckets!);
    }

    [Fact]
    public async Task A_second_batch_of_the_same_session_adds_events_to_it()
    {
        var (device, session) = (Guid.NewGuid(), Guid.NewGuid());
        var count = new TelemetryEventInput("count", Name: "hub.sync.failed", Count: 1);
        await SendAsync(AndroidChrome, Batch(device, session, count));
        await SendAsync(AndroidChrome, Batch(device, session, count));

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var stored = await db.TelemetrySessions.SingleAsync(s => s.DeviceId == device, Ct);
        Assert.Equal(2, await db.TelemetryRecords.CountAsync(e => e.SessionId == stored.Id, Ct));
    }

    [Fact]
    public async Task Batches_of_a_new_session_that_arrive_together_all_land_in_one_session()
    {
        // The hub sends when the page is hidden and again on pagehide (web vitals arrive in between).
        var (device, session) = (Guid.NewGuid(), Guid.NewGuid());
        var count = new TelemetryEventInput("count", Name: "hub.play.session", Count: 1);
        var responses = await Task.WhenAll(
            Enumerable.Range(0, 6).Select(_ => SendAsync(AndroidChrome, Batch(device, session, count))));

        Assert.All(responses, response => Assert.Equal(HttpStatusCode.Accepted, response.StatusCode));
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var stored = await db.TelemetrySessions.SingleAsync(s => s.DeviceId == device, Ct);
        Assert.Equal(6, await db.TelemetryRecords.CountAsync(e => e.SessionId == stored.Id, Ct));
    }

    [Theory]
    [InlineData("""{ "kind": "count", "name": "Na scored 40", "count": 1 }""", "event_invalid")]
    [InlineData("""{ "kind": "count", "source": "game", "name": "a.b", "count": 1 }""", "event_invalid")]
    [InlineData("""{ "kind": "metric", "name": "a.b-ms", "value": -1 }""", "event_invalid")]
    [InlineData("""{ "kind": "frames", "buckets": [1, 2], "slowestMs": 1 }""", "event_invalid")]
    [InlineData("""{ "kind": "error", "message": "" }""", "event_invalid")]
    [InlineData("""{ "kind": "sound", "name": "a.b" }""", "event_invalid")]
    public async Task Malformed_events_are_refused(string json, string code)
    {
        var body = $$"""{ "deviceId": "{{Guid.NewGuid()}}", "sessionId": "{{Guid.NewGuid()}}", "context": {{JsonSerializer.Serialize(Phone, Json)}}, "events": [{{json}}] }""";
        var response = await RawAsync(body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(code, await response.Content.ReadAsStringAsync(Ct), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Oversized_batches_and_bad_contexts_are_refused()
    {
        var many = string.Join(',', Enumerable.Repeat("""{"kind":"count","name":"a.b","count":1}""", 201));
        var tooMany = await RawAsync(
            $$"""{ "deviceId": "{{Guid.NewGuid()}}", "sessionId": "{{Guid.NewGuid()}}", "context": {{JsonSerializer.Serialize(Phone, Json)}}, "events": [{{many}}] }""");
        Assert.Equal(HttpStatusCode.BadRequest, tooMany.StatusCode);
        Assert.Contains("events", await tooMany.Content.ReadAsStringAsync(Ct), StringComparison.OrdinalIgnoreCase);

        var badContext = await SendAsync(AndroidChrome, new TelemetryBatch(
            Guid.NewGuid(), Guid.NewGuid(), Phone with { DeviceClass = "fridge" }, [new("count", Name: "a.b", Count: 1)]));
        Assert.Contains("context_invalid", await badContext.Content.ReadAsStringAsync(Ct), StringComparison.Ordinal);

        var huge = await RawAsync(new string(' ', 40_000) + "{}");
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, huge.StatusCode);
    }

    [Fact]
    public async Task The_report_needs_the_operator_token()
    {
        var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(Url("/api/telemetry/report"), Ct)).StatusCode);

        using var wrong = new HttpRequestMessage(HttpMethod.Get, Url("/api/telemetry/report"));
        wrong.Headers.Add(TelemetryModule.OperatorHeader, "guess");
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(wrong, Ct)).StatusCode);

        Assert.NotNull(await ReportAsync());
    }

    [Fact]
    public async Task The_report_groups_what_each_game_version_reported()
    {
        const string version = "7.0.0";
        TelemetryEventInput Game(string kind, string? name = null, string? message = null, double? value = null, int[]? buckets = null) =>
            new(kind, "game", "merge-block", version, name, message, Count: kind is "count" ? 1 : null, Value: value,
                Buckets: buckets, SlowestMs: buckets is null ? null : 140, StepP95Ms: buckets is null ? null : 4,
                Renderer: buckets is null ? null : "webgl");
        var phone = Guid.NewGuid();
        await SendAsync(AndroidChrome, Batch(phone, Guid.NewGuid(),
            Game("error", message: "RangeError: column 5 is full"),
            Game("error", message: "RangeError: column 2 is full"),
            Game("frames", buckets: [900, 50, 30, 15, 4, 1]),
            Game("metric", "kit.first-frame-ms", value: 700),
            Game("count", "kit.renderer.webgl"),
            new TelemetryEventInput("count", "hub", "merge-block", version, Name: "hub.play.session", Count: 1),
            new TelemetryEventInput("error", Message: "TypeError: sync broke")));
        await SendAsync(IPhoneSafari, Batch(Guid.NewGuid(), Guid.NewGuid(),
            Game("error", message: "RangeError: column 9 is full"),
            Game("metric", "kit.first-frame-ms", value: 1500)));
        await SendAsync(Headless, Batch(Guid.NewGuid(), Guid.NewGuid(), Game("error", message: "only in tests")));

        var report = (await ReportAsync())!;
        var game = report.Games.Single(g => g.GameId == "merge-block" && g.GameVersion == version);
        var error = Assert.Single(game.Errors);
        Assert.Equal((3, 2, true, "game"), ((int)error.Occurrences, error.Devices, error.New, error.Source));
        Assert.Equal(2, game.Devices);
        Assert.Equal(2, game.SessionsWithErrors);
        var frames = Assert.Single(game.Frames);
        Assert.Equal(("Android", "Chrome", "webgl", 1000L), (frames.Os, frames.Browser, frames.Renderer, frames.Frames));
        Assert.Equal(0.02, frames.SlowShare);
        Assert.Equal("≤ 25 ms", frames.P95);
        var firstFrame = Assert.Single(game.Metrics);
        Assert.Equal((2, 1500.0), (firstFrame.Samples, firstFrame.Max));
        Assert.Contains(game.Counts, c => c.Name == "hub.play.session" && c.Total == 1);
        Assert.Contains(report.Games, g => g.GameId is null && g.Errors.Any(e => e.Message == "TypeError: sync broke"));
        Assert.Contains(report.Devices, d => d.Os == "iOS" && d.OsVersion == "26" && d.Browser == "Safari");
        Assert.DoesNotContain(report.Devices, d => d.Browser == "HeadlessChrome");

        var withHeadless = (await ReportAsync("?includeHeadless=true"))!;
        Assert.Contains(withHeadless.Devices, d => d.Browser == "HeadlessChrome");
    }

    [Fact]
    public async Task Maintenance_rolls_finished_days_up_once_and_deletes_what_is_past_retention()
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var now = DateTimeOffset.UtcNow;
        var session = new TelemetrySession
        {
            DeviceId = Guid.NewGuid(), ClientSessionId = Guid.NewGuid(), FirstSeenAt = now.AddDays(-40), LastSeenAt = now.AddDays(-2),
            HubVersion = "old", Os = "Android", OsVersion = "15", Browser = "Chrome", BrowserVersion = "141",
            DeviceClass = "phone", DisplayMode = "browser", Theme = "light", Locale = "vi",
        };
        TelemetryRecord Record(DateTimeOffset at, string kind, int count = 1, double? value = null, int[]? buckets = null) => new()
        {
            Session = session, ReceivedAt = at, Source = "game", GameId = "maint-game", GameVersion = "1.0.0", Kind = kind,
            Name = kind is "count" or "metric" ? "kit.thing" : null, Count = count, Value = value, Buckets = buckets,
            Message = kind == "error" ? "boom" : null, Fingerprint = kind == "error" ? "boom|" : null, SlowestMs = buckets is null ? null : 50,
        };
        var twoDaysAgo = now.AddDays(-2);
        db.TelemetryRecords.AddRange(
            Record(now.AddDays(-40), "error"),
            Record(twoDaysAgo, "error", count: 3),
            Record(twoDaysAgo, "metric", value: 100),
            Record(twoDaysAgo, "metric", value: 300),
            Record(twoDaysAgo, "frames", buckets: [10, 1, 0, 0, 0, 1]),
            Record(twoDaysAgo, "frames", buckets: [5, 0, 0, 0, 0, 0]));
        await db.SaveChangesAsync(Ct);

        var maintenance = scope.ServiceProvider.GetRequiredService<TelemetryMaintenance>();
        var first = await maintenance.RunAsync(Ct);
        var again = await maintenance.RunAsync(Ct);

        Assert.True(first.RolledUp >= 2);
        Assert.True(first.EventsDeleted >= 1);
        Assert.Equal(0, again.RolledUp);
        var day = DateOnly.FromDateTime(twoDaysAgo.UtcDateTime);
        var rows = await db.TelemetryDays.Where(d => d.GameId == "maint-game" && d.Day == day).ToListAsync(Ct);
        Assert.Equal(3, rows.Single(d => d.Kind == "error").Total);
        Assert.Equal(300, rows.Single(d => d.Kind == "metric").ValueMax);
        Assert.Equal([15L, 1, 0, 0, 0, 1], rows.Single(d => d.Kind == "frames").Buckets!);
        Assert.False(await db.TelemetryRecords.AnyAsync(e => e.GameId == "maint-game" && e.ReceivedAt < now.AddDays(-30), Ct));
    }

    [Fact]
    public async Task The_hub_learns_whether_to_send_from_the_config_and_the_account()
    {
        var client = factory.CreateClient();
        var config = await client.GetFromJsonAsync<ClientConfig>(Url("/api/config"), Ct);
        Assert.True(config!.Telemetry);

        Assert.True((await Accounts.SignUpAsync(factory, client, "Bố")).Account.Telemetry);
        await client.PostAsJsonAsync(Url("/api/session/parent-gate"), new { password = Password }, Ct);

        var off = await client.PatchAsJsonAsync(Url("/api/account"), new { telemetry = false }, Ct);
        var me = (await off.Content.ReadFromJsonAsync<MeView>(Ct))!;
        Assert.False(me.Account.Telemetry);
    }

    [Fact]
    public async Task With_telemetry_off_on_the_server_batches_are_dropped()
    {
        await using var off = factory.WithWebHostBuilder(builder => builder.UseSetting("Telemetry:Enabled", "false"));
        var client = off.CreateClient();
        var device = Guid.NewGuid();

        Assert.False((await client.GetFromJsonAsync<ClientConfig>(Url("/api/config"), Ct))!.Telemetry);
        var response = await client.PostAsJsonAsync(
            Url("/api/telemetry"), Batch(device, Guid.NewGuid(), new TelemetryEventInput("count", Name: "a.b", Count: 1)), Ct);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        Assert.False(await db.TelemetrySessions.AnyAsync(s => s.DeviceId == device, Ct));
    }

    [Theory]
    [InlineData(AndroidChrome, "Android", "15", "Chrome", "141")]
    [InlineData(IPhoneSafari, "iOS", "26", "Safari", "26")]
    [InlineData("Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1", "iOS", "18", "Chrome", "141")]
    [InlineData("Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36", "Android", "14", "Samsung Internet", "28")]
    [InlineData("Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148", "iPadOS", "17", "WebView", "")]
    [InlineData("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0", "Windows", "", "Firefox", "143")]
    [InlineData("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15", "macOS", "10.15", "Safari", "26")]
    [InlineData(Headless, "Linux", "", "HeadlessChrome", "141")]
    [InlineData(null, "Other", "", "Other", "")]
    public void User_agents_are_reduced_to_families_and_major_versions(
        string? userAgent, string os, string osVersion, string browser, string browserVersion) =>
        Assert.Equal(new ReducedAgent(os, osVersion, browser, browserVersion), UserAgents.Reduce(userAgent));

    [Fact]
    public void The_95th_percentile_frame_is_found_in_its_bucket()
    {
        Assert.Equal(0, TelemetryReports.P95Bucket([100, 0, 0, 0, 0, 0]));
        Assert.Equal(2, TelemetryReports.P95Bucket([900, 40, 30, 20, 10, 0]));
        Assert.Equal(5, TelemetryReports.P95Bucket([10, 0, 0, 0, 0, 10]));
    }

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private static TelemetryBatch Batch(Guid device, Guid session, params TelemetryEventInput[] events) =>
        new(device, session, Phone, events);

    private async Task<HttpResponseMessage> SendAsync(string userAgent, TelemetryBatch batch)
    {
        var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, Url("/api/telemetry"))
        {
            Content = JsonContent.Create(batch, options: Json),
        };
        request.Headers.TryAddWithoutValidation("User-Agent", userAgent);
        return await client.SendAsync(request, Ct);
    }

    private async Task<HttpResponseMessage> RawAsync(string json)
    {
        using var content = new StringContent(json, Encoding.UTF8, "application/json");
        return await factory.CreateClient().PostAsync(Url("/api/telemetry"), content, Ct);
    }

    private async Task<TelemetryReport?> ReportAsync(string query = "")
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, Url($"/api/telemetry/report{query}"));
        request.Headers.Add(TelemetryModule.OperatorHeader, ApiFactory.TelemetryToken);
        var response = await factory.CreateClient().SendAsync(request, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<TelemetryReport>(Json, Ct);
    }

    private static Uri Url(string path) => new(path, UriKind.Relative);
}
