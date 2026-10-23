using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Studio;
using static Tohe.Api.Tests.StudioLibrary;

namespace Tohe.Api.Tests;

/// <summary>
/// The Studio's checks as the gate of every draft (ADR 0051, D-09): on every upload — its metadata stripped, its new
/// hash kept — on submitting, again on approving, and on a dry run that saves nothing; and a reviewer approving a style,
/// which a pack version needs before it is approved. Against PostgreSQL and SeaweedFS in containers.
/// </summary>
public sealed class StudioGateTests(ApiFactory factory, SeaweedFs storage)
    : IClassFixture<ApiFactory>, IClassFixture<SeaweedFs>, IAsyncDisposable
{
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    private readonly WebApplicationFactory<Program> _app = WithStorage(factory, storage);

    public ValueTask DisposeAsync() => _app.DisposeAsync();

    [Fact]
    public async Task An_upload_is_checked_and_kept_with_its_metadata_stripped_under_its_new_hash()
    {
        var contributor = await ContributorAsync();
        var styleId = await CorpusStyleAsync(contributor);
        var meta = Of(Fixture("good-meta.png"));
        var bad = Of(Fixture("bad-colour-16.png"));
        var made = await CreateDraftAsync(contributor, NewId("pack"), "1.0.0", styleId, Asset("tree", meta), Asset("rock", bad));
        var draft = (await made.Content.ReadFromJsonAsync<PackVersionView>(Ct))!;

        // A picture off the style's palette is refused, and nothing is kept.
        var refused = await UploadAsync(contributor, draft.Id, bad);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, refused.StatusCode);
        Assert.Equal([("rock", "colour_not_in_palette")], await ProblemsAsync(refused, "checks_failed"));
        Assert.Empty(await storage.KeysAsync($"drafts/{draft.Id}/{bad.Sha256}"));

        // A picture with text chunks is kept without them: its new sha256 and size, which the asset takes.
        var uploaded = await UploadAsync(contributor, draft.Id, meta);
        Assert.Equal(HttpStatusCode.OK, uploaded.StatusCode);
        var kept = (await uploaded.Content.ReadFromJsonAsync<StudioUploadView>(Ct))!;
        Assert.True(kept.Stripped);
        Assert.NotEqual(meta.Sha256, kept.Sha256);
        Assert.True(kept.Bytes < meta.Length);
        Assert.Equal((16, 16), (kept.Width, kept.Height));
        var stored = (await storage.ReadAsync($"drafts/{draft.Id}/{kept.Sha256}.png"))!;
        Assert.Equal(kept.Sha256, Of(stored).Sha256);
        Assert.Null(await storage.ReadAsync($"drafts/{draft.Id}/{meta.Sha256}.png"));

        var view = (await contributor.GetFromJsonAsync<PackVersionView>(Url($"/api/studio/versions/{draft.Id}"), Ct))!;
        var tree = view.Assets.Single(asset => asset.Id == "tree");
        Assert.Equal((kept.Sha256, kept.Bytes, 16, 16, true), (tree.Sha256, tree.Bytes, tree.Width ?? 0, tree.Height ?? 0, tree.Uploaded));

        // The file the asset no longer names is not the draft's any more.
        Assert.Equal("file_not_in_draft", await CodeOfAsync(await UploadAsync(contributor, draft.Id, meta)));
    }

    [Fact]
    public async Task The_dry_run_reports_and_saves_nothing_and_submitting_holds_the_same_gate()
    {
        var contributor = await ContributorAsync();
        var styleId = await NewStyleAsync(contributor);
        var file = NewFile();
        var made = await CreateDraftAsync(contributor, NewId("pack"), "1.0.0", styleId, Asset("tree", file, licence: "CC-BY-4.0"));
        var draft = (await made.Content.ReadFromJsonAsync<PackVersionView>(Ct))!;
        Assert.Equal(HttpStatusCode.OK, (await UploadAsync(contributor, draft.Id, file)).StatusCode);
        var before = await StateAsync(draft.Id);

        var report = await CheckAsync(contributor, draft.Id);
        Assert.False(report.Ok);
        Assert.Equal([("tree", "attribution_missing")], report.Problems.Select(problem => (problem.Asset, problem.Code)));
        Assert.Equal(before, await StateAsync(draft.Id));

        // Submitting holds the same gate: 422 with the same problems, and the draft stays a draft.
        var refused = await contributor.PostAsync(Url($"/api/studio/drafts/{draft.Id}/submit"), null, Ct);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, refused.StatusCode);
        Assert.Equal([("tree", "attribution_missing")], await ProblemsAsync(refused, "checks_failed"));
        Assert.Equal(before, await StateAsync(draft.Id));

        // Only its creator asks.
        var other = await ContributorAsync();
        Assert.Equal("not_yours", await CodeOfAsync(await other.PostAsync(Url($"/api/studio/drafts/{draft.Id}/check"), null, Ct)));

        var fixedDraft = await contributor.PutAsJsonAsync(Url($"/api/studio/drafts/{draft.Id}"), new { version = "1.0.0", assets = new[] { Asset("tree", file, licence: "CC-BY-4.0", attribution: "Cô Ba") } }, Ct);
        Assert.Equal(HttpStatusCode.OK, fixedDraft.StatusCode);
        Assert.True((await CheckAsync(contributor, draft.Id)).Ok);
        Assert.Equal(HttpStatusCode.OK, (await contributor.PostAsync(Url($"/api/studio/drafts/{draft.Id}/submit"), null, Ct)).StatusCode);
    }

    [Fact]
    public async Task An_agent_runs_the_dry_run_too()
    {
        var owner = await Admins.NewAsync(factory, "owner", _app);
        var agent = AgentClient(_app, (await Agents.TokenAsync(owner.Client, (await Agents.CreateAsync(owner.Client)).Id)).Token);
        var styleId = await NewStyleAsync(agent);
        var draft = await DraftAsync(agent, NewId("pack"), "1.0.0", styleId, ("tree", NewFile()));
        Assert.True((await CheckAsync(agent, draft.Id)).Ok);
    }

    [Fact]
    public async Task Approving_takes_an_approved_style_and_the_reviewers_word_for_share_alike()
    {
        var contributor = await ContributorAsync();
        var styleId = await NewStyleAsync(contributor);
        var file = NewFile();
        var made = await CreateDraftAsync(contributor, NewId("pack"), "1.0.0", styleId, Asset("tree", file, licence: "CC-BY-SA-4.0", attribution: "Cô Ba"));
        var draft = (await made.Content.ReadFromJsonAsync<PackVersionView>(Ct))!;
        Assert.Equal(HttpStatusCode.OK, (await UploadAsync(contributor, draft.Id, file)).StatusCode);

        // CC-BY-SA waits for the reviewer: submitting takes it.
        Assert.Equal(HttpStatusCode.OK, (await contributor.PostAsync(Url($"/api/studio/drafts/{draft.Id}/submit"), null, Ct)).StatusCode);

        var reviewer = await ReviewerAsync(_app, factory);
        var refused = await ReviewAsync(reviewer, draft.Id, "approve");
        Assert.Equal(HttpStatusCode.UnprocessableEntity, refused.StatusCode);
        Assert.Equal([(null, "style_not_approved"), ("tree", "licence_not_accepted")], await ProblemsAsync(refused, "checks_failed"));

        await ApproveStyleAsync(reviewer, styleId);
        Assert.Equal([("tree", "licence_not_accepted")], await ProblemsAsync(await ReviewAsync(reviewer, draft.Id, "approve"), "checks_failed"));
        Assert.Equal("reason_required", await FieldCodeAsync(await ReviewAsync(reviewer, draft.Id, "approve", new { allowShareAlike = true }), "shareAlikeReason"));
        Assert.Empty(await storage.KeysAsync($"packs/{draft.PackId}/"));

        var approved = await ReviewAsync(reviewer, draft.Id, "approve", new { allowShareAlike = true, shareAlikeReason = "Bộ cây của Cô Ba, chủ đồng ý" });
        Assert.Equal(HttpStatusCode.OK, approved.StatusCode);
        var view = (await approved.Content.ReadFromJsonAsync<PackVersionView>(Ct))!;
        Assert.Equal(("approved", true, "Bộ cây của Cô Ba, chủ đồng ý"), (view.Status, view.ShareAlikeAllowed, view.ShareAlikeReason));

        await using var scope = _app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var entry = await db.StudioAudit.SingleAsync(found => found.VersionId == draft.Id && found.Action == "version.approve", Ct);
        Assert.Contains("chủ đồng ý", entry.Details, StringComparison.Ordinal);
    }

    [Fact]
    public async Task A_reviewer_approves_or_rejects_a_style_behind_step_up()
    {
        var owner = await Admins.NewAsync(factory, "owner", _app);
        var agent = AgentClient(_app, (await Agents.TokenAsync(owner.Client, (await Agents.CreateAsync(owner.Client)).Id)).Token);
        var contributor = await ContributorAsync();
        var sample = NewFile();
        var styleId = NewId("style");
        object Style(string name) => new { id = styleId, name, tileSize = 16, view = "side", samples = new[] { new { sha256 = sample.Sha256, ext = "png", bytes = sample.Length } } };
        Assert.Equal(HttpStatusCode.OK, (await contributor.PostAsJsonAsync(Url("/api/studio/styles"), Style("Gỗ"), Ct)).StatusCode);

        // The review permission and step-up; no agent.
        Assert.Equal("studio_required", await CodeOfAsync(await contributor.PostAsync(Url($"/api/studio/styles/{styleId}/approve"), null, Ct)));
        Assert.Equal(HttpStatusCode.Unauthorized, (await agent.PostAsync(Url($"/api/studio/styles/{styleId}/approve"), null, Ct)).StatusCode);
        var noStepUp = await Studio.SignInAsync(_app, await Studio.NewAsync(factory, StudioRole.Reviewer, twoFactor: true));
        Assert.Equal("step_up_required", await CodeOfAsync(await noStepUp.PostAsync(Url($"/api/studio/styles/{styleId}/approve"), null, Ct)));

        // Rejected with a reason; its creator changes it, and it is a draft again.
        var reviewer = await ReviewerAsync(_app, factory);
        Assert.Equal("reason_required", await FieldCodeAsync(await reviewer.PostAsJsonAsync(Url($"/api/studio/styles/{styleId}/reject"), new { reason = "" }, Ct), "reason"));
        var rejected = await reviewer.PostAsJsonAsync(Url($"/api/studio/styles/{styleId}/reject"), new { reason = "Bảng màu chưa có" }, Ct);
        Assert.Equal(HttpStatusCode.OK, rejected.StatusCode);
        Assert.Equal(("rejected", "Bảng màu chưa có"), await StatusOfStyleAsync(rejected));
        Assert.Equal("not_a_draft", await CodeOfAsync(await reviewer.PostAsync(Url($"/api/studio/styles/{styleId}/approve"), null, Ct)));
        var changed = await contributor.PutAsJsonAsync(Url($"/api/studio/styles/{styleId}"), Style("Gỗ sáng"), Ct);
        Assert.Equal(("draft", "Bảng màu chưa có"), await StatusOfStyleAsync(changed));

        // Approved once its samples are there; then it never changes.
        Assert.Equal("files_missing", await CodeOfAsync(await reviewer.PostAsync(Url($"/api/studio/styles/{styleId}/approve"), null, Ct)));
        using (var body = new ByteArrayContent(sample.Bytes))
        {
            Assert.Equal(HttpStatusCode.NoContent, (await contributor.PutAsync(Url($"/api/studio/styles/{styleId}/samples/{sample.Sha256}"), body, Ct)).StatusCode);
        }

        var approved = await reviewer.PostAsync(Url($"/api/studio/styles/{styleId}/approve"), null, Ct);
        Assert.Equal(HttpStatusCode.OK, approved.StatusCode);
        Assert.Equal(("approved", (string?)null), await StatusOfStyleAsync(approved));
        Assert.Equal("not_a_draft", await CodeOfAsync(await contributor.PutAsJsonAsync(Url($"/api/studio/styles/{styleId}"), Style("Khác"), Ct)));
        Assert.Equal("not_a_draft", await CodeOfAsync(await reviewer.PostAsJsonAsync(Url($"/api/studio/styles/{styleId}/reject"), new { reason = "Lại" }, Ct)));

        await using var scope = _app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var actions = await db.StudioAudit.Where(entry => entry.Target == styleId).OrderBy(entry => entry.Id).Select(entry => entry.Action).ToListAsync(Ct);
        Assert.Equal(["style.create", "style.reject", "style.update", "style.sample.upload", "style.approve"], actions);
    }

    [Fact]
    public async Task An_ai_source_needs_a_vendor_whose_terms_the_owner_checked()
    {
        var contributor = await ContributorAsync();
        var styleId = await NewStyleAsync(contributor);
        var vendor = NewId("vendor");
        var file = NewFile();
        var source = new { type = "ai", vendor, model = "pixel-1", prompt = "một củ cà rốt", seed = 7, date = "2026-10-24" };
        var made = await CreateDraftAsync(contributor, NewId("pack"), "1.0.0", styleId, Asset("carrot", file, licence: "LicenseRef-Tohe-Internal", source: source));
        var draft = (await made.Content.ReadFromJsonAsync<PackVersionView>(Ct))!;
        Assert.Equal(HttpStatusCode.OK, (await UploadAsync(contributor, draft.Id, file)).StatusCode);

        Assert.Equal([("carrot", "vendor_not_checked")], (await CheckAsync(contributor, draft.Id)).Problems.Select(problem => (problem.Asset, problem.Code)));

        // On the list, but its terms not checked yet: still refused. Checked: accepted.
        await using (var scope = _app.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
            db.StudioVendors.Add(new StudioVendor { Id = vendor, Name = "A vendor" });
            await db.SaveChangesAsync(Ct);
        }

        Assert.False((await CheckAsync(contributor, draft.Id)).Ok);
        await using (var scope = _app.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
            await db.StudioVendors.Where(found => found.Id == vendor)
                .ExecuteUpdateAsync(set => set.SetProperty(found => found.TermsCheckedAt, DateTimeOffset.UtcNow), Ct);
        }

        Assert.Equal(HttpStatusCode.OK, (await contributor.PostAsync(Url($"/api/studio/drafts/{draft.Id}/submit"), null, Ct)).StatusCode);
    }

    [Fact]
    public async Task Semver_is_held_against_the_version_approved_before()
    {
        var contributor = await ContributorAsync();
        var styleId = await NewStyleAsync(contributor);
        var reviewer = await ReviewerAsync(_app, factory);
        await ApproveStyleAsync(reviewer, styleId);
        var packId = NewId("pack");
        var tree = NewFile();
        await ApprovedAsync(reviewer, (await SubmittedAsync(contributor, packId, "1.0.0", styleId, ("tree", tree))).Id);

        // An asset added is a minor version; a resized one, a major.
        var patch = await DraftAsync(contributor, packId, "1.0.1", null, ("tree", tree), ("leaf", NewFile()));
        var refused = await contributor.PostAsync(Url($"/api/studio/drafts/{patch.Id}/submit"), null, Ct);
        Assert.Equal([("leaf", "semver_too_small")], await ProblemsAsync(refused, "checks_failed"));
        var resized = await DraftAsync(contributor, packId, "1.1.0", null, ("tree", NewFile(32, 32)));
        Assert.Equal([("tree", "semver_too_small")], (await CheckAsync(contributor, resized.Id)).Problems.Select(problem => (problem.Asset, problem.Code)));

        var minor = await DraftAsync(contributor, packId, "1.1.0", null, ("tree", tree), ("leaf", NewFile()));
        Assert.Equal(HttpStatusCode.OK, (await contributor.PostAsync(Url($"/api/studio/drafts/{minor.Id}/submit"), null, Ct)).StatusCode);
    }

    private async Task<HttpClient> ContributorAsync() =>
        await Studio.SignInAsync(_app, await Studio.NewAsync(factory, StudioRole.Contributor, twoFactor: false));

    /// <summary>A style with the corpus's palette and tile (Fixtures/studio/README.md).</summary>
    private static async Task<string> CorpusStyleAsync(HttpClient client)
    {
        var id = NewId("style");
        var made = await client.PostAsJsonAsync(Url("/api/studio/styles"), new { id, name = "Corpus", tileSize = 16, view = "top-down", palette = new[] { "#000000", "#ffffff", "#aa5533", "#33aa55" } }, Ct);
        Assert.Equal(HttpStatusCode.OK, made.StatusCode);
        return id;
    }

    private static byte[] Fixture(string name) => File.ReadAllBytes(Path.Combine(AppContext.BaseDirectory, "Fixtures", "studio", name));

    private static async Task<StudioCheckReport> CheckAsync(HttpClient client, Guid versionId)
    {
        var checkedDraft = await client.PostAsync(Url($"/api/studio/drafts/{versionId}/check"), null, Ct);
        Assert.Equal(HttpStatusCode.OK, checkedDraft.StatusCode);
        return (await checkedDraft.Content.ReadFromJsonAsync<StudioCheckReport>(Ct))!;
    }

    /// <summary>What a dry run must not change: the version's row and its audit.</summary>
    private async Task<(string Status, DateTimeOffset UpdatedAt, int Audit)> StateAsync(Guid versionId)
    {
        await using var scope = _app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var version = await db.StudioPackVersions.AsNoTracking().SingleAsync(found => found.Id == versionId, Ct);
        return (StudioNames.Of(version.Status), version.UpdatedAt, await db.StudioAudit.CountAsync(entry => entry.VersionId == versionId, Ct));
    }

    private static async Task<(string Status, string? Reason)> StatusOfStyleAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var style = (await response.Content.ReadFromJsonAsync<StyleView>(Ct))!;
        return (style.Status, style.Reason);
    }

    private static async Task<List<(string? Asset, string Code)>> ProblemsAsync(HttpResponseMessage response, string code)
    {
        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        Assert.Equal(code, json.RootElement.GetProperty("code").GetString());
        Assert.False(json.RootElement.GetProperty("ok").GetBoolean());
        return
        [
            .. json.RootElement.GetProperty("problems").EnumerateArray().Select(problem => (
                problem.TryGetProperty("asset", out var asset) ? asset.GetString() : null,
                problem.GetProperty("code").GetString()!)),
        ];
    }

    private static async Task<string?> CodeOfAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    private static async Task<string?> FieldCodeAsync(HttpResponseMessage response, string field)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.GetProperty("errors").GetProperty(field)[0].GetString();
    }
}
