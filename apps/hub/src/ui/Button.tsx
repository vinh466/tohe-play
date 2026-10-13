import type { ButtonHTMLAttributes } from 'react';

const variants = {
  primary: 'bg-orange-500 text-white shadow-sm shadow-orange-300 active:bg-orange-600',
  secondary: 'bg-orange-100 text-orange-800 active:bg-orange-200',
  ghost: 'bg-transparent text-orange-800 active:bg-orange-100',
  danger: 'bg-red-50 text-red-700 active:bg-red-100',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  busy?: boolean;
}

/** Large, rounded, finger-friendly button (min 48 px high). */
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
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 font-bold text-lg transition active:scale-[0.97] disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {busy ? (
        <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
}
