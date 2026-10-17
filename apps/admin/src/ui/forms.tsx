// Buttons, fields and messages for the console's few forms. Token colours only (ADR 0013).
import { type ButtonHTMLAttributes, type InputHTMLAttributes, useId } from 'react';
import { ApiError } from '../api/client.ts';

const variants = {
  // brand-strong, not brand: these buttons carry body-size text, and on-brand meets AA only on brand-strong.
  primary: 'bg-brand-strong text-on-brand',
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
  admin_self: 'Không làm việc này trên tài khoản của chính bạn ở đây.',
  admin_rank: 'Tài khoản này có vai trò ngang hoặc cao hơn bạn.',
  admin_required: 'Vai trò của bạn không làm được việc này.',
  last_owner: 'Tò He cần ít nhất một chủ.',
  reason_required: 'Ghi lý do để các quản trị viên khác hiểu.',
  reason_too_long: 'Lý do dài quá 300 ký tự.',
  role_invalid: 'Vai trò không hợp lệ.',
  name_required: 'Tên không được để trống.',
  name_too_long: 'Tên dài quá 24 ký tự.',
  name_reserved: 'Tên này dành cho Tò He.',
  name_invalid_character: 'Tên có ký tự không dùng được.',
  settings_last_method: 'Phải còn ít nhất một cách đăng nhập.',
  settings_lockout_self:
    'Tắt thì chính bạn không còn cách nào đăng nhập. Thêm một cách khác cho tài khoản của bạn ở Tò He trước.',
  method_unknown: 'Máy chủ chưa cấu hình cách đăng nhập này.',
  registration_invalid: 'Chế độ đăng ký không hợp lệ.',
  community_exists: 'Đã có cộng đồng tên này.',
  invite_code_exists: 'Đã có mã này.',
  invite_code_invalid: 'Mã gồm 4–32 ký tự: chữ không dấu, số, dấu gạch ngang.',
  max_uses_invalid: 'Số lượt phải từ 1 trở lên.',
  expires_in_past: 'Ngày hết hạn phải ở phía trước.',
};

/** What went wrong, in Vietnamese; `own` words a code for the form at hand, e.g. a limit of its own. */
export function problem(error: unknown, own: Record<string, string> = {}): string {
  const reason = error instanceof ApiError ? error.reason : null;
  return (reason && (own[reason] ?? reasons[reason])) ?? 'Có lỗi xảy ra, thử lại nhé.';
}
