using System.Globalization;
using System.Text.RegularExpressions;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Links;

/// <summary>
/// The message a game asks to send with its share link (ADR 0045): it goes out under the player's name, next to a real
/// Tò He link, so it is checked — one line, at most 120 characters, no address, domain or email, no run of seven digits
/// or more, and through the name filter (ADR 0035). What fails is not sent: the hub uses its own words. Never stored,
/// never shown in a preview.
/// </summary>
public static partial class ShareTexts
{
    /// <summary>The longest message, in characters as people count them.</summary>
    public const int MaxLength = 120;

    /// <summary>The longest text a request may carry, checked or not.</summary>
    public const int MaxRequestLength = 500;

    /// <summary>The text as it may be sent — trimmed — or null when it may not.</summary>
    public static string? Accept(string? text)
    {
        var trimmed = text?.Trim();
        if (string.IsNullOrEmpty(trimmed)
            || trimmed.Length > MaxRequestLength
            || new StringInfo(trimmed).LengthInTextElements > MaxLength
            || trimmed.Any(c => char.IsControl(c) || c is '\u2028' or '\u2029'
                || char.GetUnicodeCategory(c) == UnicodeCategory.Format)
            || Address().IsMatch(trimmed)
            || Digits().IsMatch(trimmed)
            || NameFilter.IsOffensive(trimmed))
        {
            return null;
        }

        return trimmed;
    }

    /// <summary>
    /// A link, an email or a domain: a scheme, <c>www.</c>, an <c>@</c> between words, or a name dot a top-level name —
    /// in any script (look-alike letters, <c>tròchơi.vn</c>) and with the full-width and ideographic dots too.
    /// </summary>
    [GeneratedRegex(@"(?i)(://|\bwww[.．。｡]|\S@\S|[\p{L}\p{N}-]+[.．。｡]\p{L}{2,})")]
    private static partial Regex Address();

    /// <summary>
    /// Seven digits or more, counted across single spaces, dots and dashes: a phone number however it is written
    /// (<c>0901 234 567</c>). Stricter than seven in a row — a refusal only means the hub's own words go instead.
    /// </summary>
    [GeneratedRegex(@"(\d[\s.\-]?){6,}\d")]
    private static partial Regex Digits();
}
