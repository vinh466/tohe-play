using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Identity;

/// <summary>The roles that run the platform (ADR 0027), weakest first. An account holds at most one.</summary>
public enum PlatformRole
{
    Viewer,
    Moderator,
    Admin,
    Owner,
}

/// <summary>An account that holds a platform role.</summary>
public sealed record RoleHolder(Guid AccountId, string? Email, string? Username, string DisplayName, PlatformRole Role);

/// <summary>
/// An account's platform role is one account claim, <c>tohe:role</c> (ADR 0027). It is read from the database on every
/// admin request, never from the session cookie, so taking a role away works at once.
/// </summary>
internal sealed class PlatformRoles(ToheDbContext db, UserManager<Account> users)
{
    public const string ClaimType = "tohe:role";

    public static string NameOf(PlatformRole role) => role switch
    {
        PlatformRole.Owner => "owner",
        PlatformRole.Admin => "admin",
        PlatformRole.Moderator => "moderator",
        _ => "viewer",
    };

    public static PlatformRole? Parse(string? name) => name switch
    {
        "owner" => PlatformRole.Owner,
        "admin" => PlatformRole.Admin,
        "moderator" => PlatformRole.Moderator,
        "viewer" => PlatformRole.Viewer,
        _ => null,
    };

    public async Task<PlatformRole?> RoleOfAsync(Guid accountId, CancellationToken ct) =>
        Parse(await db.UserClaims.AsNoTracking()
            .Where(claim => claim.UserId == accountId && claim.ClaimType == ClaimType)
            .Select(claim => claim.ClaimValue)
            .FirstOrDefaultAsync(ct));

    public Task<bool> AnyOwnerAsync(CancellationToken ct) =>
        db.UserClaims.AnyAsync(claim => claim.ClaimType == ClaimType && claim.ClaimValue == NameOf(PlatformRole.Owner), ct);

    /// <summary>Gives the account this role, in place of any it had.</summary>
    public async Task SetAsync(Account account, PlatformRole role)
    {
        await RemoveAsync(account);
        await users.AddClaimAsync(account, new Claim(ClaimType, NameOf(role)));
    }

    /// <summary>Takes the account's role away; false when it had none.</summary>
    public async Task<bool> RemoveAsync(Account account)
    {
        var held = (await users.GetClaimsAsync(account)).Where(claim => claim.Type == ClaimType).ToList();
        if (held.Count == 0)
        {
            return false;
        }

        await users.RemoveClaimsAsync(account, held);
        return true;
    }

    /// <summary>Every account with a role: the strongest roles first, then the oldest accounts.</summary>
    public async Task<IReadOnlyList<RoleHolder>> HoldersAsync(CancellationToken ct)
    {
        var rows = await (
                from claim in db.UserClaims.AsNoTracking()
                where claim.ClaimType == ClaimType
                join account in db.Users.AsNoTracking() on claim.UserId equals account.Id
                orderby account.CreatedAt
                select new { account.Id, account.Email, account.UserName, account.DisplayName, claim.ClaimValue })
            .ToListAsync(ct);
        var holders = new List<RoleHolder>();
        foreach (var row in rows)
        {
            if (Parse(row.ClaimValue) is { } role)
            {
                holders.Add(new RoleHolder(row.Id, row.Email, row.Email is null ? row.UserName : null, row.DisplayName, role));
            }
        }

        return [.. holders.OrderByDescending(holder => holder.Role)];
    }
}
