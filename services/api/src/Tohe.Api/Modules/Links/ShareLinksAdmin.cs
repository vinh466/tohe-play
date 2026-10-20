using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Links;

/// <summary>A share link's maker as the console sees it.</summary>
/// <param name="Name">Its current name; null when the profile is gone.</param>
/// <param name="AccountId">Its account; null for a device profile, whose device is <paramref name="DeviceId"/>.</param>
/// <param name="Stopped">Its account is suspended or waiting to be deleted: its links resolve as revoked meanwhile.</param>
public sealed record AdminLinkMaker(Guid ProfileId, string? Name, bool Child, Guid? AccountId, Guid? DeviceId, bool Stopped);

/// <summary>A share link's counts on one UTC day.</summary>
public sealed record AdminLinkDay(DateOnly Day, int Opened, int Played, int AccountsMade);

/// <summary>A share link as the console sees it (ADR 0044): every count, by day, whatever the threshold the maker has.</summary>
public sealed record AdminShareLinkView(
    string Code,
    string Kind,
    string GameId,
    string GameVersion,
    string Level,
    string State,
    DateTimeOffset CreatedAt,
    DateTimeOffset ExpiresAt,
    int? MaxUses,
    int Uses,
    DateTimeOffset? RevokedAt,
    AdminLinkMaker Maker,
    int Opened,
    int Played,
    int AccountsMade,
    IReadOnlyList<AdminLinkDay> Days);

/// <summary>Share links for the console (ADR 0044): find one by its code, revoke it.</summary>
internal sealed class ShareLinksAdmin(ToheDbContext db, IProfileStandings standings, TimeProvider clock)
{
    /// <summary>The link with this code, typed any way the codes are read; null when there is none.</summary>
    public async Task<AdminShareLinkView?> FindAsync(string? input, CancellationToken ct) =>
        await LinkAsync(input, ct) is { } link ? await ViewAsync(link, ct) : null;

    /// <summary>
    /// Revokes the link, in the caller's unit of work; one revoked already keeps when it was. Null when there is none.
    /// </summary>
    public async Task<(AdminShareLinkView View, bool Changed)?> RevokeAsync(string? input, CancellationToken ct)
    {
        if (await LinkAsync(input, ct) is not { } link)
        {
            return null;
        }

        var changed = link.RevokedAt is null;
        link.RevokedAt ??= clock.GetUtcNow();
        return (await ViewAsync(link, ct), changed);
    }

    private Task<ShareLink?> LinkAsync(string? input, CancellationToken ct) =>
        LinkCodes.TryNormalize(input, out var code)
            ? db.ShareLinks.FirstOrDefaultAsync(link => link.Code == code, ct)
            : Task.FromResult<ShareLink?>(null);

    private async Task<AdminShareLinkView> ViewAsync(ShareLink link, CancellationToken ct)
    {
        var maker = await standings.FindAsync(link.MakerProfileId, ct);
        var days = await db.ShareLinkDays.AsNoTracking()
            .Where(day => day.LinkId == link.Id)
            .OrderByDescending(day => day.Day)
            .Select(day => new AdminLinkDay(day.Day, day.Opened, day.Played, day.AccountsMade))
            .ToListAsync(ct);
        return new AdminShareLinkView(
            link.Code,
            LinkNames.Of(link.Kind),
            link.GameId,
            link.GameVersion,
            LinkNames.Of(link.Level),
            ShareLinks.StateOf(link, maker is null or { Stopped: true }, clock.GetUtcNow()),
            link.CreatedAt,
            link.ExpiresAt,
            link.MaxUses,
            link.Uses,
            link.RevokedAt,
            new AdminLinkMaker(link.MakerProfileId, maker?.Name, maker?.Child ?? false, maker?.AccountId, maker?.DeviceId, maker?.Stopped ?? false),
            days.Sum(day => day.Opened),
            days.Sum(day => day.Played),
            days.Sum(day => day.AccountsMade),
            days);
    }
}
