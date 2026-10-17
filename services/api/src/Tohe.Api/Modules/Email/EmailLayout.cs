using System.Text;
using System.Text.Encodings.Web;
using System.Text.Unicode;

namespace Tohe.Api.Modules.Email;

/// <summary>The one thing a message asks its reader to open, e.g. the page that takes its code.</summary>
public sealed record EmailLink(string Label, Uri Url);

/// <summary>
/// The one look every Tò He email has: a heading, a few short paragraphs, an optional one-time code set apart, an
/// optional link, and the same footer. Vietnamese, like the hub. No images, no tracking, no links that are not the
/// point of the message. The colours are fixed: mail clients do not read the design tokens' CSS variables (ADR 0013
/// covers screens).
/// </summary>
public static class EmailLayout
{
    private const string Footer = "Thư tự động từ Tò He — vui lòng không trả lời thư này.";

    /// <summary>Escapes what HTML treats specially and leaves Vietnamese letters as they are.</summary>
    private static readonly HtmlEncoder Html = HtmlEncoder.Create(UnicodeRanges.All);

    public static EmailBody Render(
        string heading,
        IReadOnlyList<string> paragraphs,
        string? code = null,
        string? footnote = null,
        EmailLink? link = null)
    {
        var text = new StringBuilder()
            .AppendLine(heading)
            .AppendLine();
        foreach (var paragraph in paragraphs)
        {
            text.AppendLine(paragraph).AppendLine();
        }

        if (code is not null)
        {
            text.AppendLine($"    {Spaced(code)}").AppendLine();
        }

        if (link is not null)
        {
            text.AppendLine($"{link.Label}: {link.Url.AbsoluteUri}").AppendLine();
        }

        if (footnote is not null)
        {
            text.AppendLine(footnote).AppendLine();
        }

        text.AppendLine("—").Append(Footer);

        var html = new StringBuilder()
            .Append("<!doctype html><html lang=\"vi\"><head><meta charset=\"utf-8\">")
            .Append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"></head>")
            .Append("<body style=\"margin:0;padding:24px;background:#fff7ed;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1c1917\">")
            .Append("<div style=\"max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:24px\">")
            .Append("<p style=\"margin:0 0 16px;font-size:14px;color:#c2410c;font-weight:600\">Tò He</p>")
            .Append("<h1 style=\"margin:0 0 16px;font-size:20px\">").Append(Encode(heading)).Append("</h1>");
        foreach (var paragraph in paragraphs)
        {
            html.Append("<p style=\"margin:0 0 16px;font-size:16px;line-height:1.5\">").Append(Encode(paragraph)).Append("</p>");
        }

        if (code is not null)
        {
            html.Append("<p style=\"margin:8px 0 24px;font-size:32px;font-weight:700;letter-spacing:6px;text-align:center\">")
                .Append(Encode(Spaced(code)))
                .Append("</p>");
        }

        if (link is not null)
        {
            html.Append("<p style=\"margin:0 0 24px;text-align:center\"><a href=\"").Append(Encode(link.Url.AbsoluteUri))
                .Append("\" style=\"display:inline-block;padding:12px 20px;border-radius:12px;background:#c2410c;")
                .Append("color:#ffffff;font-size:16px;font-weight:600;text-decoration:none\">")
                .Append(Encode(link.Label))
                .Append("</a></p>");
        }

        if (footnote is not null)
        {
            html.Append("<p style=\"margin:0 0 16px;font-size:14px;line-height:1.5;color:#57534e\">").Append(Encode(footnote)).Append("</p>");
        }

        html.Append("<p style=\"margin:24px 0 0;font-size:12px;color:#78716c\">").Append(Encode(Footer)).Append("</p>")
            .Append("</div></body></html>");

        return new EmailBody(text.ToString(), html.ToString());
    }

    /// <summary>"482913" reads as "482 913": easier to copy by eye from one screen to another.</summary>
    private static string Spaced(string code) =>
        code.Length == 6 && code.All(char.IsAsciiDigit) ? $"{code[..3]} {code[3..]}" : code;

    private static string Encode(string value) => Html.Encode(value);
}
