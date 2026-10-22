/**
 * A place on a board: its number in a round badge, the top three tinted. No medal emoji (docs/conventions/voice-and-look.md):
 * the number is what says the place, and it is read as one.
 */
export function Rank({ place }: { place: number }) {
  return (
    <span
      className={`grid size-9 shrink-0 place-items-center rounded-full font-black text-lg tabular-nums ${
        place <= 3 ? 'bg-soft-strong text-accent' : 'text-ink-soft'
      }`}
    >
      {place}
    </span>
  );
}
