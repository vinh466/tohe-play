using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Studio;
using static Tohe.Api.Tests.StudioLibrary;

namespace Tohe.Api.Tests;

/// <summary>
/// The Studio's library (ADR 0051): drafts by agents and contributors, which only their creator changes; review behind
/// the review permission and step-up; approval that publishes files by hash and a manifest in the build tool's format,
/// never overwritten; the owner's withdrawal; no storage, 503; drafts removed after 30 days. Against PostgreSQL and
/// SeaweedFS in containers.
/// </summary>
public sealed class StudioLibraryTests(ApiFactory factory, SeaweedFs storage)
    : IClassFixture<ApiFactory>, IClassFixture<SeaweedFs>, IAsyncDisposable
{
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    private readonly WebApplicationFactory<Program> _app = WithStorage(factory, storage);

    public ValueTask DisposeAsync() => _app.DisposeAsync();

    [Fact]
    public async Task An_agent_drafts_a_pack_a_reviewer_approves_it_and_the_library_holds_its_files_and_manifest()
    {
        var owner = await Admins.NewAsync(factory, "owner", _app);
        var agentView = await Agents.CreateAsync(owner.Client);
        var token = await Agents.TokenAsync(owner.Client, agentView.Id);
        var agent = AgentClient(_app, token.Token);

        // A style with a sample, then a pack of two assets, one a sprite sheet that needs credit.
        var sample = NewFile();
        var styleId = NewId("style");
        var style = await agent.PostAsJsonAsync(Url("/api/studio/styles"), new
        {
            id = styleId,
            name = "Đất nung",
            tileSize = 16,
            view = "top-down",
            palette = new[] { "#aa5533" },
            outline = "1 px, darker than the fill",
            samples = new[] { new { sha256 = sample.Sha256, ext = "png", bytes = sample.Length } },
        }, Ct);
        Assert.Equal(HttpStatusCode.OK, style.StatusCode);
        using (var body = new ByteArrayContent(sample.Bytes))
        {
            Assert.Equal(HttpStatusCode.NoContent, (await agent.PutAsync(Url($"/api/studio/styles/{styleId}/samples/{sample.Sha256}"), body, Ct)).StatusCode);
        }

        var carrot = NewFile(96);
        var leaf = NewFile(48);
        var packId = NewId("farm");
        var made = await CreateDraftAsync(agent, packId, "1.0.0", styleId,
            new
            {
                id = "crops/carrot",
                kind = "spritesheet",
                sha256 = carrot.Sha256,
                ext = "png",
                bytes = carrot.Length,
                width = 64,
                height = 16,
                frames = new { width = 16, height = 16, count = 4 },
                tags = new[] { "crop" },
                licence = "CC-BY-4.0",
                attribution = "Cà rốt của Cô Ba",
                source = new { type = "pack", name = "Farm", url = "https://example.test/farm", author = "Cô Ba" },
            },
            Asset("crops/leaf", leaf));
        Assert.Equal(HttpStatusCode.OK, made.StatusCode);
        var draft = (await made.Content.ReadFromJsonAsync<PackVersionView>(Ct))!;
        Assert.Equal(("draft", "agent", agentView.Id), (draft.Status, draft.CreatedBy.Kind, draft.CreatedBy.Id));
        Assert.All(draft.Assets, asset => Assert.False(asset.Uploaded));

        // Submitting before the files are there names what is missing.
        var early = await agent.PostAsync(Url($"/api/studio/drafts/{draft.Id}/submit"), null, Ct);
        Assert.Equal(HttpStatusCode.Conflict, early.StatusCode);
        Assert.Equal("files_missing", await CodeOfAsync(early));

        Assert.Equal(HttpStatusCode.NoContent, (await UploadAsync(agent, draft.Id, carrot)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await UploadAsync(agent, draft.Id, leaf)).StatusCode);
        Assert.Equal(carrot.Bytes, await storage.ReadAsync($"drafts/{draft.Id}/{carrot.Sha256}.png"));
        var submitted = await agent.PostAsync(Url($"/api/studio/drafts/{draft.Id}/submit"), null, Ct);
        Assert.Equal(HttpStatusCode.OK, submitted.StatusCode);
        Assert.Equal("submitted", (await submitted.Content.ReadFromJsonAsync<PackVersionView>(Ct))!.Status);

        // Submitted, nobody changes it.
        Assert.Equal("not_a_draft", await CodeOfAsync(await UploadAsync(agent, draft.Id, leaf)));

        var reviewer = await ReviewerAsync(_app, factory);
        var approved = await ApprovedAsync(reviewer, draft.Id);
        Assert.Equal("approved", approved.Status);
        Assert.NotNull(approved.ReviewedBy);
        Assert.Equal($"{PublicBaseUrl}/packs/{packId}/1.0.0.json", approved.ManifestUrl);
        Assert.Equal($"{PublicBaseUrl}/blobs/sha256/{carrot.Sha256}.png", approved.Assets.Single(asset => asset.Id == "crops/carrot").PublicUrl);

        // The files by hash, the manifest, and nothing left in the drafts.
        Assert.Equal(carrot.Bytes, await storage.ReadAsync($"blobs/sha256/{carrot.Sha256}.png"));
        Assert.Equal(leaf.Bytes, await storage.ReadAsync($"blobs/sha256/{leaf.Sha256}.png"));
        Assert.Empty(await storage.KeysAsync($"drafts/{draft.Id}/"));
        var manifest = (await storage.ReadAsync($"packs/{packId}/1.0.0.json"))!;
        Assert.Equal(approved.ManifestSha256, Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(manifest)));

        // The build tool's format (docs/guides/use-assets-in-a-game.md#the-manifest), keys in ordinal order.
        using var json = JsonDocument.Parse(manifest);
        var root = json.RootElement;
        Assert.Equal(["files", "id", "manifestVersion", "version"], Keys(root));
        Assert.Equal((1, packId, "1.0.0"), (root.GetProperty("manifestVersion").GetInt32(), root.GetProperty("id").GetString(), root.GetProperty("version").GetString()));
        var files = root.GetProperty("files").EnumerateArray().ToList();
        Assert.Equal(["crops/carrot", "crops/leaf"], files.Select(file => file.GetProperty("id").GetString()));
        Assert.Equal(["attribution", "bytes", "ext", "frames", "height", "id", "kind", "licence", "sha256", "width"], Keys(files[0]));
        Assert.Equal(["bytes", "ext", "height", "id", "kind", "licence", "sha256", "width"], Keys(files[1]));
        Assert.Equal(["count", "height", "width"], Keys(files[0].GetProperty("frames")));
        Assert.Equal(("spritesheet", carrot.Sha256, "png", carrot.Length, "CC-BY-4.0", "Cà rốt của Cô Ba"), (
            files[0].GetProperty("kind").GetString(),
            files[0].GetProperty("sha256").GetString(),
            files[0].GetProperty("ext").GetString(),
            files[0].GetProperty("bytes").GetInt64(),
            files[0].GetProperty("licence").GetString(),
            files[0].GetProperty("attribution").GetString()));
        Assert.Contains("Cà rốt", Encoding.UTF8.GetString(manifest), StringComparison.Ordinal);
        Assert.EndsWith("}\n", Encoding.UTF8.GetString(manifest), StringComparison.Ordinal);

        // Anyone in the Studio, an agent too, reads the pack and its files.
        var pack = (await agent.GetFromJsonAsync<PackView>(Url($"/api/studio/packs/{packId}"), Ct))!;
        Assert.Equal((styleId, "approved"), (pack.StyleId, Assert.Single(pack.Versions).Status));
        var file = await agent.GetAsync(Url($"/api/studio/versions/{draft.Id}/files/{leaf.Sha256}"), Ct);
        Assert.Equal(HttpStatusCode.OK, file.StatusCode);
        Assert.Equal("nosniff", file.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal(leaf.Bytes, await file.Content.ReadAsByteArrayAsync(Ct));
        Assert.Equal(sample.Bytes, await agent.GetByteArrayAsync(Url($"/api/studio/styles/{styleId}/samples/{sample.Sha256}"), Ct));

        // Every action in the Studio's audit, with who; every call of the agent in the agents' audit.
        await using var scope = _app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var audit = await db.StudioAudit.Where(entry => entry.VersionId == draft.Id).OrderBy(entry => entry.Id).ToListAsync(Ct);
        Assert.Equal(["draft.create", "draft.file.upload", "draft.file.upload", "version.submit", "version.approve"], audit.Select(entry => entry.Action));
        Assert.All(audit.Take(4), entry => Assert.Equal((agentView.Id, (Guid?)null), (entry.AgentId!.Value, entry.AccountId)));
        Assert.Equal(((Guid?)null, approved.ReviewedBy), (audit[4].AgentId, audit[4].AccountId));
        Assert.Contains(await db.AgentAudit.Where(entry => entry.AgentId == agentView.Id).Select(entry => entry.Action).ToListAsync(Ct),
            action => action == "POST /api/studio/drafts/{versionId:guid}/submit");
    }

    [Fact]
    public async Task A_contributor_drafts_in_the_studio_session_and_a_reviewer_rejects_with_a_reason()
    {
        var contributor = await Studio.SignInAsync(_app, await Studio.NewAsync(factory, StudioRole.Contributor, twoFactor: false));
        var styleId = await NewStyleAsync(contributor);
        var file = NewFile();
        var submitted = await SubmittedAsync(contributor, NewId("pack"), "0.1.0", styleId, ("tree", file));
        Assert.Equal(("submitted", "account"), (submitted.Status, submitted.CreatedBy.Kind));

        var reviewer = await ReviewerAsync(_app, factory);
        Assert.Equal("reason_required", await FieldCodeAsync(await ReviewAsync(reviewer, submitted.Id, "reject", new { reason = " " }), "reason"));
        var rejected = await ReviewAsync(reviewer, submitted.Id, "reject", new { reason = "Có chữ trong hình" });
        Assert.Equal(HttpStatusCode.OK, rejected.StatusCode);
        var view = (await rejected.Content.ReadFromJsonAsync<PackVersionView>(Ct))!;
        Assert.Equal(("rejected", "Có chữ trong hình"), (view.Status, view.Reason));

        // A fix is a new draft: the rejected files leave the drafts, and it is not approved after all.
        Assert.Empty(await storage.KeysAsync($"drafts/{submitted.Id}/"));
        Assert.Equal("version_not_submitted", await CodeOfAsync(await ReviewAsync(reviewer, submitted.Id, "approve")));
    }

    [Fact]
    public async Task Only_who_made_a_draft_changes_it()
    {
        var owner = await Admins.NewAsync(factory, "owner", _app);
        var agentView = await Agents.CreateAsync(owner.Client);
        var agent = AgentClient(_app, (await Agents.TokenAsync(owner.Client, agentView.Id)).Token);
        var sameAgent = AgentClient(_app, (await Agents.TokenAsync(owner.Client, agentView.Id)).Token);
        var otherAgent = AgentClient(_app, (await Agents.TokenAsync(owner.Client, (await Agents.CreateAsync(owner.Client)).Id)).Token);
        var contributor = await Studio.SignInAsync(_app, await Studio.NewAsync(factory, StudioRole.Contributor, twoFactor: false));
        var otherContributor = await Studio.SignInAsync(_app, await Studio.NewAsync(factory, StudioRole.Contributor, twoFactor: false));

        var styleId = await NewStyleAsync(agent);
        var file = NewFile();
        var mine = await DraftAsync(contributor, NewId("pack"), "1.0.0", styleId, ("tree", file));
        var agents = await DraftAsync(agent, NewId("pack"), "1.0.0", styleId, ("tree", file));
        var update = new { version = "1.0.1", assets = new[] { Asset("tree", file) } };

        foreach (var (client, draft) in new[] { (otherContributor, mine), (agent, mine), (contributor, agents), (otherAgent, agents) })
        {
            Assert.Equal("not_yours", await CodeOfAsync(await client.PutAsJsonAsync(Url($"/api/studio/drafts/{draft.Id}"), update, Ct)));
            Assert.Equal("not_yours", await CodeOfAsync(await UploadAsync(client, draft.Id, file)));
            Assert.Equal("not_yours", await CodeOfAsync(await client.PostAsync(Url($"/api/studio/drafts/{draft.Id}/submit"), null, Ct)));
        }

        Assert.Equal("not_yours", await CodeOfAsync(await contributor.PutAsJsonAsync(Url($"/api/studio/styles/{styleId}"), new { name = "Khác", view = "side" }, Ct)));

        // The draft is the agent's, not the token's: another token of the same agent changes it; its file stays.
        var changed = await sameAgent.PutAsJsonAsync(Url($"/api/studio/drafts/{agents.Id}"), update, Ct);
        Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
        var view = (await changed.Content.ReadFromJsonAsync<PackVersionView>(Ct))!;
        Assert.Equal("1.0.1", view.Version);
        Assert.True(Assert.Single(view.Assets).Uploaded);
        Assert.Equal(HttpStatusCode.OK, (await contributor.PutAsJsonAsync(Url($"/api/studio/drafts/{mine.Id}"), update, Ct)).StatusCode);
    }

    [Fact]
    public async Task Reviewing_takes_the_review_permission_and_step_up_and_no_agent_reaches_it()
    {
        var owner = await Admins.NewAsync(factory, "owner", _app);
        var agent = AgentClient(_app, (await Agents.TokenAsync(owner.Client, (await Agents.CreateAsync(owner.Client)).Id)).Token);
        var contributor = await Studio.SignInAsync(_app, await Studio.NewAsync(factory, StudioRole.Contributor, twoFactor: false));
        var styleId = await NewStyleAsync(contributor);
        var submitted = await SubmittedAsync(contributor, NewId("pack"), "1.0.0", styleId, ("tree", NewFile()));

        Assert.Equal("studio_required", await CodeOfAsync(await ReviewAsync(contributor, submitted.Id, "approve")));
        Assert.Equal(HttpStatusCode.Unauthorized, (await ReviewAsync(agent, submitted.Id, "approve")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await ReviewAsync(agent, submitted.Id, "reject", new { reason = "x" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await ReviewAsync(agent, submitted.Id, "deprecate")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await ReviewAsync(agent, submitted.Id, "withdraw", new { reason = "x", code = "123456" })).StatusCode);

        var member = await Studio.NewAsync(factory, StudioRole.Reviewer, twoFactor: true);
        var noStepUp = await Studio.SignInAsync(_app, member);
        Assert.Equal("step_up_required", await CodeOfAsync(await ReviewAsync(noStepUp, submitted.Id, "approve")));

        var reviewer = await ReviewerAsync(_app, factory);
        var approved = await ApprovedAsync(reviewer, submitted.Id);
        Assert.Equal("version_not_submitted", await CodeOfAsync(await ReviewAsync(reviewer, submitted.Id, "approve")));

        // Deprecated, it is still published.
        var deprecated = await ReviewAsync(reviewer, approved.Id, "deprecate", new { reason = "Có bản mới" });
        Assert.Equal("deprecated", (await deprecated.Content.ReadFromJsonAsync<PackVersionView>(Ct))!.Status);
        Assert.NotNull(await storage.ReadAsync($"packs/{approved.PackId}/1.0.0.json"));
        Assert.Equal("version_not_approved", await CodeOfAsync(await ReviewAsync(reviewer, approved.Id, "deprecate")));
    }

    [Fact]
    public async Task Approval_writes_a_manifest_once_and_never_overwrites_one()
    {
        var contributor = await Studio.SignInAsync(_app, await Studio.NewAsync(factory, StudioRole.Contributor, twoFactor: false));
        var styleId = await NewStyleAsync(contributor);
        var reviewer = await ReviewerAsync(_app, factory);

        // Something else already at the manifest's key: refused, and left as it was.
        var packId = NewId("pack");
        var file = NewFile();
        var submitted = await SubmittedAsync(contributor, packId, "1.0.0", styleId, ("tree", file));
        var squatter = Encoding.UTF8.GetBytes("""{"manifestVersion":1}""");
        await storage.PutAsync($"packs/{packId}/1.0.0.json", squatter);
        var refused = await ReviewAsync(reviewer, submitted.Id, "approve");
        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
        Assert.Equal("manifest_exists", await CodeOfAsync(refused));
        Assert.Equal(squatter, await storage.ReadAsync($"packs/{packId}/1.0.0.json"));

        // The very bytes it would write — a retry after the database failed — let the approval go on.
        await using (var scope = _app.Services.CreateAsyncScope())
        {
            var assets = await StudioLibraryEndpoints.AssetsOfAsync(scope.ServiceProvider.GetRequiredService<ToheDbContext>(), submitted.Id, Ct);
            await storage.PutAsync($"packs/{packId}/1.0.0.json", PackManifests.Write(packId, "1.0.0", assets).Bytes);
        }

        var approved = await ApprovedAsync(reviewer, submitted.Id);
        var manifest = await storage.ReadAsync($"packs/{packId}/1.0.0.json");
        Assert.Equal(approved.ManifestSha256, Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(manifest!)));

        // A version is above every one approved, on submitting and again on approving.
        var same = await DraftAsync(contributor, packId, "1.0.0", null, ("tree", file));
        Assert.Equal("version_not_greater", await CodeOfAsync(await contributor.PostAsync(Url($"/api/studio/drafts/{same.Id}/submit"), null, Ct)));
        var older = await DraftAsync(contributor, packId, "0.9.0", null, ("tree", file));
        Assert.Equal("version_not_greater", await CodeOfAsync(await contributor.PostAsync(Url($"/api/studio/drafts/{older.Id}/submit"), null, Ct)));
        var first = await SubmittedAsync(contributor, packId, "1.1.0", null, ("tree", file));
        var second = await SubmittedAsync(contributor, packId, "1.1.0-beta.1", null, ("tree", file));
        await ApprovedAsync(reviewer, first.Id);
        Assert.Equal("version_not_greater", await CodeOfAsync(await ReviewAsync(reviewer, second.Id, "approve")));

        // A pack's style is fixed by its first draft.
        Assert.Equal("style_mismatch", await CodeOfAsync(await CreateDraftAsync(contributor, packId, "2.0.0", await NewStyleAsync(contributor), Asset("tree", file))));
    }

    [Fact]
    public async Task The_owner_withdraws_with_a_reason_and_a_fresh_code_and_a_shared_file_stays()
    {
        var contributor = await Studio.SignInAsync(_app, await Studio.NewAsync(factory, StudioRole.Contributor, twoFactor: false));
        var styleId = await NewStyleAsync(contributor);
        var reviewer = await ReviewerAsync(_app, factory);
        var only = NewFile();
        var shared = NewFile();
        var packId = NewId("pack");
        var withdrawn = await ApprovedAsync(reviewer, (await SubmittedAsync(contributor, packId, "1.0.0", styleId, ("only", only), ("shared", shared))).Id);
        var other = await ApprovedAsync(reviewer, (await SubmittedAsync(contributor, NewId("pack"), "1.0.0", styleId, ("shared", shared))).Id);

        // A reviewer who is not the owner never withdraws.
        Assert.Equal("owner_required", await CodeOfAsync(await ReviewAsync(reviewer, withdrawn.Id, "withdraw", new { reason = "Gỡ", code = "123456" })));

        var owner = await Admins.NewAsync(factory, "owner", _app);
        await Studio.GrantAsync(factory, owner.AccountId, StudioRole.Reviewer);
        var member = new Studio.Member(owner.Email, owner.AccountId, owner.Key);
        var studio = await Studio.SignInAsync(_app, member, step: -1);
        Assert.Equal("reason_required", await FieldCodeAsync(await ReviewAsync(studio, withdrawn.Id, "withdraw", new { code = Studio.Code(member, step: 1) }), "reason"));
        Assert.Equal("code_invalid", await FieldCodeAsync(await ReviewAsync(studio, withdrawn.Id, "withdraw", new { reason = "Gỡ theo yêu cầu" }), "code"));

        var done = await ReviewAsync(studio, withdrawn.Id, "withdraw", new { reason = "Gỡ theo yêu cầu", code = Studio.Code(member, step: 1) });
        Assert.Equal(HttpStatusCode.OK, done.StatusCode);
        var view = (await done.Content.ReadFromJsonAsync<PackVersionView>(Ct))!;
        Assert.Equal(("withdrawn", "Gỡ theo yêu cầu", (string?)null), (view.Status, view.WithdrawReason, view.ManifestUrl));

        // Its manifest and its own file are gone; the file another published version uses stays.
        Assert.Null(await storage.ReadAsync($"packs/{packId}/1.0.0.json"));
        Assert.Null(await storage.ReadAsync($"blobs/sha256/{only.Sha256}.png"));
        Assert.Equal(shared.Bytes, await storage.ReadAsync($"blobs/sha256/{shared.Sha256}.png"));
        Assert.Equal("approved", other.Status);
        Assert.Equal(HttpStatusCode.NotFound, (await contributor.GetAsync(Url($"/api/studio/versions/{withdrawn.Id}/files/{only.Sha256}"), Ct)).StatusCode);
        Assert.Equal("version_not_approved", await CodeOfAsync(await ReviewAsync(studio, withdrawn.Id, "withdraw", new { reason = "Lần nữa", code = Studio.Code(member, step: -1) })));

        // Its number is never published again.
        var again = await DraftAsync(contributor, packId, "1.0.0", null, ("only", only));
        Assert.Equal("version_not_greater", await CodeOfAsync(await contributor.PostAsync(Url($"/api/studio/drafts/{again.Id}/submit"), null, Ct)));

        await using var scope = _app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var entry = await db.StudioAudit.SingleAsync(found => found.VersionId == withdrawn.Id && found.Action == "version.withdraw", Ct);
        Assert.Equal(owner.AccountId, entry.AccountId);
    }

    [Fact]
    public async Task Uploads_are_checked_against_their_hash_their_size_the_limit_and_the_quota()
    {
        await using var app = WithStorage(factory, storage, new Dictionary<string, string>
        {
            ["Studio:MaxFileBytes"] = "64",
            ["Studio:DraftQuotaBytes"] = "100",
        });
        var contributor = await Studio.SignInAsync(app, await Studio.NewAsync(factory, StudioRole.Contributor, twoFactor: false));
        var styleId = await NewStyleAsync(contributor);
        var file = NewFile(50);
        var made = await CreateDraftAsync(contributor, NewId("pack"), "1.0.0", styleId, Asset("tree", file));
        var draft = (await made.Content.ReadFromJsonAsync<PackVersionView>(Ct))!;

        Assert.Equal("sha256_mismatch", await FieldCodeAsync(await UploadAsync(contributor, draft.Id, file, NewFile(50).Bytes), "file"));
        Assert.Equal("bytes_mismatch", await FieldCodeAsync(await UploadAsync(contributor, draft.Id, file, NewFile(49).Bytes), "file"));
        var large = await UploadAsync(contributor, draft.Id, file, NewFile(65).Bytes);
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, large.StatusCode);
        Assert.Equal("file_too_large", await CodeOfAsync(large));
        Assert.Equal("file_not_in_draft", await CodeOfAsync(await UploadAsync(contributor, draft.Id, NewFile(50))));
        Assert.Equal("bytes_invalid", await FieldCodeAsync(await CreateDraftAsync(contributor, NewId("pack"), "1.0.0", styleId, Asset("big", NewFile(65))), "assets[0].bytes"));
        Assert.Equal("asset_id_invalid", await FieldCodeAsync(await CreateDraftAsync(contributor, NewId("pack"), "1.0.0", styleId, Asset("Big Tree", file)), "assets[0].id"));
        Assert.Equal("version_invalid", await FieldCodeAsync(await CreateDraftAsync(contributor, NewId("pack"), "v1", styleId, Asset("tree", file)), "version"));

        // 50 bytes, then 50 more — the same file again changes nothing — then over the 100 of the quota.
        Assert.Equal(HttpStatusCode.NoContent, (await UploadAsync(contributor, draft.Id, file)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await UploadAsync(contributor, draft.Id, file)).StatusCode);
        var second = await DraftAsync(contributor, NewId("pack"), "1.0.0", styleId, ("tree", NewFile(50)));
        var third = NewFile(50);
        var full = await CreateDraftAsync(contributor, NewId("pack"), "1.0.0", styleId, Asset("tree", third));
        var over = await UploadAsync(contributor, (await full.Content.ReadFromJsonAsync<PackVersionView>(Ct))!.Id, third);
        Assert.Equal(HttpStatusCode.Conflict, over.StatusCode);
        Assert.Equal("drafts_quota_exceeded", await CodeOfAsync(over));
        Assert.Equal("draft", second.Status);
    }

    [Fact]
    public async Task Without_storage_every_library_endpoint_answers_503_and_the_api_still_runs()
    {
        var owner = await Admins.NewAsync(factory, "owner", factory);
        var agentView = await Agents.CreateAsync(owner.Client);
        var agent = AgentClient(factory, (await Agents.TokenAsync(owner.Client, agentView.Id)).Token);
        var contributor = await Studio.SignInAsync(factory, await Studio.NewAsync(factory, StudioRole.Contributor, twoFactor: false));

        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync(Url("/api/studio/packs"), Ct)).StatusCode);
        foreach (var client in new[] { contributor, agent })
        {
            var packs = await client.GetAsync(Url("/api/studio/packs"), Ct);
            Assert.Equal(HttpStatusCode.ServiceUnavailable, packs.StatusCode);
            Assert.Equal("studio_storage_not_configured", await CodeOfAsync(packs));
            Assert.Equal("studio_storage_not_configured", await CodeOfAsync(await CreateDraftAsync(client, "farm-crops", "1.0.0", "style", Asset("tree", NewFile()))));
        }

        Assert.Equal(HttpStatusCode.OK, (await contributor.GetAsync(Url("/api/studio/session"), Ct)).StatusCode);
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        Assert.Contains(503, await db.AgentAudit.Where(entry => entry.AgentId == agentView.Id).Select(entry => entry.Result).ToListAsync(Ct));
    }

    [Fact]
    public async Task A_draft_not_submitted_within_30_days_is_removed_with_its_files()
    {
        var contributor = await Studio.SignInAsync(_app, await Studio.NewAsync(factory, StudioRole.Contributor, twoFactor: false));
        var styleId = await NewStyleAsync(contributor);
        var packId = NewId("pack");
        var stale = await DraftAsync(contributor, packId, "1.0.0", styleId, ("tree", NewFile()));
        var fresh = await DraftAsync(contributor, NewId("pack"), "1.0.0", styleId, ("tree", NewFile()));
        var waiting = await SubmittedAsync(contributor, NewId("pack"), "1.0.0", styleId, ("tree", NewFile()));
        Assert.NotEmpty(await storage.KeysAsync($"drafts/{stale.Id}/"));

        await using var scope = _app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var old = DateTimeOffset.UtcNow.AddDays(-31);
        await db.StudioPackVersions.Where(version => version.Id == stale.Id || version.Id == waiting.Id)
            .ExecuteUpdateAsync(set => set.SetProperty(version => version.CreatedAt, old), Ct);

        var removed = await scope.ServiceProvider.GetRequiredService<StudioDraftCleanup>().RunAsync(Ct);

        Assert.True(removed >= 1);
        Assert.Empty(await storage.KeysAsync($"drafts/{stale.Id}/"));
        Assert.False(await db.StudioPackVersions.AnyAsync(version => version.Id == stale.Id, Ct));
        Assert.False(await db.StudioAssets.AnyAsync(asset => asset.VersionId == stale.Id, Ct));
        Assert.False(await db.StudioPacks.AnyAsync(pack => pack.Id == packId, Ct));
        Assert.True(await db.StudioPackVersions.AnyAsync(version => version.Id == fresh.Id, Ct));
        Assert.True(await db.StudioPackVersions.AnyAsync(version => version.Id == waiting.Id, Ct));
        Assert.NotEmpty(await storage.KeysAsync($"drafts/{fresh.Id}/"));
        Assert.True(await db.StudioAudit.AnyAsync(entry => entry.VersionId == stale.Id && entry.Action == "draft.expire" && entry.AgentId == null && entry.AccountId == null, Ct));
    }

    [Theory]
    [InlineData("1.0.0", "0.9.9", 1)]
    [InlineData("1.0.0", "1.0.0", 0)]
    [InlineData("1.10.0", "1.9.0", 1)]
    [InlineData("1.0.0", "1.0.0-rc.1", 1)]
    [InlineData("1.0.0-alpha", "1.0.0-alpha.1", -1)]
    [InlineData("1.0.0-alpha.1", "1.0.0-alpha.beta", -1)]
    [InlineData("1.0.0-beta.2", "1.0.0-beta.11", -1)]
    [InlineData("1.0.0-rc.1", "1.0.0-beta.11", 1)]
    public void Versions_are_ordered_by_semver_precedence(string a, string b, int order) =>
        Assert.Equal(order, Math.Sign(SemVersion.Parse(a)!.CompareTo(SemVersion.Parse(b))));

    [Fact]
    public void The_same_version_always_makes_the_same_manifest()
    {
        StudioAsset Make(string id) => new()
        {
            AssetId = id,
            Kind = "image",
            Sha256 = new string('a', 64),
            Ext = "png",
            Bytes = 10,
            Licence = "CC0-1.0",
            Source = "{}",
        };

        var one = PackManifests.Write("farm-crops", "1.0.0", [Make("b"), Make("a")]);
        var two = PackManifests.Write("farm-crops", "1.0.0", [Make("a"), Make("b")]);
        Assert.Equal(one.Bytes, two.Bytes);
        Assert.Equal(one.Sha256, two.Sha256);
        Assert.StartsWith(
            "{\n  \"files\": [\n    {\n      \"bytes\": 10,\n      \"ext\": \"png\",\n      \"id\": \"a\",\n",
            Encoding.UTF8.GetString(one.Bytes),
            StringComparison.Ordinal);
    }

    private static List<string> Keys(JsonElement element) => [.. element.EnumerateObject().Select(property => property.Name)];

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
