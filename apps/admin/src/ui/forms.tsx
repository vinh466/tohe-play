// Buttons, fields and messages for the console's few forms. Token colours only (ADR 0013).
import { type ButtonHTMLAttributes, type InputHTMLAttributes, useId } from 'react';
import { ApiError } from '../api/client.ts';

const variants = {
  primary: 'bg-brand text-on-brand hover:bg-brand-strong',
  secondary: 'bg-soft text-ink hover:bg-soft-strong',
  danger: 'bg-danger-soft text-danger',
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
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2 font-semibold disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  error,
  hint,
  mono = false,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | null;
  hint?: string;
  mono?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-semibold text-ink text-sm">
        {label}
      </label>
      <input
        id={id}
        {...input}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`rounded-xl border border-line-strong bg-surface px-3 py-2 text-ink ${mono ? 'font-mono text-xs sm:text-sm' : ''}`}
      />
      {hint ? <span className="text-ink-soft text-sm">{hint}</span> : null}
      {error ? (
        <span id={`${id}-error`} role="alert" className="text-danger text-sm">
          {error}
        </span>
      ) : null}
    </div>
  );
}

const reasons: Record<string, string> = {
  code_invalid: 'Mã không đúng.',
  code_used: 'Mã này vừa được dùng. Chờ ứng dụng hiện mã mới.',
  proof_required: 'Nhập mã trước đã.',
  locked_out: 'Sai quá nhiều lần. Thử lại sau 5 phút.',
  password_invalid: 'Mật khẩu không đúng.',
  attempt_closed: 'Mã đã hết hạn. Gửi mã mới nhé.',
  code_cooldown: 'Vừa gửi mã rồi. Chờ một phút.',
  too_many_codes: 'Đã gửi quá nhiều mã. Thử lại sau.',
  email_unavailable: 'Máy chủ không gửi email được.',
  setup_token_invalid: 'Mã cài đặt không đúng.',
  setup_email_not_allowed: 'Địa chỉ email này không được phép nhận quyền chủ.',
  setup_closed: 'Tò He đã có chủ.',
  email_required: 'Tài khoản cần có email đã xác nhận trước.',
  step_up_required: 'Cần xác nhận lại là bạn.',
  authenticator_not_set_up: 'Tạo khoá trước đã.',
};

/** What went wrong, in Vietnamese. */
export function problem(error: unknown): string {
  const reason = error instanceof ApiError ? error.reason : null;
  return (reason && reasons[reason]) ?? 'Có lỗi xảy ra, thử lại nhé.';
}
