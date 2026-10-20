import { Navigate } from '@tanstack/react-router';
import { type ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TermsPrompt } from '../legal/Consent.tsx';
import { TERMS_VERSION } from '../legal/documents.ts';
import { Loading } from '../ui/Screen.tsx';
import { rememberNext } from './next.ts';
import { deviceMode, type Player, playerGate, type SessionState } from './session.ts';
import { useSession } from './useSession.ts';

type AccountSession = Extract<SessionState, { status: 'account' }>;
type DeviceSession = Extract<SessionState, { status: 'device' }>;
type PlayingSession = Extract<SessionState, { status: 'device' | 'account' }> & { player: Player };

type Props =
  | { need: 'signedOut'; children: ReactNode }
  | { need: 'account'; children: (session: AccountSession) => ReactNode }
  /** Who may choose who plays: an account, or a device that plays as its device profiles (the profile picker). */
  | { need: 'chooser'; children: (session: AccountSession | DeviceSession) => ReactNode }
  | {
      need: 'player';
      children: (session: PlayingSession) => ReactNode;
      /** Come back here after signing in and choosing a profile (a room link). */
      returnTo?: string;
      /**
       * False for what needs an account (a room link): a device with no session is sent to sign in instead of playing
       * as a device profile. Default true: opening the hub is playing.
       */
      device?: boolean;
    };

/**
 * Sends people where they belong. A device with no session plays as its device profile at once, with no sign-in screen
 * first (E-03, ADR 0043; `/account/sign-in` opens only when chosen, or for what needs an account); signed-in devices
 * without a chosen player go to the profile picker, and away from the sign-in screens once signed in. The picker is
 * asked to choose by itself (`auto`) when the account leaves nothing to choose. An account that has not accepted the
 * terms the hub shows accepts them first (ADR 0025).
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
    case 'chooser':
      return session.status === 'signedOut' ? (
        <Navigate to="/account/sign-in" replace />
      ) : (
        props.children(session)
      );
    case 'player': {
      const gate = playerGate(session, { device: props.device ?? true });
      if (gate !== 'play' && props.returnTo) rememberNext(props.returnTo);
      switch (gate) {
        case 'enter-as-device':
          return <EnterAsDevice label={t('loading')} />;
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

/**
 * The first visit: the device plays as its device profile from now on — made silently the first time, which counts
 * the funnel's first step (useSession) — until someone signs in.
 */
function EnterAsDevice({ label }: { label: string }) {
  useEffect(() => {
    deviceMode.enable();
  }, []);
  return <Loading label={label} />;
}
