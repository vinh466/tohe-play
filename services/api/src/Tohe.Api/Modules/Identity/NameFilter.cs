using System.Collections.Frozen;
using System.Text;

namespace Tohe.Api.Modules.Identity;

/// <summary>
/// Offensive words in a profile name (E-07, ADR 0035). Names are free and shown to strangers (ADR 0023); this catches
/// the common words, written the ways people write them to slip through — not every spelling: a moderator renames what
/// slips through (ADR 0027). Whole words only, so a word inside another ("Essex") is not one. The owner reviews both
/// lists.
/// </summary>
public static class NameFilter
{
    /// <summary>
    /// Vietnamese words matched with their marks, whatever the case and however the marks were typed: without them most
    /// are everyday words — "lớn", "các", "đi", "buổi", "Diễm".
    /// </summary>
    private static readonly string[] Marked =
    [
        "đụ", "địt", "đéo", "lồn", "cặc", "buồi", "dái", "đĩ", "điếm", "phò", "chó đẻ", "khốn nạn",
    ];

    /// <summary>
    /// Words matched without marks or case, digits and symbols read as the letters they stand for: English, and
    /// Vietnamese teen code that means nothing else.
    /// </summary>
    private static readonly string[] Plain =
    [
        "fuck", "fucks", "fucked", "fucker", "fucking", "motherfucker", "fuk", "fck", "shit", "bullshit", "bitch",
        "bitches", "cunt", "dick", "cock", "pussy", "asshole", "bastard", "slut", "whore", "porn", "nigger", "nigga",
        "faggot", "retard", "rape", "rapist", "nazi", "hitler",
        "dcm", "dkm", "dmm", "vcl", "vkl", "clgt", "cmn", "dit", "djt", "duma", "loz",
    ];

    /// <summary>The marks Vietnamese letters carry, as combining characters: tones, then the letter's own marks.</summary>
    private const string Marks = "̛̣̀́̉̃̂̆";

    /// <summary>
    /// Each Vietnamese vowel with marks as its base letter and its marks: the six tones (none, grave, acute, hook, tilde,
    /// dot below) of a ă â e ê i o ô ơ u ư y. Built here because the API has no ICU to decompose
    /// (InvariantGlobalization), and names may arrive composed or not. đ is a letter of its own — "dụ" is not "đụ" —
    /// read as d only without marks.
    /// </summary>
    private static readonly FrozenDictionary<char, (char Base, string Marks)> Letters = BuildLetters();

    private static readonly FrozenDictionary<char, char> Leet = new Dictionary<char, char>
    {
        ['0'] = 'o', ['1'] = 'i', ['3'] = 'e', ['4'] = 'a', ['5'] = 's', ['7'] = 't', ['@'] = 'a', ['$'] = 's', ['!'] = 'i',
    }.ToFrozenDictionary();

    private static readonly List<Run[]> MarkedRuns = [.. Marked.Select(word => Runs(MarkedUnits(word)))];

    private static readonly List<Run[]> PlainRuns = [.. Plain.Select(word => Runs(PlainUnits(word)))];

    /// <summary>True when a word of the name — or two side by side, or letters typed apart — is on a list.</summary>
    public static bool IsOffensive(string name)
    {
        var words = name.ToLowerInvariant()
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Select(Keep)
            .Where(word => word.Length > 0)
            .ToList();
        return Candidates(words).Any(candidate =>
        {
            var marked = Runs(MarkedUnits(candidate));
            var plain = Runs(PlainUnits(candidate));
            return MarkedRuns.Any(word => Matches(marked, word)) || PlainRuns.Any(word => Matches(plain, word));
        });
    }

    /// <summary>
    /// Each word; each two side by side, for the lists' two-word entries; and runs of single letters typed apart, read
    /// as one word ("f u c k").
    /// </summary>
    private static IEnumerable<string> Candidates(List<string> words)
    {
        for (var i = 0; i < words.Count; i++)
        {
            yield return words[i];
            if (i + 1 < words.Count)
            {
                yield return $"{words[i]} {words[i + 1]}";
            }
        }

        var letters = new StringBuilder();
        foreach (var word in words.Append(""))
        {
            if (Units(word) == 1)
            {
                letters.Append(word);
                continue;
            }

            if (letters.Length > 1)
            {
                yield return letters.ToString();
            }

            letters.Clear();
        }
    }

