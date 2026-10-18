namespace Tohe.Api.Infrastructure;

/// <summary>
/// The calendar week boards and statistics count (ADR 0029): from Monday 00:00 in Việt Nam. Asia/Ho_Chi_Minh has kept
/// UTC+7 without daylight saving since 1975, so a fixed offset is exact — and needs no time zone database in the image.
/// </summary>
public static class Weeks
{
    public static readonly TimeSpan VietnamOffset = TimeSpan.FromHours(7);

    /// <summary>The Monday 00:00 (UTC+7) that starts the week <paramref name="at"/> falls in — in UTC, as the database
    /// takes it.</summary>
    public static DateTimeOffset StartOf(DateTimeOffset at)
    {
        var local = at.ToOffset(VietnamOffset);
        var sinceMonday = ((int)local.DayOfWeek + 6) % 7;
        return new DateTimeOffset(local.Date, VietnamOffset).AddDays(-sinceMonday).ToUniversalTime();
    }
}
