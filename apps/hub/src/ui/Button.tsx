import type { ButtonHTMLAttributes } from 'react';

const variants = {
  primary: 'bg-brand text-on-brand shadow-[3px_3px_0_var(--tohe-line-ink)] active:bg-brand-strong',
  secondary: 'bg-soft text-accent active:bg-soft-strong',
  ghost: 'bg-transparent text-accent active:bg-soft',
  danger: 'bg-danger-soft text-danger active:bg-danger-soft-strong',
};

/** The look of a button, for a link that acts as one — a full navigation, such as to a sign-in provider. */
export const buttonClass = (variant: keyof typeof variants = 'primary') =>
  `inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 font-bold text-xl transition active:scale-[0.97] disabled:opacity-50 ${variants[variant]}`;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  busy?: boolean;
}

/**
 * Large, rounded, finger-friendly button (min 48 px high). Labels are 1.25rem bold: white on brand only reaches
 * WCAG AA as large text (tokens.css).
 */
export function Button({
  variant = 'primary',
  busy = false,
  className = '',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`${buttonClass(variant)} ${className}`}
    >
      {busy ? (
        <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
}
