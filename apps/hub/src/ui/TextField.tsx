import { type InputHTMLAttributes, useId } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

/** Labelled input with an optional hint and an error message linked for screen readers. */
export function TextField({ label, hint, error, className = '', ...input }: TextFieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="font-semibold text-orange-950">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...input}
        className="h-12 w-full min-w-0 rounded-2xl border-2 border-orange-200 bg-white px-4 text-lg text-orange-950 outline-none transition placeholder:text-orange-300 focus:border-orange-500 aria-invalid:border-red-400"
      />
      {error ? (
        <p id={`${id}-error`} className="text-red-700 text-sm">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-orange-900/60 text-sm">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
