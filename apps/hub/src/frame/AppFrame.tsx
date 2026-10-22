import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import type { Player } from '../session/session.ts';
import { Avatar } from '../ui/AvatarGrid.tsx';
import { FramedContext } from '../ui/Screen.tsx';
import { showsUpdateNotice, updates } from '../update/update.ts';
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
      <div className="flex min-h-dvh flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-[calc(7rem+env(safe-area-inset-left))] short:pb-0 short:pl-[calc(7rem+env(safe-area-inset-left))]">
        <TabNav
          current={current}
          className="fixed inset-y-0 left-0 z-30 hidden w-[calc(7rem+env(safe-area-inset-left))] flex-col gap-2 border-line border-r bg-surface pt-[max(1.5rem,env(safe-area-inset-top))] pl-[env(safe-area-inset-left)] md:flex short:flex short:gap-1 short:pt-[max(0.5rem,env(safe-area-inset-top))]"
          item="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl mx-2 px-1 text-center text-sm short:min-h-14 short:gap-0"
        />
        <Outlet />
        <UpdateNotice pathname={pathname} />
        {/* The keyboard of a phone covers the bottom of the screen: the bar steps aside while someone types, so it never
            sits over the field (or is pushed up over it, where the browser resizes the page). */}
        {typing ? null : (
          <TabNav
            current={current}
            className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-line border-t bg-surface px-[env(safe-area-inset-left)] pb-[env(safe-area-inset-bottom)] md:hidden short:hidden"
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

/**
 * "Có bản mới — Tải lại" (ADR 0046): a new version waits, and only the frame's screens say so — never a game, a table
 * or a replay, which are outside the frame. It sits above the bar; "Để sau" hides it until the next start.
 */
function UpdateNotice({ pathname }: { pathname: string }) {
  const { t } = useTranslation();
  const waiting = useSyncExternalStore(updates.subscribe, updates.waiting);
  const [later, setLater] = useState(false);
  const [reloading, setReloading] = useState(false);
  if (later || !showsUpdateNotice(waiting, pathname)) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-notice py-2 pr-2 pl-4 text-notice-ink shadow-lg md:bottom-4 md:left-[calc(8rem+env(safe-area-inset-left))] short:bottom-4 short:left-[calc(8rem+env(safe-area-inset-left))]"
    >
      <span className="min-w-0 flex-1 font-semibold">{t('update.ready')}</span>
      <button
        type="button"
        disabled={reloading}
        onClick={() => {
          setReloading(true);
          void updates.apply();
        }}
        className="shrink-0 rounded-full bg-brand px-4 py-1.5 font-bold text-on-brand text-xl active:bg-brand-strong disabled:opacity-60"
      >
        {t('update.reload')}
      </button>
      <button
        type="button"
        aria-label={t('update.later')}
        onClick={() => setLater(true)}
        className="grid size-10 shrink-0 place-items-center rounded-full font-bold active:bg-soft"
      >
        ✕
      </button>
    </div>
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
      <h1 className="min-w-0 truncate font-black text-3xl text-brand-ink short:text-xl">{title}</h1>
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
