using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Identity;

/// <summary>How new accounts may come (ADR 0028).</summary>
public enum RegistrationMode
{
    /// <summary>Anyone signs up; an invite code is welcome, for its community.</summary>
    Open,

    /// <summary>Signing up needs an invite code.</summary>
    Invite,

    /// <summary>Nobody new; everyone else signs in.</summary>
    Closed,
}

/// <summary>
/// What the admin console switched on (ADR 0028) — the sign-in methods, and how new accounts come — as this module asks
/// it. The admin module keeps the answers; a method the deployment did not configure is never on.
/// </summary>
public interface ISignInSettings
{
    /// <summary><see cref="SignInMethods.Password"/>, or a provider's id: <c>google</c>, <c>github</c>, <c>oidc</c>.</summary>
    ValueTask<bool> IsOnAsync(string method, CancellationToken ct);

    ValueTask<RegistrationMode> RegistrationAsync(CancellationToken ct);

    /// <summary>
    /// A device solves a proof-of-work before signing up or asking for a password reset (ADR 0037). Off unless the
    /// console turns it on.
    /// </summary>
    ValueTask<bool> ProofOfWorkAsync(CancellationToken ct);
}

public static class SignInMethods
{
    /// <summary>Email and password — signing in with them, and signing up by email.</summary>
    public const string Password = "password";
}

/// <summary>A group of people who came by its invite codes (ADR 0028). A name, for now; boards per community follow.</summary>
public sealed class Community
{
    public Guid Id { get; set; }

    public required string Name { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>A code that lets someone sign up, into its community; it may expire, run out, or be revoked.</summary>
public sealed class InviteCode
{
    /// <summary>Upper-case letters, digits and dashes, 4 to 32 (<see cref="Invites.Normalize"/>).</summary>
    public required string Code { get; set; }

    public Guid CommunityId { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? ExpiresAt { get; set; }

    /// <summary>How many accounts may come with it; none, no limit.</summary>
    public int? MaxUses { get; set; }

    /// <summary>Accounts that came with it — counted in the transaction that made each.</summary>
    public int Uses { get; set; }

    public DateTimeOffset? RevokedAt { get; set; }
}

internal sealed class CommunityConfiguration : IEntityTypeConfiguration<Community>
{
    public void Configure(EntityTypeBuilder<Community> builder)
    {
        builder.ToTable("communities", "identity");
        builder.Property(community => community.Name).HasMaxLength(Invites.MaxCommunityName);
        builder.HasIndex(community => community.Name).IsUnique();
    }
}

internal sealed class InviteCodeConfiguration : IEntityTypeConfiguration<InviteCode>
{
    public void Configure(EntityTypeBuilder<InviteCode> builder)
    {
        builder.ToTable("invite_codes", "identity");
        builder.HasKey(code => code.Code);
        builder.Property(code => code.Code).HasMaxLength(Invites.MaxLength);
        builder.HasIndex(code => code.CommunityId);
        builder.HasOne<Community>()
            .WithMany()
            .HasForeignKey(code => code.CommunityId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

/// <summary>
/// Whether a new account may come (ADR 0028): the registration mode, and the invite code — checked when signing up
/// starts, then used when the account is made, in its transaction, so a code's limit holds when two people use it at
/// once and an account that fails to be made leaves the count alone.
/// </summary>
internal sealed partial class Invites(ToheDbContext db, ISignInSettings settings)
{
    public const int MaxLength = 32;
    public const int MaxCommunityName = 64;

    /// <summary>A code as typed — any case, spaces — made comparable; none when nothing usable was typed.</summary>
    public static string? Normalize(string? code)
    {
        var plain = string.Concat((code ?? "").Where(c => !char.IsWhiteSpace(c))).ToUpperInvariant();
        return Pattern().IsMatch(plain) ? plain : null;
    }

    /// <summary>Why no new account may come now with this code, if it may not.</summary>
    public async Task<string?> RefusalAsync(string? typed, DateTimeOffset now, CancellationToken ct)
    {
        var mode = await settings.RegistrationAsync(ct);
        if (mode == RegistrationMode.Closed)
        {
            return "registration_closed";
        }

        if (string.IsNullOrWhiteSpace(typed))
        {
            return mode == RegistrationMode.Invite ? "invite_required" : null;
        }

        var code = Normalize(typed);
        var usable = code is not null && await db.InviteCodes.AnyAsync(
            invite => invite.Code == code
                && invite.RevokedAt == null
                && (invite.ExpiresAt == null || invite.ExpiresAt > now)
                && (invite.MaxUses == null || invite.Uses < invite.MaxUses),
            ct);
        return usable ? null : "invite_invalid";
    }

    /// <summary>
    /// In the transaction that makes the account: the mode once more, the code counted, its community returned — or why
    /// not, when the mode or the code changed since signing up started.
    /// </summary>
    public async Task<(Guid? Community, string? Code, string? Refusal)> AdmitAsync(string? typed, DateTimeOffset now, CancellationToken ct)
    {
        if (await RefusalAsync(typed, now, ct) is { } refusal)
        {
            return (null, null, refusal);
        }

        if (Normalize(typed) is not { } code)
        {
            return (null, null, null);
        }

        var used = await db.Database.ExecuteSqlAsync(
            $"""
             UPDATE identity.invite_codes SET uses = uses + 1
             WHERE code = {code} AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > {now})
               AND (max_uses IS NULL OR uses < max_uses)
             """,
            ct);
        if (used != 1)
        {
            return (null, null, "invite_invalid");
        }

        var community = await db.InviteCodes.Where(invite => invite.Code == code).Select(invite => invite.CommunityId).FirstAsync(ct);
        return (community, code, null);
    }

    [GeneratedRegex("^[A-Z0-9-]{4,32}$")]
    private static partial Regex Pattern();
}
