import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate } from '@tanstack/react-router';
import { type ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { deviceProfilesQuery } from '../api/queries.ts';
import { TermsPrompt } from '../legal/Consent.tsx';
import { TERMS_VERSION } from '../legal/documents.ts';
import { Button } from '../ui/Button.tsx';
import { Icon } from '../ui/Icon.tsx';
import { Loading, Screen } from '../ui/Screen.tsx';
import { sessionEnded } from './ended.ts';
import { rememberNext } from './next.ts';
import { deviceMode, type Player, playerGate, type SessionState } from './session.ts';
import { useSession } from './useSession.ts';
import { asksWhoIsPlaying, whoIsPlaying } from './whoIsPlaying.ts';

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
 * terms the hub shows accepts them first (ADR 0025). Coming back (ADR 0046): an account's session that ended says so
 * instead of playing on as a device profile, and a cold start after 30 minutes unused asks "Ai đang chơi?" on a device
 * with more than one profile.
 */
export function RequireSession(props: Props) {
  const { t } = useTranslation();
  const session = useSession();
  const ended = useSyncExternalStore(sessionEnded.subscribe, sessionEnded.get);
  const ask = useWhoIsPlayingAsk(props.need === 'player' ? session : null);
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
      if (ended && session.status !== 'account') return <SessionEnded returnTo={props.returnTo} />;
      const gate = playerGate(session, { device: props.device ?? true });
      if (gate !== 'play' && props.returnTo) rememberNext(props.returnTo);
      if (gate === 'play' && ask === 'loading') return <Loading label={t('loading')} />;
      if (gate === 'play' && ask === 'ask') return <AskWhoIsPlaying returnTo={props.returnTo} />;
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

/**
 * Whether this screen asks "Ai đang chơi?" first: the cold start followed 30 minutes unused (whoIsPlaying.ts) and the
 * device has someone else to choose — the account's profiles, or this device's own.
 */
function useWhoIsPlayingAsk(session: SessionState | { status: 'loading' } | null): 'ask' | 'no' | 'loading' {
  const pending = whoIsPlaying.pending() && session !== null;
  const device = useQuery({ ...deviceProfilesQuery, enabled: pending && session?.status === 'device' });
  if (!pending || !session) return 'no';
  if (session.status === 'account') return asksWhoIsPlaying(true, session.me.profiles.length) ? 'ask' : 'no';
  if (session.status !== 'device') return 'no';
  if (!device.data) return device.isError ? 'no' : 'loading';
  return asksWhoIsPlaying(true, device.data.length) ? 'ask' : 'no';
}

/**
 * The picker, asked to show (`ask`): whoever taps their avatar plays, and the screen that asked opens after it — a link
 * or a table goes on as the entry pipeline keeps it.
 */
function AskWhoIsPlaying({ returnTo }: { returnTo?: string }) {
  const { t } = useTranslation();
  useState(() => rememberNext(returnTo ?? `${window.location.pathname}${window.location.search}`));
  return (
    <>
      <Loading label={t('loading')} />
      <Navigate to="/account/profiles" search={{ ask: true }} replace />
    </>
  );
}

/**
 * The account's session ended (session/ended.ts): said, with a way to sign in that comes back here — and this device's
 * own profiles only if the player chooses them.
 */
function SessionEnded({ returnTo }: { returnTo?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <Screen narrow back="/play">
      <section
        aria-labelledby="session-ended"
        className="mt-8 flex flex-col gap-4 rounded-3xl bg-surface p-5 text-center shadow-sm"
      >
        <Icon name="key" weight="fill" className="mx-auto text-5xl text-accent" />
        <h1 id="session-ended" className="font-black text-2xl text-brand-ink">
          {t('sessionEnded.title')}
        </h1>
        <p className="text-ink">{t('sessionEnded.body')}</p>
        <Button
          onClick={() => {
            rememberNext(returnTo ?? `${window.location.pathname}${window.location.search}`);
            void navigate({ to: '/account/sign-in' });
          }}
        >
          {t('sessionEnded.signIn')}
        </Button>
        <Button variant="secondary" onClick={() => deviceMode.enable()}>
          {t('sessionEnded.onDevice')}
        </Button>
      </section>
    </Screen>
  );
}
