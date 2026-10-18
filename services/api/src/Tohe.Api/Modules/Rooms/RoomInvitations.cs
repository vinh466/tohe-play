using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Rooms;

/// <summary>
/// How often an account may ask profiles to tables by their ID (ADR 0033, D-17): every lookup counts — found or not,
/// let in or not — so IDs cannot be walked. In memory: one API process runs the rooms (ADR 0016), and a restart only
/// forgets the last hour.
/// </summary>
internal sealed class InviteLimits(TimeProvider clock, IOptions<RoomsOptions> options)
{
    private static readonly TimeSpan Window = TimeSpan.FromHours(1);

    private readonly Dictionary<Guid, Queue<DateTimeOffset>> _lookups = [];
    private readonly Lock _gate = new();

    /// <summary>Invitations from other accounts that may wait for one profile at a time.</summary>
    public int WaitingPerProfile => options.Value.InvitationsWaitingPerProfile;

    /// <summary>Counts a lookup by the account; false once it made its hourly share (<c>Rooms:InviteLookupsPerHour</c>).</summary>
    public bool TryTake(Guid accountId)
    {
        var now = clock.GetUtcNow();
        lock (_gate)
        {
            if (!_lookups.TryGetValue(accountId, out var times))
            {
                _lookups[accountId] = times = new Queue<DateTimeOffset>();
            }

            while (times.Count > 0 && times.Peek() <= now - Window)
            {
                times.Dequeue();
            }

            if (times.Count >= options.Value.InviteLookupsPerHour)
            {
                return false;
            }

            times.Enqueue(now);
            return true;
        }
    }
}

/// <summary>Who has played with whom, from the hands this module keeps (ADR 0033).</summary>
internal static class Tables
{
    /// <summary>The two profiles sat at the same finished hand at least once.</summary>
    public static Task<bool> PlayedTogetherAsync(ToheDbContext db, Guid profileId, Guid otherId, CancellationToken ct) =>
        db.RoomResults.AsNoTracking()
            .Where(mine => mine.ProfileId == profileId)
            .AnyAsync(
                mine => db.RoomResults.Any(theirs =>
                    theirs.RoomId == mine.RoomId && theirs.Hand == mine.Hand && theirs.ProfileId == otherId),
                ct);
}
