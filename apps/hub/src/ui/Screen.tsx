import { createContext, type ReactNode, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import type { FrameBack } from '../frame/tabs.ts';
import { InstalledAppHint } from '../install/InstalledAppHint.tsx';
import { InAppStrip } from '../install/InstallNudge.tsx';
import { BackLink } from '../navigation/leave.tsx';
import { Icon } from './Icon.tsx';

/**
 * True inside the app's frame (frame/AppFrame.tsx): the frame keeps the bottom of the screen — its bar and the phone's
 * home indicator — and the height, so a screen in it fills what is left.
 */
export const FramedContext = createContext(false);

/**
 * Where the arrow of a screen of the frame leads (`backTarget` in frame/tabs.ts), set by the frame from the path: null
 * on a tab's root. `Screen` draws it, so no sub-screen of the frame is left without a way back.
 */
export const FrameBackContext = createContext<FrameBack | null>(null);

/** The way back at the top of a screen: the arrow and the word, a pill of at least 44 px. */
export const backPill =
  'inline-flex min-h-11 shrink-0 items-center gap-1.5 self-start rounded-full bg-surface pr-4 pl-3 font-semibold text-accent shadow-sm active:scale-95';

const widths = { narrow: 'max-w-md', normal: 'max-w-3xl', wide: 'max-w-[75rem] md:px-8' } as const;

/**
 * Centred column with safe-area padding: every hub screen but a game in play. Forms are `narrow`; the catalog is `wide`
 * (up to about 1200 px on a computer). In the in-app browser of a chat app it opens with the strip that says to open
 * the real browser; on an entry page on an iPhone, with the line that says how to open it in the installed app.
 *
 * A way back at the top ("←"), because an installed app on an iPhone has no Back (ADR 0046): in the frame it comes from
 * the frame (a tab's root has none); outside it, from `back` — the screen a gate or a form leads away to.
 */
export function Screen({
  children,
  narrow = false,
  wide = false,
  back,
}: {
  children: ReactNode;
  narrow?: boolean;
  wide?: boolean;
  /** Outside the frame: where "←" goes (ignored inside it, which knows its screens). */
  back?: '/play';
}) {
  const { t } = useTranslation();
  const framed = useContext(FramedContext);
  const frameBack = useContext(FrameBackContext);
  const arrow = framed ? frameBack : (back ?? null);
  const width = widths[narrow ? 'narrow' : wide ? 'wide' : 'normal'];
  const height = framed ? 'flex-1 pb-8 short:pb-4' : 'min-h-dvh pb-[max(2rem,env(safe-area-inset-bottom))]';
  return (
    <main
      className={`mx-auto flex w-full flex-col gap-6 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] short:gap-3 short:pt-[max(0.75rem,env(safe-area-inset-top))] ${height} ${width}`}
    >
      {arrow ? (
        <BackLink to={arrow} className={backPill}>
          <Icon name="arrow-left" className="text-xl" />
          {t('back')}
        </BackLink>
      ) : null}
      <InAppStrip />
      <InstalledAppHint />
      {children}
    </main>
  );
}

/** Message shown while the session is being resolved. */
export function Loading({ label }: { label: string }) {
  const framed = useContext(FramedContext);
  return (
    <div className={`grid place-items-center text-ink-soft ${framed ? 'flex-1' : 'min-h-dvh'}`} role="status">
      {label}
    </div>
  );
}
