using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Studio;

/// <summary>
/// The roles of the Asset Studio (ADR 0051), weakest first. A studio role is not a platform role: it opens nothing in
/// the console, and a platform role opens nothing in the Studio. An account holds at most one.
/// </summary>
public enum StudioRole
{
    /// <summary>Makes and changes drafts.</summary>
    Contributor,

    /// <summary>Approves, rejects and deprecates pack versions; signs in with two-factor authentication always.</summary>
    Reviewer,
}

/// <summary>
/// An account with a studio role (ADR 0051), given in the console. ADR 0051 calls it an account claim of its own; it is
/// kept in the Studio's schema because each module keeps its own tables (ADR 0003). The row goes with the account when
/// the account is deleted for good.
/// </summary>
public sealed class StudioMember
{
    public Guid AccountId { get; set; }

    public StudioRole Role { get; set; }

    /// <summary>The account that gave it, in the console.</summary>
    public Guid GrantedBy { get; set; }

    public DateTimeOffset GrantedAt { get; set; }
}

internal sealed class StudioMemberConfiguration : IEntityTypeConfiguration<StudioMember>
{
    public void Configure(EntityTypeBuilder<StudioMember> builder)
    {
        builder.ToTable("members", "studio", table =>
            table.HasCheckConstraint("ck_members_role", "role IN ('contributor', 'reviewer')"));
        builder.HasKey(member => member.AccountId);
        builder.Property(member => member.Role)
            .HasConversion(role => StudioRoles.NameOf(role), name => StudioRoles.Parse(name) ?? StudioRole.Contributor)
            .HasMaxLength(16);
        // Deleting an account for good (ADR 0034, 0038) takes its studio role with it.
        builder.HasOne<Account>()
            .WithOne()
            .HasForeignKey<StudioMember>(member => member.AccountId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

/// <summary>
/// Who holds a studio role (ADR 0051). Read from the database on every Studio request, never from the session cookie,
/// so taking a role away works at the next request.
/// </summary>
internal sealed class StudioRoles(ToheDbContext db)
{
    public static string NameOf(StudioRole role) => role switch
    {
        StudioRole.Reviewer => "reviewer",
        _ => "contributor",
    };

    public static StudioRole? Parse(string? name) => name switch
    {
        "contributor" => StudioRole.Contributor,
        "reviewer" => StudioRole.Reviewer,
        _ => null,
    };

    /// <summary>
    /// What a studio session asks of the account besides the role: a reviewer has two-factor authentication on, always.
    /// </summary>
    public static bool MayHoldSession(StudioRole role, Account account) =>
        role != StudioRole.Reviewer || account.TwoFactorEnabled;

    public async Task<StudioRole?> RoleOfAsync(Guid accountId, CancellationToken ct) =>
        await db.StudioMembers.AsNoTracking()
            .Where(member => member.AccountId == accountId)
            .Select(member => (StudioRole?)member.Role)
            .FirstOrDefaultAsync(ct);
}
