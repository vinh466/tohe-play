import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackLink } from '../navigation/leave.tsx';
import { actAsDevice } from '../rooms/devicePlayer.ts';
import { AtTables } from '../session/AtTables.tsx';
import { rememberNext } from '../session/next.ts';
import { RequireSession } from '../session/RequireSession.tsx';
import type { Player, SessionState } from '../session/session.ts';
import { Button } from '../ui/Button.tsx';
import { Screen } from '../ui/Screen.tsx';
import { type EntryIntent, intentPath, type Level } from './codes.ts';
import { entry } from './intent.ts';

type PlayingSession = Extract<SessionState, { status: 'device' | 'account' }> & { player: Player };

/**
 * Steps 3, 5 and 6 of the entry pipeline (ADR 0044): the intent kept on this tab; the identity gate at `level` — the
 * highest of the game's, the feature's and the link's; and the profile ready — chosen, its terms accepted, and its copy
 * on the server with the `named` line when the level asks for a name. Signing in, a provider's round trip, the profile
 * picker and the terms all come back to the intent's path.
 */
export function EntryGate({
  intent,
  level,
  children,
}: {
  intent: EntryIntent;
  level: Level;
  children: (player: Player, session: PlayingSession) => ReactNode;
}) {
  // Kept once, when the gate opens: once reached, a later drawing must not keep it again.
  useState(() => entry.keep(intent));
  const path = intentPath(intent);
  // No `returnTo`: the picker goes on to the kept intent, which ends once reached — a path remembered here would send
  // a later sign-in back to a game or a link already reached.
  // Through the gate: the intent is this player's from now on — another profile chosen later never inherits it, and one
  // kept for another player is forgotten here.
  const through = (player: Player, session: PlayingSession) => {
    entry.claim(intent, player.id);
    return children(player, session);
  };
  return (
    <RequireSession need="player">
      {(session) => {
        if (level === 'any') {
          // Nothing asked of the player: an account's session acts as itself, never as a device profile.
          if (session.status === 'account') actAsDevice(null);
          return through(session.player, session);
        }
        if (level === 'account' && session.status === 'device') return <AccountNeeded path={path} />;
        return (
          <AtTables session={session} purpose={intent.kind === 'room' ? 'table' : 'entry'}>
            {(player) => through(player, session)}
          </AtTables>
        );
      }}
    </RequireSession>
  );
}

/**
 * A link — or a game, or its tables (ADR 0045) — that asks for an account, opened by a device profile: signing in or up
 * comes back to it.
 */
export function AccountNeeded({ path }: { path: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const go = (to: '/account/sign-in' | '/account/register') => {
    rememberNext(path);
    void navigate({ to });
  };
  return (
    <Screen narrow>
      <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 text-center shadow-sm">
        <h1 className="font-black text-2xl text-brand-ink">{t('entry.accountTitle')}</h1>
        <p className="text-ink">{t('entry.accountBody')}</p>
        <Button onClick={() => go('/account/sign-in')}>{t('entry.signIn')}</Button>
        <Button variant="secondary" onClick={() => go('/account/register')}>
          {t('entry.signUp')}
        </Button>
      </section>
      <BackLink to="/play" className="text-center font-semibold text-accent">
        {t('entry.toCatalog')}
      </BackLink>
    </Screen>
  );
}
