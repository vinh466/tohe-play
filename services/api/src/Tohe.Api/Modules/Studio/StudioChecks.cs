namespace Tohe.Api.Modules.Studio;

/// <summary>One check that failed: a code, what is wrong, and the asset it is about when it is about one.</summary>
/// <param name="Code">A machine-readable code, e.g. <c>format_not_allowed</c>.</param>
/// <param name="Message">What is wrong, in English.</param>
/// <param name="AssetId">The asset, when the failure is about one.</param>
public sealed record StudioCheckFailure(string Code, string Message, string? AssetId = null);

/// <summary>When the checks of a whole version run.</summary>
internal enum StudioCheckStage
{
    Submit,
    Approve,
}

/// <summary>An uploaded file, before it is kept: its bytes and every asset of the draft that names it.</summary>
internal sealed record StudioFileToCheck(
    StudioPackVersion Version,
    StudioStyle Style,
    IReadOnlyList<StudioAsset> Assets,
    ReadOnlyMemory<byte> Content);

/// <summary>
/// A whole version, on submitting and on approving: its pack and style, its assets, and the version approved last
/// before it with its assets (none for a first version). Its files are in <see cref="IStudioStorage"/> under
/// <see cref="StudioKeys.Draft"/>.
/// </summary>
internal sealed record StudioVersionToCheck(
    StudioPack Pack,
    StudioStyle Style,
    StudioPackVersion Version,
    IReadOnlyList<StudioAsset> Assets,
    StudioPackVersion? Previous,
    IReadOnlyList<StudioAsset> PreviousAssets);

/// <summary>
/// The server's checks of the Studio (docs/architecture/asset-studio.md#checks): on every upload, on submitting and on
/// approving. Any failure refuses the request with <c>422 checks_failed</c>.
/// </summary>
internal interface IStudioChecks
{
    Task<IReadOnlyList<StudioCheckFailure>> CheckFileAsync(StudioFileToCheck file, CancellationToken ct);

    Task<IReadOnlyList<StudioCheckFailure>> CheckVersionAsync(StudioVersionToCheck version, StudioCheckStage stage, CancellationToken ct);
}

/// <summary>A placeholder until the checks themselves arrive: everything passes.</summary>
internal sealed class PassingStudioChecks : IStudioChecks
{
    public Task<IReadOnlyList<StudioCheckFailure>> CheckFileAsync(StudioFileToCheck file, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<StudioCheckFailure>>([]);

    public Task<IReadOnlyList<StudioCheckFailure>> CheckVersionAsync(
        StudioVersionToCheck version, StudioCheckStage stage, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<StudioCheckFailure>>([]);
}
