using MailKit.Net.Smtp;
using Microsoft.Extensions.Options;
using MimeKit;

namespace Tohe.Api.Modules.Email;

/// <summary>Hands one message to the relay. Tests replace it; everything else talks to the outbox.</summary>
public interface ISmtpTransport
{
    Task SendAsync(MimeMessage message, CancellationToken cancellationToken);
}

/// <summary>
/// MailKit, one connection per message: the volume is a handful of codes an hour, and a fresh connection never trips
/// over a relay that dropped an idle one. (System.Net.Mail.SmtpClient is not recommended for new code by Microsoft.)
/// </summary>
internal sealed class MailKitSmtpTransport(IOptions<EmailOptions> options) : ISmtpTransport
{
    public async Task SendAsync(MimeMessage message, CancellationToken cancellationToken)
    {
        var smtp = options.Value.Smtp;
        using var client = new SmtpClient { Timeout = (int)TimeSpan.FromSeconds(30).TotalMilliseconds };
        await client.ConnectAsync(smtp.Host, smtp.Port, smtp.SocketOptions, cancellationToken);
        if (smtp.Username.Length > 0)
        {
            await client.AuthenticateAsync(smtp.Username, smtp.Password, cancellationToken);
        }

        await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(quit: true, cancellationToken);
    }
}
