using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Identity;

/// <summary>A community with how many accounts came with it, and its codes.</summary>
public sealed record CommunityView(Guid Id, string Name, DateTimeOffset CreatedAt, int Members, IReadOnlyList<InviteCodeView> Codes);

/// <param name="Usable">Not revoked, not expired, uses left: a sign-up may use it now.</param>
public sealed record InviteCodeView(
    string Code,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ExpiresAt,
    int? MaxUses,
    int Uses,
    DateTimeOffset? RevokedAt,
    bool Usable);

/// <summary>
/// What the admin console changes of communities and their invite codes (ADR 0028); the tables stay this module's.
/// The console checks who may, and audits.
/// </summary>
internal sealed class CommunitiesAdmin(ToheDbContext db)
{
    private const string Alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

    public async Task<IReadOnlyList<CommunityView>> ListAsync(DateTimeOffset now, CancellationToken ct)
    {
        var communities = await db.Communities.AsNoTracking().OrderBy(community => community.CreatedAt).ToListAsync(ct);
        var members = await db.Users.AsNoTracking()
            .Where(account => account.CommunityId != null)
            .GroupBy(account => account.CommunityId)
            .Select(group => new { Id = group.Key!.Value, Count = group.Count() })
            .ToDictionaryAsync(group => group.Id, group => group.Count, ct);
        var codes = (await db.InviteCodes.AsNoTracking().OrderByDescending(code => code.CreatedAt).ToListAsync(ct))
            .ToLookup(code => code.CommunityId);
        return [.. communities.Select(community => new CommunityView(
            community.Id,
            community.Name,
            community.CreatedAt,
            members.GetValueOrDefault(community.Id),
            [.. codes[community.Id].Select(code => View(code, now))]))];
    }

    /// <summary>A new community; none when the name is taken.</summary>
    public async Task<Community?> CreateAsync(string name, DateTimeOffset now, CancellationToken ct)
    {
        if (await db.Communities.AnyAsync(community => community.Name == name, ct))
        {
            return null;
        }

        var community = new Community { Id = Guid.CreateVersion7(now), Name = name, CreatedAt = now };
        db.Communities.Add(community);
        await db.SaveChangesAsync(ct);
        return community;
    }

    public Task<Community?> FindAsync(Guid id, CancellationToken ct) =>
        db.Communities.FirstOrDefaultAsync(community => community.Id == id, ct);

    /// <summary>A new code for the community: the one asked for, or eight characters made up; none when it is taken.</summary>
    public async Task<InviteCodeView?> CreateCodeAsync(
        Community community, string? code, DateTimeOffset? expiresAt, int? maxUses, DateTimeOffset now, CancellationToken ct)
    {
        var invite = new InviteCode
        {
            Code = code ?? $"{RandomNumberGenerator.GetString(Alphabet, 4)}-{RandomNumberGenerator.GetString(Alphabet, 4)}",
            CommunityId = community.Id,
            CreatedAt = now,
            ExpiresAt = expiresAt,
            MaxUses = maxUses,
        };
        db.InviteCodes.Add(invite);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            db.Entry(invite).State = EntityState.Detached;
            return null;
        }

        return View(invite, now);
    }

    /// <summary>Revokes a code: no sign-up uses it again; the accounts that came with it keep their community.</summary>
    public async Task<InviteCode?> RevokeAsync(string code, DateTimeOffset now, CancellationToken ct)
    {
        if (await db.InviteCodes.FirstOrDefaultAsync(invite => invite.Code == code, ct) is not { } invite)
        {
            return null;
        }

        invite.RevokedAt ??= now;
        await db.SaveChangesAsync(ct);
        return invite;
    }

    private static InviteCodeView View(InviteCode code, DateTimeOffset now) => new(
        code.Code,
        code.CreatedAt,
        code.ExpiresAt,
        code.MaxUses,
        code.Uses,
        code.RevokedAt,
        code.RevokedAt is null && (code.ExpiresAt is null || code.ExpiresAt > now) && (code.MaxUses is null || code.Uses < code.MaxUses));
}
