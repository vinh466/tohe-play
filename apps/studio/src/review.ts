// What a reviewer may do, and when, in the Studio's app (ADR 0051, docs/architecture/asset-studio.md, Reviewing in the
// app). Pure, so the rules are tested without a browser. The API decides every action; this only hides what a session
// may not do and holds the reviewer back from what the API would surely refuse.
import type { Asset, Pack, PackVersion, StudioMe, Style } from './api/client.ts';

/** The permission that opens reviewing: approving, rejecting and deprecating, behind step-up. */
export const REVIEW_PERMISSION = 'studio.review';

/** A session that may review: what the API calls `studio.review`. */
export const mayReview = (me: Pick<StudioMe, 'permissions'>) => me.permissions.includes(REVIEW_PERMISSION);

/**
 * A session that may be shown Withdraw. The API withdraws for the platform's owner alone (`403 owner_required`), but
 * the Studio's session does not say who the owner is, so every reviewer sees it and the API refuses anyone else.
 */
export const mayWithdraw = (me: Pick<StudioMe, 'permissions'>) => mayReview(me);

/** Step-up is open in this Studio session now: the review actions may be sent. */
export function stepUpOpen(me: Pick<StudioMe, 'secureUntil'>, now: number = Date.now()): boolean {
  return me.secureUntil !== null && Date.parse(me.secureUntil) > now;
}

/** What a reviewer looks for that a machine cannot (ADR 0051, Checks and review). Every line ticked before approving. */
export const REVIEW_CHECKLIST = [
  {
    id: 'children',
    label: 'Hợp với trẻ em',
    hint: 'Không máu me, không có gì đáng sợ, không chữ, không logo, không giống người thật.',
  },
  {
    id: 'original',
    label: 'Không gần như chép lại',
    hint: 'Không na ná một nhân vật hay một game đã có.',
  },
  { id: 'style', label: 'Đúng phong cách', hint: 'So với hình mẫu và bảng màu của phong cách bên cạnh.' },
  {
    id: 'readable',
    label: 'Nhìn rõ ở kích thước thật',
    hint: 'Ở 1× và 2×, trên nền sáng và nền tối.',
  },
  { id: 'source', label: 'Nguồn đáng tin', hint: 'Nguồn và giấy phép của từng tài nguyên hợp lý.' },
] as const;

export type ChecklistItem = (typeof REVIEW_CHECKLIST)[number]['id'];

/** Every line of the checklist ticked. */
export const checklistDone = (ticked: ReadonlySet<string>) =>
  REVIEW_CHECKLIST.every((item) => ticked.has(item.id));

/** The licence a reviewer allows case by case, with a reason (docs/architecture/asset-studio.md, Licences). */
export const SHARE_ALIKE = 'CC-BY-SA-4.0';

export const needsShareAlike = (assets: readonly Pick<Asset, 'licence'>[]) =>
  assets.some((asset) => asset.licence === SHARE_ALIKE);

/** At most this many characters in a review's reason, as the API keeps. */
export const MAX_REASON = 1000;

/** A reason the API takes: not blank, not too long. */
export const reasonGiven = (reason: string) => reason.trim().length > 0 && reason.trim().length <= MAX_REASON;

/**
 * Approve may be pressed: the checklist done and, for a version with a CC-BY-SA-4.0 asset, share-alike allowed with a
 * reason — without it the API's checks refuse the licence, so such a version is approved with it or rejected.
 */
export function approveReady(state: {
  ticked: ReadonlySet<string>;
  shareAlikeNeeded: boolean;
  allowShareAlike: boolean;
  shareAlikeReason: string;
}): boolean {
  if (!checklistDone(state.ticked)) return false;
  if (!state.shareAlikeNeeded) return true;
  return state.allowShareAlike && reasonGiven(state.shareAlikeReason);
}

export interface VersionActions {
  approve: boolean;
  reject: boolean;
  deprecate: boolean;
  withdraw: boolean;
}

