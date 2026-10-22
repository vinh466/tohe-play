import { type InputHTMLAttributes, type ReactNode, useId } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
  /** The hint and the error change as the player types (what a code was read as): read out politely. */
  live?: boolean;
  /** A button on the field's row, at its right (a code's "Mở"): the row stays one line. */
  action?: ReactNode;
}

/** Labelled input with an optional hint and an error message linked for screen readers. */
export function TextField({
  label,
  hint,
  error,
  live = false,
  action,
  className = '',
  ...input
}: TextFieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="font-semibold text-ink">
        {label}
      </label>
      <div className="flex items-start gap-2">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...input}
          className="h-12 w-full min-w-0 rounded-2xl border-2 border-line bg-surface px-4 text-ink text-lg outline-none transition placeholder:text-ink-faint focus:border-focus aria-invalid:border-danger-line"
        />
        {action}
      </div>
      {error ? (
        <p id={`${id}-error`} aria-live={live ? 'polite' : undefined} className="text-danger text-sm">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} aria-live={live ? 'polite' : undefined} className="text-ink-soft text-sm">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
