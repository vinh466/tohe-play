using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Progress;

/// <summary>A deleted profile's saved games and scores go with it (ADR 0034).</summary>
internal sealed class ProgressProfileData(ToheDbContext db) : IProfileData
{
    /// <summary>Nothing here plays live.</summary>
    public Task WithdrawAsync(IReadOnlyCollection<Guid> profileIds, CancellationToken ct) => Task.CompletedTask;

    public async Task PurgeAsync(IReadOnlyCollection<Guid> profileIds, CancellationToken ct)
    {
        await db.SavedGames.Where(save => profileIds.Contains(save.ProfileId)).ExecuteDeleteAsync(ct);
        await db.Scores.Where(score => profileIds.Contains(score.ProfileId)).ExecuteDeleteAsync(ct);
    }
}
