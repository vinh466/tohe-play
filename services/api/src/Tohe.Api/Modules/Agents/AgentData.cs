using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Tohe.Api.Modules.Agents;

/// <summary>
/// An AI agent the owner lets call the API (ADR 0052): a name and a note, made in the console. It holds tokens; disabled,
/// every one of them is revoked. Never deleted, so its audit keeps naming it.
/// </summary>
public sealed class Agent
{
    public const int MaxName = 60;

    public const int MaxNote = 200;

    public Guid Id { get; set; }

    /// <summary>Unique, e.g. "studio-agent on the workstation".</summary>
    public required string Name { get; set; }

    public string? Note { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>The account that made it, in the console.</summary>
    public Guid CreatedBy { get; set; }

    /// <summary>When it was disabled; a disabled agent stays disabled and gets no new token.</summary>
    public DateTimeOffset? DisabledAt { get; set; }
}

/// <summary>
/// A token of an agent (ADR 0052): only the SHA-256 of what was shown once is kept, with its scopes, its expiry and
/// whether it was revoked. Read again on every request, so a revocation holds at the next one.
/// </summary>
public sealed class AgentToken
{
    public Guid Id { get; set; }

    public Guid AgentId { get; set; }

    /// <summary>SHA-256 of the token's UTF-8 bytes, prefix included.</summary>
    public required byte[] TokenHash { get; set; }

    /// <summary>Names from <see cref="AgentScopes"/>.</summary>
    public required string[] Scopes { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>The account that made it, in the console.</summary>
    public Guid CreatedBy { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }

    /// <summary>When the owner revoked it — or disabled its agent; a revoked token stays revoked.</summary>
    public DateTimeOffset? RevokedAt { get; set; }

    /// <summary>The last request it made, kept to the minute: written at most once a minute.</summary>
    public DateTimeOffset? LastUsedAt { get; set; }
}

/// <summary>
/// One use of an agent token (ADR 0052): which agent, which token, the scope the endpoint names, what it called and the
/// status it got — refusals too, when the token is known.
/// </summary>
public sealed class AgentAuditEntry
{
    public long Id { get; set; }

    public Guid AgentId { get; set; }

    public Guid TokenId { get; set; }

    /// <summary>The scope the endpoint names, held by the token or not.</summary>
    public required string Scope { get; set; }

    /// <summary>The method and the endpoint's route pattern, e.g. <c>POST /api/studio/drafts/{id}</c>.</summary>
    public required string Action { get; set; }

    /// <summary>The status code of the answer.</summary>
    public int Result { get; set; }

    public DateTimeOffset At { get; set; }
}

internal sealed class AgentConfiguration : IEntityTypeConfiguration<Agent>
{
    public void Configure(EntityTypeBuilder<Agent> builder)
    {
        builder.ToTable("agents", "agents");
        builder.Property(agent => agent.Name).HasMaxLength(Agent.MaxName);
        builder.Property(agent => agent.Note).HasMaxLength(Agent.MaxNote);
        builder.HasIndex(agent => agent.Name).IsUnique();
    }
}

internal sealed class AgentTokenConfiguration : IEntityTypeConfiguration<AgentToken>
{
    public void Configure(EntityTypeBuilder<AgentToken> builder)
    {
        builder.ToTable("tokens", "agents");
        builder.HasOne<Agent>().WithMany().HasForeignKey(token => token.AgentId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(token => token.TokenHash).IsUnique();
        builder.HasIndex(token => token.AgentId);
    }
}

internal sealed class AgentAuditEntryConfiguration : IEntityTypeConfiguration<AgentAuditEntry>
{
    public void Configure(EntityTypeBuilder<AgentAuditEntry> builder)
    {
        builder.ToTable("audit", "agents");
        builder.HasOne<Agent>().WithMany().HasForeignKey(entry => entry.AgentId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<AgentToken>().WithMany().HasForeignKey(entry => entry.TokenId).OnDelete(DeleteBehavior.Restrict);
        builder.Property(entry => entry.Scope).HasMaxLength(64);
        builder.Property(entry => entry.Action).HasMaxLength(320);
        builder.HasIndex(entry => new { entry.AgentId, entry.Id });
        builder.HasIndex(entry => entry.TokenId);
    }
}
