import { Navigate } from '@tanstack/react-router';
import { type ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TermsPrompt } from '../legal/Consent.tsx';
import { TERMS_VERSION } from '../legal/documents.ts';
import { Loading } from '../ui/Screen.tsx';
import { rememberNext } from './next.ts';
import { guestMode, type Player, playerGate, type SessionState } from './session.ts';
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
      /**
       * False for what needs an account (a room link): a device with no session is sent to sign in instead of playing
       * as a guest. Default true: opening the hub is playing.
       */
      guest?: boolean;
    };

/**
 * Sends people where they belong. A device with no session plays as a guest at once, with no sign-in screen first
 * (E-03; `/account/sign-in` opens only when chosen, or for what needs an account); signed-in devices without a chosen
 * player go to the profile picker, and away from the sign-in screens once signed in. The picker is asked to choose by
 * itself (`auto`) when the account leaves nothing to choose. An account that has not accepted the terms the hub shows
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
        <Navigate to="/account/profiles" search={{ auto: true }} replace />
      ) : (
        props.children
      );
    case 'account':
      return session.status === 'account' ? (
        props.children(session)
      ) : (
        <Navigate to="/account/sign-in" replace />
      );
    case 'player': {
      const gate = playerGate(session, { guest: props.guest ?? true });
      if (gate !== 'play' && props.returnTo) rememberNext(props.returnTo);
      switch (gate) {
        case 'enter-as-guest':
          return <EnterAsGuest label={t('loading')} />;
        case 'sign-in':
          return <Navigate to="/account/sign-in" replace />;
        case 'choose-profile':
          return <Navigate to="/account/profiles" search={{ auto: true }} replace />;
        case 'play':
          return props.children(session as PlayingSession);
      }
    }
  }
}

/** The first visit: the device plays as a guest from now on, until someone signs in. */
function EnterAsGuest({ label }: { label: string }) {
  useEffect(() => guestMode.enable(), []);
  return <Loading label={label} />;
}
