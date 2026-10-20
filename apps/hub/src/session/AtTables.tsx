import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, devices } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { configQuery, deviceProfileQuery } from '../api/queries.ts';
import { TERMS_VERSION } from '../legal/documents.ts';
import { actAsDevice, onDeviceTrouble } from '../rooms/devicePlayer.ts';
import { db, type LocalProfile } from '../storage/db.ts';
import { AVATARS, updateDeviceProfile } from '../storage/deviceProfiles.ts';
import { AvatarGrid } from '../ui/AvatarGrid.tsx';
import { Button } from '../ui/Button.tsx';
import { Loading, Screen } from '../ui/Screen.tsx';
import { TextField } from '../ui/TextField.tsx';
import { refusedKey } from './bringInChoices.ts';
import { rememberNext } from './next.ts';
import { cleanName } from './profileNames.ts';
import { withProof } from './proofOfWork.ts';
import {
  lostServerCopy,
  mayEnter,
  type Prove,
  sendServerCopy,
  tablesStep,
  termsAgain,
} from './serverCopy.ts';
import type { Player, SessionState } from './session.ts';
import { movedNotices, settleMoves } from './transfer.ts';
import { useDeviceProfilesChanged } from './useSession.ts';

type PlayingSession = Extract<SessionState, { status: 'device' | 'account' }> & { player: Player };

/**
 * Who sits at the tables (ADR 0016, 0043): an account's profile with its session, or the device profile playing with
 * this device's key. A device profile's copy on the server is made before it acts — after the `named` screen the first
 * time, and whenever the terms changed — and made again under a new id when the server says it is gone.
 */
export function AtTables({
  session,
  children,
}: {
  session: PlayingSession;
  children: (player: Player) => ReactNode;
}) {
  if (session.status === 'account') {
    // Said before the first request of the page goes: the account's session acts, no device profile.
    actAsDevice(null);
    return children(session.player);
  }
  return <DeviceAtTables>{children}</DeviceAtTables>;
}

function DeviceAtTables({ children }: { children: (player: Player) => ReactNode }) {
  const { t } = useTranslation();
  const device = useQuery(deviceProfileQuery());
  const changed = useDeviceProfilesChanged();

  // The server said the copy is gone, or the terms changed: a new id and a new copy, or the named screen again. Moved
  // to another device: what was played here since stays as a new device profile, and the player is told.
  useEffect(
    () =>
      onDeviceTrouble((trouble, id) => {
        void (async () => {
          if (trouble === 'device_profile_not_found') await lostServerCopy(db, id);
          else if (trouble === 'device_profile_moved')
            movedNotices.add(await settleMoves(db, [{ profileId: id }]));
          else await termsAgain(db, id);
          actAsDevice(null);
          await changed();
        })();
      }),
    [changed],
  );

  const profile = device.data;
  if (!profile) return <Loading label={t('loading')} />;
  const step = tablesStep(profile, TERMS_VERSION);
  if (step === 'name') {
    actAsDevice(null);
    return <NamedScreen profile={profile} onDone={changed} />;
  }
  if (step === 'send') {
    actAsDevice(null);
    return (
      <SendCopy key={`${profile.id}:${profile.name}:${profile.avatar}`} profile={profile} onDone={changed} />
    );
  }
  actAsDevice(profile.id);
  return children({ id: profile.id, name: profile.name, avatar: profile.avatar, kind: 'device' });
}

export function useProve(): Prove {
  const config = useQuery(configQuery);
  return (send) => withProof(config.data?.proofOfWork, send);
}

/** The copy is sent again — a new id after the old one was cleaned up, or a new name — without asking anything. */
export function SendCopy({
  profile,
  onDone,
}: {
  profile: LocalProfile;
  /** With the profile as the device keeps it now: its id may be new. */
  onDone(sent: LocalProfile): Promise<void>;
}) {
  const { t } = useTranslation();
  const prove = useProve();
  const send = useMutation({
    mutationFn: () => sendServerCopy(db, devices, profile, TERMS_VERSION, prove),
    onSuccess: (sent) => onDone(sent),
  });
  const { mutate, isIdle } = send;
  useEffect(() => {
    if (isIdle) mutate();
  }, [isIdle, mutate]);
  if (!send.isError) return <Loading label={t('named.sending')} />;
  return (
    <Screen narrow>
      <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-center text-danger">
        {t(errorKey(send.error))}
      </p>
      <Button onClick={() => send.mutate()}>{t('named.retry')}</Button>
    </Screen>
  );
}

