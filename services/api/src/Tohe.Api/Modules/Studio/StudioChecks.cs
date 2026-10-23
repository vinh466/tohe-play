using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Studio;

/// <summary>One check that failed: the asset it is about (none for the whole version), a stable code, and what is wrong.</summary>
/// <param name="Asset">The asset's id; none when the problem is the version's.</param>
/// <param name="Code">
/// A stable code: <c>format_not_allowed</c>, <c>magic_mismatch</c>, <c>too_many_pixels</c>, <c>too_large</c>,
/// <c>size_not_tile_multiple</c>, <c>frames_mismatch</c>, <c>colour_not_in_palette</c>, <c>alpha_not_binary</c>,
/// <c>tile_edges_differ</c>, <c>id_duplicate</c>, <c>style_unknown</c>, <c>style_not_approved</c>,
/// <c>source_incomplete</c>, <c>licence_not_accepted</c>, <c>attribution_missing</c>, <c>vendor_not_checked</c> or
/// <c>semver_too_small</c>.
/// </param>
/// <param name="Message">What is wrong, in English, for whoever fixes it.</param>
public sealed record StudioCheckProblem(string? Asset, string Code, string Message);

/// <summary>What the Studio's checks found: <c>ok</c> when nothing.</summary>
public sealed record StudioCheckReport(bool Ok, IReadOnlyList<StudioCheckProblem> Problems)
{
    public static StudioCheckReport Of(IReadOnlyList<StudioCheckProblem> problems) => new(problems.Count == 0, problems);
}

/// <summary>When the checks of a whole version run.</summary>
internal enum StudioCheckStage
{
    /// <summary>On submitting, and the dry run: a <c>CC-BY-SA-4.0</c> asset waits for the reviewer's word.</summary>
    Submit,

    /// <summary>On approving: the style approved, and <c>CC-BY-SA-4.0</c> only when the reviewer allowed it.</summary>
    Approve,
}

/// <summary>The limits the checks hold a file and a version to (<see cref="StudioOptions"/>).</summary>
internal sealed record StudioCheckLimits(long MaxFileBytes, long MaxPackBytes, long MaxPixels)
{
    public static StudioCheckLimits Of(StudioOptions options) => new(options.MaxFileBytes, options.MaxPackBytes, options.MaxPixels);
}

/// <summary>An uploaded file, before it is kept: its bytes and every asset of the draft that names it.</summary>
internal sealed record StudioFileToCheck(
    StudioPackVersion Version,
    StudioStyle? Style,
    IReadOnlyList<StudioAsset> Assets,
    byte[] Content);

/// <summary>
/// What the checks of one file found, and the file to keep: its metadata stripped (the same bytes when it had none) and
/// its size in pixels, when it could be read.
/// </summary>
internal sealed record StudioFileResult(IReadOnlyList<StudioCheckProblem> Problems, byte[] Content, int? Width, int? Height);

/// <summary>
/// A whole version, on submitting, on approving and on a dry run: its pack and style (none when the style is gone), its
/// assets, and the version approved last before it with its assets (none for a first version). Its files are in
/// <see cref="IStudioStorage"/> under <see cref="StudioKeys.Draft"/>.
/// </summary>
internal sealed record StudioVersionToCheck(
    StudioPack Pack,
    StudioStyle? Style,
    StudioPackVersion Version,
    IReadOnlyList<StudioAsset> Assets,
    StudioPackVersion? Previous,
    IReadOnlyList<StudioAsset> PreviousAssets);

/// <summary>
/// The server's checks of the Studio (docs/architecture/asset-studio.md#checks), the gate of every draft: the file's on
/// every upload, all of them on submitting, again on approving, and on a dry run that saves nothing. Any problem refuses
/// an upload, a submission or an approval with <c>422 checks_failed</c> and the problems.
/// </summary>
internal interface IStudioChecks
{
    Task<StudioFileResult> CheckFileAsync(StudioFileToCheck file, CancellationToken ct);

    Task<IReadOnlyList<StudioCheckProblem>> CheckVersionAsync(StudioVersionToCheck version, StudioCheckStage stage, CancellationToken ct);
}

/// <summary>
/// The checks as the API runs them: <see cref="StudioFileChecks"/> on each file, <see cref="StudioVersionChecks"/> on the
/// metadata, with the vendors whose terms were checked from <c>studio.vendors</c> and the files from the drafts.
/// </summary>
internal sealed class StudioChecks(ToheDbContext db, IStudioStorage storage, IOptions<StudioOptions> options) : IStudioChecks
{
    private StudioCheckLimits Limits => StudioCheckLimits.Of(options.Value);

    public Task<StudioFileResult> CheckFileAsync(StudioFileToCheck file, CancellationToken ct) =>
        Task.FromResult(StudioFileChecks.Check(file.Content, file.Assets[0].Ext, file.Assets, file.Style, Limits));

    public async Task<IReadOnlyList<StudioCheckProblem>> CheckVersionAsync(
        StudioVersionToCheck version, StudioCheckStage stage, CancellationToken ct)
    {
        var vendors = await db.StudioVendors.AsNoTracking()
            .Where(vendor => vendor.TermsCheckedAt != null)
            .Select(vendor => vendor.Id)
            .ToListAsync(ct);
        var problems = StudioVersionChecks.Check(version, stage, vendors.ToHashSet(StringComparer.Ordinal), Limits);

        // Every file that arrived, again: the limits or the style may have changed since its upload. One not uploaded
        // yet is checked when it is (submitting refuses a draft with one missing).
        var limits = Limits;
        foreach (var file in version.Assets.Where(asset => asset.UploadedAt is not null).GroupBy(asset => (asset.Sha256, asset.Ext)))
        {
            if (await storage.ReadAsync(StudioKeys.Draft(version.Version.Id, file.Key.Sha256, file.Key.Ext), ct) is not { } found)
            {
                continue;
            }

            byte[] content;
            await using (found)
            {
                using var bytes = new MemoryStream();
                await found.Content.CopyToAsync(bytes, ct);
                content = bytes.ToArray();
            }

            problems.AddRange(StudioFileChecks.Check(content, file.Key.Ext, [.. file], version.Style, limits).Problems);
        }

        return StudioVersionChecks.Ordered(problems);
    }
}

/// <summary>
/// The licences the Studio accepts (ADR 0051), as SPDX identifiers: a mirror of <c>ACCEPTED_ASSET_LICENCES</c> and of
/// <c>licenceNeedsAttribution</c> in <c>@tohe/contract</c> (packages/contract/src/assets.ts). A test reads that file and
/// fails when the lists differ.
/// </summary>
internal static class StudioLicences
{
    /// <summary>Accepted only when a reviewer allows it for the version, with a reason (ADR 0051).</summary>
    public const string ShareAlike = "CC-BY-SA-4.0";

    public static readonly IReadOnlyList<string> Accepted =
    [
        "CC0-1.0",
        "CC-BY-4.0",
        ShareAlike,
        "OFL-1.1",
        "MIT",
        "BSD-2-Clause",
        "BSD-3-Clause",
        "Apache-2.0",
        "LicenseRef-Tohe-Internal",
    ];

    /// <summary>The accepted licences that ask for no credit.</summary>
    public static readonly IReadOnlyList<string> NoAttribution = ["CC0-1.0", "LicenseRef-Tohe-Internal"];

    public static bool IsAccepted(string spdx) => Accepted.Contains(spdx, StringComparer.Ordinal);

    public static bool NeedsAttribution(string spdx) => !NoAttribution.Contains(spdx, StringComparer.Ordinal);
}
