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

/** The platform roles in Vietnamese (ADR 0027). */
export const roleName = (role: string) =>
  ({ owner: 'Chủ', admin: 'Quản trị viên', moderator: 'Kiểm duyệt viên', viewer: 'Người xem' })[role] ?? role;
