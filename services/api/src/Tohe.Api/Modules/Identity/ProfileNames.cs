using System.Collections.Frozen;
using System.Globalization;
using System.Text;

namespace Tohe.Api.Modules.Identity;

/// <summary>
/// Profile names are chosen freely, for fun (ADR 0023): any script, Vietnamese with its marks, digits, spaces, emoji.
/// They are not unique — the public ID tells profiles apart — but they are shown to strangers, so a few rails hold:
/// no invisible or direction-changing characters, no pile of combining marks on one letter, none of the names that
/// would pass for the platform itself, and no offensive word (<see cref="NameFilter"/>, ADR 0035).
/// </summary>
/// <remarks>
/// The API runs without ICU (InvariantGlobalization), where <see cref="string.Normalize()"/> leaves anything beyond
/// ASCII as it is. So the hub sends names composed (NFC), the rules here hold for composed and decomposed text alike,
/// and reserved names are matched through a table of Latin letters with marks instead of a decomposition.
/// </remarks>
public static class ProfileNames
{
    /// <summary>Visible characters (grapheme clusters), not UTF-16 units: an emoji family counts as one.</summary>
    public const int MaxLength = 24;

    /// <summary>
    /// Emoji joined by zero-width joiners make one visible character of any length, so what is stored has its own
    /// bound (UTF-16 units, under the column's 200): two dozen Vietnamese letters or a handful of emoji families.
    /// </summary>
    public const int MaxStoredLength = 128;

    /// <summary>More combining marks than this on one character is "zalgo", not Vietnamese (which needs two).</summary>
    private const int MaxMarksPerCharacter = 3;

    /// <summary>Letters that draw nothing (Hangul and braille fillers): a name made of them looks empty.</summary>
    private static readonly int[] Blank = [0x115F, 0x1160, 0x17B4, 0x17B5, 0x2800, 0x3164, 0xFFA0];

    /// <summary>Compared without case or diacritics: "Tò He", "TO HE" and "to-he" are all taken.</summary>
    private static readonly string[] Reserved =
    [
        "admin", "administrator", "quan tri", "quan tri vien", "moderator", "mod", "kiem duyet", "support", "ho tro",
        "system", "he thong", "tohe", "to he", "official", "chinh thuc", "nguoi choi da xoa",
    ];

    /// <summary>
    /// Lower-case Latin letters with marks and their base letter, from Unicode 16's decompositions of Latin-1
    /// Supplement, Latin Extended-A/B and Latin Extended Additional — every Vietnamese letter among them — plus đ,
    /// which has no decomposition.
    /// </summary>
    private static readonly FrozenDictionary<char, char> Unmarked = new (char Base, string Marked)[]
    {
        ('a', "àáâãäåāăąǎǟǡǻȁȃȧḁạảấầẩẫậắằẳẵặ"),
        ('b', "ḃḅḇ"),
        ('c', "çćĉċčḉ"),
        ('d', "ďḋḍḏḑḓđ"),
        ('e', "èéêëēĕėęěȅȇȩḕḗḙḛḝẹẻẽếềểễệ"),
        ('f', "ḟ"),
        ('g', "ĝğġģǧǵḡ"),
        ('h', "ĥȟḣḥḧḩḫẖ"),
        ('i', "ìíîïĩīĭįǐȉȋḭḯỉị"),
        ('j', "ĵǰ"),
        ('k', "ķǩḱḳḵ"),
        ('l', "ĺļľḷḹḻḽ"),
        ('m', "ḿṁṃ"),
        ('n', "ñńņňǹṅṇṉṋ"),
        ('o', "òóôõöōŏőơǒǫǭȍȏȫȭȯȱṍṏṑṓọỏốồổỗộớờởỡợ"),
        ('p', "ṕṗ"),
        ('r', "ŕŗřȑȓṙṛṝṟ"),
        ('s', "śŝşšșṡṣṥṧṩ"),
        ('t', "ţťțṫṭṯṱẗ"),
        ('u', "ùúûüũūŭůűųưǔǖǘǚǜȕȗṳṵṷṹṻụủứừửữự"),
        ('v', "ṽṿ"),
        ('w', "ŵẁẃẅẇẉẘ"),
        ('x', "ẋẍ"),
        ('y', "ýÿŷȳẏẙỳỵỷỹ"),
        ('z', "źżžẑẓẕ"),
    }.SelectMany(group => group.Marked.Select(marked => (marked, group.Base))).ToFrozenDictionary(p => p.marked, p => p.Base);

