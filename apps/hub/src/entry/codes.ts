// Every way into Tò He is an entry (ADR 0044): an address or a typed code becomes a typed intent — a kind and a code,
// never a free path, so no link can send a player anywhere else. Pure helpers, tested in entry.test.ts.
// docs/architecture/entry-links.md#the-hubs-entry-pipeline

/** `room`: a table's lobby, `/r/<six digits>`. `share`: a share link, `/s/<eight characters>`. `play`: a game's menu. */
export type EntryKind = 'room' | 'share' | 'play';

export interface EntryIntent {
  kind: EntryKind;
  /** Six digits, eight upper-case Crockford characters, or a game's id — never anything else. */
  code: string;
}

/** A share link's eight characters: Crockford base32, without I, L, O and U (the API's `LinkCodes.Alphabet`). */
const SHARE = /^[0-9A-HJKMNP-TV-Z]{8}$/;
const ROOM = /^\d{6}$/;
/** A game's id, as the Game Contract's `GameId` (packages/contract), kept here so the catalog loads no Zod. */
const GAME = /^[a-z][a-z0-9-]{1,38}[a-z0-9]$/;

/** Longer than anything worth reading: a whole pasted message is not a code. */
const MAX_INPUT = 200;

/**
 * A typed code as the API reads it (`LinkCodes.TryNormalize`): spaces and hyphens ignored, upper case, I and L read as
 * 1, O as 0.
 */
export function normalizeTyped(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase().replace(/[IL]/g, '1').replace(/O/g, '0');
}

/** A table's code: digits only, spaces and hyphens ignored — I, L and O are a share link's reading, not a table's. */
const tableDigits = (input: string) => input.replace(/[\s-]/g, '');

/** A code of a known kind — from the address `/r/<code>` or `/s/<code>`, or a game's id — or null when it is not one. */
export function readCodeOf(kind: EntryKind, raw: string): EntryIntent | null {
  if (raw.length > MAX_INPUT) return null;
  if (kind === 'play') return GAME.test(raw) ? { kind, code: raw } : null;
  if (kind === 'room') {
    const code = tableDigits(raw);
    return ROOM.test(code) ? { kind, code } : null;
  }
  const code = normalizeTyped(raw);
  return SHARE.test(code) ? { kind, code } : null;
}

/**
 * What "Nhập mã" reads (ADR 0044): six digits are a table, eight characters a share link; a pasted link is read by its
 * `/r/` or `/s/` part, whatever its host. Anything else is null.
 */
export function readCode(input: string): EntryIntent | null {
  const text = input.trim();
  if (text.length === 0 || text.length > MAX_INPUT) return null;
  const link = /\/([rs])\/([0-9A-Za-z-]{1,20})(?:[/?#]|$)/.exec(text);
  if (link) return readCodeOf(link[1] === 'r' ? 'room' : 'share', link[2] ?? '');
  return readCodeOf('room', text) ?? readCodeOf('share', text);
}

/** The hub's own path for an intent, built from its kind and its checked code only. */
export function intentPath(intent: EntryIntent): string {
  switch (intent.kind) {
    case 'room':
      return `/r/${intent.code}`;
    case 'share':
      return `/s/${intent.code}`;
    case 'play':
      return `/play/${intent.code}`;
  }
}

/** True for the path of an entry that waits for a player: a table's link or a share link. */
export const isEntryPath = (path: string) => /^\/[rs]\//.test(path);

/** "482913" → "482 913", "7KQ2M9XA" → "7KQ2 M9XA": easier to read aloud and to type. */
export function formatEntryCode(intent: EntryIntent): string {
  const { code } = intent;
  if (intent.kind === 'room') return `${code.slice(0, 3)} ${code.slice(3)}`;
  if (intent.kind === 'share') return `${code.slice(0, 4)} ${code.slice(4)}`;
  return code;
}

/** The query a link preview's card adds to send a person on to the app (`linkPreviewAppQuery` in @tohe/routes). */
export const APP_QUERY = 'app';

/**
 * Where an entry's address should be, or null when it is right as it is: without `?app=1` — which means nothing to the
 * hub — and with its code in its canonical form (`/s/7kq2-m9xa` → `/s/7KQ2M9XA`).
 */
export function canonicalEntry(
  kind: 'room' | 'share',
  raw: string,
  search: Record<string, unknown>,
): { code: string } | null {
  const read = readCodeOf(kind, raw);
  const code = read?.code ?? raw;
  const extra = Object.keys(search).length > 0;
  return extra || code !== raw ? { code } : null;
}

export type Level = 'any' | 'named' | 'account';

const ORDER: readonly Level[] = ['any', 'named', 'account'];

/** A level the API sent, read safely: anything unknown asks the most. */
export function readLevel(value: string | null | undefined): Level {
  return value === 'any' || value === 'named' || value === 'account' ? value : value ? 'account' : 'any';
}

/** The identity gate (ADR 0043, 0044): the highest of the game's, the feature's and the link's level. */
export function highestLevel(...levels: Level[]): Level {
  return levels.reduce<Level>(
    (high, level) => (ORDER.indexOf(level) > ORDER.indexOf(high) ? level : high),
    'any',
  );
}