    /// <summary>A word's letters, digits, marks and look-alike symbols; dots, dashes, emoji and the like go.</summary>
    private static string Keep(string word)
    {
        var kept = new StringBuilder(word.Length);
        foreach (var c in word)
        {
            var plain = c is >= 'ａ' and <= 'ｚ' ? (char)(c - 'ａ' + 'a') : c is >= '０' and <= '９' ? (char)(c - '０' + '0') : c;
            if (char.IsLetterOrDigit(plain) || Marks.Contains(plain) || Leet.ContainsKey(plain))
            {
                kept.Append(plain);
            }
        }

        return kept.ToString();
    }

    /// <summary>Letters in a word, a letter's marks counted with it.</summary>
    private static int Units(string word) => word.Count(c => !Marks.Contains(c));

    /// <summary>Each letter with its marks, in one order, however they were typed; a space stays a space.</summary>
    private static List<string> MarkedUnits(string word)
    {
        var units = new List<(char Base, List<char> Marks)>();
        foreach (var c in word)
        {
            if (Marks.Contains(c))
            {
                if (units.Count > 0)
                {
                    units[^1].Marks.Add(c);
                }

                continue;
            }

            var (letter, marks) = Letters.TryGetValue(c, out var decomposed) ? decomposed : (c, "");
            units.Add((letter, [.. marks]));
        }

        return [.. units.Select(unit => unit.Base + string.Concat(unit.Marks.Order()))];
    }

    /// <summary>Each letter without its marks, digits and symbols read as letters; anything else left out.</summary>
    private static List<string> PlainUnits(string word)
    {
        var units = new List<string>();
        foreach (var c in word)
        {
            var letter = c == 'đ' ? 'd' : Letters.TryGetValue(c, out var decomposed) ? decomposed.Base : Leet.GetValueOrDefault(c, c);
            if (letter is >= 'a' and <= 'z' or ' ')
            {
                units.Add(letter.ToString());
            }
        }

        return units;
    }

    /// <summary>A letter repeated in a row, as one letter and how many times: "fuuuck" is f, u×3, c, k.</summary>
    private readonly record struct Run(string Unit, int Count);

    private static Run[] Runs(List<string> units)
    {
        var runs = new List<Run>();
        foreach (var unit in units)
        {
            if (runs.Count > 0 && runs[^1].Unit == unit)
            {
                runs[^1] = runs[^1] with { Count = runs[^1].Count + 1 };
            }
            else
            {
                runs.Add(new Run(unit, 1));
            }
        }

        return [.. runs];
    }

    /// <summary>
    /// The same letters in the same order, each repeated at least as often as in the listed word: "fuuuck" is "fuck",
    /// but "Niger" is not the slur with two g.
    /// </summary>
    private static bool Matches(Run[] candidate, Run[] word) =>
        candidate.Length == word.Length
        && candidate.Zip(word).All(pair => pair.First.Unit == pair.Second.Unit && pair.First.Count >= pair.Second.Count);

    private static FrozenDictionary<char, (char Base, string Marks)> BuildLetters()
    {
        // Tones in the order of each row below: none, grave, acute, hook, tilde, dot below.
        string[] tones = ["", "̀", "́", "̉", "̃", "̣"];
        (char Base, string Own, string Row)[] vowels =
        [
            ('a', "", "aàáảãạ"), ('a', "̆", "ăằắẳẵặ"), ('a', "̂", "âầấẩẫậ"),
            ('e', "", "eèéẻẽẹ"), ('e', "̂", "êềếểễệ"),
            ('i', "", "iìíỉĩị"),
            ('o', "", "oòóỏõọ"), ('o', "̂", "ôồốổỗộ"), ('o', "̛", "ơờớởỡợ"),
            ('u', "", "uùúủũụ"), ('u', "̛", "ưừứửữự"),
            ('y', "", "yỳýỷỹỵ"),
        ];
        var letters = new Dictionary<char, (char, string)>();
        foreach (var (letter, own, row) in vowels)
        {
            for (var tone = 0; tone < tones.Length; tone++)
            {
                if (row[tone] != letter)
                {
                    letters[row[tone]] = (letter, own + tones[tone]);
                }
            }
        }

        return letters.ToFrozenDictionary();
    }
}
