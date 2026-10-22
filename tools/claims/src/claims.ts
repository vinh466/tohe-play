// Claims: the repository paths one worker may change, and whether two workers' claims touch.
import { HOT_ZONES, type HotZone } from './zones.ts';

/**
 * A repository-relative path: `dir/` claims everything under it, `a/b.ts` one file, a pattern with `*`, `**` or `?`
 * the paths it matches. A claim that starts with `@` names a shared resource, such as `@dev-stack`.
 */
export type Claim = string;

/** The file in an agent worktree's root that holds its claims. Ignored by git; only the master writes it. */
export const CLAIMS_FILE = '.agent-claims';

export interface ClaimsFile {
  branch: string;
  /** The commit the worktree started from: a worktree back at it has nothing of its own yet. */
  base: string;
  opened: string;
  claims: Claim[];
}

const WILDCARD = /[*?]/;

export const isResource = (claim: Claim): boolean => claim.startsWith('@');

/** A claim as written in a packet, checked: throws on one that is empty, absolute or climbs out with `..`. */
export function normaliseClaim(raw: string): Claim {
  const claim = raw.trim().replace(/^\.\//, '');
  if (claim === '') throw new Error('a claim is empty');
  if (isResource(claim)) {
    if (!/^@[a-z0-9-]+$/.test(claim)) throw new Error(`resource claim '${raw}' must look like @dev-stack`);
    return claim;
  }
  if (claim.startsWith('/') || claim.split('/').includes('..'))
    throw new Error(`claim '${raw}' must be a path inside the repository`);
  return claim;
}

/** `dir/` stands for `dir/**`. */
function segments(claim: Claim): string[] {
  const parts = claim.split('/');
  if (claim.endsWith('/')) parts[parts.length - 1] = '**';
  return parts;
}

function segmentPattern(segment: string): RegExp {
  const body = segment
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]');
  return new RegExp(`^${body}$`);
}

/** The text before a segment's first wildcard and after its last one. */
function ends(segment: string): [string, string] {
  const last = Math.max(segment.lastIndexOf('*'), segment.lastIndexOf('?'));
  return [segment.slice(0, segment.search(WILDCARD)), segment.slice(last + 1)];
}

/** Whether two path segments can be the same name. Exact unless both have wildcards; then it may say yes wrongly. */
function segmentsMeet(a: string, b: string): boolean {
  const aWild = WILDCARD.test(a);
  const bWild = WILDCARD.test(b);
  if (!aWild && !bWild) return a === b;
  if (!bWild) return segmentPattern(a).test(b);
  if (!aWild) return segmentPattern(b).test(a);
  const [aStart, aEnd] = ends(a);
  const [bStart, bEnd] = ends(b);
  return (
    (aStart.startsWith(bStart) || bStart.startsWith(aStart)) && (aEnd.endsWith(bEnd) || bEnd.endsWith(aEnd))
  );
}

function meet(a: string[], b: string[], i: number, j: number): boolean {
  const x = a[i];
  const y = b[j];
  if (x === undefined && y === undefined) return true;
  if (x === '**') return meet(a, b, i + 1, j) || (y !== undefined && meet(a, b, i, j + 1));
  if (y === '**') return meet(a, b, i, j + 1) || (x !== undefined && meet(a, b, i + 1, j));
  if (x === undefined || y === undefined) return false;
  return segmentsMeet(x, y) && meet(a, b, i + 1, j + 1);
}

/**
 * Whether two claims can name the same file. Exact when either is a plain path; for two patterns it may say they
 * touch when they never do, never the other way round.
 */
export function touches(a: Claim, b: Claim): boolean {
  if (isResource(a) || isResource(b)) return a === b;
  return meet(segments(a), segments(b), 0, 0);
}

/** Whether a repository-relative file path falls under a claim. */
export const covers = (claim: Claim, path: string): boolean => !isResource(claim) && touches(claim, path);

export const zonesOf = (claim: Claim, zones: HotZone[] = HOT_ZONES): HotZone[] =>
  zones.filter((zone) => zone.claims.some((zoneClaim) => touches(claim, zoneClaim)));

export interface Touch {
  mine: Claim;
  theirs: Claim;
  /** Set when the two claims name different files of one hot zone. */
  zone?: string;
}

/** Every way two claim lists touch: two claims that can name one file, or two that reach the same hot zone. */
export function touchesBetween(mine: Claim[], theirs: Claim[], zones: HotZone[] = HOT_ZONES): Touch[] {
  const found: Touch[] = [];
  for (const m of mine) {
    for (const t of theirs) {
      if (touches(m, t)) {
        found.push({ mine: m, theirs: t });
        continue;
      }
      const theirZones = zonesOf(t, zones);
      const shared = zonesOf(m, zones).find((zone) => theirZones.includes(zone));
      if (shared !== undefined) found.push({ mine: m, theirs: t, zone: shared.name });
    }
  }
  return found;
}

/** The paths of a list that no claim covers. */
export const outside = (claims: Claim[], paths: string[]): string[] =>
  paths.filter((path) => !claims.some((claim) => covers(claim, path)));
