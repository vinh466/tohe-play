using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Email;

/// <summary>A message to send: who to, and what (see <see cref="EmailLayout"/> for the body).</summary>
/// <param name="Kind">What kind of message this is, e.g. <c>signup-code</c>; kept with the envelope for diagnostics.</param>
public sealed record EmailMessage(string Kind, string To, string Subject, EmailBody Body);

/// <summary>Plain text for every client, HTML for those that show it.</summary>
public sealed record EmailBody(string Text, string Html);

/// <summary>Where other modules hand over mail. Nothing is sent until the caller saves its changes.</summary>
public interface IEmailOutbox
{
    /// <summary>False with <c>Email:Mode=Disabled</c>: features that need email must not be offered.</summary>
    bool Enabled { get; }

    /// <summary>
    /// Adds the message to the caller's unit of work; it is sent after the caller's <c>SaveChangesAsync</c> commits,
    /// within <see cref="EmailOptions.PollInterval"/>. Throws when email is disabled — check <see cref="Enabled"/>.
    /// </summary>
    void Add(EmailMessage message);
}

internal sealed class EmailOutbox(ToheDbContext db, IOptions<EmailOptions> options, TimeProvider clock) : IEmailOutbox
{
    public bool Enabled => options.Value.Mode != EmailMode.Disabled;

    public void Add(EmailMessage message)
    {
        if (!Enabled)
        {
            throw new InvalidOperationException("Email is disabled (Email:Mode=Disabled); check IEmailOutbox.Enabled first.");
        }

        var now = clock.GetUtcNow();
        db.EmailOutbox.Add(new OutboxEmail
        {
            Id = Guid.CreateVersion7(now),
            Kind = message.Kind,
            To = message.To,
            Subject = message.Subject,
            Text = message.Body.Text,
            Html = message.Body.Html,
            CreatedAt = now,
            NextAttemptAt = now,
        });
    }
}
