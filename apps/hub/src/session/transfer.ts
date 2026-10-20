// The transfer code (ADR 0043, step I2b): a device profile on the server moves to another device with its id, saves
// and scores — at once with the secret its QR code carries, or with six digits the old device confirms. The old device
// hears it moved, and keeps what was played there since as a new device profile.
// docs/architecture/identity.md#the-transfer-code
import type {
  DeviceProfileData,
  DeviceProfileView,
  ProfileMoveView,
  TransferCodeView,
  TransferRedemption,
  TransferStatusView,
  TransferView,
} from '../api/client.ts';
import type { ToheDb } from '../storage/db.ts';
import { deviceProfileData, markSent, movedAway, receiveDeviceProfile } from '../storage/deviceProfiles.ts';

/** The requests a transfer needs; injected so the logic is testable without a server. */
export interface TransferApi {
  start(id: string, body: { termsVersion: string; data: DeviceProfileData }): Promise<TransferCodeView>;
  status(id: string): Promise<TransferStatusView>;
  confirm(id: string, accept: boolean): Promise<unknown>;
  cancel(id: string): Promise<unknown>;
  redeem(body: TransferRedemption): Promise<TransferView>;
  get(id: string): Promise<TransferView>;
}

/** The hub's page that redeems a secret: the QR code and the link carry it after `#`, so no server logs it. */
export const TRANSFER_PATH = '/account/transfer';

/** How often both devices ask while one waits for the other. */
export const POLL_MS = 2000;

/** The link the QR code carries: opened on the new device, it redeems the secret. */
export function transferLink(origin: string, secret: string): string {
  return `${origin}${TRANSFER_PATH}#${secret}`;
}

/** A secret, as the API makes them: 32 bytes in base64url. */
const SECRET = /^[A-Za-z0-9_-]{43}$/;

/** The secret a link's `#` carries, or null. */
export function secretFromHash(hash: string): string | null {
  const secret = hash.replace(/^#/, '');
  return SECRET.test(secret) ? secret : null;
}

/** The secret a scanned QR code carries — a transfer link of this hub — or null. */
export function secretFromScan(text: string, origin: string): string | null {
  try {
    const url = new URL(text.trim());
    return url.origin === origin && url.pathname === TRANSFER_PATH ? secretFromHash(url.hash) : null;
  } catch {
    return null;
  }
}

/** Six digits as typed — spaces and dashes ignored — or null. */
export function cleanCode(typed: string): string | null {
  const digits = typed.replace(/[\s-]/g, '');
  return /^[0-9]{6}$/.test(digits) ? digits : null;
}

/** The six digits as shown: two groups of three, easy to read out. */
export function showCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

/** Whole seconds left until `expiresAt`, never below zero. */
export function secondsLeft(expiresAt: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
}

/** m:ss, for the countdown. */
export function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * The old device makes a code for its device profile, which has a copy on the server and the terms accepted: its saves
 * and scores go with it, and count as sent from now on — what is played after stays here should it move.
 */
export async function startTransfer(
  db: ToheDb,
  api: TransferApi,
  id: string,
  terms: string,
): Promise<TransferCodeView> {
  const data = await deviceProfileData(db, id);
  const code = await api.start(id, { termsVersion: terms, data });
  await markSent(db, id, data);
  return code;
}

/** A transfer the new device redeemed and that is done: the profile is this device's now, with its data. */
export async function receive(db: ToheDb, transfer: TransferView): Promise<DeviceProfileView | null> {
  if (transfer.state !== 'done' || !transfer.profile) return null;
  await receiveDeviceProfile(db, transfer.profile, transfer.data ?? {});
  return transfer.profile;
}

/** What the old device says once a profile moved away: its name, and whether what was played since was kept. */
export interface MovedNotice {
  name: string;
  kept: boolean;
}

/**
 * The profiles that moved away from this device (`GET /api/devices/moves`, or a `410 device_profile_moved`): each one
 * still here leaves, keeping what was played since as a new device profile. Returns what to tell the player.
 */
export async function settleMoves(
  db: ToheDb,
  moves: Pick<ProfileMoveView, 'profileId'>[],
): Promise<MovedNotice[]> {
  const notices: MovedNotice[] = [];
  for (const move of moves) {
    const outcome = await movedAway(db, move.profileId);
    if (outcome) notices.push({ name: outcome.name, kept: outcome.kept !== null });
  }
  return notices;
}

/**
 * Asked when the hub opens: only a device with a copy on the server can have had one move away, so a device that never
 * reached the server asks nothing (ADR 0043, lazily).
 */
export async function checkMoves(db: ToheDb, list: () => Promise<ProfileMoveView[]>): Promise<MovedNotice[]> {
  const onServer = await db.profiles.filter((profile) => profile.server !== undefined).count();
  if (onServer === 0) return [];
  return settleMoves(db, await list());
}

const NOTICES = 'tohe:moved';

const listeners = new Set<() => void>();

/** Notices kept until a screen shows them: the move is heard on one page, told on the next. */
export const movedNotices = {
  add(notices: MovedNotice[]) {
    if (notices.length === 0) return;
    // One line per name and outcome: the same move heard twice is told once.
    const all = [...movedNotices.parse(movedNotices.raw()), ...notices];
    const once = all.filter(
      (notice, index) =>
        all.findIndex((other) => other.name === notice.name && other.kept === notice.kept) === index,
    );
    localStorage.setItem(NOTICES, JSON.stringify(once));
    for (const listener of listeners) listener();
  },
  /** The stored text: a stable snapshot for useSyncExternalStore. */
  raw: (): string | null => localStorage.getItem(NOTICES),
  parse(raw: string | null): MovedNotice[] {
    try {
      const parsed = JSON.parse(raw ?? '[]') as unknown;
      return Array.isArray(parsed) ? (parsed as MovedNotice[]) : [];
    } catch {
      return [];
    }
  },
  clear() {
    localStorage.removeItem(NOTICES);
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
};