/**
 * The `named` screen (ADR 0043): others will see this name, so the player chooses it and an avatar, and ticks one line
 * — the terms, and 16 or older or a parent's permission — before anything of the profile reaches the server. Under 16
 * without a parent's word, "Nhờ bố mẹ" leads to signing in, where a parent makes a child's profile instead.
 */
export function NamedScreen({
  profile,
  onDone,
  purpose = 'table',
}: {
  profile: LocalProfile;
  /** With the profile as the device keeps it now: its id may be new. */
  onDone(sent: LocalProfile): Promise<void>;
  /** At a table (the default), or before a transfer code: the same line, other words around it. */
  purpose?: 'table' | 'transfer';
}) {
  const { t } = useTranslation();
  const words =
    purpose === 'transfer'
      ? {
          title: t('transfer.namedTitle'),
          body: t('transfer.namedBody'),
          kept: t('transfer.namedKept'),
          go: t('transfer.namedGo'),
        }
      : { title: t('named.title'), body: t('named.body'), kept: t('named.kept'), go: t('named.go') };
  const navigate = useNavigate();
  const prove = useProve();
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [ticked, setTicked] = useState(false);
  const send = useMutation({
    mutationFn: async () => {
      const clean = cleanName(name);
      await updateDeviceProfile(db, profile.id, { name: clean, avatar });
      return sendServerCopy(db, devices, { ...profile, name: clean, avatar }, TERMS_VERSION, prove);
    },
    onSuccess: (sent) => onDone(sent),
  });
  const refused =
    send.error instanceof ApiError && send.error.code === 'name_refused'
      ? t(refusedKey(send.error.reason))
      : null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (mayEnter(name, ticked)) send.mutate();
  };
  // Signing in comes back here: a parent's account, then the profile picker, then this table.
  const toSignIn = () => {
    rememberNext(window.location.pathname);
    void navigate({ to: '/account/sign-in' });
  };
  const link = 'font-semibold text-accent underline underline-offset-2';

  return (
    <Screen narrow>
      <form onSubmit={submit} className="flex flex-col gap-5 rounded-3xl bg-surface p-5 shadow-sm" noValidate>
        <div className="flex flex-col gap-1">
          <h1 className="font-black text-2xl text-brand-ink">{words.title}</h1>
          <p className="text-ink-soft">{words.body}</p>
        </div>
        <TextField
          label={t('device.name')}
          required
          maxLength={128}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={refused}
        />
        <AvatarGrid avatars={AVATARS} value={avatar} onChange={setAvatar} label={t('account.avatar')} />
        <label className="flex items-start gap-3 text-ink">
          <input
            type="checkbox"
            checked={ticked}
            onChange={(event) => setTicked(event.target.checked)}
            className="mt-1 size-6 shrink-0 accent-brand"
          />
          <span>
            {t('named.agree')}{' '}
            <a href="/terms" target="_blank" rel="noopener" className={link}>
              {t('named.terms')}
            </a>{' '}
            {t('named.age')}
          </span>
        </label>
        <p className="text-ink-soft text-sm">
          {words.kept}{' '}
          <a href="/privacy" target="_blank" rel="noopener" className={link}>
            {t('legal.privacy')}
          </a>
          .
        </p>
        {send.isError && !refused ? (
          <p role="alert" className="text-danger">
            {t(errorKey(send.error))}
          </p>
        ) : null}
        <Button type="submit" disabled={!mayEnter(name, ticked)} busy={send.isPending}>
          {words.go}
        </Button>
      </form>
      <section className="flex flex-col gap-2 rounded-3xl bg-surface p-5 text-center shadow-sm">
        <p className="text-ink">{t('named.parentsHint')}</p>
        <Button variant="secondary" onClick={toSignIn}>
          {t('named.parents')}
        </Button>
      </section>
      <p className="text-center text-ink">
        {t('named.haveAccount')}{' '}
        <Link
          to="/account/sign-in"
          onClick={() => rememberNext(window.location.pathname)}
          className="font-bold text-accent underline underline-offset-4"
        >
          {t('named.signIn')}
        </Link>
      </p>
    </Screen>
  );
}
