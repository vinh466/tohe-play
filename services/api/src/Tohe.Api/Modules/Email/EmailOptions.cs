using MailKit.Security;

namespace Tohe.Api.Modules.Email;

public enum EmailMode
{
    /// <summary>Nothing is sent, and features that need email are unavailable (they check <see cref="IEmailOutbox.Enabled"/>).</summary>
    Disabled,

    /// <summary>Mail goes out through an SMTP relay: Resend on UAT and production, Mailpit locally (ADR 0022).</summary>
    Smtp,
}

/// <summary>Transactional email (ADR 0022): codes and security notices, never marketing.</summary>
public sealed class EmailOptions
{
    public const string Section = "Email";

    public EmailMode Mode { get; set; } = EmailMode.Disabled;

    /// <summary>The sender, e.g. <c>Tò He &lt;no-reply@example.org&gt;</c> — an address the relay may send as.</summary>
    public string From { get; set; } = "";

    public SmtpOptions Smtp { get; set; } = new();

    /// <summary>How often the outbox is looked at. A code reaches the relay within this long of being asked for.</summary>
    public TimeSpan PollInterval { get; set; } = TimeSpan.FromSeconds(3);

    /// <summary>Attempts before a message is given up (backing off from a minute to six hours between them).</summary>
    public int MaxAttempts { get; set; } = 6;

    /// <summary>How long sent and given-up messages keep their envelope (recipient, kind, times) — never the body.</summary>
    public TimeSpan Retention { get; set; } = TimeSpan.FromDays(30);

    /// <summary>Run delivery in the background. Tests turn it off and call <see cref="EmailDelivery"/> themselves.</summary>
    public bool DeliveryEnabled { get; set; } = true;

    internal IEnumerable<string> Problems()
    {
        if (Mode != EmailMode.Smtp)
        {
            yield break;
        }

        if (!MimeKit.MailboxAddress.TryParse(From, out _))
        {
            yield return "Email:From must be a mailbox the relay may send as, e.g. \"Tò He <no-reply@example.org>\"";
        }

        if (string.IsNullOrWhiteSpace(Smtp.Host))
        {
            yield return "Email:Smtp:Host is required with Email:Mode=Smtp";
        }

        if (Smtp.Port is < 1 or > 65535)
        {
            yield return "Email:Smtp:Port must be a TCP port";
        }

        if (MaxAttempts < 1)
        {
            yield return "Email:MaxAttempts must be at least 1";
        }
    }
}

public sealed class SmtpOptions
{
    public string Host { get; set; } = "";

    /// <summary>587 with STARTTLS is what Resend, like most relays, expects.</summary>
    public int Port { get; set; } = 587;

    /// <summary>
    /// <c>StartTls</c> (587), <c>SslOnConnect</c> (465), or <c>None</c> — only for a relay on the same machine or network,
    /// such as Mailpit.
    /// </summary>
    public SmtpSecurity Security { get; set; } = SmtpSecurity.StartTls;

    public string Username { get; set; } = "";

    public string Password { get; set; } = "";

    internal SecureSocketOptions SocketOptions => Security switch
    {
        SmtpSecurity.SslOnConnect => SecureSocketOptions.SslOnConnect,
        SmtpSecurity.None => SecureSocketOptions.None,
        _ => SecureSocketOptions.StartTls,
    };
}

public enum SmtpSecurity
{
    StartTls,
    SslOnConnect,
    None,
}
