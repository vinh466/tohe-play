import { useTranslation } from 'react-i18next';

/**
 * "Xoay dọc máy để chơi": the layer over a portrait game while a phone is held sideways on a short screen
 * (frame/short.ts, ADR 0046). Calm: the page colour, a drawing of a phone turning upright, one line. It is always in
 * the tree of a portrait game and shown by CSS alone (`turn:`) — touch screens only, height under 500 px, landscape — so
 * it goes the moment the phone turns back, and a tablet or a computer never sees it. The game keeps running underneath;
 * nothing is paused or locked. Colours are the design tokens.
 */
export function RotateHint() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="absolute inset-0 z-10 hidden flex-col items-center justify-center gap-3 bg-page px-6 text-center text-ink turn:flex"
    >
      <svg
        viewBox="0 0 96 96"
        aria-hidden="true"
        className="size-24 text-brand"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* The phone, drawn sideways, turning to stand upright; the arrow shows the way. */}
        <g className="origin-center animate-turn-phone motion-reduce:animate-none">
          <rect x="14" y="30" width="68" height="36" rx="7" />
          <path d="M24 42v12" />
        </g>
        <path d="M28 14a34 34 0 0 0-16 18" />
        <path d="M10 21v12h12" />
      </svg>
      <p className="font-black text-2xl text-brand-ink">{t('rotate.title')}</p>
    </div>
  );
}
