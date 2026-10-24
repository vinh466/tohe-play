// How the Studio writes names, sizes and times: Vietnamese, as the hub and the console. A code it does not know is
// shown as it is, so a status or kind added later reads as itself rather than as nothing.

const counts = new Intl.NumberFormat('vi-VN');
const decimals = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const dateTimes = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

export const count = (value: number) => counts.format(value);

export const dateTime = (iso: string) => dateTimes.format(new Date(iso));

/** A file's size: "512 B", "3,4 KB", "1,2 MB" (1024 to a step). */
export function bytes(value: number): string {
  if (value < 1024) return `${counts.format(value)} B`;
  if (value < 1024 * 1024) return `${decimals.format(value / 1024)} KB`;
  return `${decimals.format(value / (1024 * 1024))} MB`;
}

const roles: Record<string, string> = { contributor: 'Người đóng góp', reviewer: 'Người duyệt' };

/** A studio role (ADR 0051): not a platform role. */
export const roleName = (role: string) => roles[role] ?? role;

const versionStatuses: Record<string, string> = {
  draft: 'Bản nháp',
  submitted: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Bị từ chối',
  deprecated: 'Không nên dùng nữa',
  withdrawn: 'Đã rút',
};

/** A pack version's place in its life (docs/architecture/asset-studio.md, Packs). */
export const versionStatusName = (status: string) => versionStatuses[status] ?? status;

const styleStatuses: Record<string, string> = {
  draft: 'Bản nháp',
  approved: 'Đã duyệt',
  rejected: 'Bị từ chối',
};

export const styleStatusName = (status: string) => styleStatuses[status] ?? status;

export type Tone = 'soft' | 'brand' | 'notice' | 'danger';

const statusTones: Record<string, Tone> = {
  submitted: 'notice',
  approved: 'brand',
  rejected: 'danger',
  deprecated: 'notice',
  withdrawn: 'danger',
};

/** How a status looks: waiting for a reviewer stands out, a refusal reads as one, a draft stays quiet. */
export const statusTone = (status: string): Tone => statusTones[status] ?? 'soft';

const kinds: Record<string, string> = {
  image: 'Hình',
  spritesheet: 'Sprite sheet',
  tileset: 'Bộ ô (tileset)',
  audio: 'Âm thanh',
  font: 'Phông chữ',
  palette: 'Bảng màu',
};

export const kindName = (kind: string) => kinds[kind] ?? kind;

/** The kinds a browser draws as a picture. */
export const isPicture = (kind: string) => kind === 'image' || kind === 'spritesheet' || kind === 'tileset';

const views: Record<string, string> = {
  'top-down': 'Nhìn từ trên xuống',
  side: 'Nhìn ngang',
  isometric: 'Isometric',
  other: 'Khác',
};

export const viewName = (view: string) => views[view] ?? view;

/** Who made a style, a pack or a version: an agent or an account, by the start of its id. */
export function creatorName(creator: { kind: string; id: string }): string {
  const who = creator.kind === 'agent' ? 'Agent' : creator.kind === 'account' ? 'Tài khoản' : creator.kind;
  return `${who} ${creator.id.slice(0, 8)}`;
}

const sourceTypes: Record<string, string> = {
  pack: 'Lấy từ một gói có sẵn',
  upload: 'Tải lên',
  ai: 'Tạo bằng AI',
  code: 'Vẽ bằng mã',
};

const sourceFields: Record<string, string> = {
  name: 'Tên gói',
  url: 'Địa chỉ',
  author: 'Tác giả',
  by: 'Người tải lên',
  vendor: 'Nhà cung cấp',
  model: 'Mô hình',
  prompt: 'Câu lệnh',
  seed: 'Seed',
  date: 'Ngày',
  script: 'Kịch bản vẽ',
};

/** An address a link may lead to: http or https, nothing else (never `javascript:`). */
export function webAddress(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export interface SourceLine {
  label: string;
  value: string;
  /** For the source's `url`, when it is a web address: where its link leads. */
  href?: string;
}

/**
 * An asset's source (a JSON object with its `type`, docs/architecture/asset-studio.md) as lines to show: what kind of
 * source first, then each field it has, named in Vietnamese where the Studio knows the field; its `url` a link.
 */
export function sourceLines(source: unknown): SourceLine[] {
  if (typeof source !== 'object' || source === null || Array.isArray(source)) return [];
  const { type, ...fields } = source as Record<string, unknown>;
  const lines: SourceLine[] = [];
  if (typeof type === 'string') lines.push({ label: 'Nguồn', value: sourceTypes[type] ?? type });
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined || value === '') continue;
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    const href = key === 'url' && typeof value === 'string' ? webAddress(value) : undefined;
    lines.push({ label: sourceFields[key] ?? key, value: text, ...(href ? { href } : {}) });
  }
  return lines;
}

/**
 * Where the sign-in sends a person back to: a page of this host only — a path from its root, never `//elsewhere` nor
 * `/\elsewhere`, which browsers read as another host — and never the sign-in itself.
 */
export function safeRedirect(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
    return undefined;
  }
  if (raw === '/sign-in' || raw.startsWith('/sign-in?') || raw.startsWith('/sign-in#')) return undefined;
  return raw;
}
