using System.Text.Json;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Admin;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Studio;

/// <summary>
/// The Studio's library (ADR 0051, docs/architecture/asset-studio.md#the-library-in-the-api): reading styles, packs and
/// versions; drafts made by agents and contributors; review by a reviewer, and withdrawal by the owner. Approving
/// publishes a version's files by hash and its manifest to object storage, which builds read.
/// </summary>
internal static partial class StudioLibraryEndpoints
{
    private static readonly JsonSerializerOptions Json = JsonSerializerOptions.Web;

    public static void Map(RouteGroupBuilder studio)
    {
        // The Studio's session, or an agent's token where the endpoint lets agents in: StudioLibraryAccess checks either.
        var library = studio.MapGroup("").AllowAnonymous().AddEndpointFilter<StudioLibraryAccess>();

        library.MapGet("/styles", ListStylesAsync)
            .RequireStudioPermission(StudioPermissions.Read).AllowStudioAgents()
            .WithName("GetStudioStyles")
            .WithSummary("Every style, newest first, with its samples.");
        library.MapGet("/styles/{id}", GetStyleAsync)
            .RequireStudioPermission(StudioPermissions.Read).AllowStudioAgents()
            .WithName("GetStudioStyle")
            .WithSummary("One style, with its samples.");
        library.MapGet("/styles/{id}/samples/{sha256}", GetSampleAsync)
            .RequireStudioPermission(StudioPermissions.Read).AllowStudioAgents()
            .WithName("GetStudioStyleSample")
            .WithSummary("A sample picture of a style.");
        library.MapPost("/styles", CreateStyleAsync)
            .RequireStudioPermission(StudioPermissions.Contribute).AllowStudioAgents()
            .WithName("CreateStudioStyle")
            .WithSummary("Make a style draft: id, name, tile size, view, palette, outline and its samples' metadata.");
        library.MapPut("/styles/{id}", UpdateStyleAsync)
            .RequireStudioPermission(StudioPermissions.Contribute).AllowStudioAgents()
            .WithName("UpdateStudioStyle")
            .WithSummary("Change a style draft: only who made it, while it is a draft.");
        library.MapPut("/styles/{id}/samples/{sha256}", UploadSampleAsync)
            .RequireStudioPermission(StudioPermissions.Contribute).AllowStudioAgents()
            .WithName("UploadStudioStyleSample")
            .WithSummary("Upload a sample picture its style's metadata names; the body is the file.");

        library.MapGet("/packs", ListPacksAsync)
            .RequireStudioPermission(StudioPermissions.Read).AllowStudioAgents()
            .WithName("GetStudioPacks")
            .WithSummary("Every pack with its versions and their status.");
        library.MapGet("/packs/{id}", GetPackAsync)
            .RequireStudioPermission(StudioPermissions.Read).AllowStudioAgents()
            .WithName("GetStudioPack")
            .WithSummary("One pack with its versions and their status.");
        library.MapGet("/versions/{versionId:guid}", GetVersionAsync)
            .RequireStudioPermission(StudioPermissions.Read).AllowStudioAgents()
            .WithName("GetStudioPackVersion")
            .WithSummary("A pack version: its assets, status, review and manifest.");
        library.MapGet("/versions/{versionId:guid}/files/{sha256}", GetFileAsync)
            .RequireStudioPermission(StudioPermissions.Read).AllowStudioAgents()
            .WithName("GetStudioPackVersionFile")
            .WithSummary("One file of a pack version: from the drafts until it is approved, from the library after.");

        library.MapPost("/drafts", CreateDraftAsync)
            .RequireStudioPermission(StudioPermissions.Contribute).AllowStudioAgents()
            .WithName("CreateStudioDraft")
            .WithSummary("Make a draft version of a pack — the pack too when it is new — with every asset's metadata.");
        library.MapPut("/drafts/{versionId:guid}", UpdateDraftAsync)
            .RequireStudioPermission(StudioPermissions.Contribute).AllowStudioAgents()
            .WithName("UpdateStudioDraft")
            .WithSummary("Replace a draft's version and assets: only who made it, while it is a draft.");
        library.MapPut("/drafts/{versionId:guid}/files/{sha256}", UploadFileAsync)
            .RequireStudioPermission(StudioPermissions.Contribute).AllowStudioAgents()
            .WithName("UploadStudioDraftFile")
            .WithSummary("Upload a file an asset of the draft names; the body is the file, checked against its sha256 and size.");
        library.MapPost("/drafts/{versionId:guid}/submit", SubmitAsync)
            .RequireStudioPermission(StudioPermissions.Contribute).AllowStudioAgents()
            .WithName("SubmitStudioDraft")
            .WithSummary("Submit a draft for review: every file uploaded, a version above every one approved, the checks passed.");

        library.MapPost("/versions/{versionId:guid}/approve", ApproveAsync)
            .RequireStudioPermission(StudioPermissions.Review).RequireStudioStepUp()
            .WithName("ApproveStudioPackVersion")
            .WithSummary("Approve a submitted version: its files are published by hash and its manifest written, once.");
        library.MapPost("/versions/{versionId:guid}/reject", RejectAsync)
            .RequireStudioPermission(StudioPermissions.Review).RequireStudioStepUp()
            .WithName("RejectStudioPackVersion")
            .WithSummary("Reject a submitted version, with a reason.");
        library.MapPost("/versions/{versionId:guid}/deprecate", DeprecateAsync)
            .RequireStudioPermission(StudioPermissions.Review).RequireStudioStepUp()
            .WithName("DeprecateStudioPackVersion")
            .WithSummary("Deprecate an approved version: games that pinned it keep working.");
        library.MapPost("/versions/{versionId:guid}/withdraw", WithdrawAsync)
            .RequireStudioPermission(StudioPermissions.Review)
            .WithName("WithdrawStudioPackVersion")
            .WithSummary("The owner withdraws a published version, with a reason and a fresh code: its manifest and files are deleted.");
    }

    // ---------------------------------------------------------------------------------------------------------- styles

