using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Tohe.Api.Modules.Email;

/// <summary>
/// One message waiting for, or done with, the relay. Written in the same transaction as the change it reports, so a
/// code is never sent for an attempt that was rolled back, nor lost for one that was saved. Once sent or given up the
/// body is erased — it may hold a one-time code — and only the envelope stays, for <see cref="EmailOptions.Retention"/>.
/// </summary>
public sealed class OutboxEmail
{
    public Guid Id { get; set; }

    /// <summary>What kind of message this is, e.g. <c>signup-code</c>; for diagnostics, never shown to anyone.</summary>
    public required string Kind { get; set; }

    public required string To { get; set; }

    public string? Subject { get; set; }

    public string? Text { get; set; }

    public string? Html { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public int Attempts { get; set; }

    public DateTimeOffset NextAttemptAt { get; set; }

    public string? LastError { get; set; }

    public DateTimeOffset? SentAt { get; set; }

    public DateTimeOffset? FailedAt { get; set; }
}

internal sealed class OutboxEmailConfiguration : IEntityTypeConfiguration<OutboxEmail>
{
    public void Configure(EntityTypeBuilder<OutboxEmail> builder)
    {
        builder.ToTable("outbox", "email");
        builder.Property(email => email.Kind).HasMaxLength(64);
        builder.Property(email => email.To).HasMaxLength(320);
        builder.Property(email => email.Subject).HasMaxLength(200);
        builder.Property(email => email.LastError).HasMaxLength(500);
        // What delivery looks for: messages still waiting, by when they are due.
        builder.HasIndex(email => email.NextAttemptAt)
            .HasFilter("sent_at IS NULL AND failed_at IS NULL")
            .HasDatabaseName("ix_outbox_due");
        builder.HasIndex(email => email.CreatedAt);
    }
}
