// Local-date helpers for Mỗi Ngày. Pure and injectable (`now`) so tests do not depend on the clock; the game
// uses the player's local date, which is enough for one family in one timezone (SPEC.md, "Mỗi Ngày").

/** `YYYYMMDD`, in local time. */
export function todayId(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/** The `YYYYMM` of a date id, or of today when omitted. */
export const monthOf = (id: string): string => id.slice(0, 6);

/** The last `count` date ids, oldest first, ending on `now`'s date. */
export function recentDays(count: number, now: Date = new Date()): string[] {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days: string[] = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const day = new Date(end);
    day.setDate(end.getDate() - offset);
    days.push(todayId(day));
  }
  return days;
}

/** "8/11" for a date id. */
export const dateLabel = (id: string): string => `${Number(id.slice(6, 8))}/${Number(id.slice(4, 6))}`;

/** The number of stamped days in a month, for the monthly badge. */
export function stampedInMonth(dates: Readonly<Record<string, number>>, month: string): number {
  return Object.keys(dates).filter((date) => date.startsWith(month) && (dates[date] ?? 0) > 0).length;
}
