/** A few choices side by side, one pressed: whose board, which period. */
export function Segmented<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: { value: T; label: string }[];
  value: T;
  onChange(value: T): void;
}) {
  return (
    <fieldset
      className={`grid min-w-0 gap-1 rounded-2xl bg-soft p-1 ${options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}
    >
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`truncate rounded-xl px-2 py-2 font-bold ${option.value === value ? 'bg-surface text-ink shadow-sm' : 'text-ink-soft'}`}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}
