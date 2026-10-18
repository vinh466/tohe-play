import { Navigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { TermsPrompt } from '../legal/Consent.tsx';
import { TERMS_VERSION } from '../legal/documents.ts';
import { Loading } from '../ui/Screen.tsx';
import { rememberNext } from './next.ts';
import type { Player, SessionState } from './session.ts';
import { useSession } from './useSession.ts';

type AccountSession = Extract<SessionState, { status: 'account' }>;
type PlayingSession = Extract<SessionState, { status: 'guest' | 'account' }> & { player: Player };

type Props =
  | { need: 'signedOut'; children: ReactNode }
  | { need: 'account'; children: (session: AccountSession) => ReactNode }
  | {
      need: 'player';
      children: (session: PlayingSession) => ReactNode;
      /** Come back here after signing in and choosing a profile (a room link). */
      returnTo?: string;
    };

/**
 * Sends people where they belong: signed-out devices to /welcome, signed-in devices without a chosen player to
 * the profile picker, and away from the sign-in screens once signed in. The picker is asked to choose by itself
 * (`auto`) when the account leaves nothing to choose. An account that has not accepted the terms the hub shows
 * accepts them first (ADR 0025).
 */
export function RequireSession(props: Props) {
  const { t } = useTranslation();
  const session = useSession();
  if (session.status === 'loading') return <Loading label={t('loading')} />;
  if (
    props.need !== 'signedOut' &&
    session.status === 'account' &&
    session.me.account.termsVersion !== TERMS_VERSION
  ) {
    return <TermsPrompt me={session.me} />;
  }

  switch (props.need) {
    case 'signedOut':
      return session.status === 'account' ? (
        <Navigate to="/profiles" search={{ auto: true }} replace />
      ) : (
        props.children
      );
    case 'account':
      return session.status === 'account' ? props.children(session) : <Navigate to="/welcome" replace />;
    case 'player':
      if ((session.status === 'signedOut' || !session.player) && props.returnTo) rememberNext(props.returnTo);
      if (session.status === 'signedOut') return <Navigate to="/welcome" replace />;
      if (!session.player) return <Navigate to="/profiles" search={{ auto: true }} replace />;
      return props.children(session as PlayingSession);
  }
}
