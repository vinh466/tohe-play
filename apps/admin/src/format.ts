// How the console writes numbers, times and durations: Vietnamese, as the hub.

const counts = new Intl.NumberFormat('vi-VN');
const shares = new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 1 });
const decimals = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const dateTimes = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

export const count = (value: number) => counts.format(value);

export const dateTime = (iso: string) => dateTimes.format(new Date(iso));

/** A day of the telemetry roll-ups, `2026-10-18` → `18/10`, the way Vietnamese writes it. */
export const day = (isoDay: string) => `${isoDay.slice(8, 10)}/${isoDay.slice(5, 7)}`;

export const percent = (share: number) => shares.format(share);

export const milliseconds = (value: number) =>
  value >= 1000 ? `${decimals.format(value / 1000)} s` : `${counts.format(Math.round(value))} ms`;

/** How long ago, roughly: "vừa xong", "5 phút trước", "3 giờ trước", "2 ngày trước". */
export function ago(iso: string, now: Date = new Date()): string {
  const seconds = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'vừa xong';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} giờ trước`;
  return `${Math.floor(seconds / 86_400)} ngày trước`;
}

/** How long since, roughly: "12 phút", "5 giờ", "3 ngày". */
export function since(iso: string, now: Date = new Date()): string {
  const seconds = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))} phút`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} giờ`;
  return `${Math.floor(seconds / 86_400)} ngày`;
}

/** A profile's public ID as people read it, `123456789012` → `1234 5678 9012` (ADR 0023). */
export const publicId = (id: string) => id.replace(/(\d{4})(?=\d)/g, '$1 ');

/** A result's trust level (ADR 0029), as the console names it. */
export const levelName = (level: string) =>
  ({
    reported: 'Mới báo',
    checked: 'Đã kiểm',
    verified: 'Đã xác minh',
    held: 'Chờ xem xét',
    rejected: 'Bị từ chối',
  })[level] ?? level;

/** How a level stands out: held waits for a person, rejected counts nowhere. */
export const levelTone = (level: string): 'soft' | 'notice' | 'danger' =>
  level === 'held' ? 'notice' : level === 'rejected' ? 'danger' : 'soft';

/** Why a result stands where it does: a rule of the engine, or a person's decision (ADR 0029, 0030). */
export const reasonName = (reason: string) =>
  ({
    in_progress: 'Đang chơi dở',
    checked: 'Qua các luật',
    refereed: 'Máy chủ làm trọng tài',
    replayed: 'Máy chủ chơi lại, khớp điểm',
    imported: 'Có từ trước engine',
    personal_jump: 'Vượt xa kỷ lục của chính hồ sơ',
    rate: 'Nộp lượt nhanh hơn người chơi được',
    too_fast: 'Đi nước nhanh hơn người chơi được',
    replay_mismatch: 'Chơi lại ra điểm khác',
    illegal_move: 'Có nước đi sai luật',
    replay_failed: 'Module verify lỗi khi chơi lại',
    replay_unavailable: 'Không tải được module verify',
    unknown_game: 'Game không có trong danh mục',
    approved: 'Người duyệt',
    rejected: 'Người từ chối',
    reopened: 'Người mở lại',
  })[reason] ?? reason;

/** What a result's level rests on. */
export const evidenceName = (evidence: string) =>
  ({
    device: 'Chỉ có số của thiết bị',
    refereed: 'Máy chủ làm trọng tài',
    replayed: 'Máy chủ chơi lại, khớp điểm',
  })[evidence] ?? evidence;

const detailNames: Record<string, string> = {
  note: 'Ghi chú',
  previousBest: 'Kỷ lục trước',
  runs: 'Số lượt',
  minutes: 'Số phút',
  moves: 'Số nước',
  seconds: 'Số giây',
  needed: 'Cần ít nhất (giây)',
  claimed: 'Game báo',
  replayed: 'Chơi lại ra',
  error: 'Lỗi',
  attempts: 'Số lần thử',
  people: 'Số người',
};

/** What a rule saw, or a person's note, on one line: `Kỷ lục trước: 100 · Số lượt: 10`. */
export function decisionDetails(details: unknown): string | null {
  if (details === null || typeof details !== 'object' || Array.isArray(details)) return null;
  const parts = Object.entries(details).map(
    ([key, value]) =>
      `${detailNames[key] ?? key}: ${typeof value === 'number' ? count(value) : String(value)}`,
  );
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** The platform roles in Vietnamese (ADR 0027). */
export const roleName = (role: string) =>
  ({ owner: 'Chủ', admin: 'Quản trị viên', moderator: 'Kiểm duyệt viên', viewer: 'Người xem' })[role] ?? role;