    private static async Task<Ok<IReadOnlyList<StyleView>>> ListStylesAsync(ToheDbContext db, CancellationToken ct)
    {
        var styles = await db.StudioStyles.AsNoTracking().OrderByDescending(style => style.CreatedAt).ToListAsync(ct);
        var samples = (await db.StudioStyleSamples.AsNoTracking().ToListAsync(ct)).ToLookup(sample => sample.StyleId);
        return TypedResults.Ok<IReadOnlyList<StyleView>>([.. styles.Select(style => View(style, samples[style.Id]))]);
    }

    private static async Task<Results<Ok<StyleView>, ProblemHttpResult>> GetStyleAsync(string id, ToheDbContext db, CancellationToken ct)
    {
        if (await db.StudioStyles.AsNoTracking().FirstOrDefaultAsync(style => style.Id == id, ct) is not { } style)
        {
            return StyleNotFound();
        }

        return TypedResults.Ok(View(style, await SamplesOfAsync(db, id, ct)));
    }

    private static async Task<Results<FileStreamHttpResult, ProblemHttpResult>> GetSampleAsync(
        string id, string sha256, HttpContext http, ToheDbContext db, IStudioStorage storage, CancellationToken ct)
    {
        var sample = await db.StudioStyleSamples.AsNoTracking()
            .FirstOrDefaultAsync(found => found.StyleId == id && found.Sha256 == sha256 && found.UploadedAt != null, ct);
        return sample is null
            ? FileNotFound()
            : await StreamAsync(http, storage, StudioKeys.StyleSample(id, sample.Sha256, sample.Ext), sample.Ext, ct);
    }

    private static async Task<Results<Ok<StyleView>, ValidationProblem, ProblemHttpResult>> CreateStyleAsync(
        StyleRequest request, HttpContext http, ToheDbContext db, IOptions<StudioOptions> options, TimeProvider clock, CancellationToken ct)
    {
        if (StudioInput.Style(request, creating: true, options.Value.MaxFileBytes) is { Count: > 0 } errors)
        {
            return TypedResults.ValidationProblem(errors);
        }

        if (await db.StudioStyles.AnyAsync(style => style.Id == request.Id, ct))
        {
            return Problems.Of(StatusCodes.Status409Conflict, "style_exists", "A style already has this id");
        }

        var actor = StudioActor.Of(http);
        var now = clock.GetUtcNow();
        var style = new StudioStyle
        {
            Id = request.Id!,
            Name = request.Name!.Trim(),
            Status = StyleStatus.Draft,
            View = request.View!,
            CreatedByAgent = actor.AgentId,
            CreatedByAccount = actor.AccountId,
            CreatedAt = now,
        };
        Apply(style, request, now);
        db.StudioStyles.Add(style);
        var samples = (request.Samples ?? []).Select(sample => NewSample(style.Id, sample)).ToList();
        db.StudioStyleSamples.AddRange(samples);
        Audit(db, actor, "style.create", style.Id, null, new { samples = samples.Count }, now);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Problems.Of(StatusCodes.Status409Conflict, "style_exists", "A style already has this id");
        }

