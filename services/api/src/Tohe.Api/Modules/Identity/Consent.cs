using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Identity;

namespace Tohe.Api.Modules.Identity;

/// <summary>
/// Signing up asks for 16 or older and the terms and privacy notice (ADR 0025): under 16, a child plays as a profile a
/// parent makes (ADR 0023). The hub names the version of the documents it showed; the account keeps it, and the hub
/// asks again when its documents are newer.
/// </summary>
public static partial class Consent
{
    public const int MaxVersionLength = 32;

    /// <summary>Letters, digits, dots and dashes, as the hub names its documents' versions (e.g. <c>2026-10-18</c>).</summary>
    public static bool IsVersion(string? value) => value is not null && Version().IsMatch(value);

    [GeneratedRegex("^[A-Za-z0-9.-]{1,32}$")]
    private static partial Regex Version();
}

/// <summary>The account's manage PIN (step-up level 1, ADR 0025): six digits, hashed like a password.</summary>
internal static partial class ManagePins
{
    /// <summary>Wrong PINs in a row before the PIN locks.</summary>
    public const int Tries = 5;

    public static readonly TimeSpan LockFor = TimeSpan.FromMinutes(5);

    private static readonly PasswordHasher<Account> Hasher = new();

    public static bool IsPin(string? value) => value is not null && Pin().IsMatch(value);

    public static string Hash(Account account, string pin) => Hasher.HashPassword(account, pin);

    public static bool Verify(Account account, string pin) =>
        account.ManagePinHash is { } hash
        && Hasher.VerifyHashedPassword(account, hash, pin) != PasswordVerificationResult.Failed;

    [GeneratedRegex("^[0-9]{6}$")]
    private static partial Regex Pin();
}
