import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, auth, devices, type MeView, type ProfileView, session } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { deviceProfilesQuery, profileOptionsQuery } from '../api/queries.ts';
import { intentPath, isEntryPath } from '../entry/codes.ts';
import { entry } from '../entry/intent.ts';
import { useLeaveTo } from '../navigation/leave.tsx';
import { BringIn } from '../session/BringIn.tsx';
import { withProgress } from '../session/bringInChoices.ts';
import { MovedNotice } from '../session/MovedNotice.tsx';
import { takeNext } from '../session/next.ts';
import { cleanName, funName, MAX_NAME_LENGTH, visibleLength } from '../session/profileNames.ts';
import { RequireSession } from '../session/RequireSession.tsx';
import { deleteEverywhere } from '../session/serverCopy.ts';
import { deviceMode } from '../session/session.ts';
import { useDeviceProfilesChanged, useSetMe } from '../session/useSession.ts';
import { db, type LocalProfile } from '../storage/db.ts';
import {
  AVATARS,
  createDeviceProfile,
  currentDeviceProfile,
  listDeviceProfiles,
  MAX_DEVICE_PROFILES,
  randomAvatar,
  updateDeviceProfile,
} from '../storage/deviceProfiles.ts';
import { funnel } from '../telemetry/telemetry.ts';
import { Avatar, AvatarGrid } from '../ui/AvatarGrid.tsx';
import { Button } from '../ui/Button.tsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx';
import { DataLink } from '../ui/DataLink.tsx';
import { Modal } from '../ui/Modal.tsx';
import { PinPad } from '../ui/PinPad.tsx';
import { Loading, Screen } from '../ui/Screen.tsx';
import { TextField } from '../ui/TextField.tsx';
import { ThemeButton } from '../ui/ThemePicker.tsx';

/**
 * "Ai đang chơi?": the account's profiles when one is signed in — after offering to bring this device's profiles in —
 * or this device's own profiles when none is (ADR 0043).
 */
export function ProfilesPage() {
  return (
    <RequireSession need="chooser">
      {(state) => (state.status === 'account' ? <Picker me={state.me} /> : <DevicePicker />)}
    </RequireSession>
  );
}

/**
 * On, as `player`: to a page that needed a player (session/next.ts) — a table, say — or to the entry this tab keeps
 * for this player (ADR 0044) — a link, a typed code, a game — or to the catalog. A page remembered since the entry was
 * kept means the entry was left behind: it goes. An entry the gate let another player through goes too.
 */
function useGoOn() {
  const leaveTo = useLeaveTo();
  return useCallback(
    async (player: string) => {
      const next = takeNext();
      if (next && !isEntryPath(next)) {
        entry.forget();
        leaveTo({ to: next });
        return;
      }
      const kept = entry.current(player);
      leaveTo({ to: kept ? intentPath(kept) : (next ?? '/play') });
    },
    [leaveTo],
  );
}

/**
 * Right after signing in, a device that played as its device profiles is asked once what to bring into the account
 * (ADR 0043); then it plays as the account's profiles.
 */
function useBringInOffer() {
  const [offer, setOffer] = useState<{ devices: LocalProfile[]; playing: string | null } | 'none' | null>(
    () => (deviceMode.enabled() ? null : 'none'),
  );
  useEffect(() => {
    if (offer !== null) return;
    let live = true;
    void (async () => {
      const devices = await withProgress(db, await listDeviceProfiles(db));
      if (!live) return;
      if (devices.length === 0) {
        deviceMode.disable();
        setOffer('none');
      } else {
        setOffer({ devices, playing: currentDeviceProfile.get() });
      }
    })();
    return () => {
      live = false;
    };
  }, [offer]);
  // Who plays next: the device profile being played, now the account's — or the profile it was merged into.
  const [playNext, setPlayNext] = useState<string | null>(null);
  const finish = useCallback((next: string | null) => {
    deviceMode.disable();
    setPlayNext(next);
    setOffer('none');
  }, []);
  return { offer, finish, playNext };
}

