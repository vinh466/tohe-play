using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MimeKit;
using Tohe.Api.Infrastructure;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Email;

/// <summary>
/// Sends what is due in the outbox, retries what failed, gives up after <see cref="EmailOptions.MaxAttempts"/>, and
/// erases every body once it is done with it. At least once: a message the relay took just before the API stopped
/// is sent again on the next run — a second copy of a code is harmless.
/// </summary>
internal sealed partial class EmailDelivery(
    ToheDbContext db,
    ISmtpTransport transport,
    IOptions<EmailOptions> options,
    ToheMetrics metrics,
    TimeProvider clock,
    ILogger<EmailDelivery> logger)
{
    private const int Batch = 20;

    /// <summary>Waits after the 1st, 2nd… failure; the last one repeats.</summary>
    private static readonly TimeSpan[] Backoff =
    [
        TimeSpan.FromMinutes(1),
        TimeSpan.FromMinutes(5),
        TimeSpan.FromMinutes(15),
        TimeSpan.FromHours(1),
        TimeSpan.FromHours(6),
    ];

    /// <summary>One pass over the outbox; returns how many messages were sent.</summary>
    public async Task<int> RunAsync(CancellationToken cancellationToken)
    {
        var settings = options.Value;
        var now = clock.GetUtcNow();
        var due = await db.EmailOutbox
            .Where(email => email.SentAt == null && email.FailedAt == null && email.NextAttemptAt <= now)
            .OrderBy(email => email.NextAttemptAt)
            .Take(Batch)
            .ToListAsync(cancellationToken);

        var sent = 0;
        if (due.Count > 0)
        {
            var from = MailboxAddress.Parse(settings.From);
            foreach (var email in due)
            {
                email.Attempts++;
                try
                {
                    await transport.SendAsync(Compose(email, from), cancellationToken);
                    email.SentAt = clock.GetUtcNow();
                    email.LastError = null;
                    Erase(email);
                    sent++;
                    metrics.EmailSent();
                }
                catch (Exception error) when (error is not OperationCanceledException)
                {
                    email.LastError = error.Message.Length > 500 ? error.Message[..500] : error.Message;
                    if (email.Attempts >= settings.MaxAttempts)
                    {
                        email.FailedAt = now;
                        Erase(email);
                        LogGaveUp(email.Id, email.Kind, email.Attempts);
                        metrics.EmailFailed();
                    }
                    else
                    {
                        email.NextAttemptAt = now + Backoff[Math.Min(email.Attempts, Backoff.Length) - 1];
                        LogRetrying(email.Id, email.Kind, email.Attempts, email.NextAttemptAt);
                    }
                }

                // One message at a time: a later failure must not undo the record that an earlier one went out.
                await db.SaveChangesAsync(cancellationToken);
            }
        }

        var cutoff = now - settings.Retention;
        await db.EmailOutbox
            .Where(email => (email.SentAt != null && email.SentAt < cutoff) || (email.FailedAt != null && email.FailedAt < cutoff))
            .ExecuteDeleteAsync(cancellationToken);
        return sent;
    }

    private static MimeMessage Compose(OutboxEmail email, MailboxAddress from)
    {
        var message = new MimeMessage();
        message.From.Add(from);
        message.To.Add(MailboxAddress.Parse(email.To));
        message.Subject = email.Subject ?? "";
        message.Body = new BodyBuilder { TextBody = email.Text, HtmlBody = email.Html }.ToMessageBody();
        return message;
    }

    /// <summary>The body may hold a one-time code: it never outlives its delivery.</summary>
    private static void Erase(OutboxEmail email)
    {
        email.Subject = null;
        email.Text = null;
        email.Html = null;
    }

    // Never the recipient or the body: logs travel further than the database.
    [LoggerMessage(Level = LogLevel.Warning, Message = "Email {Id} ({Kind}) failed, attempt {Attempts}; next try at {Next}")]
    private partial void LogRetrying(Guid id, string kind, int attempts, DateTimeOffset next);

    [LoggerMessage(Level = LogLevel.Error, Message = "Email {Id} ({Kind}) given up after {Attempts} attempts")]
    private partial void LogGaveUp(Guid id, string kind, int attempts);
}

/// <summary>Runs <see cref="EmailDelivery"/> every <see cref="EmailOptions.PollInterval"/>.</summary>
internal sealed partial class EmailDeliveryWorker(
    IServiceScopeFactory scopes,
    IOptions<EmailOptions> options,
    BackgroundWork work,
    ILogger<EmailDeliveryWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(options.Value.PollInterval);
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<EmailDelivery>().RunAsync(stoppingToken);
                work.Succeeded(BackgroundWork.EmailDelivery);
            }
            catch (Exception error) when (error is not OperationCanceledException)
            {
                work.Failed(BackgroundWork.EmailDelivery, error);
                LogFailed(error);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Email delivery failed; next try at the next interval")]
    private partial void LogFailed(Exception error);
}
