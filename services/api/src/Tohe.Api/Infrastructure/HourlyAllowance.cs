namespace Tohe.Api.Infrastructure;

/// <summary>
/// How many times each account may do one thing in a sliding hour — look up profile IDs, ask other accounts' profiles
/// to tables (ADR 0033). In memory: one API process serves everyone (ADR 0016), and a restart forgets an hour at most.
/// </summary>
internal abstract class HourlyAllowance(TimeProvider clock)
{
    private static readonly TimeSpan Window = TimeSpan.FromHours(1);

    private readonly Dictionary<Guid, Queue<DateTimeOffset>> _uses = [];
    private readonly Lock _gate = new();

    /// <summary>Counts a use by the account; false, counting nothing, once it had <paramref name="limit"/> in the last hour.</summary>
    public bool TryTake(Guid accountId, int limit)
    {
        var now = clock.GetUtcNow();
        lock (_gate)
        {
            if (!_uses.TryGetValue(accountId, out var times))
            {
                _uses[accountId] = times = new Queue<DateTimeOffset>();
            }

            while (times.Count > 0 && times.Peek() <= now - Window)
            {
                times.Dequeue();
            }

            if (times.Count >= limit)
            {
                return false;
            }

            times.Enqueue(now);
            return true;
        }
    }
}
