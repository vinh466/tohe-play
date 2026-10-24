// Buttons, fields and messages for the Studio's few forms. Token colours only (ADR 0013).
import { type ButtonHTMLAttributes, type InputHTMLAttributes, useId } from 'react';
import { ApiError } from '../api/client.ts';

const variants = {
  // brand-strong, not brand: these buttons carry body-size text, and on-brand meets AA only on brand-strong.
  primary: 'bg-brand-strong text-on-brand',
  secondary: 'bg-soft text-ink hover:bg-soft-strong',
};

export function Button({
  variant = 'primary',
  busy = false,
  className = '',
  disabled,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants; busy?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 font-semibold disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  error,
  hint,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | null;
  hint?: string;
}) {
  const id = useId();
  const described = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ');
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-semibold text-ink text-sm">
        {label}
      </label>
      <input
        id={id}
        {...input}
        aria-invalid={error ? true : undefined}
        aria-describedby={described || undefined}
        className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-ink"
      />
      {hint ? (
        <span id={`${id}-hint`} className="text-ink-soft text-sm">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-error`} role="alert" className="text-danger text-sm">
          {error}
        </span>
      ) : null}
    </div>
  );
}

const reasons: Record<string, string> = {
  invalid_credentials: 'Email, mật khẩu hoặc mã không đúng.',
  account_suspended: 'Tài khoản này đang bị tạm khoá.',
  account_deleting: 'Tài khoản này đang chờ xoá. Đăng nhập Tò He để giữ lại, rồi quay lại đây.',
  locked_out: 'Sai quá nhiều lần. Thử lại sau 5 phút.',
  code_invalid: 'Mã không đúng.',
  code_used: 'Mã này vừa được dùng. Chờ ứng dụng hiện mã mới.',
  studio_required: 'Vai trò của bạn ở Studio không làm được việc này.',
  studio_storage_not_configured: 'Thư viện chưa có kho lưu trữ: người vận hành cần cấu hình nó trước.',
  pack_not_found: 'Không có gói này.',
  version_not_found: 'Không có phiên bản này.',
  style_not_found: 'Không có phong cách này.',
};

/** What went wrong, in Vietnamese; `own` words a code for the page at hand. */
export function problem(error: unknown, own: Record<string, string> = {}): string {
  const reason = error instanceof ApiError ? error.reason : null;
  if (reason === null && error instanceof ApiError && error.status === 429)
    return reasons.locked_out as string;
  return (reason && (own[reason] ?? reasons[reason])) ?? 'Có lỗi xảy ra, thử lại nhé.';
}