function Picker({ me }: { me: MeView }) {
  const { t } = useTranslation();
  const { auto } = useSearch({ from: '/account/profiles' });
  const navigate = useNavigate();
  const setMe = useSetMe();
  const goOn = useGoOn();
  const [pinFor, setPinFor] = useState<ProfileView | null>(null);
  const [pinErrors, setPinErrors] = useState(0);
  const { offer, finish, playNext } = useBringInOffer();
  // Device profiles left on this device with progress: each can still come into the account (ADR 0043).
  const devices = useQuery({
    queryKey: ['device-profiles', 'with-progress'],
    queryFn: async () => withProgress(db, await listDeviceProfiles(db)),
  });
  const [bringing, setBringing] = useState<LocalProfile | null>(null);

  const select = useMutation({
    mutationFn: ({ profile, pin }: { profile: ProfileView; pin?: string }) =>
      session.selectProfile(profile.id, pin),
    onSuccess: async (next, { profile }) => {
      entry.switched({ auto, from: me.activeProfileId, to: profile.id });
      setPinFor(null);
      await setMe(next);
      await goOn(profile.id);
    },
    onError: (error, { profile }) => {
      if (error instanceof ApiError && error.code === 'pin_required') setPinFor(profile);
      if (error instanceof ApiError && error.code === 'pin_invalid') setPinErrors((n) => n + 1);
    },
  });

  const signOut = useMutation({
    mutationFn: () => auth.logout(),
    onSettled: async () => {
      // Whoever signs in next on this device did not come for this tab's entry.
      entry.forget();
      await setMe(null);
      await navigate({ to: '/account/sign-in', replace: true });
    },
  });

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
  // this device has not chosen yet. Decided once the device's profiles were offered, so the picker never flashes.
  const handled = useRef(!auto);
  const [moving, setMoving] = useState(!!auto);
  const play = select.mutate;
  const switched = useRef(false);
  useEffect(() => {
    if (offer !== 'none') return;
    // The player goes on as the profile they were just playing (ADR 0043), whatever the account had chosen before.
    const next = playNext ? me.profiles.find((profile) => profile.id === playNext) : undefined;
    if (next && !switched.current) {
      switched.current = true;
      handled.current = true;
      if (next.id === me.activeProfileId) void goOn(next.id);
      else if (next.hasPin) {
        setMoving(false);
        setPinFor(next);
      } else play({ profile: next });
      return;
    }
    if (handled.current) return;
    handled.current = true;
    const active = me.profiles.find((profile) => profile.id === me.activeProfileId);
    const only = me.profiles.length === 1 ? me.profiles[0] : undefined;
    if (active) void goOn(active.id);
    else if (only && !only.hasPin) play({ profile: only });
    else setMoving(false);
  }, [offer, playNext, me, goOn, play]);

  const options = useQuery(profileOptionsQuery);
  const full = options.data !== undefined && me.profiles.length >= options.data.maxProfiles;

  if (offer === null) return <Loading label={t('loading')} />;
  if (offer !== 'none') {
    return <BringIn me={me} devices={offer.devices} playingId={offer.playing} onDone={finish} />;
  }
  if (bringing) {
    return <BringIn me={me} devices={[bringing]} playingId={bringing.id} onDone={() => setBringing(null)} />;
  }
  if (moving && !select.isError) return <Loading label={t('loading')} />;

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

      {/* Device profiles kept on this device: each can still come into the account (ADR 0043). */}
      {devices.data && devices.data.length > 0 ? (
        <section
          aria-labelledby="on-device"
          className="flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-sm"
        >
          <h2 id="on-device" className="font-bold text-ink">
            {t('device.title')}
          </h2>
          <p className="-mt-2 text-ink-soft text-sm">{t('device.keptHint')}</p>
          <ul className="flex flex-col gap-2">
            {devices.data.map((device) => (
              <li key={device.id} className="flex items-center gap-3">
                <Avatar avatar={device.avatar} size="sm" />
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{device.name}</span>
                <Button variant="secondary" onClick={() => setBringing(device)}>
                  {t('device.bringOne')}
                </Button>
              </li>
            ))}
          </ul>
        </section>
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
    </Screen>
  );
}

/**
 * "Hồ sơ trên máy này" (ADR 0043): up to five players of this device, without an account — switch, make one, rename,
 * delete, on the device only.
 */
function DevicePicker() {
  const { t } = useTranslation();
  const { auto } = useSearch({ from: '/account/profiles' });
  const goOn = useGoOn();
  const changed = useDeviceProfilesChanged();
  const profiles = useQuery(deviceProfilesQuery);
  const [editing, setEditing] = useState<LocalProfile | 'new' | null>(null);
  const current = currentDeviceProfile.get();
  const list = profiles.data ?? [];

  const choose = async (profile: LocalProfile) => {
    entry.switched({ auto, from: current, to: profile.id });
    currentDeviceProfile.set(profile.id);
    await changed();
    await goOn(profile.id);
  };

  if (profiles.isPending) return <Loading label={t('loading')} />;
  return (
    <Screen>
      <header className="grid grid-cols-[2.75rem_1fr_2.75rem] items-start gap-2 text-center">
        <div className="col-start-2 pt-6">
          <p className="font-semibold text-ink-soft">{t('device.title')}</p>
          <h1 className="font-black text-4xl text-brand-ink">{t('profiles.title')}</h1>
        </div>
        <ThemeButton />
      </header>

      <MovedNotice />

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {list.map((profile, index) => (
          <li
            key={profile.id}
            className="relative animate-pop-in"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <button
              type="button"
              onClick={() => void choose(profile)}
              aria-current={profile.id === current ? true : undefined}
              className={`flex w-full flex-col items-center gap-2 rounded-3xl bg-surface p-4 shadow-sm transition active:scale-95 ${
                profile.id === current ? 'ring-4 ring-brand' : ''
              }`}
            >
              <Avatar avatar={profile.avatar} />
              <span className="max-w-full truncate font-bold text-ink text-lg">{profile.name}</span>
              <span className="text-ink-soft text-sm">
                {profile.id === current ? t('device.playing') : t('device.onDevice')}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setEditing(profile)}
              aria-label={t('device.editOf', { name: profile.name })}
              className="absolute top-2 right-2 grid size-10 place-items-center rounded-full bg-soft text-accent active:scale-95"
            >
              ✏️
            </button>
          </li>
        ))}
        {list.length < MAX_DEVICE_PROFILES ? (
          <li>
            <button
              type="button"
              onClick={() => setEditing('new')}
              className="flex size-full min-h-44 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-line-strong border-dashed p-4 text-brand-ink transition active:scale-95"
            >
              <span className="grid size-16 place-items-center rounded-full bg-soft text-4xl">+</span>
              <span className="font-bold">{t('profiles.add')}</span>
            </button>
          </li>
        ) : null}
      </ul>
      <p className="text-center text-ink-soft text-sm">{t('device.hint', { max: MAX_DEVICE_PROFILES })}</p>
      {/* ADR 0043: a device profile never on the server is lost with the browser's data — the hub says so here. */}
      {list.some((profile) => !profile.server) ? (
        <p className="text-center text-ink-soft text-sm">{t('device.onlyHere')}</p>
      ) : null}

      <footer className="mt-auto flex flex-col items-center gap-3">
        {/* A profile from another device, moved here with its transfer code (ADR 0043). */}
        <Link to="/account/transfer" className="font-bold text-accent underline underline-offset-4">
          {t('transfer.receive')}
        </Link>
        <Link
          to="/account/sign-in"
          onClick={() => funnel.signInOpened()}
          className="font-bold text-brand-ink underline underline-offset-4"
        >
          {t('device.signIn')}
        </Link>
        <DataLink />
      </footer>

      <Modal
        open={editing !== null}
        title={editing === 'new' ? t('device.new') : t('device.edit')}
        onClose={() => setEditing(null)}
      >
        {editing ? (
          <DeviceProfileForm
            profile={editing === 'new' ? null : editing}
            canDelete={list.length > 1}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Modal>
    </Screen>
  );
}

/** Make, rename or delete a device profile; a new one plays at once. */
function DeviceProfileForm({
  profile,
  canDelete,
  onDone,
}: {
  profile: LocalProfile | null;
  canDelete: boolean;
  onDone(): void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const changed = useDeviceProfilesChanged();
  const [name, setName] = useState(() => profile?.name ?? funName(i18n.language));
  const [avatar, setAvatar] = useState(() => profile?.avatar ?? randomAvatar());
  const [showErrors, setShowErrors] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const clean = cleanName(name);
  const nameError = !clean
    ? t('errors.nameRequired')
    : visibleLength(clean) > MAX_NAME_LENGTH
      ? t('errors.nameTooLong')
      : null;

  const save = useMutation({
    mutationFn: async () => {
      if (profile) await updateDeviceProfile(db, profile.id, { name: clean, avatar });
      else {
        await createDeviceProfile(db, { name: clean, avatar, chosen: true });
        // "Thêm người chơi": someone new plays now, and the entry this tab kept was not theirs (ADR 0044).
        entry.forget();
      }
    },
    onSuccess: async () => {
      await changed();
      onDone();
    },
  });
  const remove = useMutation({
    mutationFn: async () => {
      // Its copy on the server goes too, when it has one (ADR 0043).
      if (profile) await deleteEverywhere(db, devices, profile);
    },
    onSuccess: async () => {
      await changed();
      onDone();
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setShowErrors(true);
    if (!nameError) save.mutate();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div className="flex items-end gap-2">
        <TextField
          className="flex-1"
          label={t('device.name')}
          hint={t('device.nameHint')}
          required
          maxLength={128}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={showErrors ? nameError : null}
        />
        <Button
          variant="secondary"
          aria-label={t('register.anotherName')}
          title={t('register.anotherName')}
          onClick={() => setName(funName(i18n.language))}
        >
          🎲
        </Button>
      </div>
      <AvatarGrid avatars={AVATARS} value={avatar} onChange={setAvatar} label={t('account.avatar')} />
      {save.isError ? (
        <p role="alert" className="text-danger">
          {t('device.full', { max: MAX_DEVICE_PROFILES })}
        </p>
      ) : null}
      <Button type="submit" busy={save.isPending}>
        {t('save')}
      </Button>
      {profile ? (
        // To another device with a transfer code (ADR 0043): the named screen and its copy on the server first if needed.
        <Button
          variant="secondary"
          onClick={() => void navigate({ to: '/account/transfer/send', search: { profile: profile.id } })}
        >
          📲 {t('transfer.send')}
        </Button>
      ) : null}
      {profile && canDelete ? (
        <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
          {t('device.delete')}
        </Button>
      ) : null}
      <ConfirmDialog
        open={confirmDelete}
        title={t('device.deleteTitle', { name: profile?.name ?? '' })}
        body={t('device.deleteBody')}
        primary={{ label: t('cancel'), onClick: () => setConfirmDelete(false) }}
        secondary={{ label: t('device.deleteYes'), onClick: () => remove.mutate() }}
      />
    </form>
  );
}
