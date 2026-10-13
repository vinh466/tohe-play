using System.Security.Cryptography;

namespace Tohe.Api.Modules.Identity;

/// <summary>Household invite codes: 8 characters without look-alikes (0/O, 1/I/L), valid 7 days.</summary>
internal static class Invites
{
    private const string Alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);

    public static string NewCode() =>
        string.Create(8, 0, static (span, _) =>
        {
            for (var i = 0; i < span.Length; i++)
            {
                span[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
            }
        });

    /// <summary>Accepts what people type: lower case, spaces, a dash in the middle.</summary>
    public static string Normalize(string code) =>
        new([.. code.ToUpperInvariant().Where(c => !char.IsWhiteSpace(c) && c != '-')]);
}
