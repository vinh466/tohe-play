// The adult's place (ADR 0046): links out of Tò He — the docs, GitHub, mail, any other origin — live only in Tôi, and on
// an account's child profile following one asks for the account's manage PIN (docs/architecture/identity.md). A device
// with only device profiles has no PIN, so nothing asks there. Pure functions here; OutboundLink.tsx asks.
import type { SessionState } from '../session/session.ts';
import { parentUnlocked } from '../session/session.ts';

/** Whether `href` leaves Tò He: another origin, or another scheme (mail, telephone). The public pages do not. */
export function leavesTohe(href: string, origin: string): boolean {
  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return true;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return true;
  return url.origin !== origin;
}

/**
 * Whether following a link out of Tò He asks for the manage PIN first: on an account's child profile, unless the
 * account's management is open on this device already (the PIN typed within the last minutes).
 */
export function outboundNeedsPin(session: SessionState | { status: 'loading' }, now = new Date()): boolean {
  if (session.status !== 'account') return false;
  if (session.player?.kind !== 'child') return false;
  return !parentUnlocked(session.me, now);
}
