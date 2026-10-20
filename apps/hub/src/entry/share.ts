// "Chia sẻ" on a game (ADR 0044): a `game` link to its menu, made by the profile playing. Pure helpers, tested in
// entry.test.ts.
import type { MakeLinkRequest, ShareLinkView } from '../api/client.ts';

/** A link kept for sharing again needs at least this long left, or a new one is made. */
export const REUSE_MIN_LEFT_MS = 24 * 60 * 60 * 1000;

/**
 * The profile's own link to this game that "Chia sẻ" shows again rather than making another — 30 a day is the limit,
 * and opening the sheet twice is not sharing twice: a `game` link that still opens, asks nothing of whoever opens it,
 * has no maximum of uses and a day or more left. The newest first, as the API lists them.
 */
export function reusableLink(
  mine: readonly ShareLinkView[],
  gameId: string,
  now: number,
): ShareLinkView | null {
  return (
    mine.find(
      (link) =>
        link.kind === 'game' &&
        link.gameId === gameId &&
        link.state === 'ok' &&
        link.level === 'any' &&
        link.maxUses === null &&
        Date.parse(link.expiresAt) - now >= REUSE_MIN_LEFT_MS,
    ) ?? null
  );
}

/** What "Chia sẻ" makes: a link to the game's menu, asking for nothing more than the game does, for 30 days. */
export const gameLinkRequest = (gameId: string): MakeLinkRequest => ({ kind: 'game', gameId });

/** The address a share link is sent as: `/s/<code>` on this hub. */
export const shareUrl = (code: string, origin: string) => `${origin}/s/${code}`;

/** The choices of a link's expiry, in hours from now (the API takes 1 to 2160). */
export const EXPIRY_CHOICES = [1, 24, 24 * 7, 24 * 30, 24 * 90] as const;
