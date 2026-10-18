using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Email;

/// <summary>The outbox: whether email goes out, what waits, and what the last day sent or gave up on.</summary>
/// <param name="Enabled">The server sends email (<c>Email:Mode</c> is not <c>Disabled</c>).</param>
/// <param name="OldestWaitingSince">When the message waiting longest was added; none when nothing waits.</param>
public sealed record OutboxState(bool Enabled, int Waiting, int SentLastDay, int FailedLastDay, DateTimeOffset? OldestWaitingSince);

/// <summary>What the admin console shows of the outbox (ADR 0027); the table stays this module's.</summary>
internal sealed class EmailFacts(ToheDbContext db, IOptions<EmailOptions> options)
{
    public async Task<OutboxState> StateAsync(DateTimeOffset now, CancellationToken ct)
    {
        var waiting = db.EmailOutbox.Where(email => email.SentAt == null && email.FailedAt == null);
        return new OutboxState(
            options.Value.Mode != EmailMode.Disabled,
            await waiting.CountAsync(ct),
            await db.EmailOutbox.CountAsync(email => email.SentAt > now.AddDays(-1), ct),
            await db.EmailOutbox.CountAsync(email => email.FailedAt > now.AddDays(-1), ct),
            await waiting.MinAsync(email => (DateTimeOffset?)email.CreatedAt, ct));
    }
}
