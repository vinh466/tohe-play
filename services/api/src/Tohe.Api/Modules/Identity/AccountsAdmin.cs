using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Identity;

/// <summary>An account in a list of the admin console.</summary>
/// <param name="Username">What an account from before email sign-in signs in with, until it adds an email.</param>
/// <param name="DeleteAfter">Its owner asked to delete it (ADR 0034): it goes then, unless someone signs in before.</param>
public sealed record AccountSummary(
    Guid Id,
    string? Email,
    string? Username,
    string DisplayName,
    DateTimeOffset CreatedAt,
    string? Role,
    bool Suspended,
    int Profiles,
    DateTimeOffset? DeleteAfter);

/// <summary>One account, as the admin console shows it.</summary>
/// <param name="Logins">The providers it signs in with (ADR 0026).</param>
/// <param name="SuspendedReason">Why, in the admin's words.</param>
/// <param name="Community">The community it came with, by an invite code (ADR 0028).</param>
/// <param name="DeleteAfter">Its owner asked to delete it (ADR 0034): it goes then, unless someone signs in before.</param>
public sealed record AccountDetail(
    Guid Id,
    string? Email,
    string? Username,
    string DisplayName,
    DateTimeOffset CreatedAt,
    string? TermsVersion,
    DateTimeOffset? TermsAcceptedAt,
    string? Role,
    bool HasPassword,
    bool TwoFactorEnabled,
    IReadOnlyList<string> Logins,
    DateTimeOffset? SuspendedAt,
    string? SuspendedReason,
    string? Community,
    IReadOnlyList<ProfileDetail> Profiles,
    DateTimeOffset? DeleteAfter);

/// <param name="Names">The names it had, newest first (D-17).</param>
public sealed record ProfileDetail(
    Guid Id,
    string PublicId,
    string Name,
    string Avatar,
    string Kind,
    string? AgeBand,
    DateTimeOffset CreatedAt,
    IReadOnlyList<NameChange> Names,
    bool OnPublicBoards,
    bool HiddenFromBoards);

/// <param name="Kind"><c>rename</c>: a name it had · <c>merged</c>: a device profile's name merged into it (ADR 0043).</param>
public sealed record NameChange(string Name, DateTimeOffset At, string Kind = "rename");

/// <summary>
/// A device profile on the server (ADR 0043), as the console shows it: no account, no email, no public ID — its name, its
/// avatar, when it came and was last used, the terms its player accepted, and every name it had.
/// </summary>
public sealed record DeviceProfileDetail(
    Guid Id,
    string Name,
    string Avatar,
    DateTimeOffset CreatedAt,
    DateTimeOffset? LastUsedAt,
    string? TermsVersion,
    DateTimeOffset? TermsAcceptedAt,
    IReadOnlyList<NameChange> Names);

/// <summary>A profile as the console names it next to its results: never more than a moderator needs.</summary>
/// <param name="Account">Its account's address, or an old account's username.</param>
public sealed record ProfileCard(Guid Id, string Name, string Avatar, string PublicId, Guid AccountId, string? Account);

