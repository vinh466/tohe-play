// The transfer code (ADR 0043, step I2b): a device profile on the server moves to another device with its id, saves
// and scores — at once with the secret its QR code carries, or with six digits the old device confirms. The old device
// hears it moved, and keeps what was played there since as a new device profile.
// docs/architecture/identity.md#the-transfer-code
import {
  ApiError,
  type DeviceProfileData,
  type DeviceProfileView,
  type ProfileMoveView,
  type ProofOfWorkSolution,
  type TransferCodeView,
  type TransferRedemption,
  type TransferStatusView,
  type TransferView,
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
  /** The transfers this device redeemed, newest first, while their answer is kept. */
  list(): Promise<TransferView[]>;
}

/** Sends a request with a solved proof-of-work when the server asks for one (session/proofOfWork.ts). */
export type Prove = <T>(send: (proof: ProofOfWorkSolution | null) => Promise<T>) => Promise<T>;

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

/**
 * The six digits, or the transfer link pasted whole (the old device's "Chép link"): what the receive field takes. An
 * installed iPhone app cannot open the QR code's link, so the link pasted there is its way in.
 */
export function readTyped(typed: string, origin: string): { code: string } | { secret: string } | null {
  const code = cleanCode(typed);
  if (code) return { code };
  const secret = secretFromScan(typed, origin);
  return secret ? { secret } : null;
}

/** What one code may carry (the API's `TransferCodes.MaxDataBytes`, 1 MB), with room for how the API writes it. */
export const MAX_TRANSFER_BYTES = 950_000;

const size = (data: DeviceProfileData) => new TextEncoder().encode(JSON.stringify(data)).length;

/**
 * What fits in one code: the oldest saves first, then the lowest scores, stay behind until it fits. What stays is not
 * marked as sent, so the old device keeps it should the profile move (nothing is lost).
 */
export function fitTransfer(data: DeviceProfileData, max = MAX_TRANSFER_BYTES): DeviceProfileData {
  const saves = [...(data.saves ?? [])];
  const scores = [...(data.scores ?? [])];
  while (size({ saves, scores }) > max && (saves.length > 0 || scores.length > 0)) {
    if (saves.length > 0) saves.pop();
    else scores.pop();
  }
  return { saves, scores };
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
  const data = fitTransfer(await deviceProfileData(db, id));
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

/**
 * A redemption this device started and has not settled — kept in IndexedDB before the request goes and after its
 * answer, so neither a lost answer nor a closed app loses a profile on its way here. Kept as long as the API keeps the
 * transfer's answer: its code's ten minutes and ten more.
 */
export interface PendingTransfer {
  /** The QR code's secret: redeemed again by this device, it gives the same answer. */
  secret?: string;
  /** The transfer the answer named. */
  transferId?: string;
  until: number;
}

const PENDING = 'transfer:pending';

/** How long a pending redemption is kept: the API's `TransferCodes.Lifetime` and `Grace`. */
export const PENDING_MS = 20 * 60_000;

export const pendingTransfer = {
  async get(db: ToheDb): Promise<PendingTransfer | null> {
    const entry = await db.cache.get(PENDING);
    const pending = entry?.value as PendingTransfer | undefined;
    if (pending && pending.until > Date.now()) return pending;
    if (entry) await db.cache.delete(PENDING);
    return null;
  },
  set: (db: ToheDb, pending: PendingTransfer) =>
    db.cache.put({ key: PENDING, value: pending, at: Date.now() }),
  clear: (db: ToheDb) => db.cache.delete(PENDING),
};

/**
 * Takes in an answer: done, the profile is this device's (and nothing is pending); asked, the transfer's id is kept to
 * ask again; declined, full or expired, nothing is pending any more. Returns the profile when it arrived.
 */
export async function settleAnswer(db: ToheDb, view: TransferView): Promise<DeviceProfileView | null> {
  if (view.state === 'asked') {
    const pending = await pendingTransfer.get(db);
    await pendingTransfer.set(db, {
      ...pending,
      transferId: view.id,
      until: pending?.until ?? Date.now() + PENDING_MS,
    });
    return null;
  }
  const received = await receive(db, view);
  await pendingTransfer.clear(db);
  return received;
}

/** Redeems a secret or six digits on this device, remembered first, settled when the answer comes. */
export async function redeemTransfer(
  db: ToheDb,
  api: TransferApi,
  body: { secret: string } | { code: string },
  prove: Prove,
): Promise<TransferView> {
  await pendingTransfer.set(db, {
    ...('secret' in body ? { secret: body.secret } : {}),
    until: Date.now() + PENDING_MS,
  });
  const view = await prove((proof) => api.redeem({ ...body, proof: proof ?? null }));
  await settleAnswer(db, view);
  return view;
}

/**
 * Carries on with what this device was redeeming when the hub opens, or the receive page: the transfer it named, or —
 * its answer lost — this device's transfers, or the secret again. A network error leaves it pending for next time.
 * Returns the answer to show, or null when nothing was pending (or it ended).
 */
export async function resumeTransfer(
  db: ToheDb,
  api: TransferApi,
  prove: Prove,
): Promise<TransferView | null> {
  const pending = await pendingTransfer.get(db);
  if (!pending) return null;
  try {
    let view: TransferView | undefined;
    if (pending.transferId) view = await api.get(pending.transferId);
    else {
      const mine = await api.list();
      for (const done of mine.filter((transfer) => transfer.state === 'done')) await receive(db, done);
      view = mine.find((transfer) => transfer.state === 'asked') ?? mine[0];
      if (!view && pending.secret)
        view = await prove((proof) => api.redeem({ secret: pending.secret, proof: proof ?? null }));
    }
    if (!view) {
      await pendingTransfer.clear(db);
      return null;
    }
    await settleAnswer(db, view);
    return view;
  } catch (error) {
    // The transfer, or the code, is gone: nothing to wait for. Anything else — the network — waits for next time.
    if (error instanceof ApiError && error.status === 404) {
      await pendingTransfer.clear(db);
      return null;
    }
    throw error;
  }
}

/**
 * What the device says on opening: a profile moved away (its name, and whether what was played since was kept), or a
 * profile that arrived from another device (`received`).
 */
export interface MovedNotice {
  name: string;
  kept: boolean;
  received?: boolean;
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
        all.findIndex(
          (other) =>
            other.name === notice.name && other.kept === notice.kept && other.received === notice.received,
        ) === index,
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
