namespace Tohe.Api.Infrastructure;

/// <summary>
/// How many times each account may do one thing in a sliding hour — look up profile IDs, ask other accounts' profiles
/// to tables (ADR 0033) — or the whole server, under one key: wrong transfer codes (ADR 0043). In memory: one API
/// process serves everyone (ADR 0016), and a restart forgets an hour at most.
/// </summary>
internal abstract class HourlyAllowance(TimeProvider clock) : SlidingAllowance(clock, TimeSpan.FromHours(1));

/// <summary>
/// How many times each key — an account, a device — may do one thing in a sliding window of <paramref name="window"/>.
/// In memory: one API process serves everyone (ADR 0016), and a restart forgets one window at most.
/// </summary>
internal abstract class SlidingAllowance(TimeProvider clock, TimeSpan window)
{
    private readonly Dictionary<Guid, LinkedList<DateTimeOffset>> _uses = [];
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

            times.AddLast(clock.GetUtcNow());
            return true;
        }
    }

    /// <summary>Gives back the account's latest use: it was taken before it was known not to count.</summary>
    public void GiveBack(Guid accountId)
    {
        lock (_gate)
        {
            if (_uses.TryGetValue(accountId, out var times) && times.Count > 0)
            {
                times.RemoveLast();
            }
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
    private LinkedList<DateTimeOffset> Recent(Guid accountId)
    {
        if (!_uses.TryGetValue(accountId, out var times))
        {
            _uses[accountId] = times = new LinkedList<DateTimeOffset>();
        }

        var since = clock.GetUtcNow() - window;
        while (times.First is { } oldest && oldest.Value <= since)
        {
            times.RemoveFirst();
        }

        return times;
    }
}