/// <summary>
/// What the admin console reads and changes of accounts and profiles (ADR 0027); the tables stay this module's. The
/// console checks who may do what; this only does it.
/// </summary>
internal sealed class AccountsAdmin(
    ToheDbContext db,
    UserManager<Account> users,
    PlatformRoles roles,
    IEnumerable<IProfileData> modules,
    IEnumerable<IProfileNames> names,
    TimeProvider clock)
{
    private const int Page = 50;

    /// <summary>
    /// Device profiles on the server whose name holds the text, or whose id starts with it (ADR 0043); the latest used
    /// first. Nothing typed, the latest used.
    /// </summary>
    public async Task<IReadOnlyList<DeviceProfileDetail>> DeviceProfilesAsync(string? text, CancellationToken ct)
    {
        var query = db.Profiles.AsNoTracking().Where(profile => profile.DeviceId != null);
        var typed = text?.Trim() ?? "";
        if (typed.Length > 0)
        {
            var pattern = $"%{Like(typed)}%";
            var prefix = $"{Like(typed.ToLowerInvariant())}%";
            query = query.Where(profile =>
                EF.Functions.ILike(profile.Name, pattern) || EF.Functions.Like(profile.Id.ToString(), prefix));
        }

        var profiles = await query
            .OrderByDescending(profile => profile.LastUsedAt ?? profile.CreatedAt)
            .Take(Page)
            .ToListAsync(ct);
        return await DeviceDetailsAsync(profiles, ct);
    }

    /// <summary>One device profile on the server, or null when there is none with this id.</summary>
    public async Task<DeviceProfileDetail?> DeviceProfileAsync(Guid id, CancellationToken ct)
    {
        var profiles = await db.Profiles.AsNoTracking().Where(profile => profile.Id == id && profile.DeviceId != null).ToListAsync(ct);
        return (await DeviceDetailsAsync(profiles, ct)).FirstOrDefault();
    }

    private async Task<IReadOnlyList<DeviceProfileDetail>> DeviceDetailsAsync(IReadOnlyList<Profile> profiles, CancellationToken ct)
    {
        var ids = profiles.Select(profile => profile.Id).ToList();
        var names = (await db.ProfileNameHistory.AsNoTracking()
                .Where(name => ids.Contains(name.ProfileId))
                .OrderByDescending(name => name.At).ThenByDescending(name => name.Id)
                .ToListAsync(ct))
            .ToLookup(name => name.ProfileId);
        return [.. profiles.Select(profile => new DeviceProfileDetail(
            profile.Id,
            profile.Name,
            profile.Avatar,
            profile.CreatedAt,
            profile.LastUsedAt,
            profile.TermsVersion,
            profile.TermsAcceptedAt,
            [.. names[profile.Id].Select(name => new NameChange(
                name.Name, name.At, name.Kind == ProfileNameKind.Merged ? "merged" : "rename"))]))];
    }

    /// <summary>
    /// The profile leaves every table it sits at or watches — a bot finishes a hand in progress — and invitations to it
    /// end, as when it is deleted (ADR 0034); nothing it stored goes. A moderator's way to take someone off a table.
    /// </summary>
    public async Task WithdrawAsync(Guid profileId, CancellationToken ct)
    {
        foreach (var module in modules)
        {
            await module.WithdrawAsync([profileId], ct);
        }
    }

    /// <summary>
    /// Accounts whose email, username, display name or profile name holds the text, or whose profile ID starts with
    /// the digits; the newest first. Nothing typed, the newest accounts.
    /// </summary>
    /// <param name="deleting">Only accounts whose owner asked to delete them (ADR 0038), the soonest due first.</param>
    public async Task<IReadOnlyList<AccountSummary>> SearchAsync(string? text, bool deleting, CancellationToken ct)
    {
        var query = db.Users.AsNoTracking();
        if (deleting)
        {
            query = query.Where(account => account.DeleteAfter != null);
        }

        var typed = text?.Trim() ?? "";
        var digits = string.Concat(typed.Where(c => !char.IsWhiteSpace(c)));
        if (digits.Length >= 4 && digits.All(char.IsAsciiDigit))
        {
            query = query.Where(account => db.Profiles.Any(p => p.AccountId == account.Id && p.PublicId!.StartsWith(digits)));
        }
        else if (typed.Length > 0)
        {
            var pattern = $"%{Like(typed)}%";
            query = query.Where(account =>
                EF.Functions.ILike(account.Email ?? "", pattern)
                || EF.Functions.ILike(account.UserName ?? "", pattern)
                || EF.Functions.ILike(account.DisplayName, pattern)
                || db.Profiles.Any(p => p.AccountId == account.Id && EF.Functions.ILike(p.Name, pattern)));
        }

        var ordered = deleting
            ? query.OrderBy(account => account.DeleteAfter)
            : query.OrderByDescending(account => account.CreatedAt);
        var rows = await ordered
            .Take(Page)
            .Select(account => new
            {
                account.Id,
                account.Email,
                account.UserName,
                account.DisplayName,
                account.CreatedAt,
                account.SuspendedAt,
                account.DeleteAfter,
                Profiles = db.Profiles.Count(p => p.AccountId == account.Id),
                Role = db.UserClaims
                    .Where(claim => claim.UserId == account.Id && claim.ClaimType == PlatformRoles.ClaimType)
                    .Select(claim => claim.ClaimValue)
                    .FirstOrDefault(),
            })
            .ToListAsync(ct);
        return [.. rows.Select(row => new AccountSummary(
            row.Id,
            row.Email,
            row.Email is null ? row.UserName : null,
            row.DisplayName,
            row.CreatedAt,
            PlatformRoles.Parse(row.Role) is { } role ? PlatformRoles.NameOf(role) : null,
            row.SuspendedAt is not null,
            row.Profiles,
            row.DeleteAfter))];
    }

    public async Task<AccountDetail?> DetailAsync(Guid id, CancellationToken ct)
    {
        if (await db.Users.AsNoTracking().FirstOrDefaultAsync(account => account.Id == id, ct) is not { } account)
        {
            return null;
        }

        var profiles = await db.Profiles.AsNoTracking()
            .Where(profile => profile.AccountId == id)
            .OrderBy(profile => profile.CreatedAt)
            .ToListAsync(ct);
        var ids = profiles.Select(profile => profile.Id).ToList();
        var names = (await db.ProfileNameHistory.AsNoTracking()
                .Where(name => ids.Contains(name.ProfileId))
                .OrderByDescending(name => name.At).ThenByDescending(name => name.Id)
                .ToListAsync(ct))
            .ToLookup(name => name.ProfileId);
        var logins = await db.UserLogins.AsNoTracking()
            .Where(login => login.UserId == id)
            .Select(login => login.LoginProvider)
            .OrderBy(provider => provider)
            .ToListAsync(ct);
        var role = await roles.RoleOfAsync(id, ct);
        var community = account.CommunityId is { } communityId
            ? await db.Communities.AsNoTracking().Where(c => c.Id == communityId).Select(c => c.Name).FirstOrDefaultAsync(ct)
            : null;

        return new AccountDetail(
            account.Id,
            account.Email,
            account.Email is null ? account.UserName : null,
            account.DisplayName,
            account.CreatedAt,
            account.TermsVersion,
            account.TermsAcceptedAt,
            role is { } held ? PlatformRoles.NameOf(held) : null,
            account.PasswordHash is not null,
            account.TwoFactorEnabled,
            logins,
            account.SuspendedAt,
            account.SuspendedReason,
            community,
            [.. profiles.Select(profile => new ProfileDetail(
                profile.Id,
                profile.PublicId!,
                profile.Name,
                profile.Avatar,
                profile.Kind == ProfileKind.Adult ? "adult" : "child",
                profile.AgeBand,
                profile.CreatedAt,
                [.. names[profile.Id].Select(name => new NameChange(
                    name.Name, name.At, name.Kind == ProfileNameKind.Merged ? "merged" : "rename"))],
                profile.OnPublicBoards,
                profile.HiddenFromBoardsAt is not null))],
            account.DeleteAfter);
    }

    public async Task<IReadOnlyDictionary<Guid, ProfileCard>> CardsAsync(IReadOnlyCollection<Guid> profileIds, CancellationToken ct) =>
        await db.Profiles.AsNoTracking()
            .Where(profile => profileIds.Contains(profile.Id))
            .Join(
                db.Users,
                profile => profile.AccountId,
                account => (Guid?)account.Id,
                (profile, account) => new ProfileCard(
                    profile.Id, profile.Name, profile.Avatar, profile.PublicId!, account.Id, account.Email ?? account.UserName))
            .ToDictionaryAsync(card => card.Id, ct);

    /// <summary>Hides a profile from public boards, or shows it again (ADR 0029); its owner's switch stays as it is.</summary>
    public void SetHiddenFromBoards(Profile profile, bool hidden, DateTimeOffset now) =>
        profile.HiddenFromBoardsAt = hidden ? profile.HiddenFromBoardsAt ?? now : null;

    /// <summary>No way in until lifted; the new security stamp ends its sessions within the session check.</summary>
    public async Task SuspendAsync(Account account, string reason, DateTimeOffset now)
    {
        account.SuspendedAt = now;
        account.SuspendedReason = reason;
        await users.UpdateSecurityStampAsync(account);
    }

    public async Task LiftAsync(Account account)
    {
        account.SuspendedAt = null;
        account.SuspendedReason = null;
        await users.UpdateAsync(account);
    }

    /// <summary>A new security stamp: every session of the account ends within the session check.</summary>
    public Task SignOutEverywhereAsync(Account account) => users.UpdateSecurityStampAsync(account);

    public Task<Profile?> FindProfileAsync(Guid id, CancellationToken ct) =>
        db.Profiles.FirstOrDefaultAsync(profile => profile.Id == id, ct);

    /// <summary>
    /// Renames a profile under the same rules as its owner (<see cref="ProfileNames"/>); the database keeps the old name
    /// in its history. Returns the name before, or the rule it broke.
    /// </summary>
    public async Task<(string? Before, string? Error)> RenameAsync(Profile profile, string name, CancellationToken ct)
    {
        if (!ProfileNames.TryNormalize(name, out var clean, out var error))
        {
            return (null, error);
        }

        var before = profile.Name;
        profile.Name = clean;
        // A device profile's copy keeps the moderator's name whatever its device sends later (ADR 0043).
        if (profile.DeviceId is not null)
        {
            profile.NameModeratedAt = clock.GetUtcNow();
        }

        await db.SaveChangesAsync(ct);
        return (before, null);
    }

    /// <summary>The tables show a profile's new name at once: its seats, as others see them.</summary>
    public async Task ShowNameAsync(Profile profile, CancellationToken ct)
    {
        foreach (var table in names)
        {
            await table.RenamedAsync(profile.Id, profile.Name, ct);
        }
    }

    private static string Like(string text) =>
        text.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("%", "\\%", StringComparison.Ordinal)
            .Replace("_", "\\_", StringComparison.Ordinal);
}