    /// <summary>The name as it will be stored, or a validation code for the hub to explain.</summary>
    public static bool TryNormalize(string? input, out string name, out string error)
    {
        name = "";
        error = "name_required";
        if (string.IsNullOrWhiteSpace(input))
        {
            return false;
        }

        if (input.Length > MaxStoredLength * 4)
        {
            error = "name_too_long";
            return false;
        }

        var builder = new StringBuilder(input.Length);
        var space = false;
        foreach (var rune in input.EnumerateRunes())
        {
            var category = Rune.GetUnicodeCategory(rune);
            if (Rune.IsWhiteSpace(rune))
            {
                space = builder.Length > 0;
                continue;
            }

            // Control characters, bidirectional overrides, zero-width tricks. The joiners emoji sequences need stay.
            var allowedFormat = rune.Value is 0x200D or 0xFE0F or 0xFE0E || rune.Value is >= 0xE0020 and <= 0xE007F;
            if (category is UnicodeCategory.Control or UnicodeCategory.Surrogate or UnicodeCategory.PrivateUse
                    or UnicodeCategory.OtherNotAssigned
                || (category == UnicodeCategory.Format && !allowedFormat)
                || Blank.Contains(rune.Value))
            {
                error = "name_invalid_character";
                return false;
            }

            if (space)
            {
                builder.Append(' ');
                space = false;
            }

            builder.Append(rune.ToString());
        }

        var normalized = builder.ToString();
        var info = StringInfo.GetTextElementEnumerator(normalized);
        var length = 0;
        while (info.MoveNext())
        {
            length++;
            var element = (string)info.Current;
            var marks = element.EnumerateRunes().Count(r => Rune.GetUnicodeCategory(r) is UnicodeCategory.NonSpacingMark
                or UnicodeCategory.EnclosingMark);
            if (marks > MaxMarksPerCharacter)
            {
                error = "name_invalid_character";
                return false;
            }
        }

        if (length > MaxLength || normalized.Length > MaxStoredLength)
        {
            error = "name_too_long";
            return false;
        }

        if (IsReserved(normalized))
        {
            error = "name_reserved";
            return false;
        }

        if (NameFilter.IsOffensive(normalized))
        {
            error = "name_inappropriate";
            return false;
        }

        name = normalized;
        error = "";
        return true;
    }

    private static bool IsReserved(string name)
    {
        var folded = Fold(name);
        return Reserved.Any(reserved => folded == reserved);
    }

    /// <summary>
    /// Lower case, marks removed whether composed or not, full-width letters made plain, separators collapsed to one
    /// space. Joiners vanish rather than separate, so "ad‍min" (a zero-width joiner inside) is still "admin".
    /// </summary>
    private static string Fold(string value)
    {
        var builder = new StringBuilder(value.Length);
        foreach (var c in value.ToLowerInvariant())
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) is UnicodeCategory.NonSpacingMark or UnicodeCategory.Format)
            {
                continue;
            }

            var plain = c switch
            {
                >= 'ａ' and <= 'ｚ' => (char)(c - 'ａ' + 'a'),
                >= '０' and <= '９' => (char)(c - '０' + '0'),
                _ => Unmarked.GetValueOrDefault(c, c),
            };
            if (char.IsLetterOrDigit(plain))
            {
                builder.Append(plain);
            }
            else if (builder.Length > 0 && builder[^1] != ' ')
            {
                builder.Append(' ');
            }
        }

        return builder.ToString().Trim();
    }
}
