import { createContext, type ReactNode, useContext } from 'react';
import { InstalledAppHint } from '../install/InstalledAppHint.tsx';
import { InAppStrip } from '../install/InstallNudge.tsx';

/**
 * True inside the app's frame (frame/AppFrame.tsx): the frame keeps the bottom of the screen — its bar and the phone's
 * home indicator — and the height, so a screen in it fills what is left.
 */
export const FramedContext = createContext(false);

const widths = { narrow: 'max-w-md', normal: 'max-w-3xl', wide: 'max-w-[75rem] md:px-8' } as const;

/**
 * Centred column with safe-area padding: every hub screen but a game in play. Forms are `narrow`; the catalog is `wide`
 * (up to about 1200 px on a computer). In the in-app browser of a chat app it opens with the strip that says to open
 * the real browser; on an entry page on an iPhone, with the line that says how to open it in the installed app.
 */
export function Screen({
  children,
  narrow = false,
  wide = false,
}: {
  children: ReactNode;
  narrow?: boolean;
  wide?: boolean;
}) {
  const framed = useContext(FramedContext);
  const width = widths[narrow ? 'narrow' : wide ? 'wide' : 'normal'];
  const height = framed ? 'flex-1 pb-8 short:pb-4' : 'min-h-dvh pb-[max(2rem,env(safe-area-inset-bottom))]';
  return (
    <main
      className={`mx-auto flex w-full flex-col gap-6 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] short:gap-3 short:pt-[max(0.75rem,env(safe-area-inset-top))] ${height} ${width}`}
    >
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
