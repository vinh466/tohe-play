// The dead ends of the entry pipeline (ADR 0044, step 2): what each says, and its ways out. Pure, tested in
// entry.test.ts.

/**
 * Why an entry ends here (ADR 0044, step 2): `unknown` — never made, or a table that closed — says no more than that;
 * `expired`, `revoked` and `used_up` are a share link's, which still names its game; `not-for-profile` is a game this
 * profile does not have (its age, step 6).
 */
export type DeadEndReason = 'unknown' | 'expired' | 'revoked' | 'used_up' | 'not-for-profile';

/** The states of a share link that end the entry with a reason and the game as the way out. */
export const linkDeadEnds: readonly string[] = ['expired', 'revoked', 'used_up'];

/** The screen a dead end shows: what it says, and the ways out. Pure, tested in entry.test.ts. */
export function deadEndScreen(
  reason: DeadEndReason,
  game: { id?: string | null; name?: string | null },
  child = false,
): { title: string; body: string; toGame: boolean; codeBox: boolean } {
  switch (reason) {
    case 'unknown':
      return { title: 'entry.unknownTitle', body: 'entry.unknownBody', toGame: false, codeBox: true };
    case 'expired':
    case 'revoked':
    case 'used_up': {
      const key = reason === 'used_up' ? 'usedUp' : reason;
      return {
        title: `entry.${key}Title`,
        body: game.name ? `entry.${key}Body` : `entry.${key}BodyNoGame`,
        toGame: Boolean(game.id),
        codeBox: false,
      };
    }
    case 'not-for-profile':
      return {
        title: child ? 'entry.tooYoungTitle' : 'entry.goneTitle',
        body: child ? 'entry.tooYoungBody' : 'entry.goneBody',
        toGame: false,
        codeBox: false,
      };
  }
}
