import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, auth, type MeView, type ProfileView, session } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { profileOptionsQuery } from '../api/queries.ts';
import { useLeaveTo } from '../navigation/leave.tsx';
import { takeNext } from '../session/next.ts';
import { RequireSession } from '../session/RequireSession.tsx';
import { useSetMe } from '../session/useSession.ts';
import { db } from '../storage/db.ts';
import { hasProgress, moveProgress } from '../storage/repository.ts';
import { Avatar } from '../ui/AvatarGrid.tsx';
import { Button } from '../ui/Button.tsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx';
import { DataLink } from '../ui/DataLink.tsx';
import { Modal } from '../ui/Modal.tsx';
import { PinPad } from '../ui/PinPad.tsx';
import { Loading, Screen } from '../ui/Screen.tsx';
import { ThemeButton } from '../ui/ThemePicker.tsx';

export function ProfilesPage() {
  return <RequireSession need="account">{({ me }) => <Picker me={me} />}</RequireSession>;
}

const GUEST_PROGRESS_OFFERED = 'tohe:guest-progress-offered';

function Picker({ me }: { me: MeView }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const leaveTo = useLeaveTo();
  const setMe = useSetMe();
  const [pinFor, setPinFor] = useState<ProfileView | null>(null);
  const [pinErrors, setPinErrors] = useState(0);
  const [offerMove, setOfferMove] = useState<{ from: string; to: ProfileView } | null>(null);

  // Back to a room link that needed a player (session/next.ts), or to the catalog.
  const goOn = useCallback(async () => {
    const next = takeNext();
    leaveTo({ to: next ?? '/play' });
  }, [leaveTo]);

  // A real profile now plays on this device: the first time, offer it the guest's progress.
  const playing = useCallback(
    async (profile: ProfileView) => {
      const guest = await db.profiles.toCollection().first();
      if (guest && !localStorage.getItem(GUEST_PROGRESS_OFFERED) && (await hasProgress(db, guest.id))) {
        setOfferMove({ from: guest.id, to: profile });
        return;
      }
      await goOn();
    },
    [goOn],
  );

  const select = useMutation({
    mutationFn: ({ profile, pin }: { profile: ProfileView; pin?: string }) =>
      session.selectProfile(profile.id, pin),
    onSuccess: async (next, { profile }) => {
      setPinFor(null);
      await setMe(next);
      await playing(profile);
    },
    onError: (error, { profile }) => {
      if (error instanceof ApiError && error.code === 'pin_required') setPinFor(profile);
      if (error instanceof ApiError && error.code === 'pin_invalid') setPinErrors((n) => n + 1);
    },
  });

  const signOut = useMutation({
    mutationFn: () => auth.logout(),
    onSettled: async () => {
      await setMe(null);
      await navigate({ to: '/account/sign-in', replace: true });
    },
  });

  const finishMove = async (move: boolean) => {
    if (move && offerMove) await moveProgress(db, offerMove.from, offerMove.to.id);
    localStorage.setItem(GUEST_PROGRESS_OFFERED, '1');
    setOfferMove(null);
    await goOn();
  };

  const choose = (profile: ProfileView) => {
    if (profile.hasPin) {
      setPinErrors(0);
      setPinFor(profile);
    } else {
      select.mutate({ profile });
    }
  };

  // When the hub sent someone here to pick a player (`auto`), an account that leaves nobody to choose goes straight on
  // (ADR 0023): signing up and signing in already chose its only profile, or it has one profile without a PIN that
  // this device has not chosen yet. Decided on arrival, so the picker never flashes.
  const { auto } = useSearch({ from: '/account/profiles' });
  const [arrival] = useState(() => {
    if (!auto) return null;
    const active = me.profiles.find((profile) => profile.id === me.activeProfileId);
    if (active) return { profile: active, chosen: true };
    const only = me.profiles.length === 1 ? me.profiles[0] : undefined;
    return only && !only.hasPin ? { profile: only, chosen: false } : null;
  });
  const handled = useRef(false);
  const play = select.mutate;
  useEffect(() => {
    if (!arrival || handled.current) return;
    handled.current = true;
    if (arrival.chosen) void playing(arrival.profile);
    else play({ profile: arrival.profile });
  }, [arrival, play, playing]);

  const options = useQuery(profileOptionsQuery);
  const full = options.data !== undefined && me.profiles.length >= options.data.maxProfiles;

  if (arrival && !select.isError && offerMove === null) return <Loading label={t('loading')} />;

  return (
    <Screen>
      {/* Three columns keep the title centred next to the theme button. */}
      <header className="grid grid-cols-[2.75rem_1fr_2.75rem] items-start gap-2 text-center">
        <div className="col-start-2 pt-6">
          <p className="font-semibold text-ink-soft">{me.account.displayName}</p>
          <h1 className="font-black text-4xl text-brand-ink">{t('profiles.title')}</h1>
        </div>
        <ThemeButton />
      </header>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {me.profiles.map((profile, index) => (
          <li key={profile.id} className="animate-pop-in" style={{ animationDelay: `${index * 40}ms` }}>
            <button
              type="button"
              onClick={() => choose(profile)}
              disabled={select.isPending}
              className="flex w-full flex-col items-center gap-2 rounded-3xl bg-surface p-4 shadow-sm transition active:scale-95 disabled:opacity-60"
            >
              <Avatar avatar={profile.avatar} />
              <span className="font-bold text-ink text-lg">{profile.name}</span>
              <span className="text-ink-soft text-sm">
                {profile.kind === 'adult'
                  ? t('profiles.adult')
                  : t('account.years', { band: profile.ageBand })}
                {profile.hasPin ? ' · 🔒' : ''}
              </span>
            </button>
          </li>
        ))}
        {full ? null : (
          <li>
            <button
              type="button"
              onClick={() => void navigate({ to: '/account', search: { add: true } })}
              className="flex size-full min-h-44 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-line-strong border-dashed p-4 text-brand-ink transition active:scale-95"
            >
              <span className="grid size-16 place-items-center rounded-full bg-soft text-4xl">+</span>
              <span className="font-bold">{t('profiles.add')}</span>
            </button>
          </li>
        )}
      </ul>

      {select.isError && !(select.error instanceof ApiError && select.error.code?.startsWith('pin_')) ? (
        <p role="alert" className="text-center text-danger">
          {t(errorKey(select.error))}
        </p>
      ) : null}

      <footer className="mt-auto flex flex-wrap justify-center gap-3">
        <Button variant="secondary" onClick={() => void navigate({ to: '/account', search: { add: false } })}>
          ⚙️ {t('profiles.manage')}
        </Button>
        <Button variant="ghost" busy={signOut.isPending} onClick={() => signOut.mutate()}>
          {t('profiles.signOut')}
        </Button>
      </footer>
      <DataLink />

      <Modal
        open={pinFor !== null}
        title={t('profiles.pinTitle', { name: pinFor?.name ?? '' })}
        onClose={() => setPinFor(null)}
      >
        <PinPad
          errorKey={pinErrors}
          error={pinErrors > 0 ? t('errors.pinInvalid') : null}
          disabled={select.isPending}
          onComplete={(pin) => pinFor && select.mutate({ profile: pinFor, pin })}
        />
      </Modal>

      <ConfirmDialog
        open={offerMove !== null}
        title={t('profiles.moveTitle')}
        body={t('profiles.moveBody', { name: offerMove?.to.name ?? '' })}
        primary={{
          label: t('profiles.moveYes', { name: offerMove?.to.name ?? '' }),
          onClick: () => void finishMove(true),
        }}
        secondary={{ label: t('profiles.moveNo'), onClick: () => void finishMove(false) }}
      />
    </Screen>
  );
}
