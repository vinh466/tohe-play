using System.Net.Mail;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Platform;

namespace Tohe.Api.Modules.Identity;

/// <summary>What a typed code did: opened its attempt, cost a try, or met a closed attempt.</summary>
internal sealed record CodeCheck(AuthAttempt? Attempt, int TriesLeft)
{
    public static CodeCheck Closed { get; } = new(null, 0);

    /// <summary>The answer when the code did not open the attempt; null when it did.</summary>
    public ProblemHttpResult? Problem =>
        Attempt is not null ? null : TriesLeft > 0 ? Problems.CodeInvalid(TriesLeft) : Problems.AttemptClosed();
}

/// <summary>Starts code attempts and checks typed codes (ADR 0024).</summary>
internal sealed class Attempts(ToheDbContext db, TimeProvider clock, ILookupNormalizer normalizer, IOptions<AppOptions> app)
{
    /// <summary>The address as typed (trimmed) when it is a plain address with a dotted domain; otherwise null.</summary>
    public static string? ParseEmail(string? input)
    {
        var email = input?.Trim();
        if (string.IsNullOrEmpty(email) || email.Length > Codes.MaxEmailLength
            || !MailAddress.TryCreate(email, out var address)
            || address.Address != email || address.DisplayName.Length > 0 || !address.Host.Contains('.'))
        {
            return null;
        }

        return email;
    }

    public string Normalize(string email) => normalizer.NormalizeEmail(email);

    /// <summary>
    /// Why <paramref name="normalizedEmail"/> may not get a code now — a minute between codes, five an hour — or null.
    /// Decoys count like real attempts, so the answer says nothing about whose address it is.
    /// </summary>
    public async Task<string?> RefusalAsync(string normalizedEmail, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var since = now.AddHours(-1);
        var sent = await db.AuthAttempts
            .Where(a => a.NormalizedEmail == normalizedEmail && a.CreatedAt > since)
            .Select(a => a.CreatedAt)
            .ToListAsync(ct);
        if (sent.Any(at => now - at < Codes.Cooldown))
        {
            return "code_cooldown";
        }

        return sent.Count >= Codes.PerAddressPerHour ? "too_many_codes" : null;
    }

    /// <summary>
    /// A new attempt for <paramref name="email"/>, saved with the caller's changes; returns the code to send, or null for
    /// a decoy. A new email change replaces the account's earlier one. Earlier sign-ups and resets stay open: closing
    /// them would let anyone cancel someone else's, and a code only ever opens its own attempt anyway.
    /// </summary>
    public async Task<(AuthAttempt Attempt, string? Code)> StartAsync(
        AttemptPurpose purpose,
        string email,
        bool decoy,
        CancellationToken ct,
        Guid? accountId = null,
        string? passwordHash = null,
        string? displayName = null)
    {
        var now = clock.GetUtcNow();

        // Housekeeping on the way: a day past their end, attempts serve nothing, not even the limits.
        var stale = now.AddDays(-1);
        await db.AuthAttempts.Where(a => a.ExpiresAt < stale).ExecuteDeleteAsync(ct);
        if (purpose == AttemptPurpose.ChangeEmail && accountId is not null)
        {
            await db.AuthAttempts
                .Where(a => a.Purpose == AttemptPurpose.ChangeEmail && a.AccountId == accountId && a.ClosedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.ClosedAt, now), ct);
        }

        // Random, not time-ordered: the id is what the client holds next to the code.
        var id = Guid.NewGuid();
        var code = decoy ? null : Codes.New();
        var attempt = new AuthAttempt
        {
            Id = id,
            Purpose = purpose,
            Email = email,
            NormalizedEmail = Normalize(email),
            AccountId = accountId,
            CodeHash = code is null ? null : Codes.Hash(id, code),
            PasswordHash = passwordHash,
            DisplayName = displayName,
            TriesLeft = Codes.Tries,
            CreatedAt = now,
            ExpiresAt = now + Codes.Lifetime,
        };
        db.AuthAttempts.Add(attempt);
        return (attempt, code);
    }

    /// <summary>
    /// Checks a typed code. A wrong one costs a try, counted in the database so tries made at the same moment all
    /// count; the last try closes the attempt. <paramref name="accountId"/>: whose attempt it must be, if anyone's.
    /// </summary>
    public async Task<CodeCheck> CheckAsync(
        Guid attemptId, AttemptPurpose purpose, string? code, Guid? accountId, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var attempt = await db.AuthAttempts.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == attemptId && a.Purpose == purpose, ct);
        if (attempt is null || !attempt.IsOpen(now) || (accountId is not null && attempt.AccountId != accountId))
        {
            return CodeCheck.Closed;
        }

        if (Codes.Matches(attempt, code))
        {
            return new CodeCheck(attempt, attempt.TriesLeft);
        }

        await db.AuthAttempts
            .Where(a => a.Id == attemptId && a.TriesLeft > 0)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.TriesLeft, a => a.TriesLeft - 1), ct);
        var left = await db.AuthAttempts.Where(a => a.Id == attemptId).Select(a => a.TriesLeft).FirstAsync(ct);
        return left > 0 ? new CodeCheck(null, left) : CodeCheck.Closed;
    }

    /// <summary>Uses up an attempt whose code was right; false when another request used it first.</summary>
    public async Task<bool> UseAsync(AuthAttempt attempt, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var used = await db.AuthAttempts
            .Where(a => a.Id == attempt.Id && a.ClosedAt == null && a.TriesLeft > 0 && a.ExpiresAt > now)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.ClosedAt, now), ct);
        return used == 1;
    }

    /// <summary>A page of the hub, for links in email; none when the hub's public URL is not configured.</summary>
    public Uri? Link(string pathAndQuery) => app.Value.PublicUrl is { } hub ? new Uri(hub, pathAndQuery) : null;
}
