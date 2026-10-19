using System.Collections.Concurrent;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;

namespace Tohe.Api.Modules.Identity;

/// <summary>
/// A small puzzle the device solves before asking for a code by email (ADR 0037): find the number under
/// <paramref name="MaxNumber"/> whose SHA-256, after <paramref name="Salt"/>, is <paramref name="Challenge"/>.
/// </summary>
/// <param name="Algorithm">Always <c>SHA-256</c>.</param>
/// <param name="Challenge">The hash to find, hexadecimal.</param>
/// <param name="Token">Send it back with the number: it holds the challenge, sealed, for five minutes.</param>
public sealed record ProofOfWorkChallenge(string Algorithm, string Challenge, string Salt, int MaxNumber, string Token);

/// <summary>The device's answer to a <see cref="ProofOfWorkChallenge"/>.</summary>
public sealed record ProofOfWorkSolution(string Token, int Number);

/// <summary>
/// Self-hosted proof-of-work (ADR 0037, E-09): with the console's switch on, signing up and asking for a password reset
/// cost a device about half a second of hashing — nothing for a person, real money for a bot asking thousands of times.
/// The challenge is sealed with Data Protection (the keys every API instance shares), so the API keeps nothing until it
/// is answered; an answer is spent once.
/// </summary>
internal sealed class ProofOfWork(IDataProtectionProvider protection, IOptions<IdentityOptions> options, TimeProvider clock)
{
    private readonly ITimeLimitedDataProtector _protector =
        protection.CreateProtector("Tohe.Identity.ProofOfWork").ToTimeLimitedDataProtector();

    /// <summary>Salts already answered, until their challenge would have expired anyway.</summary>
    private readonly ConcurrentDictionary<string, DateTimeOffset> _spent = new(StringComparer.Ordinal);

    public ProofOfWorkChallenge New()
    {
        var max = options.Value.ProofOfWorkMaxNumber;
        var salt = Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(12));
        var challenge = Hash(salt, RandomNumberGenerator.GetInt32(max + 1));
        var token = _protector.Protect($"{salt}:{challenge}", clock.GetUtcNow() + options.Value.ProofOfWorkLifetime);
        return new ProofOfWorkChallenge("SHA-256", challenge, salt, max, token);
    }

    /// <summary>A sealed challenge of ours, not expired, answered right, and not answered before.</summary>
    public bool Accepts(ProofOfWorkSolution? solution)
    {
        if (solution is null || string.IsNullOrEmpty(solution.Token) || solution.Number < 0)
        {
            return false;
        }

        string sealedValue;
        DateTimeOffset expires;
        try
        {
            sealedValue = _protector.Unprotect(solution.Token, out expires);
        }
        catch (CryptographicException)
        {
            return false;
        }

        var parts = sealedValue.Split(':');
        if (parts.Length != 2 || Hash(parts[0], solution.Number) != parts[1])
        {
            return false;
        }

        var now = clock.GetUtcNow();
        foreach (var (salt, until) in _spent)
        {
            if (until < now)
            {
                _spent.TryRemove(salt, out _);
            }
        }

        return _spent.TryAdd(parts[0], expires);
    }

    /// <summary>What the device computes: SHA-256 of the salt followed by the number in decimal, hexadecimal.</summary>
    public static string Hash(string salt, int number) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(salt + number.ToString(CultureInfo.InvariantCulture))));
}
