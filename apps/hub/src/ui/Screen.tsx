import type { ReactNode } from 'react';
import { InAppStrip } from '../install/InstallNudge.tsx';

/**
 * Centred column with safe-area padding: the frame of every hub screen except the game launcher. In the in-app browser
 * of a chat app it opens with the strip that says to open the real browser.
 */
export function Screen({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return (
    <main
      className={`mx-auto flex min-h-dvh w-full flex-col gap-6 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] ${
        narrow ? 'max-w-md' : 'max-w-3xl'
      }`}
    >
      <InAppStrip />
      {children}
    </main>
  );
}

/** Message shown while the session is being resolved. */
export function Loading({ label }: { label: string }) {
  return (
    <div className="grid min-h-dvh place-items-center text-ink-soft" role="status">
      {label}
    </div>
  );
}
