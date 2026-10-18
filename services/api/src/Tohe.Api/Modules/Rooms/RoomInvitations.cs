using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Rooms;

/// <summary>Invitations an account sends to other accounts' profiles in an hour (ADR 0033, <c>Rooms:InvitationsPerHour</c>).</summary>
internal sealed class RoomInvitations(TimeProvider clock) : HourlyAllowance(clock);

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
