interface AvatarGridProps {
  avatars: readonly string[];
  value: string;
  onChange(avatar: string): void;
  label: string;
}

/** Pick one emoji avatar. */
export function AvatarGrid({ avatars, value, onChange, label }: AvatarGridProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 font-semibold text-orange-950">{label}</legend>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {avatars.map((avatar) => (
          <button
            key={avatar}
            type="button"
            aria-pressed={avatar === value}
            onClick={() => onChange(avatar)}
            className={`grid aspect-square place-items-center rounded-2xl text-4xl transition active:scale-95 ${
              avatar === value ? 'bg-orange-200 ring-4 ring-orange-500' : 'bg-white'
            }`}
          >
            {avatar}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** The big round avatar used on profile cards and chips. */
export function Avatar({ avatar, size = 'lg' }: { avatar: string; size?: 'sm' | 'lg' }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full bg-linear-to-b from-amber-100 to-orange-200 ${
        size === 'lg' ? 'size-24 text-6xl' : 'size-9 text-2xl'
      }`}
    >
      {avatar}
    </span>
  );
}