        return TypedResults.Ok(View(style, samples));
    }

    private static async Task<Results<Ok<StyleView>, ValidationProblem, ProblemHttpResult>> UpdateStyleAsync(
        string id,
        StyleRequest request,
        HttpContext http,
        ToheDbContext db,
        IStudioStorage storage,
        IOptions<StudioOptions> options,
        TimeProvider clock,
        ILoggerFactory logs,
        CancellationToken ct)
    {
        if (await db.StudioStyles.FirstOrDefaultAsync(found => found.Id == id, ct) is not { } style)
        {
            return StyleNotFound();
        }

        var actor = StudioActor.Of(http);
        if (StyleRefusal(style, actor) is { } refused)
        {
            return refused;
        }

        if (StudioInput.Style(request, creating: false, options.Value.MaxFileBytes) is { Count: > 0 } errors)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var now = clock.GetUtcNow();
        style.Name = request.Name!.Trim();
        style.View = request.View!;
        Apply(style, request, now);

        // The samples are replaced; one whose file arrived and that is still named keeps it.
        var before = await db.StudioStyleSamples.Where(sample => sample.StyleId == id).ToListAsync(ct);
        var after = (request.Samples ?? []).Select(sample => NewSample(id, sample)).ToList();
        foreach (var sample in after)
        {
            sample.UploadedAt = before.FirstOrDefault(old => SameFile(old.Sha256, old.Ext, old.Bytes, sample.Sha256, sample.Ext, sample.Bytes))?.UploadedAt;
        }

        var gone = before
            .Where(old => old.UploadedAt is not null && !after.Any(sample => sample.Sha256 == old.Sha256 && sample.Ext == old.Ext))
            .Select(old => StudioKeys.StyleSample(id, old.Sha256, old.Ext))
            .ToList();
        db.StudioStyleSamples.RemoveRange(before);
        db.StudioStyleSamples.AddRange(after);
        Audit(db, actor, "style.update", id, null, new { samples = after.Count }, now);
        await db.SaveChangesAsync(ct);
        await DeleteQuietlyAsync(storage, gone, logs);
        return TypedResults.Ok(View(style, after));
    }

    private static async Task<Results<NoContent, ValidationProblem, ProblemHttpResult>> UploadSampleAsync(
        string id,
        string sha256,
        Stream body,
        HttpContext http,
        ToheDbContext db,
        IStudioStorage storage,
        IOptions<StudioOptions> options,
        TimeProvider clock,
        CancellationToken ct)
    {
        if (await db.StudioStyles.FirstOrDefaultAsync(found => found.Id == id, ct) is not { } style)
        {
            return StyleNotFound();
        }

        var actor = StudioActor.Of(http);
        if (StyleRefusal(style, actor) is { } refused)
        {
            return refused;
        }

        if (await db.StudioStyleSamples.FirstOrDefaultAsync(sample => sample.StyleId == id && sample.Sha256 == sha256, ct) is not { } sample)
        {
            return FileNotInDraft();
        }

        var content = await ReadBodyAsync(http.Request, body, options.Value.MaxFileBytes, ct);
        if (content is null)
        {
            return FileTooLarge(options.Value.MaxFileBytes);
        }

        if (FileMismatch(content, sha256, sample.Bytes) is { } mismatch)
        {
            return mismatch;
        }

        await storage.PutAsync(StudioKeys.StyleSample(id, sha256, sample.Ext), content, StudioKeys.ContentType(sample.Ext), published: false, ct);
        var now = clock.GetUtcNow();
        sample.UploadedAt = now;
        style.UpdatedAt = now;
        Audit(db, actor, "style.sample.upload", id, null, new { sha256, bytes = content.Length }, now);
        await db.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }

    // ----------------------------------------------------------------------------------------------- packs, versions

    private static async Task<Ok<IReadOnlyList<PackView>>> ListPacksAsync(ToheDbContext db, CancellationToken ct)
    {
        var packs = await db.StudioPacks.AsNoTracking().OrderBy(pack => pack.Id).ToListAsync(ct);
        var versions = (await db.StudioPackVersions.AsNoTracking().ToListAsync(ct)).ToLookup(version => version.PackId);
        return TypedResults.Ok<IReadOnlyList<PackView>>([.. packs.Select(pack => View(pack, versions[pack.Id]))]);
    }

    private static async Task<Results<Ok<PackView>, ProblemHttpResult>> GetPackAsync(string id, ToheDbContext db, CancellationToken ct)
    {
        if (await db.StudioPacks.AsNoTracking().FirstOrDefaultAsync(pack => pack.Id == id, ct) is not { } pack)
        {
            return Problems.Of(StatusCodes.Status404NotFound, "pack_not_found", "No pack has this id");
        }

        var versions = await db.StudioPackVersions.AsNoTracking().Where(version => version.PackId == id).ToListAsync(ct);
        return TypedResults.Ok(View(pack, versions));
    }

    private static async Task<Results<Ok<PackVersionView>, ProblemHttpResult>> GetVersionAsync(
        Guid versionId, ToheDbContext db, IOptions<StudioOptions> options, CancellationToken ct)
    {
        if (await db.StudioPackVersions.AsNoTracking().FirstOrDefaultAsync(version => version.Id == versionId, ct) is not { } version)
        {
            return VersionNotFound();
        }

        return TypedResults.Ok(View(version, await AssetsOfAsync(db, versionId, ct), options.Value));
    }

    private static async Task<Results<FileStreamHttpResult, ProblemHttpResult>> GetFileAsync(
        Guid versionId, string sha256, HttpContext http, ToheDbContext db, IStudioStorage storage, CancellationToken ct)
    {
        var version = await db.StudioPackVersions.AsNoTracking().FirstOrDefaultAsync(found => found.Id == versionId, ct);
        var asset = await db.StudioAssets.AsNoTracking().FirstOrDefaultAsync(found => found.VersionId == versionId && found.Sha256 == sha256, ct);
        if (version is null || asset is null || version.Status == PackVersionStatus.Withdrawn)
        {
            return FileNotFound();
        }

        var key = IsPublished(version.Status)
            ? StudioKeys.Blob(asset.Sha256, asset.Ext)
            : StudioKeys.Draft(versionId, asset.Sha256, asset.Ext);
        return await StreamAsync(http, storage, key, asset.Ext, ct);
    }

    // ---------------------------------------------------------------------------------------------------------- drafts

    private static async Task<Results<Ok<PackVersionView>, ValidationProblem, ProblemHttpResult>> CreateDraftAsync(
        DraftRequest request, HttpContext http, ToheDbContext db, IOptions<StudioOptions> options, TimeProvider clock, CancellationToken ct)
    {
        var errors = StudioInput.Draft(request.Version, request.Assets, options.Value.MaxFileBytes);
        if (!StudioInput.IsId(request.PackId))
        {
            errors["packId"] = ["id_invalid"];
        }

        if (request.Description is { Length: > StudioPack.MaxDescription })
        {
            errors["description"] = ["description_too_long"];
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var actor = StudioActor.Of(http);
        var now = clock.GetUtcNow();
        var pack = await db.StudioPacks.FirstOrDefaultAsync(found => found.Id == request.PackId, ct);
        if (pack is null)
        {
            if (string.IsNullOrEmpty(request.StyleId))
            {
                return Problems.Field("styleId", "style_required");
            }

            if (!await db.StudioStyles.AnyAsync(style => style.Id == request.StyleId, ct))
            {
                return StyleNotFound();
            }

            pack = new StudioPack
            {
                Id = request.PackId!,
                StyleId = request.StyleId,
                Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
                CreatedByAgent = actor.AgentId,
                CreatedByAccount = actor.AccountId,
                CreatedAt = now,
            };
            db.StudioPacks.Add(pack);
        }
        else if (request.StyleId is { Length: > 0 } styleId && styleId != pack.StyleId)
        {
            return Problems.Of(StatusCodes.Status409Conflict, "style_mismatch", "This pack has another style");
        }

        var version = new StudioPackVersion
        {
            Id = Guid.CreateVersion7(now),
            PackId = pack.Id,
            Version = request.Version!,
            Status = PackVersionStatus.Draft,
            CreatedByAgent = actor.AgentId,
            CreatedByAccount = actor.AccountId,
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.StudioPackVersions.Add(version);
        var assets = (request.Assets ?? []).Select(asset => NewAsset(version.Id, asset)).ToList();
        db.StudioAssets.AddRange(assets);
        Audit(db, actor, "draft.create", Target(version), version.Id, new { assets = assets.Count }, now);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Someone made this pack at the same moment: send the draft again, it lands in theirs.
            return Problems.Of(StatusCodes.Status409Conflict, "pack_exists", "This pack was just made; send the draft again");
        }

        return TypedResults.Ok(View(version, assets, options.Value));
    }

    private static async Task<Results<Ok<PackVersionView>, ValidationProblem, ProblemHttpResult>> UpdateDraftAsync(
        Guid versionId,
        DraftUpdateRequest request,
        HttpContext http,
        ToheDbContext db,
        IStudioStorage storage,
        IOptions<StudioOptions> options,
        TimeProvider clock,
        ILoggerFactory logs,
        CancellationToken ct)
    {
        if (await db.StudioPackVersions.FirstOrDefaultAsync(found => found.Id == versionId, ct) is not { } version)
        {
            return VersionNotFound();
        }

        var actor = StudioActor.Of(http);
        if (DraftRefusal(version, actor) is { } refused)
        {
            return refused;
        }

        if (StudioInput.Draft(request.Version, request.Assets, options.Value.MaxFileBytes) is { Count: > 0 } errors)
        {
            return TypedResults.ValidationProblem(errors);
        }

        // The assets are replaced; a file that arrived and is still named keeps it, one no longer named is deleted.
        var before = await db.StudioAssets.Where(asset => asset.VersionId == versionId).ToListAsync(ct);
        var after = (request.Assets ?? []).Select(asset => NewAsset(versionId, asset)).ToList();
        foreach (var asset in after)
        {
            asset.UploadedAt = before.FirstOrDefault(old => SameFile(old.Sha256, old.Ext, old.Bytes, asset.Sha256, asset.Ext, asset.Bytes))?.UploadedAt;
        }

        var gone = before
            .Where(old => old.UploadedAt is not null && !after.Any(asset => asset.Sha256 == old.Sha256 && asset.Ext == old.Ext && asset.UploadedAt is not null))
            .Select(old => StudioKeys.Draft(versionId, old.Sha256, old.Ext))
            .Distinct(StringComparer.Ordinal)
            .ToList();
        var now = clock.GetUtcNow();
        version.Version = request.Version!;
        version.UpdatedAt = now;
        db.StudioAssets.RemoveRange(before);
        db.StudioAssets.AddRange(after);
        Audit(db, actor, "draft.update", Target(version), version.Id, new { assets = after.Count }, now);
        if (await SaveReviewAsync(db, ct) is { } changed)
        {
            return changed;
        }

        await DeleteQuietlyAsync(storage, gone, logs);
        return TypedResults.Ok(View(version, after, options.Value));
    }

    private static async Task<Results<NoContent, ValidationProblem, ProblemHttpResult>> UploadFileAsync(
        Guid versionId,
        string sha256,
        Stream body,
        HttpContext http,
        ToheDbContext db,
        IStudioStorage storage,
        IStudioChecks checks,
        IOptions<StudioOptions> options,
        TimeProvider clock,
        CancellationToken ct)
    {
        if (await db.StudioPackVersions.FirstOrDefaultAsync(found => found.Id == versionId, ct) is not { } version)
        {
            return VersionNotFound();
        }

        var actor = StudioActor.Of(http);
        if (DraftRefusal(version, actor) is { } refused)
        {
            return refused;
        }

        var assets = await db.StudioAssets.Where(asset => asset.VersionId == versionId && asset.Sha256 == sha256).ToListAsync(ct);
        if (assets.Count == 0)
        {
            return FileNotInDraft();
        }

        var settings = options.Value;
        var content = await ReadBodyAsync(http.Request, body, settings.MaxFileBytes, ct);
        if (content is null)
        {
            return FileTooLarge(settings.MaxFileBytes);
        }

        var file = assets[0];
        if (FileMismatch(content, sha256, file.Bytes) is { } mismatch)
        {
            return mismatch;
        }

        if (await DraftBytesAsync(db, actor, (versionId, sha256), ct) + content.Length > settings.DraftQuotaBytes)
        {
            return Problems.Of(StatusCodes.Status409Conflict, "drafts_quota_exceeded", "Your drafts hold as many bytes as they may; submit or change some first");
        }

        var style = await StyleOfAsync(db, version.PackId, ct);
        if (ChecksFailed(await checks.CheckFileAsync(new StudioFileToCheck(version, style, assets, content), ct)) is { } failed)
        {
            return failed;
        }

        await storage.PutAsync(StudioKeys.Draft(versionId, sha256, file.Ext), content, StudioKeys.ContentType(file.Ext), published: false, ct);
        var now = clock.GetUtcNow();
        foreach (var asset in assets)
        {
            asset.UploadedAt = now;
        }

        version.UpdatedAt = now;
        Audit(db, actor, "draft.file.upload", Target(version), version.Id, new { sha256, bytes = content.Length }, now);
        if (await SaveReviewAsync(db, ct) is { } changed)
        {
            return changed;
        }

        return TypedResults.NoContent();
    }

    private static async Task<Results<Ok<PackVersionView>, ValidationProblem, ProblemHttpResult>> SubmitAsync(
        Guid versionId, HttpContext http, ToheDbContext db, IStudioChecks checks, IOptions<StudioOptions> options, TimeProvider clock, CancellationToken ct)
    {
        if (await db.StudioPackVersions.FirstOrDefaultAsync(found => found.Id == versionId, ct) is not { } version)
        {
            return VersionNotFound();
        }

        var actor = StudioActor.Of(http);
        if (DraftRefusal(version, actor) is { } refused)
        {
            return refused;
        }

        var assets = await AssetsOfAsync(db, versionId, ct);
        if (assets.Count == 0)
        {
            return Problems.Field("assets", "assets_required");
        }

        if (assets.Where(asset => asset.UploadedAt is null).Select(asset => asset.AssetId).ToList() is { Count: > 0 } missing)
        {
            return TypedResults.Problem(
                title: "Some files are not uploaded yet",
                statusCode: StatusCodes.Status409Conflict,
                extensions: new Dictionary<string, object?> { ["code"] = "files_missing", ["assets"] = missing });
        }

        if (await ToCheckAsync(db, version, assets, ct) is not { } toCheck)
        {
            return VersionNotGreater();
        }

        if (ChecksFailed(await checks.CheckVersionAsync(toCheck, StudioCheckStage.Submit, ct)) is { } failed)
        {
            return failed;
        }

        var now = clock.GetUtcNow();
        version.Status = PackVersionStatus.Submitted;
        version.SubmittedAt = now;
        version.UpdatedAt = now;
        Audit(db, actor, "version.submit", Target(version), version.Id, new { assets = assets.Count }, now);
        if (await SaveReviewAsync(db, ct) is { } changed)
        {
            return changed;
        }

        return TypedResults.Ok(View(version, assets, options.Value));
    }

    // ---------------------------------------------------------------------------------------------------------- review

    private static async Task<Results<Ok<PackVersionView>, ProblemHttpResult>> ApproveAsync(
        Guid versionId,
        HttpContext http,
        ToheDbContext db,
        IStudioStorage storage,
        IStudioChecks checks,
        IOptions<StudioOptions> options,
        TimeProvider clock,
        ILoggerFactory logs,
        CancellationToken ct)
    {
        if (await db.StudioPackVersions.FirstOrDefaultAsync(found => found.Id == versionId, ct) is not { } version)
        {
            return VersionNotFound();
        }

        if (version.Status != PackVersionStatus.Submitted)
        {
            return VersionNotSubmitted();
        }

        var assets = await AssetsOfAsync(db, versionId, ct);
        if (await ToCheckAsync(db, version, assets, ct) is not { } toCheck)
        {
            return VersionNotGreater();
        }

        if (ChecksFailed(await checks.CheckVersionAsync(toCheck, StudioCheckStage.Approve, ct)) is { } failed)
        {
            return failed;
        }

        // Written once, never overwritten: one already there goes on only when it holds these very bytes — a retry after
        // the database failed to record the approval.
        var (manifest, manifestSha256) = PackManifests.Write(version.PackId, version.Version, assets);
        var manifestKey = StudioKeys.Manifest(version.PackId, version.Version);
        var written = false;
        if (await storage.ReadAsync(manifestKey, ct) is { } existing)
        {
            await using (existing)
            {
                using var bytes = new MemoryStream();
                await existing.Content.CopyToAsync(bytes, ct);
                if (!bytes.ToArray().AsSpan().SequenceEqual(manifest))
                {
                    return Problems.Of(StatusCodes.Status409Conflict, "manifest_exists", "A manifest of this pack version is already published; it never changes");
                }
            }

            written = true;
        }

        var files = Files(assets);
        foreach (var (sha256, ext) in files)
        {
            var blob = StudioKeys.Blob(sha256, ext);
            if (!await storage.ExistsAsync(blob, ct))
            {
                await storage.CopyAsync(StudioKeys.Draft(versionId, sha256, ext), blob, StudioKeys.ContentType(ext), published: true, ct);
            }
        }

        if (!written)
        {
            await storage.PutAsync(manifestKey, manifest, "application/json", published: true, ct);
        }

        var now = clock.GetUtcNow();
        var reviewer = StudioActor.Of(http);
        version.Status = PackVersionStatus.Approved;
        version.ReviewedBy = reviewer.AccountId;
        version.ReviewedAt = now;
        version.ManifestSha256 = manifestSha256;
        version.UpdatedAt = now;
        Audit(db, reviewer, "version.approve", Target(version), version.Id, new { manifestSha256, files = files.Count }, now);
        if (await SaveReviewAsync(db, ct) is { } changed)
        {
            return changed;
        }

        await DeleteQuietlyAsync(storage, files.Select(file => StudioKeys.Draft(versionId, file.Sha256, file.Ext)), logs);
        return TypedResults.Ok(View(version, assets, options.Value));
    }

    private static async Task<Results<Ok<PackVersionView>, ValidationProblem, ProblemHttpResult>> RejectAsync(
        Guid versionId,
        ReviewReasonRequest request,
        HttpContext http,
        ToheDbContext db,
        IStudioStorage storage,
        IOptions<StudioOptions> options,
        TimeProvider clock,
        ILoggerFactory logs,
        CancellationToken ct)
    {
        var reason = request.Reason?.Trim();
        if (string.IsNullOrEmpty(reason))
        {
            return Problems.Field("reason", "reason_required");
        }

        if (reason.Length > StudioPackVersion.MaxReason)
        {
            return Problems.Field("reason", "reason_too_long");
        }

        if (await db.StudioPackVersions.FirstOrDefaultAsync(found => found.Id == versionId, ct) is not { } version)
        {
            return VersionNotFound();
        }

        if (version.Status != PackVersionStatus.Submitted)
        {
            return VersionNotSubmitted();
        }

        var assets = await AssetsOfAsync(db, versionId, ct);
        var now = clock.GetUtcNow();
        var reviewer = StudioActor.Of(http);
        version.Status = PackVersionStatus.Rejected;
        version.ReviewedBy = reviewer.AccountId;
        version.ReviewedAt = now;
        version.Reason = reason;
        version.UpdatedAt = now;
        Audit(db, reviewer, "version.reject", Target(version), version.Id, new { reason }, now);
        if (await SaveReviewAsync(db, ct) is { } changed)
        {
            return changed;
        }

        // A fix is a new draft: the rejected files leave the drafts, their metadata stays.
        await DeleteQuietlyAsync(storage, Files(assets).Select(file => StudioKeys.Draft(versionId, file.Sha256, file.Ext)), logs);
        return TypedResults.Ok(View(version, assets, options.Value));
    }

    private static async Task<Results<Ok<PackVersionView>, ValidationProblem, ProblemHttpResult>> DeprecateAsync(
        Guid versionId,
        ReviewReasonRequest request,
        HttpContext http,
        ToheDbContext db,
        IOptions<StudioOptions> options,
        TimeProvider clock,
        CancellationToken ct)
    {
        var reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim();
        if (reason is { Length: > StudioPackVersion.MaxReason })
        {
            return Problems.Field("reason", "reason_too_long");
        }

        if (await db.StudioPackVersions.FirstOrDefaultAsync(found => found.Id == versionId, ct) is not { } version)
        {
            return VersionNotFound();
        }

        if (version.Status != PackVersionStatus.Approved)
        {
            return VersionNotApproved();
        }

        var now = clock.GetUtcNow();
        var reviewer = StudioActor.Of(http);
        version.Status = PackVersionStatus.Deprecated;
        version.DeprecatedBy = reviewer.AccountId;
        version.DeprecatedAt = now;
        version.UpdatedAt = now;
        Audit(db, reviewer, "version.deprecate", Target(version), version.Id, new { reason }, now);
        if (await SaveReviewAsync(db, ct) is { } changed)
        {
            return changed;
        }

        return TypedResults.Ok(View(version, await AssetsOfAsync(db, versionId, ct), options.Value));
    }

    private static async Task<Results<Ok<PackVersionView>, ValidationProblem, ProblemHttpResult>> WithdrawAsync(
        Guid versionId,
        WithdrawRequest request,
        HttpContext http,
        ToheDbContext db,
        IStudioStorage storage,
        PlatformRoles roles,
        UserManager<Account> users,
        IOptions<StudioOptions> options,
        TimeProvider clock,
        CancellationToken ct)
    {
        var reason = request.Reason?.Trim();
        if (string.IsNullOrEmpty(reason))
        {
            return Problems.Field("reason", "reason_required");
        }

        if (reason.Length > StudioPackVersion.MaxReason)
        {
            return Problems.Field("reason", "reason_too_long");
        }

        // The owner alone, read from the platform's roles now (ADR 0051): a reviewer who is not the owner never withdraws.
        var caller = StudioCaller.Of(http);
        if (await roles.RoleOfAsync(caller.AccountId, ct) != PlatformRole.Owner
            || await users.FindByIdAsync(caller.AccountId.ToString()) is not { } account)
        {
            return Problems.Of(StatusCodes.Status403Forbidden, "owner_required", "Only the owner withdraws a pack version");
        }

        if (await db.StudioPackVersions.FirstOrDefaultAsync(found => found.Id == versionId, ct) is not { } version)
        {
            return VersionNotFound();
        }

        if (!IsPublished(version.Status))
        {
            return VersionNotApproved();
        }

        // A fresh second factor in the request; wrong codes count towards the lockout even when refused.
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        if (Authenticator.Problem(await Authenticator.CheckCodeAsync(account, request.Code, users, clock)) is { } wrong)
        {
            await transaction.CommitAsync(ct);
            return wrong;
        }

        // The manifest, and every blob no other published version uses, before the status: deleting is safe to repeat.
        var assets = await AssetsOfAsync(db, versionId, ct);
        var files = Files(assets);
        var hashes = files.Select(file => file.Sha256).ToList();
        var shared = await db.StudioAssets.AsNoTracking()
            .Where(asset => asset.VersionId != versionId && hashes.Contains(asset.Sha256))
            .Join(
                db.StudioPackVersions.Where(other =>
                    other.Status == PackVersionStatus.Approved || other.Status == PackVersionStatus.Deprecated),
                asset => asset.VersionId,
                other => other.Id,
                (asset, _) => new { asset.Sha256, asset.Ext })
            .ToListAsync(ct);
        var deleted = files.Where(file => !shared.Any(other => other.Sha256 == file.Sha256 && other.Ext == file.Ext)).ToList();
        await storage.DeleteAsync(StudioKeys.Manifest(version.PackId, version.Version), ct);
        foreach (var (sha256, ext) in deleted)
        {
            await storage.DeleteAsync(StudioKeys.Blob(sha256, ext), ct);
        }

        var now = clock.GetUtcNow();
        version.Status = PackVersionStatus.Withdrawn;
        version.WithdrawnBy = caller.AccountId;
        version.WithdrawnAt = now;
        version.WithdrawReason = reason;
        version.UpdatedAt = now;
        Audit(db, StudioActor.Of(http), "version.withdraw", Target(version), version.Id, new { reason, deletedFiles = deleted.Count, keptFiles = files.Count - deleted.Count }, now);
        if (await SaveReviewAsync(db, ct) is { } changed)
        {
            return changed;
        }

        await transaction.CommitAsync(ct);
        return TypedResults.Ok(View(version, assets, options.Value));
    }

    // --------------------------------------------------------------------------------------------------------- helpers

    private static bool IsPublished(PackVersionStatus status) =>
        status is PackVersionStatus.Approved or PackVersionStatus.Deprecated;

    /// <summary>Every published version ever approved keeps its number: approved, deprecated or withdrawn.</summary>
    private static bool WasApproved(PackVersionStatus status) =>
        status is PackVersionStatus.Approved or PackVersionStatus.Deprecated or PackVersionStatus.Withdrawn;

    /// <summary>
    /// What the checks of a whole version read, or null when the version is not above every one the pack ever had
    /// approved.
    /// </summary>
    private static async Task<StudioVersionToCheck?> ToCheckAsync(
        ToheDbContext db, StudioPackVersion version, IReadOnlyList<StudioAsset> assets, CancellationToken ct)
    {
        var mine = SemVersion.Parse(version.Version);
        var approved = (await db.StudioPackVersions.AsNoTracking()
                .Where(other => other.PackId == version.PackId && other.Id != version.Id)
                .ToListAsync(ct))
            .Where(other => WasApproved(other.Status))
            .Select(other => (Version: other, Number: SemVersion.Parse(other.Version)))
            .Where(other => other.Number is not null)
            .OrderByDescending(other => other.Number)
            .ToList();
        if (mine is null || (approved.Count > 0 && mine.CompareTo(approved[0].Number) <= 0))
        {
            return null;
        }

        var previous = approved.Count > 0 ? approved[0].Version : null;
        var previousAssets = previous is null ? [] : await AssetsOfAsync(db, previous.Id, ct);
        var pack = await db.StudioPacks.AsNoTracking().SingleAsync(found => found.Id == version.PackId, ct);
        var style = await db.StudioStyles.AsNoTracking().SingleAsync(found => found.Id == pack.StyleId, ct);
        return new StudioVersionToCheck(pack, style, version, assets, previous, previousAssets);
    }

    /// <summary>
    /// The bytes of uploaded files a creator keeps in versions still <c>draft</c> or <c>submitted</c>, each file of a
    /// version once, but for <paramref name="except"/> — the file about to be uploaded again.
    /// </summary>
    private static async Task<long> DraftBytesAsync(ToheDbContext db, StudioActor actor, (Guid VersionId, string Sha256) except, CancellationToken ct)
    {
        var versions = db.StudioPackVersions.Where(version =>
            version.Status == PackVersionStatus.Draft || version.Status == PackVersionStatus.Submitted);
        versions = actor.AgentId is { } agent
            ? versions.Where(version => version.CreatedByAgent == agent)
            : versions.Where(version => version.CreatedByAccount == actor.AccountId);
        var files = await db.StudioAssets.AsNoTracking()
            .Where(asset => asset.UploadedAt != null && versions.Any(version => version.Id == asset.VersionId))
            .Select(asset => new { asset.VersionId, asset.Sha256, asset.Bytes })
            .Distinct()
            .ToListAsync(ct);
        return files.Where(file => (file.VersionId, file.Sha256) != except).Sum(file => file.Bytes);
    }

    /// <summary>The body, at most <paramref name="max"/> bytes; null when it is longer.</summary>
    private static async Task<byte[]?> ReadBodyAsync(HttpRequest request, Stream body, long max, CancellationToken ct)
    {
        if (request.ContentLength > max)
        {
            return null;
        }

        using var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int read;
        while ((read = await body.ReadAsync(chunk, ct)) > 0)
        {
            if (buffer.Length + read > max)
            {
                return null;
            }

            buffer.Write(chunk, 0, read);
        }

        return buffer.ToArray();
    }

    private static ValidationProblem? FileMismatch(byte[] content, string sha256, long bytes)
    {
        if (content.LongLength != bytes)
        {
            return Problems.Field("file", "bytes_mismatch");
        }

        return PackManifests.Sha256(content) == sha256 ? null : Problems.Field("file", "sha256_mismatch");
    }

    private static async Task<Results<FileStreamHttpResult, ProblemHttpResult>> StreamAsync(
        HttpContext http, IStudioStorage storage, string key, string ext, CancellationToken ct)
    {
        if (await storage.ReadAsync(key, ct) is not { } found)
        {
            return FileNotFound();
        }

        // Shown to a person on the hub's origin for now: nothing in it may run, and nothing but a picture is shown inline.
        http.Response.Headers.XContentTypeOptions = "nosniff";
        http.Response.Headers.ContentSecurityPolicy = "default-src 'none'; sandbox";
        http.Response.Headers.CacheControl = "private, no-store";
        var contentType = StudioKeys.ContentType(ext);
        var inline = contentType.StartsWith("image/", StringComparison.Ordinal);
        return TypedResults.Stream(found.Content, contentType, fileDownloadName: inline ? null : $"file.{ext}");
    }

    private static async Task DeleteQuietlyAsync(IStudioStorage storage, IEnumerable<string> keys, ILoggerFactory logs)
    {
        foreach (var key in keys)
        {
            try
            {
                await storage.DeleteAsync(key, CancellationToken.None);
            }
            catch (Exception error) when (error is not OperationCanceledException)
            {
                LogDeleteFailed(logs.CreateLogger(typeof(StudioLibraryEndpoints)), error, key);
            }
        }
    }

    /// <summary>Saves a change whose status was read before: someone else changing it meanwhile is a 409.</summary>
    private static async Task<ProblemHttpResult?> SaveReviewAsync(ToheDbContext db, CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
            return null;
        }
        catch (DbUpdateConcurrencyException)
        {
            return Problems.Of(StatusCodes.Status409Conflict, "version_changed", "This pack version changed meanwhile; read it again");
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return VersionNotGreater();
        }
    }

    private static List<(string Sha256, string Ext)> Files(IEnumerable<StudioAsset> assets) =>
        [.. assets.Select(asset => (asset.Sha256, asset.Ext)).Distinct()];

    private static bool SameFile(string sha256, string ext, long bytes, string otherSha256, string otherExt, long otherBytes) =>
        sha256 == otherSha256 && ext == otherExt && bytes == otherBytes;

    private static ProblemHttpResult? DraftRefusal(StudioPackVersion version, StudioActor actor)
    {
        if (!actor.Made(version.CreatedByAgent, version.CreatedByAccount))
        {
            return NotYours();
        }

        return version.Status == PackVersionStatus.Draft
            ? null
            : Problems.Of(StatusCodes.Status409Conflict, "not_a_draft", "This pack version is no longer a draft");
    }

    private static ProblemHttpResult? StyleRefusal(StudioStyle style, StudioActor actor)
    {
        if (!actor.Made(style.CreatedByAgent, style.CreatedByAccount))
        {
            return NotYours();
        }

        return style.Status == StyleStatus.Draft
            ? null
            : Problems.Of(StatusCodes.Status409Conflict, "not_a_draft", "This style is no longer a draft");
    }

    private static ProblemHttpResult? ChecksFailed(IReadOnlyList<StudioCheckFailure> failures) =>
        failures.Count == 0
            ? null
            : TypedResults.Problem(
                title: "The Studio's checks refused it",
                statusCode: StatusCodes.Status422UnprocessableEntity,
                extensions: new Dictionary<string, object?> { ["code"] = "checks_failed", ["failures"] = failures });

    private static void Audit(ToheDbContext db, StudioActor? actor, string action, string target, Guid? versionId, object? details, DateTimeOffset now) =>
        db.StudioAudit.Add(new StudioAuditEntry
        {
            At = now,
            Action = action,
            AgentId = actor?.AgentId,
            AccountId = actor?.AccountId,
            Target = target.Length > 120 ? target[..120] : target,
            VersionId = versionId,
            Details = details is null ? null : JsonSerializer.Serialize(details, Json),
        });

    internal static string Target(StudioPackVersion version) => $"{version.PackId}@{version.Version}";

    private static void Apply(StudioStyle style, StyleRequest request, DateTimeOffset now)
    {
        style.TileSize = request.TileSize;
        style.Palette = request.Palette is null ? null : [.. request.Palette];
        style.Outline = string.IsNullOrWhiteSpace(request.Outline) ? null : request.Outline.Trim();
        style.UpdatedAt = now;
    }

    private static StudioStyleSample NewSample(string styleId, StyleSampleInput sample) => new()
    {
        StyleId = styleId,
        Sha256 = sample.Sha256!,
        Ext = sample.Ext!,
        Bytes = sample.Bytes!.Value,
    };

    private static StudioAsset NewAsset(Guid versionId, AssetInput asset) => new()
    {
        VersionId = versionId,
        AssetId = asset.Id!,
        Kind = asset.Kind!,
        Sha256 = asset.Sha256!,
        Ext = asset.Ext!,
        Bytes = asset.Bytes!.Value,
        Width = asset.Width,
        Height = asset.Height,
        Frames = asset.Frames,
        Tags = [.. asset.Tags ?? []],
        Licence = asset.Licence!,
        Attribution = string.IsNullOrWhiteSpace(asset.Attribution) ? null : asset.Attribution.Trim(),
        Source = asset.Source!.Value.GetRawText(),
    };

    private static async Task<List<StudioStyleSample>> SamplesOfAsync(ToheDbContext db, string styleId, CancellationToken ct) =>
        await db.StudioStyleSamples.AsNoTracking().Where(sample => sample.StyleId == styleId).ToListAsync(ct);

    internal static async Task<List<StudioAsset>> AssetsOfAsync(ToheDbContext db, Guid versionId, CancellationToken ct) =>
        await db.StudioAssets.AsNoTracking().Where(asset => asset.VersionId == versionId).OrderBy(asset => asset.AssetId).ToListAsync(ct);

    private static async Task<StudioStyle> StyleOfAsync(ToheDbContext db, string packId, CancellationToken ct) =>
        await db.StudioPacks.AsNoTracking()
            .Where(pack => pack.Id == packId)
            .Join(db.StudioStyles.AsNoTracking(), pack => pack.StyleId, style => style.Id, (_, style) => style)
            .SingleAsync(ct);

    private static StudioCreatorView Creator(Guid? agentId, Guid? accountId) =>
        agentId is { } agent ? new StudioCreatorView("agent", agent) : new StudioCreatorView("account", accountId ?? Guid.Empty);

    private static StyleView View(StudioStyle style, IEnumerable<StudioStyleSample> samples) => new(
        style.Id,
        style.Name,
        StudioNames.Of(style.Status),
        style.TileSize,
        style.View,
        style.Palette,
        style.Outline,
        [.. samples.OrderBy(sample => sample.Sha256, StringComparer.Ordinal).Select(sample => new StyleSampleView(sample.Sha256, sample.Ext, sample.Bytes, sample.UploadedAt is not null))],
        Creator(style.CreatedByAgent, style.CreatedByAccount),
        style.CreatedAt,
        style.UpdatedAt);

    private static PackView View(StudioPack pack, IEnumerable<StudioPackVersion> versions) => new(
        pack.Id,
        pack.StyleId,
        pack.Description,
        Creator(pack.CreatedByAgent, pack.CreatedByAccount),
        pack.CreatedAt,
        [
            .. versions.OrderByDescending(version => version.CreatedAt).Select(version => new PackVersionSummaryView(
                version.Id,
                version.Version,
                StudioNames.Of(version.Status),
                Creator(version.CreatedByAgent, version.CreatedByAccount),
                version.CreatedAt,
                version.SubmittedAt,
                version.ReviewedAt)),
        ]);

    private static PackVersionView View(StudioPackVersion version, IEnumerable<StudioAsset> assets, StudioOptions options)
    {
        var publicBase = options.Storage.PublicBaseUrl?.TrimEnd('/');
        var published = IsPublished(version.Status) && !string.IsNullOrEmpty(publicBase);
        return new PackVersionView(
            version.Id,
            version.PackId,
            version.Version,
            StudioNames.Of(version.Status),
            Creator(version.CreatedByAgent, version.CreatedByAccount),
            version.CreatedAt,
            version.UpdatedAt,
            version.SubmittedAt,
            version.ReviewedBy,
            version.ReviewedAt,
            version.Reason,
            version.DeprecatedAt,
            version.WithdrawnAt,
            version.WithdrawReason,
            version.ManifestSha256,
            published ? $"{publicBase}/{StudioKeys.Manifest(version.PackId, version.Version)}" : null,
            [
                .. assets.OrderBy(asset => asset.AssetId, StringComparer.Ordinal).Select(asset => new AssetView(
                    asset.AssetId,
                    asset.Kind,
                    asset.Sha256,
                    asset.Ext,
                    asset.Bytes,
                    asset.Width,
                    asset.Height,
                    asset.Frames,
                    asset.Tags,
                    asset.Licence,
                    asset.Attribution,
                    JsonDocument.Parse(asset.Source).RootElement.Clone(),
                    asset.UploadedAt is not null || IsPublished(version.Status),
                    published ? $"{publicBase}/{StudioKeys.Blob(asset.Sha256, asset.Ext)}" : null)),
            ]);
    }

    private static ProblemHttpResult StyleNotFound() =>
        Problems.Of(StatusCodes.Status404NotFound, "style_not_found", "No style has this id");

    private static ProblemHttpResult VersionNotFound() =>
        Problems.Of(StatusCodes.Status404NotFound, "version_not_found", "No pack version has this id");

    private static ProblemHttpResult FileNotFound() =>
        Problems.Of(StatusCodes.Status404NotFound, "file_not_found", "No such file");

    private static ProblemHttpResult FileNotInDraft() =>
        Problems.Of(StatusCodes.Status404NotFound, "file_not_in_draft", "No asset of this draft names a file with this sha256");

    private static ProblemHttpResult FileTooLarge(long max) =>
        TypedResults.Problem(
            title: "This file is larger than the Studio takes",
            statusCode: StatusCodes.Status413PayloadTooLarge,
            extensions: new Dictionary<string, object?> { ["code"] = "file_too_large", ["maxBytes"] = max });

    private static ProblemHttpResult NotYours() =>
        Problems.Of(StatusCodes.Status403Forbidden, "not_yours", "Only who made a draft changes it");

    private static ProblemHttpResult VersionNotGreater() =>
        Problems.Of(StatusCodes.Status409Conflict, "version_not_greater", "The version must be greater than every one of this pack approved before");

    private static ProblemHttpResult VersionNotSubmitted() =>
        Problems.Of(StatusCodes.Status409Conflict, "version_not_submitted", "Only a submitted pack version is approved or rejected");

    private static ProblemHttpResult VersionNotApproved() =>
        Problems.Of(StatusCodes.Status409Conflict, "version_not_approved", "This pack version is not published");

    [LoggerMessage(Level = LogLevel.Warning, Message = "Studio: deleting {Key} from the storage failed; it stays until the drafts are cleaned")]
    private static partial void LogDeleteFailed(ILogger logger, Exception error, string key);
}
