using System.Security.Cryptography;

namespace Tohe.Api.Modules.Identity;

/// <summary>
/// Public profile IDs (ADR 0023): 12 digits — 11 random, the first never 0, then a Damm check digit. Random so they
/// reveal neither how many profiles exist nor their neighbours; the check digit catches every single-digit typo and
/// every swap of two neighbouring digits when someone types an ID by hand. The hub carries the same algorithm.
/// </summary>
public static class ProfileIds
{
    public const int Length = 12;

    /// <summary>The Damm quasigroup of order 10 (H. Michael Damm, 2004).</summary>
    private static readonly byte[,] Quasigroup =
    {
        { 0, 3, 1, 7, 5, 9, 8, 6, 4, 2 },
        { 7, 0, 9, 2, 1, 5, 4, 8, 6, 3 },
        { 4, 2, 0, 6, 8, 7, 1, 3, 5, 9 },
        { 1, 7, 5, 0, 9, 8, 3, 4, 2, 6 },
        { 6, 1, 2, 3, 0, 4, 5, 9, 7, 8 },
        { 3, 6, 7, 4, 2, 0, 9, 5, 8, 1 },
        { 5, 8, 6, 9, 7, 2, 0, 1, 3, 4 },
        { 8, 9, 4, 5, 3, 6, 2, 0, 1, 7 },
        { 9, 4, 3, 8, 6, 1, 7, 2, 0, 5 },
        { 2, 5, 8, 1, 4, 3, 6, 7, 9, 0 },
    };

    /// <summary>A new random ID; the caller makes sure no profile has it yet.</summary>
    public static string New()
    {
        Span<char> digits = stackalloc char[Length];
        digits[0] = (char)('1' + RandomNumberGenerator.GetInt32(9));
        for (var i = 1; i < Length - 1; i++)
        {
            digits[i] = (char)('0' + RandomNumberGenerator.GetInt32(10));
        }

        digits[Length - 1] = (char)('0' + CheckDigit(digits[..^1]));
        return new string(digits);
    }

    /// <summary>The Damm check digit of a run of decimal digits.</summary>
    public static int CheckDigit(ReadOnlySpan<char> digits)
    {
        var interim = 0;
        foreach (var digit in digits)
        {
            interim = Quasigroup[interim, digit - '0'];
        }

        return interim;
    }

    /// <summary>Accepts what people type — spaces and dashes anywhere — and returns the bare 12 digits.</summary>
    public static bool TryNormalize(string? input, out string id)
    {
        id = "";
        if (input is null)
        {
            return false;
        }

        Span<char> digits = stackalloc char[Length];
        var count = 0;
        foreach (var c in input)
        {
            if (c is ' ' or '-')
            {
                continue;
            }

            if (!char.IsAsciiDigit(c) || count == Length)
            {
                return false;
            }

            digits[count++] = c;
        }

        if (count != Length || digits[0] == '0' || CheckDigit(digits) != 0)
        {
            return false;
        }

        id = new string(digits);
        return true;
    }

    /// <summary>"123456789012" → "1234 5678 9012", as the hub shows it.</summary>
    public static string Format(string id) => $"{id[..4]} {id[4..8]} {id[8..]}";
}