/** What a session may do to a version in its status: the API's rules of a version's life. */
export function versionActions(me: Pick<StudioMe, 'permissions'>, status: string): VersionActions {
  const review = mayReview(me);
  const published = status === 'approved' || status === 'deprecated';
  return {
    approve: review && status === 'submitted',
    reject: review && status === 'submitted',
    deprecate: review && status === 'approved',
    withdraw: mayWithdraw(me) && published,
  };
}

/** A style a reviewer may approve or reject: a draft. */
export const styleReviewable = (me: Pick<StudioMe, 'permissions'>, style: Pick<Style, 'status'>) =>
  mayReview(me) && style.status === 'draft';

/** Every sample of a style uploaded: what approving a style needs. */
export const samplesUploaded = (style: Pick<Style, 'samples'>) =>
  style.samples.every((sample) => sample.uploaded);

export type QueueItem =
  | { kind: 'version'; packId: string; versionId: string; version: string; since: string }
  | { kind: 'style'; styleId: string; name: string; since: string };

/**
 * What waits for a reviewer, oldest first: every submitted version, since it was submitted, and every draft style,
 * since it last changed.
 */
export function reviewQueue(
  packs: readonly Pick<Pack, 'id' | 'versions'>[],
  styles: readonly Pick<Style, 'id' | 'name' | 'status' | 'updatedAt'>[],
): QueueItem[] {
  const versions: QueueItem[] = packs.flatMap((pack) =>
    pack.versions
      .filter((version) => version.status === 'submitted')
      .map((version) => ({
        kind: 'version' as const,
        packId: pack.id,
        versionId: version.id,
        version: version.version,
        since: version.submittedAt ?? version.createdAt,
      })),
  );
  const drafts: QueueItem[] = styles
    .filter((style) => style.status === 'draft')
    .map((style) => ({
      kind: 'style' as const,
      styleId: style.id,
      name: style.name,
      since: style.updatedAt,
    }));
  return [...versions, ...drafts].sort((a, b) => Date.parse(a.since) - Date.parse(b.since));
}

/** A version's place in the library, for the confirmation of a withdrawal: `farm-crops@1.2.0`. */
export const versionName = (version: Pick<PackVersion, 'packId' | 'version'>) =>
  `${version.packId}@${version.version}`;

export interface Grid {
  /** One cell's size in the file's pixels. */
  width: number;
  height: number;
  columns: number;
  rows: number;
}

/**
 * The grid a picture is cut in: a sprite sheet's or a tileset's `frames`, or else, for a tileset, the style's tile.
 * None for a plain picture, a size not known yet, or a cell larger than the picture.
 */
export function pictureGrid(
  asset: Pick<Asset, 'kind' | 'width' | 'height' | 'frames'>,
  tileSize: number | null,
): Grid | null {
  if (asset.width === null || asset.height === null) return null;
  const cell =
    asset.frames ??
    (asset.kind === 'tileset' && tileSize !== null ? { width: tileSize, height: tileSize } : null);
  if (cell === null || cell.width <= 0 || cell.height <= 0) return null;
  if (asset.kind !== 'spritesheet' && asset.kind !== 'tileset') return null;
  const columns = Math.floor(asset.width / cell.width);
  const rows = Math.floor(asset.height / cell.height);
  if (columns === 0 || rows === 0) return null;
  return { width: cell.width, height: cell.height, columns, rows };
}

/** The frames of a sprite sheet, left to right then top to bottom: where each starts in the file. */
export function frameOrigins(grid: Grid, count: number): { x: number; y: number }[] {
  const total = Math.min(count, grid.columns * grid.rows);
  return Array.from({ length: Math.max(total, 0) }, (_, index) => ({
    x: (index % grid.columns) * grid.width,
    y: Math.floor(index / grid.columns) * grid.height,
  }));
}
