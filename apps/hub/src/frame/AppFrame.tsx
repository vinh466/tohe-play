import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Player } from '../session/session.ts';
import { Avatar } from '../ui/AvatarGrid.tsx';
import { FramedContext } from '../ui/Screen.tsx';
import { isTyping, type TabId, tabOf, tabs } from './tabs.ts';

/**
 * The app's frame (ADR 0046): the layout route around the three tabs' screens. A phone gets a bar at the bottom, above
 * the home indicator; from tablet width the same tabs stand in a rail on the left. Each nav is in the document where it
 * shows — the rail before the screen, the bar after it — so the focus walks the screen in the order it is seen; the one
 * not shown is `display: none`, out of the focus order and of what screen readers read.
 */
export function AppFrame() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const current = tabOf(pathname);
  const typing = useTyping();
  return (
    <FramedContext.Provider value={true}>
      <div className="flex min-h-dvh flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-[calc(7rem+env(safe-area-inset-left))]">
        <TabNav
          current={current}
          className="fixed inset-y-0 left-0 z-30 hidden w-[calc(7rem+env(safe-area-inset-left))] flex-col gap-2 border-line border-r bg-surface pt-[max(1.5rem,env(safe-area-inset-top))] pl-[env(safe-area-inset-left)] md:flex"
          item="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl mx-2 px-1 text-center text-sm"
        />
        <Outlet />
        {/* The keyboard of a phone covers the bottom of the screen: the bar steps aside while someone types, so it never
            sits over the field (or is pushed up over it, where the browser resizes the page). */}
        {typing ? null : (
          <TabNav
            current={current}
            className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-line border-t bg-surface px-[env(safe-area-inset-left)] pb-[env(safe-area-inset-bottom)] md:hidden"
            item="flex h-16 flex-col items-center justify-center gap-0.5 text-xs"
          />
        )}
      </div>
    </FramedContext.Provider>
  );
}

/**
 * The three tabs. Switching tabs takes the place of the screen in the history: the app is one level (ADR 0046), so
 * phone Back from a tab leaves the app, and from a game comes back to the app.
 */
function TabNav({ current, className, item }: { current: TabId | null; className: string; item: string }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('frame.label')} className={className}>
      {tabs.map((tab) => {
        const active = tab.id === current;
        return (
          <Link
            key={tab.id}
            to={tab.to}
            replace
            aria-current={active ? 'page' : undefined}
            className={`${item} font-bold transition active:scale-95 ${active ? 'bg-soft text-accent' : 'text-ink-soft'}`}
          >
            <span aria-hidden className="text-2xl leading-none">
              {tab.icon}
            </span>
            <span className="leading-tight">{t(tab.label)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** True while a field that brings up a keyboard has the focus. */
function useTyping(): boolean {
  const [typing, setTyping] = useState(() => isTyping(document.activeElement as HTMLInputElement | null));
  useEffect(() => {
    const update = () => setTyping(isTyping(document.activeElement as HTMLInputElement | null));
    // On focusout the focus has not moved yet: look once it has.
    const later = () => setTimeout(update, 0);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', later);
    return () => {
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', later);
    };
  }, []);
  return typing;
}

/**
 * The top of a tab's screen: the tab's name, and who is playing — tapped, the profile picker, to change player.
 */
export function TabHeader({ title, player }: { title: string; player: Player | null }) {
  const { t } = useTranslation();
  return (
    <header className="flex items-center justify-between gap-3">
      <h1 className="min-w-0 truncate font-black text-3xl text-brand-ink">{title}</h1>
      {player ? (
        <Link
          to="/account/profiles"
          aria-label={t('switchProfile')}
          className="flex shrink-0 items-center gap-2 rounded-full bg-surface py-1.5 pr-4 pl-1.5 shadow-sm active:scale-95"
        >
          <Avatar avatar={player.avatar} size="sm" />
          <span className="max-w-28 truncate font-semibold text-ink">{player.name}</span>
        </Link>
      ) : null}
    </header>
  );
}
