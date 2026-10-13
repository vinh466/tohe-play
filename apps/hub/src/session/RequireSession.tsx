import { Navigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Loading } from '../ui/Screen.tsx';
import type { Player, SessionState } from './session.ts';
import { useSession } from './useSession.ts';

type AccountSession = Extract<SessionState, { status: 'account' }>;
type PlayingSession = Extract<SessionState, { status: 'guest' | 'account' }> & { player: Player };

type Props =
  | { need: 'signedOut'; children: ReactNode }
  | { need: 'account'; children: (session: AccountSession) => ReactNode }
  | { need: 'player'; children: (session: PlayingSession) => ReactNode };

/**
 * Sends people where they belong: signed-out devices to /welcome, signed-in devices without a chosen player to
 * the profile picker, and away from the sign-in screens once signed in.
 */
export function RequireSession(props: Props) {
  const { t } = useTranslation();
  const session = useSession();
  if (session.status === 'loading') return <Loading label={t('loading')} />;

  switch (props.need) {
    case 'signedOut':
      return session.status === 'account' ? <Navigate to="/profiles" replace /> : props.children;
    case 'account':
      return session.status === 'account' ? props.children(session) : <Navigate to="/welcome" replace />;
    case 'player':
      if (session.status === 'signedOut') return <Navigate to="/welcome" replace />;
      if (!session.player) return <Navigate to="/profiles" replace />;
      return props.children(session as PlayingSession);
  }
}
