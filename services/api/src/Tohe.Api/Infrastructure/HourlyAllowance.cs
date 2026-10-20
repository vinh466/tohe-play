namespace Tohe.Api.Infrastructure;

/// <summary>
/// How many times each account may do one thing in a sliding hour — look up profile IDs, ask other accounts' profiles
/// to tables (ADR 0033) — or the whole server, under one key: wrong transfer codes (ADR 0043). In memory: one API
/// process serves everyone (ADR 0016), and a restart forgets an hour at most.
/// </summary>
internal abstract class HourlyAllowance(TimeProvider clock)
{
    private static readonly TimeSpan Window = TimeSpan.FromHours(1);

    private readonly Dictionary<Guid, Queue<DateTimeOffset>> _uses = [];
    private readonly Lock _gate = new();

    /// <summary>Counts a use by the account; false, counting nothing, once it had <paramref name="limit"/> in the last hour.</summary>
    public bool TryTake(Guid accountId, int limit)
    {
        lock (_gate)
        {
            var times = Recent(accountId);
            if (times.Count >= limit)
            {
                return false;
            }

            times.Enqueue(clock.GetUtcNow());
            return true;
        }
    }

    /// <summary>True while the account had fewer than <paramref name="limit"/> uses in the last hour; counts nothing.</summary>
    public bool HasRoom(Guid accountId, int limit)
    {
        lock (_gate)
        {
            return Recent(accountId).Count < limit;
        }
    }

    /// <summary>The account's uses in the last hour, the older ones dropped. Under the lock.</summary>
    private Queue<DateTimeOffset> Recent(Guid accountId)
    {
        if (!_uses.TryGetValue(accountId, out var times))
        {
            _uses[accountId] = times = new Queue<DateTimeOffset>();
        }

        var since = clock.GetUtcNow() - Window;
        while (times.Count > 0 && times.Peek() <= since)
        {
            times.Dequeue();
        }

        return times;
    }
}
