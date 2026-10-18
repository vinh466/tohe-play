using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Admin;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Integrity;
using Tohe.Api.Modules.Progress;

namespace Tohe.Api.Tests;

/// <summary>
/// The console's review (ADR 0029): held results wait for a person with what the profile did before; approving puts one
/// on boards at the value approved, rejecting takes it off every board, and any decision — a person's or the engine's
/// rejection — is found again and reopened. Nobody decides about their own results. A moderator hides a profile from
/// public boards whatever its switch says, and its owner is told.
/// </summary>
public sealed class AdminReviewTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    [Fact]
    public async Task A_held_result_waits_with_its_history_and_approving_puts_it_on_boards_at_the_value_approved()
    {
        await Games.KnowAsync(factory, "merge-block");
        var moderator = await Admins.NewAsync(factory, "moderator");
        var (client, me) = await PlayerAsync("Bé Su");
        var jump = await HeldJumpAsync(client);
        var id = await ResultIdAsync(me, jump);

        var queue = await HeldAsync(moderator.Client);
        var entry = Assert.Single(queue.Results, entry => entry.Result.Id == id);
        Assert.Equal(("held", "personal_jump", "device", null), (entry.Result.Level, entry.Result.Reason, entry.Result.Evidence, entry.Result.By));
        Assert.Equal((me.Profiles[0].PublicId, "Bé Su", me.Account.Id), (entry.Player!.PublicId, entry.Player.Name, entry.Player.AccountId));
        Assert.True(queue.Held >= 1);

        var detail = await DetailAsync(moderator.Client, id);
        Assert.Equal((100d, IntegrityEngine.JumpHistory, 10), (detail.History.Best, detail.History.Runs, detail.History.Recent.Count));
        Assert.Null(detail.Ranked);
        Assert.Equal("personal_jump", Assert.Single(detail.Decisions).Reason);

        var approved = await DecideAsync(moderator.Client, id, "approve", "Bé chơi giỏi thật");
        Assert.Equal(("checked", "approved", moderator.Email), (approved.Result.Level, approved.Result.Reason, approved.Result.By));
        var decision = approved.Decisions[^1];
        Assert.Equal(("held", "checked", moderator.Email), (decision.From, decision.To, decision.Actor));
        Assert.Equal("Bé chơi giỏi thật", decision.Details!.Value.GetProperty("note").GetString());
        Assert.DoesNotContain((await HeldAsync(moderator.Client)).Results, entry => entry.Result.Id == id);
        var row = Assert.Single((await BoardAsync(client)).Rows);
        Assert.Equal((501d, false), (row.Value, row.UnderReview));

        // A person approved 501: the same run, reported again higher, stays as it was approved.
        await RecordAsync(client, Run(jump, 9000));
        var again = await DetailAsync(moderator.Client, id);
        Assert.Equal((501d, "checked", 2), (again.Result.Value, again.Result.Level, again.Decisions.Count));

        var twice = await moderator.Client.PostAsJsonAsync(Url($"/api/admin/review/{id}/approve"), new { note = (string?)null }, Ct);
        Assert.Equal((HttpStatusCode.Conflict, "review_not_allowed"), (twice.StatusCode, await CodeOfAsync(twice)));
        Assert.Equal([AuditActions.ResultApprove], await AuditAsync($"result {id}"));
    }

    [Fact]
    public async Task A_rejected_result_counts_nowhere_and_any_decision_is_found_again_and_reopened()
    {
        await Games.KnowAsync(factory, "merge-block");
        var admin = await Admins.NewAsync(factory, "admin");
        var (client, me) = await PlayerAsync("Bố Tí");
        var id = await ResultIdAsync(me, await HeldJumpAsync(client));

        Assert.Equal("rejected", (await DecideAsync(admin.Client, id, "reject", "Không ai đạt nổi trong hai phút")).Result.Level);
        var trusted = Assert.Single((await BoardAsync(client)).Rows);
        Assert.Equal((100d, false), (trusted.Value, trusted.UnderReview));
        var again = await admin.Client.PostAsJsonAsync(Url($"/api/admin/review/{id}/reject"), new { note = (string?)null }, Ct);
        Assert.Equal("review_not_allowed", await CodeOfAsync(again));

        // The engine's rejections are found with people's decisions, the latest first.
        var unknown = Guid.NewGuid();
        await RecordAsync(client, Run(unknown, 50, game: "khong-co-game"));
        var unknownId = await ResultIdAsync(me, unknown);
        var decided = (await admin.Client.GetFromJsonAsync<ReviewPage>(Url("/api/admin/review/decided"), Ct))!.Results
            .Where(entry => entry.Result.ProfileId == me.Profiles[0].Id)
            .Select(entry => (entry.Result.Id, entry.Result.Reason, entry.Result.By));
        Assert.Equal([(unknownId, "unknown_game", null), (id, "rejected", admin.Email)], decided);

        var reopened = await DecideAsync(admin.Client, id, "reopen", null);
        Assert.Equal(("held", "reopened"), (reopened.Result.Level, reopened.Result.Reason));
        Assert.Contains((await HeldAsync(admin.Client)).Results, entry => entry.Result.Id == id);
        var underReview = Assert.Single((await BoardAsync(client)).Rows);
        Assert.Equal((501d, true), (underReview.Value, underReview.UnderReview));

        var approved = await DecideAsync(admin.Client, id, "approve", null);
        Assert.Equal(
            [(null, "held", "personal_jump"), ("held", "rejected", "rejected"), ("rejected", "held", "reopened"), ("held", "checked", "approved")],
            approved.Decisions.Select(decision => (decision.From, decision.To, decision.Reason)));
        Assert.Equal([AuditActions.ResultApprove, AuditActions.ResultReopen, AuditActions.ResultReject], await AuditAsync($"result {id}"));
        Assert.Equal("held", (await DecideAsync(admin.Client, unknownId, "reopen", null)).Result.Level);
    }

    [Fact]
    public async Task A_replayed_run_held_for_speed_is_approved_verified_and_nobody_decides_about_their_own()
    {
        var owner = await Admins.NewAsync(factory, "owner");
        var viewer = await Admins.NewAsync(factory, "viewer");
        var (_, me) = await PlayerAsync("Chị Hai");
        var fast = await HeldRankedRunAsync(me.Account.Id);

        var detail = await DetailAsync(owner.Client, fast);
        Assert.Equal(("too_fast", "replayed"), (detail.Result.Reason, detail.Result.Evidence));
        Assert.Equal((40, 3d, 150, 700d, 700d), (detail.Ranked!.Moves, detail.Ranked.Seconds, detail.Ranked.MinMsPerMove, detail.Ranked.Claimed, detail.Ranked.Replayed));

        // A viewer reads the console, not the review; every decision needs step-up level 2 on the device.
        Assert.Equal("admin_required", await CodeOfAsync(await viewer.Client.GetAsync(Url("/api/admin/review"), Ct)));
        var laptop = await Admins.SignInAsync(factory, owner.Email);
        await laptop.PostAsJsonAsync(Url("/api/admin/two-factor/verify"), new { code = Totp.Code(owner.Key, DateTimeOffset.UtcNow.AddSeconds(30)) }, Ct);
        var notStepped = await laptop.PostAsJsonAsync(Url($"/api/admin/review/{fast}/approve"), new { note = (string?)null }, Ct);
        Assert.Equal("step_up_required", await CodeOfAsync(notStepped));

        var tooLong = await owner.Client.PostAsJsonAsync(Url($"/api/admin/review/{fast}/approve"), new { note = new string('x', 301) }, Ct);
        Assert.Contains("note_too_long", (await ErrorsAsync(tooLong))["note"]);
        Assert.Equal("verified", (await DecideAsync(owner.Client, fast, "approve", null)).Result.Level);

        // Not even an owner decides about their own results.
        var own = await HeldRankedRunAsync(owner.AccountId);
        var refused = await owner.Client.PostAsJsonAsync(Url($"/api/admin/review/{own}/reject"), new { note = "x" }, Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "admin_self"), (refused.StatusCode, await CodeOfAsync(refused)));
        Assert.Equal(HttpStatusCode.NotFound, (await owner.Client.GetAsync(Url($"/api/admin/review/{long.MaxValue}"), Ct)).StatusCode);
    }

    [Fact]
    public async Task A_hidden_profile_is_off_public_boards_whatever_its_switch_says_and_its_owner_is_told()
    {
        await Games.KnowAsync(factory, "merge-block");
        var moderator = await Admins.NewAsync(factory, "moderator");
        var admin = await Admins.NewAsync(factory, "admin");
        var (client, me) = await PlayerAsync("Bé Mơ");
        await JoinAsync(await CommunityAsync("Lớp 3A"), me.Account.Id);
        await RecordAsync(client, Run(Guid.NewGuid(), 300));
        Assert.Single((await PublicAsync(client)).Top);

        var profile = me.Profiles[0].Id;
        var noReason = await moderator.Client.PostAsJsonAsync(Url($"/api/admin/profiles/{profile}/hidden"), new { reason = " " }, Ct);
        Assert.Contains("reason_required", (await ErrorsAsync(noReason))["reason"]);
        var hidden = await moderator.Client.PostAsJsonAsync(Url($"/api/admin/profiles/{profile}/hidden"), new { reason = "Điểm lạ nhiều lần" }, Ct);
        var shown = Assert.Single((await hidden.Content.ReadFromJsonAsync<AccountDetail>(Ct))!.Profiles);
        Assert.Equal((true, true), (shown.OnPublicBoards, shown.HiddenFromBoards));
        Assert.Empty((await PublicAsync(client)).Top);

        // Its owner is told, and switching it off and on again does not bring it back.
        Assert.True(Assert.Single((await client.GetFromJsonAsync<MeView>(Url("/api/auth/me"), Ct))!.Profiles).HiddenFromBoards);
        await Accounts.StepUpAsync(client);
        foreach (var on in (bool[])[false, true])
        {
            var switched = await client.PatchAsJsonAsync(Url($"/api/profiles/{profile}"), new { onPublicBoards = on }, Ct);
            Assert.Equal(HttpStatusCode.OK, switched.StatusCode);
        }

        Assert.Empty((await PublicAsync(client)).Top);

        var back = await moderator.Client.DeleteAsync(Url($"/api/admin/profiles/{profile}/hidden"), Ct);
        Assert.False(Assert.Single((await back.Content.ReadFromJsonAsync<AccountDetail>(Ct))!.Profiles).HiddenFromBoards);
        Assert.Single((await PublicAsync(client)).Top);
        Assert.Equal([AuditActions.ProfileShow, AuditActions.ProfileHide], await AuditAsync($"{me.Profiles[0].PublicId} (Bé Mơ)"));

        // Not one's own profile, nor one of an account whose role is as strong.
        var ownCode = await CodeOfAsync(await moderator.Client.PostAsJsonAsync(
            Url($"/api/admin/profiles/{await ProfileOfAsync(moderator.AccountId)}/hidden"), new { reason = "x" }, Ct));
        var rankCode = await CodeOfAsync(await moderator.Client.PostAsJsonAsync(
            Url($"/api/admin/profiles/{await ProfileOfAsync(admin.AccountId)}/hidden"), new { reason = "x" }, Ct));
        Assert.Equal(("admin_self", "admin_rank"), (ownCode, rankCode));
    }

    // ------------------------------------------------------------------ helpers

    private static ScoreInput Run(Guid id, double value, string game = "merge-block") =>
        new(id, game, "default", value, DateTimeOffset.UtcNow);

    private async Task<(HttpClient Client, MeView Me)> PlayerAsync(string name)
    {
        var client = factory.CreateClient();
        var me = await Accounts.SignUpAsync(factory, client, name);
        var response = await client.PutAsJsonAsync(Url("/api/session/profile"), new { profileId = me.Profiles[0].Id }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (client, me);
    }

    /// <summary>Ten runs of 100, then one of 501: held, <c>personal_jump</c>. Returns that run.</summary>
    private static async Task<Guid> HeldJumpAsync(HttpClient client)
    {
        await RecordAsync(client, [.. Enumerable.Range(0, IntegrityEngine.JumpHistory).Select(_ => Run(Guid.NewGuid(), 100))]);
        var jump = Guid.NewGuid();
        await RecordAsync(client, Run(jump, 100 * IntegrityEngine.JumpFactor + 1));
        return jump;
    }

    /// <summary>A ranked run of the account's first profile whose replay agreed, held as faster than a person plays.</summary>
    private async Task<long> HeldRankedRunAsync(Guid accountId)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var profile = await ProfileOfAsync(accountId);
        var now = DateTimeOffset.UtcNow;
        var result = new IntegrityResult
        {
            Kind = ResultKind.Run,
            ProfileId = profile,
            AccountId = accountId,
            GameId = "merge-block",
            Board = "default",
            Value = 700,
            Source = $"test:{Guid.NewGuid():N}",
            Final = true,
            Level = TrustLevel.Held,
            At = now,
            RuleVersion = IntegrityEngine.RuleVersion,
        };
        db.IntegrityDecisions.Add(new IntegrityDecision { Result = result, To = TrustLevel.Held, Reason = "too_fast", RuleVersion = IntegrityEngine.RuleVersion, At = now });
        db.RankedRuns.Add(new RankedRun
        {
            Id = Guid.CreateVersion7(),
            ProfileId = profile,
            AccountId = accountId,
            GameId = "merge-block",
            GamePath = "merge-block/1.9.0/",
            Verify = "verify.js",
            Board = "default",
            MinMsPerMove = 150,
            MaxMoves = 20000,
            Seed = 7,
            State = RankedRunState.Decided,
            StartedAt = now.AddSeconds(-3),
            FinishedAt = now,
            Moves = "[]",
            MoveCount = 40,
            Claimed = 700,
            Replayed = 700,
            Result = result,
        });
        await db.SaveChangesAsync(Ct);
        return result.Id;
    }

    private static async Task RecordAsync(HttpClient client, params ScoreInput[] scores)
    {
        var response = await client.PostAsJsonAsync(Url("/api/progress/scores"), new { scores }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task<ReviewPage> HeldAsync(HttpClient admin) =>
        (await admin.GetFromJsonAsync<ReviewPage>(Url("/api/admin/review"), Ct))!;

    private static async Task<ReviewDetail> DetailAsync(HttpClient admin, long id) =>
        (await admin.GetFromJsonAsync<ReviewDetail>(Url($"/api/admin/review/{id}"), Ct))!;

    private static async Task<ReviewDetail> DecideAsync(HttpClient admin, long id, string decision, string? note)
    {
        var response = await admin.PostAsJsonAsync(Url($"/api/admin/review/{id}/{decision}"), new { note }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ReviewDetail>(Ct))!;
    }

    private static async Task<AccountBoardView> BoardAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<AccountBoardView>(Url("/api/boards/merge-block?period=all"), Ct))!;

    private static async Task<PublicBoardView> PublicAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<PublicBoardView>(Url("/api/boards/merge-block/public?scope=community&period=week"), Ct))!;

    private async Task<long> ResultIdAsync(MeView me, Guid run)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var source = IntegrityEngine.RunSource(me.Profiles[0].Id, run);
        return await scope.ServiceProvider.GetRequiredService<ToheDbContext>().IntegrityResults
            .Where(result => result.Source == source)
            .Select(result => result.Id)
            .SingleAsync(Ct);
    }

    private async Task<Guid> ProfileOfAsync(Guid accountId)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<ToheDbContext>().Profiles
            .Where(profile => profile.AccountId == accountId)
            .OrderBy(profile => profile.CreatedAt)
            .Select(profile => profile.Id)
            .FirstAsync(Ct);
    }

    private async Task<Guid> CommunityAsync(string name)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var community = new Community { Id = Guid.CreateVersion7(), Name = $"{name} {Guid.NewGuid():N}", CreatedAt = DateTimeOffset.UtcNow };
        db.Communities.Add(community);
        await db.SaveChangesAsync(Ct);
        return community.Id;
    }

    private async Task JoinAsync(Guid community, Guid accountId)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<ToheDbContext>().Users
            .Where(account => account.Id == accountId)
            .ExecuteUpdateAsync(s => s.SetProperty(account => account.CommunityId, community), Ct);
    }

    /// <summary>The actions logged on exactly this target, newest first.</summary>
    private async Task<List<string>> AuditAsync(string target)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<ToheDbContext>().AuditLog
            .Where(entry => entry.Target == target)
            .OrderByDescending(entry => entry.Id)
            .Select(entry => entry.Action)
            .ToListAsync(Ct);
    }

    private static async Task<string?> CodeOfAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    private static async Task<Dictionary<string, string[]>> ErrorsAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.GetProperty("errors").Deserialize<Dictionary<string, string[]>>()!;
    }

    private static Uri Url(string path) => new(path, UriKind.Relative);
}
