// Release tags (ADR 0041): `uat-YYYY-MM-DD.N` and `prod-YYYY-MM-DD.N`, the date in Việt Nam time, N from 1 each day.

export type Prefix = 'uat' | 'prod';

const TAG = /^(uat|prod)-(\d{4}-\d{2}-\d{2})\.(\d+)$/;

interface Parsed {
  tag: string;
  date: string;
  n: number;
}

function parse(tag: string, prefix: Prefix): Parsed | null {
  const match = TAG.exec(tag);
  if (!match || match[1] !== prefix) return null;
  return { tag, date: match[2] as string, n: Number(match[3]) };
}

/** The tags of `prefix` in the list, oldest first: by date, then by N as a number (`.10` comes after `.2`). */
export function sortTags(tags: string[], prefix: Prefix): string[] {
  return tags
    .map((tag) => parse(tag, prefix))
    .filter((parsed): parsed is Parsed => parsed !== null)
    .sort((a, b) => (a.date === b.date ? a.n - b.n : a.date < b.date ? -1 : 1))
    .map((parsed) => parsed.tag);
}

/** The newest tag of `prefix`, or null if there is none. */
export function newestTag(tags: string[], prefix: Prefix): string | null {
  return sortTags(tags, prefix).at(-1) ?? null;
}

/** Today's date in Việt Nam time, `YYYY-MM-DD`. */
export function dateInVietnam(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** The next free tag name of `prefix` for today: N is one more than the highest N already used today. */
export function nextTagName(tags: string[], prefix: Prefix, now: Date): string {
  const date = dateInVietnam(now);
  const used = tags
    .map((tag) => parse(tag, prefix))
    .filter((parsed): parsed is Parsed => parsed !== null && parsed.date === date)
    .map((parsed) => parsed.n);
  return `${prefix}-${date}.${Math.max(0, ...used) + 1}`;
}
