using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Identity;

/// <summary>How many there are, and how many came in the last day and the last week.</summary>
public sealed record Growth(int Total, int LastDay, int LastWeek);

/// <summary>What the admin console counts about accounts and profiles (ADR 0027); the tables stay this module's.</summary>
internal sealed class IdentityFacts(ToheDbContext db)
{
    public async Task<Growth> AccountsAsync(DateTimeOffset now, CancellationToken ct) => new(
        await db.Users.CountAsync(ct),
        await db.Users.CountAsync(account => account.CreatedAt > now.AddDays(-1), ct),
        await db.Users.CountAsync(account => account.CreatedAt > now.AddDays(-7), ct));

    /// <summary>
    /// Accounts with no other way in than this method (ADR 0028): for the password, those without a provider; for a
    /// provider, those without a password or another provider. They cannot sign in while it is off.
    /// </summary>
    public Task<int> OnlyWayInAsync(string method, CancellationToken ct) => method == SignInMethods.Password
        ? db.Users.CountAsync(account => account.PasswordHash != null && !db.UserLogins.Any(login => login.UserId == account.Id), ct)
        : db.Users.CountAsync(
            account => account.PasswordHash == null
                && db.UserLogins.Any(login => login.UserId == account.Id && login.LoginProvider == method)
                && !db.UserLogins.Any(login => login.UserId == account.Id && login.LoginProvider != method),
            ct);

    /// <summary>Whether the account keeps a way in with only these methods on: its password, or a provider of its.</summary>
    public async Task<bool> HasWayInAsync(Guid accountId, IReadOnlySet<string> on, CancellationToken ct)
    {
        var account = await db.Users.AsNoTracking().FirstAsync(a => a.Id == accountId, ct);
        if (account.PasswordHash is not null && on.Contains(SignInMethods.Password))
        {
            return true;
        }

        var logins = await db.UserLogins.AsNoTracking().Where(login => login.UserId == accountId).Select(login => login.LoginProvider).ToListAsync(ct);
        return logins.Any(on.Contains);
    }

    /// <summary>Accounts whose owner asked to delete them and whose seven days are over: an admin's to delete (ADR 0038).</summary>
    public Task<int> DeletionsDueAsync(DateTimeOffset now, CancellationToken ct) =>
        db.Users.CountAsync(account => account.DeleteAfter != null && account.DeleteAfter <= now, ct);

    public async Task<Growth> ProfilesAsync(DateTimeOffset now, CancellationToken ct) => new(
        await db.Profiles.CountAsync(ct),
        await db.Profiles.CountAsync(profile => profile.CreatedAt > now.AddDays(-1), ct),
        await db.Profiles.CountAsync(profile => profile.CreatedAt > now.AddDays(-7), ct));
}
