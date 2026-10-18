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

    public async Task<Growth> ProfilesAsync(DateTimeOffset now, CancellationToken ct) => new(
        await db.Profiles.CountAsync(ct),
        await db.Profiles.CountAsync(profile => profile.CreatedAt > now.AddDays(-1), ct),
        await db.Profiles.CountAsync(profile => profile.CreatedAt > now.AddDays(-7), ct));
}
