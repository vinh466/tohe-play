using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Tohe.Api.Modules.Identity;

/// <summary>What a one-time code, sent by email, is for (ADR 0024).</summary>
public enum AttemptPurpose
{
    /// <summary>Signing up: the account is created only when the code is right.</summary>
    SignUp,

    /// <summary>Forgot password: the code lets its holder set a new one.</summary>
    ResetPassword,

    /// <summary>A new sign-in email for the account (or a first one, for an account from before email).</summary>
    ChangeEmail,

    /// <summary>Proving it is the account's owner before account security changes (step-up level 2, ADR 0025).</summary>
    StepUp,
}

/// <summary>
/// A flow waiting for the code sent to <see cref="Email"/> (ADR 0024). The client holds its id: a code opens only the
/// attempt it was sent for, so a code alone — or one from someone else's attempt — is worth nothing. A decoy (an email
/// that must not learn anything, or reveal anything) has no code hash, so nothing ever opens it; it answers like a
/// real attempt until its tries run out.
/// </summary>
public sealed class AuthAttempt
{
    public Guid Id { get; init; }

    public AttemptPurpose Purpose { get; init; }

    /// <summary>Where the code went, as typed.</summary>
    public required string Email { get; init; }

    /// <summary>The email as Identity compares it, for the limits per address and the checks on confirming.</summary>
    public required string NormalizedEmail { get; init; }

    /// <summary>The account a reset or an email change is for; none for signing up.</summary>
    public Guid? AccountId { get; init; }

    /// <summary>SHA-256 of the attempt's id and its code; null for a decoy.</summary>
    public string? CodeHash { get; init; }

    /// <summary>Signing up: the chosen password, hashed by Identity, kept until the code is right.</summary>
    public string? PasswordHash { get; init; }

    /// <summary>Signing up: the first profile's name (ADR 0023).</summary>
    public string? DisplayName { get; init; }

    /// <summary>Signing up: the version of the terms accepted, with the age, when the attempt started.</summary>
    public string? TermsVersion { get; init; }

    public int TriesLeft { get; set; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset ExpiresAt { get; init; }

    /// <summary>Used, out of tries, or replaced by a newer code; never opens again.</summary>
    public DateTimeOffset? ClosedAt { get; set; }

    public bool IsDecoy => CodeHash is null;

    public bool IsOpen(DateTimeOffset now) => ClosedAt is null && ExpiresAt > now && TriesLeft > 0;
}

internal sealed class AuthAttemptConfiguration : IEntityTypeConfiguration<AuthAttempt>
{
    public void Configure(EntityTypeBuilder<AuthAttempt> builder)
    {
        builder.ToTable("auth_attempts", "identity");
        builder.Property(attempt => attempt.Purpose).HasConversion<string>().HasMaxLength(16);
        builder.Property(attempt => attempt.Email).HasMaxLength(Codes.MaxEmailLength);
        builder.Property(attempt => attempt.NormalizedEmail).HasMaxLength(Codes.MaxEmailLength);
        builder.Property(attempt => attempt.CodeHash).HasMaxLength(64).IsFixedLength();
        builder.Property(attempt => attempt.DisplayName).HasMaxLength(200);
        builder.Property(attempt => attempt.TermsVersion).HasMaxLength(Consent.MaxVersionLength);
        builder.HasIndex(attempt => new { attempt.NormalizedEmail, attempt.CreatedAt });
        builder.HasIndex(attempt => attempt.ExpiresAt);
    }
}

/// <summary>One-time codes (ADR 0024): six digits, only their hash kept, bound to the attempt they were sent for.</summary>
public static class Codes
{
    /// <summary>The longest address SMTP carries (RFC 5321).</summary>
    public const int MaxEmailLength = 254;

    public const int Tries = 5;

    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(15);

    /// <summary>Fifteen minutes; ten for stepping up, which proves someone is here right now.</summary>
    public static TimeSpan LifetimeOf(AttemptPurpose purpose) =>
        purpose == AttemptPurpose.StepUp ? TimeSpan.FromMinutes(10) : Lifetime;

    /// <summary>Between two codes to one address.</summary>
    public static readonly TimeSpan Cooldown = TimeSpan.FromSeconds(60);

    /// <summary>Codes to one address within an hour, whatever they are for.</summary>
    public const int PerAddressPerHour = 5;

    public static string New() => RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6", System.Globalization.CultureInfo.InvariantCulture);

    public static string Hash(Guid attemptId, string code) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes($"{attemptId:N}:{code}")));

    /// <summary>True when <paramref name="typed"/> (spaces allowed, as the email shows it) is the attempt's code.</summary>
    public static bool Matches(AuthAttempt attempt, string? typed)
    {
        if (attempt.CodeHash is null || typed is null)
        {
            return false;
        }

        var digits = string.Concat(typed.Where(c => !char.IsWhiteSpace(c)));
        if (digits.Length != 6 || !digits.All(char.IsAsciiDigit))
        {
            return false;
        }

        return CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(Hash(attempt.Id, digits)),
            Encoding.ASCII.GetBytes(attempt.CodeHash));
    }
}
