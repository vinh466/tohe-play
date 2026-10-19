using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Dev;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Integrity;
using Tohe.Api.Modules.Registry;

namespace Tohe.Api.Tests;

/// <summary>
/// <c>dotnet Tohe.Api.dll dev seed</c>: demo data for a development database, and only there. A database of its own: the
/// tests count what the seed made.
/// </summary>
public sealed class DevSeedTests(ApiFactory factory) : IClassFixture<ApiFactory>, IAsyncDisposable
{
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    /// <summary>The same API, as <c>ASPNETCORE_ENVIRONMENT=Development</c> runs it.</summary>
    private readonly WebApplicationFactory<Program> _development = factory.WithWebHostBuilder(builder => builder.UseEnvironment("Development"));

    public ValueTask DisposeAsync() => _development.DisposeAsync();

    [Fact]
    public async Task It_refuses_outside_development_and_leaves_the_database_alone()
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var before = (await db.Users.CountAsync(Ct), await db.Profiles.CountAsync(Ct), await db.Scores.CountAsync(Ct));

        // The test host runs as "Testing", as UAT and production run as "Production": neither is Development.
        var (exit, output) = await CommandAsync(factory, "dev", "seed");

        Assert.Equal(2, exit);
        Assert.Contains("not Development", output, StringComparison.Ordinal);
        Assert.Equal(before, (await db.Users.CountAsync(Ct), await db.Profiles.CountAsync(Ct), await db.Scores.CountAsync(Ct)));
    }

    [Fact]
    public async Task It_refuses_in_development_without_the_seed_setting_and_leaves_the_database_alone()
    {
        // A UAT or production container asked to run as Development: its configuration does not allow seeding.
        await using var asked = factory.WithWebHostBuilder(builder =>
            builder.UseEnvironment("Development").UseSetting("Dev:SeedAllowed", "false"));
        await using var scope = asked.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var before = (await db.Users.CountAsync(Ct), await db.Profiles.CountAsync(Ct), await db.Scores.CountAsync(Ct));

        var (exit, output) = await CommandAsync(asked, "dev", "seed");

        Assert.Equal(2, exit);
        Assert.Contains("Dev:SeedAllowed", output, StringComparison.Ordinal);
        Assert.Equal(before, (await db.Users.CountAsync(Ct), await db.Profiles.CountAsync(Ct), await db.Scores.CountAsync(Ct)));
    }

    [Fact]
    public async Task It_needs_a_command_it_knows()
    {
        var (exit, output) = await CommandAsync(_development, "dev");

        Assert.Equal(2, exit);
        Assert.Contains("dev seed", output, StringComparison.Ordinal);
    }

    [Fact]
    public async Task It_seeds_a_family_and_a_friend_whose_invariants_hold_and_seeding_again_changes_nothing()
    {
        // A first start: the registry knows no game yet, so there are accounts and profiles but no scores.
        var first = await CommandAsync(_development, "dev", "seed");

        Assert.Equal(0, first.Exit);
        Assert.Contains(DevSeed.FamilyEmail, first.Output, StringComparison.Ordinal);
        Assert.Contains(DevSeed.FriendEmail, first.Output, StringComparison.Ordinal);
        Assert.Contains(DevSeed.Password, first.Output, StringComparison.Ordinal);
        Assert.Contains("No scores yet", first.Output, StringComparison.Ordinal);

        await using var scope = _development.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var family = await db.Users.SingleAsync(account => account.Email == DevSeed.FamilyEmail, Ct);
        var friend = await db.Users.SingleAsync(account => account.Email == DevSeed.FriendEmail, Ct);
        Assert.All([family, friend], account =>
        {
            Assert.True(account.EmailConfirmed);
            Assert.Equal(DevSeed.TermsVersion, account.TermsVersion);
            Assert.NotNull(account.TermsAcceptedAt);
            Assert.NotNull(account.PasswordHash);
            Assert.True(ManagePins.Verify(account, DevSeed.ManagePin));
        });

        var familyProfiles = await db.Profiles.Where(p => p.AccountId == family.Id).OrderBy(p => p.CreatedAt).ToListAsync(Ct);
        Assert.Equal(2, familyProfiles.Count);
        var (adult, child) = (familyProfiles[0], familyProfiles[1]);
        Assert.Equal((ProfileKind.Adult, null, true, InviteScope.Anyone), (adult.Kind, adult.AgeBand, adult.OnPublicBoards, adult.Invites));
        // The child template of POST /api/profiles: an age band, off public boards, asked to tables only within its account.
        Assert.Equal(
            (ProfileKind.Child, "6-8", false, InviteScope.Account, false),
            (child.Kind, child.AgeBand, child.OnPublicBoards, child.Invites, child.PlayWithOthers));
        Assert.Single(await db.Profiles.Where(p => p.AccountId == friend.Id).ToListAsync(Ct));

        var profiles = await db.Profiles.ToListAsync(Ct);
        Assert.All(profiles, profile =>
        {
            Assert.True(ProfileIds.TryNormalize(profile.PublicId, out var normalized));
            Assert.Equal(profile.PublicId, normalized);
        });
        Assert.Equal(profiles.Count, profiles.Select(p => p.PublicId).Distinct().Count());
        Assert.Equal(0, await db.Scores.CountAsync(Ct));

        // The games arrive; the next seeding adds three runs of the one that takes scores to each of the three profiles,
        // each decided by the engine. A game without scores, and a game played at tables, get none.
        await Games.KnowAsync(factory, "hello");
        await AddGameAsync("tap-merge", scores: true);
        await AddGameAsync("tien-len", scores: true, rooms: """{ "seats": { "min": 2, "max": 4 } }""");
        var second = await CommandAsync(_development, "dev", "seed");

        Assert.Equal(0, second.Exit);
        Assert.Contains("tap-merge", second.Output, StringComparison.Ordinal);
        Assert.Equal(9, await db.Scores.CountAsync(Ct));
        Assert.All(await db.Scores.ToListAsync(Ct), score => Assert.Equal("tap-merge", score.GameId));
        var results = await db.IntegrityResults.ToListAsync(Ct);
        Assert.Equal(9, results.Count);
        Assert.All(results, result => Assert.Equal(TrustLevel.Checked, result.Level));

        // And again: everything is there, so nothing changes.
        var snapshot = await SnapshotAsync(db);
        var third = await CommandAsync(_development, "dev", "seed");

        Assert.Equal(0, third.Exit);
        Assert.Equal(snapshot, await SnapshotAsync(db));
        Assert.Contains("0 new run(s)", third.Output, StringComparison.Ordinal);
    }

    private static async Task<string> SnapshotAsync(ToheDbContext db)
    {
        var accounts = await db.Users.OrderBy(a => a.Email).Select(a => $"{a.Id} {a.Email} {a.PasswordHash} {a.ManagePinHash}").ToListAsync(Ct);
        var profiles = await db.Profiles.OrderBy(p => p.PublicId).Select(p => $"{p.Id} {p.PublicId} {p.Name}").ToListAsync(Ct);
        var scores = await db.Scores.OrderBy(s => s.Id).Select(s => $"{s.Id} {s.ClientId} {s.Value}").ToListAsync(Ct);
        var results = await db.IntegrityResults.OrderBy(r => r.Id).Select(r => $"{r.Id} {r.Source} {r.Level}").ToListAsync(Ct);
        return string.Join('\n', [.. accounts, .. profiles, .. scores, .. results]);
    }

    [Fact]
    public async Task The_demo_accounts_sign_in_and_the_manage_pin_opens_profile_management()
    {
        await CommandAsync(_development, "dev", "seed");

        var client = _development.CreateClient();
        var login = await client.PostAsJsonAsync(
            new Uri("/api/auth/login", UriKind.Relative), new { email = DevSeed.FamilyEmail, password = DevSeed.Password }, Ct);
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var me = (await login.Content.ReadFromJsonAsync<MeView>(Ct))!;
        Assert.Equal(["Bố Minh", "Bé Na"], me.Profiles.Select(p => p.Name));
        Assert.Equal(("adult", "child"), (me.Profiles[0].Kind, me.Profiles[1].Kind));
        Assert.True(me.Account.HasManagePin);
        Assert.Equal(DevSeed.TermsVersion, me.Account.TermsVersion);
        Assert.Null(me.Account.Role);

        var gate = await client.PostAsJsonAsync(new Uri("/api/session/parent-gate", UriKind.Relative), new { pin = DevSeed.ManagePin }, Ct);
        Assert.Equal(HttpStatusCode.OK, gate.StatusCode);
        Assert.NotNull((await gate.Content.ReadFromJsonAsync<MeView>(Ct))!.ParentUnlockedUntil);

        var friend = _development.CreateClient();
        var friendLogin = await friend.PostAsJsonAsync(
            new Uri("/api/auth/login", UriKind.Relative), new { email = DevSeed.FriendEmail, password = DevSeed.Password }, Ct);
        Assert.Equal(HttpStatusCode.OK, friendLogin.StatusCode);
        Assert.Equal("Cô Lan", Assert.Single((await friendLogin.Content.ReadFromJsonAsync<MeView>(Ct))!.Profiles).Name);
    }

    [Fact]
    public void The_terms_version_is_the_one_the_hub_shows()
    {
        // The hub asks for the terms again unless an account holds exactly its version: a seed that fell behind would
        // greet every demo account with the consent screen.
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "pnpm-workspace.yaml")))
        {
            directory = directory.Parent;
        }

        Assert.NotNull(directory);
        var documents = File.ReadAllText(Path.Combine(directory.FullName, "apps", "hub", "src", "legal", "documents.ts"));
        var version = Regex.Match(documents, @"TERMS_VERSION\s*=\s*'([^']+)'");
        Assert.True(version.Success);
        Assert.Equal(DevSeed.TermsVersion, version.Groups[1].Value);
    }

    private async Task AddGameAsync(string id, bool scores, string? rooms = null)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        db.Games.Add(new Game
        {
            Id = id,
            Version = "1.0.0",
            Name = id,
            Path = $"{id}/1.0.0/",
            Entry = "index.html",
            Orientation = "portrait",
            Capabilities = scores ? ["save", "scores"] : [],
            Rooms = rooms,
            FirstSeenAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync(Ct);
    }

    /// <summary><c>dotnet Tohe.Api.dll …</c>, as inside the API's container.</summary>
    private static async Task<(int Exit, string Output)> CommandAsync(WebApplicationFactory<Program> app, params string[] args)
    {
        using var output = new StringWriter();
        using var error = new StringWriter();
        var exit = await DevCommand.RunAsync(app.Services, args, output, error);
        return (exit, output.ToString() + error);
    }
}
