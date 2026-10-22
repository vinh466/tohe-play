import { type IconName, iconShapes } from './iconShapes.ts';

/**
 * An icon of the hub's one set (Phosphor, `iconShapes.ts`): an SVG that takes the text's colour and size (`1em`, so
 * `text-xl` on it or on its parent sizes it). It is a decoration beside a visible label, so it is hidden from screen
 * readers; a control that has only an icon would break the voice-and-look rule "every icon has a label"
 * (docs/conventions/voice-and-look.md), and none is made here.
 */
export function Icon({
  name,
  weight = 'regular',
  className = '',
}: {
  name: IconName;
  /** `fill` for the one that is on or selected (the tab shown), `regular` otherwise. */
  weight?: 'regular' | 'fill';
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 256 256"
      fill="currentColor"
      className={`inline-block size-[1em] shrink-0 ${className}`}
    >
      <path d={iconShapes[name][weight]} />
    </svg>
  );
}
