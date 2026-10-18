using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Rooms;

/// <summary>
/// Deleted profiles at the tables (ADR 0034): they leave the live ones at once; finished hands and closed tables keep
/// their seats for the others who played, with nothing of them, and their own results lose who they were.
/// </summary>
internal sealed class RoomsProfileData(RoomRegistry registry, ToheDbContext db) : IProfileData
{
    public async Task WithdrawAsync(IReadOnlyCollection<Guid> profileIds, CancellationToken ct)
    {
        foreach (var room in registry.All.Where(room => !room.IsClosed))
        {
            foreach (var id in profileIds)
            {
                await room.RunAsync(() => room.WithdrawAsync(id));
            }
        }
    }

    public async Task PurgeAsync(IReadOnlyCollection<Guid> profileIds, CancellationToken ct)
    {
        // Seats are JSON SeatRecords (ProfileId as text): theirs become a deleted person's — a fresh random id, so no
        // two of its seats can be tied together, and nothing else.
        var ids = profileIds.Select(id => id.ToString()).ToArray();
        await db.Database.ExecuteSqlAsync(
            $"""
            UPDATE rooms.hands AS h
            SET seats = (
                SELECT jsonb_agg(
                    CASE WHEN t.seat->>'ProfileId' = ANY({ids})
                        THEN jsonb_build_object('ProfileId', gen_random_uuid(), 'AccountId', NULL, 'Name', NULL,
                            'Avatar', NULL, 'Bot', NULL, 'Auto', FALSE, 'Deleted', TRUE)
                        ELSE t.seat
                    END ORDER BY t.position)
                FROM jsonb_array_elements(h.seats) WITH ORDINALITY AS t(seat, position))
            WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(h.seats) AS s(seat) WHERE s.seat->>'ProfileId' = ANY({ids}))
            """,
            ct);

        // Closed tables only: an open one is live, and the profiles left it already (WithdrawAsync).
        await db.Database.ExecuteSqlAsync(
            $"""
            UPDATE rooms.rooms AS r
            SET seat_list = (
                    SELECT jsonb_agg(
                        CASE WHEN t.seat->>'ProfileId' = ANY({ids})
                            THEN jsonb_build_object('ProfileId', gen_random_uuid(), 'AccountId', NULL, 'Name', NULL,
                                'Avatar', NULL, 'Bot', NULL, 'Auto', FALSE, 'Deleted', TRUE)
                            ELSE t.seat
                        END ORDER BY t.position)
                    FROM jsonb_array_elements(r.seat_list) WITH ORDINALITY AS t(seat, position)),
                host_profile_id = CASE WHEN r.host_profile_id::text = ANY({ids}) THEN '00000000-0000-0000-0000-000000000000'::uuid ELSE r.host_profile_id END,
                host_account_id = CASE WHEN r.host_profile_id::text = ANY({ids}) THEN '00000000-0000-0000-0000-000000000000'::uuid ELSE r.host_account_id END
            WHERE r.status = 'Closed'
              AND (r.host_profile_id::text = ANY({ids})
                OR EXISTS (SELECT 1 FROM jsonb_array_elements(r.seat_list) AS s(seat) WHERE s.seat->>'ProfileId' = ANY({ids})))
            """,
            ct);

        // Their outcomes stay counted in the hands others played, as nobody's.
        await db.RoomResults.Where(result => result.ProfileId != null && profileIds.Contains(result.ProfileId.Value))
            .ExecuteUpdateAsync(set => set.SetProperty(r => r.ProfileId, (Guid?)null).SetProperty(r => r.AccountId, (Guid?)null), ct);
    }
}
