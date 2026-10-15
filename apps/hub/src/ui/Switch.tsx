/** An on/off switch with its label, large enough for a finger; the whole row toggles. */
export function Switch({
  label,
  hint,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange(checked: boolean): void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-4 rounded-2xl bg-fill p-4 text-left transition active:scale-[0.99] disabled:opacity-60"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-bold text-ink">{label}</span>
        {hint ? <span className="text-ink-soft text-sm">{hint}</span> : null}
      </span>
      <span
        aria-hidden
        className={`relative h-8 w-14 shrink-0 rounded-full transition ${checked ? 'bg-brand' : 'bg-line-strong'}`}
      >
        <span
          className={`absolute top-1 size-6 rounded-full bg-surface shadow transition-all ${checked ? 'left-7' : 'left-1'}`}
        />
      </span>
    </button>
  );
}
