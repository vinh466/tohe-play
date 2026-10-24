import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, auth, devices, type MeView, type ProfileView, session } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { deviceProfilesQuery, profileOptionsQuery } from '../api/queries.ts';
import { intentPath, isEntryPath } from '../entry/codes.ts';
import { entry } from '../entry/intent.ts';
import { forgetGreeting } from '../launcher/recent.ts';
import { useLeaveTo } from '../navigation/leave.tsx';
import { BringIn } from '../session/BringIn.tsx';
import { withProgress } from '../session/bringInChoices.ts';
import { MovedNotice } from '../session/MovedNotice.tsx';
import { takeNext } from '../session/next.ts';
import { ParentGate } from '../session/ParentGate.tsx';
import { cleanName, funIdentity, MAX_NAME_LENGTH, visibleLength } from '../session/profileNames.ts';
import { RequireSession } from '../session/RequireSession.tsx';
import { deleteEverywhere } from '../session/serverCopy.ts';
import { deviceMode } from '../session/session.ts';
import { useDeviceProfilesChanged, useSetMe } from '../session/useSession.ts';
import { switchNeedsGate, whoIsPlaying } from '../session/whoIsPlaying.ts';
import { db, type LocalProfile } from '../storage/db.ts';
import {
  AVATARS,
  createDeviceProfile,
  currentDeviceProfile,
  listDeviceProfiles,
  MAX_DEVICE_PROFILES,
  updateDeviceProfile,
} from '../storage/deviceProfiles.ts';
import { funnel } from '../telemetry/telemetry.ts';
import { AnotherName } from '../ui/AnotherName.tsx';
import { Avatar, AvatarGrid } from '../ui/AvatarGrid.tsx';
import { Button } from '../ui/Button.tsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx';
import { DataLink } from '../ui/DataLink.tsx';
import { Icon } from '../ui/Icon.tsx';
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

/** "Ai đang chơi?" asked at a cold start (whoIsPlaying.ts): shown, so not asked again until the next one. */
function useAsked(ask: boolean | undefined) {
  useEffect(() => {
    if (ask) whoIsPlaying.asked();
  }, [ask]);
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
  const { auto, ask } = useSearch({ from: '/_frame/account/profiles' });
  useAsked(ask);
  const navigate = useNavigate();
  const setMe = useSetMe();
  const goOn = useGoOn();
  const [pinFor, setPinFor] = useState<ProfileView | null>(null);
  // A child's profile moving up to an adult's: the account's manage PIN first (ADR 0046).
  const [gateFor, setGateFor] = useState<ProfileView | null>(null);
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
      // Asked at a cold start, the choice is the way on to what this tab came for, as when the hub sent someone here.
      entry.switched({ auto: auto || ask, from: me.activeProfileId, to: profile.id });
      setPinFor(null);
      await setMe(next);
      await goOn(profile.id);
    },
    onError: async (error, { profile }) => {
      if (error instanceof ApiError && error.code === 'pin_required') setPinFor(profile);
      if (error instanceof ApiError && error.code === 'pin_invalid') setPinErrors((n) => n + 1);
      // The API holds a child to the parent gate when it moves up (identity.md): the gate ran out between opening it and
      // choosing, or this device's clock disagrees. Management is closed as far as the API knows, so the session says so
      // first (else the gate would close itself again at once) and the parent is asked again.
      if (error instanceof ApiError && error.code === 'parent_gate_required') {
        setPinFor(null);
        await setMe({ ...me, parentUnlockedUntil: null });
        setGateFor(profile);
      }
    },
  });

  const signOut = useMutation({
    mutationFn: () => auth.logout(),
    onSettled: async () => {
      // Whoever signs in next on this device did not come for this tab's entry.
      entry.forget();
      // Nor is the next person greeted by this account's name on the public pages (ADR 0055).
      forgetGreeting(globalThis.localStorage);
      await setMe(null);
      await navigate({ to: '/account/sign-in', replace: true });
    },
  });

  const choose = (profile: ProfileView) => {
    if (switchNeedsGate(me, profile)) {
      setGateFor(profile);
    } else if (profile.hasPin) {
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
  // The gate opened (the parent typed the manage PIN, or proved it is them): on to the adult's profile — its own PIN
  // too, if it has one. Choosing locks management again (the API), so the child cannot come back up by itself.
  useEffect(() => {
    if (!gateFor || switchNeedsGate(me, gateFor)) return;
    setGateFor(null);
    if (gateFor.hasPin) {
      setPinErrors(0);
      setPinFor(gateFor);
    } else play({ profile: gateFor });
  }, [gateFor, me, play]);
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

  // The profile this device played last comes first and large; the others are below it (docs/architecture/surfaces.md).
  const last = me.profiles.find((profile) => profile.id === me.activeProfileId);
  const others = me.profiles.filter((profile) => profile !== last);

  return (
    <Screen>
      <PickerHeader context={me.account.displayName} lead={last !== undefined} />

      {last ? (
        <LastPlayer
          name={last.name}
          avatar={last.avatar}
          disabled={select.isPending}
          onChoose={() => choose(last)}
        />
      ) : null}

      {last && (others.length > 0 || !full) ? (
        <h2 className="font-bold text-ink text-lg">{t('profiles.others')}</h2>
      ) : null}
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {others.map((profile, index) => (
          <li key={profile.id} className="animate-pop-in" style={{ animationDelay: `${index * 40}ms` }}>
            <button
              type="button"
              onClick={() => choose(profile)}
              disabled={select.isPending}
              className="flex w-full flex-col items-center gap-2 rounded-3xl bg-surface p-4 shadow-sm transition active:scale-95 disabled:opacity-60"
            >
              <Avatar avatar={profile.avatar} size={last ? 'md' : 'lg'} />
              <span className="font-bold text-ink text-lg">{profile.name}</span>
              <span className="text-ink-soft text-sm">
                {profile.kind === 'adult'
                  ? t('profiles.adult')
                  : t('account.years', { band: profile.ageBand })}
                {profile.hasPin ? ` · ${t('account.hasPin')}` : ''}
              </span>
            </button>
          </li>
        ))}
        {full ? null : <AddTile onClick={() => void navigate({ to: '/account', search: { add: true } })} />}
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
        <Button
          variant="secondary"
          onClick={() => void navigate({ to: '/account', search: { manage: true } })}
        >
          <Icon name="gear-six" />
          {t('profiles.manage')}
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
      <Modal open={gateFor !== null} title={t('profiles.upTitle')} onClose={() => setGateFor(null)}>
        {/* Without a manage PIN yet, the gate asks the owner to prove it is them, in its own words. */}
        <ParentGate
          me={me}
          title={t('outbound.gateTitle')}
          body={me.account.hasManagePin ? t('profiles.upBody', { name: gateFor?.name ?? '' }) : undefined}
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
  const { auto, ask } = useSearch({ from: '/_frame/account/profiles' });
  useAsked(ask);
  const goOn = useGoOn();
  const changed = useDeviceProfilesChanged();
  const profiles = useQuery(deviceProfilesQuery);
  const [editing, setEditing] = useState<LocalProfile | 'new' | null>(null);
  const current = currentDeviceProfile.get();
  const list = profiles.data ?? [];

  const choose = async (profile: LocalProfile) => {
    entry.switched({ auto: auto || ask, from: current, to: profile.id });
    currentDeviceProfile.set(profile.id);
    await changed();
    await goOn(profile.id);
  };

  if (profiles.isPending) return <Loading label={t('loading')} />;
  const last = list.find((profile) => profile.id === current);
  const others = list.filter((profile) => profile !== last);
  const tile = (profile: LocalProfile, index: number) => (
    <li key={profile.id} className="relative animate-pop-in" style={{ animationDelay: `${index * 40}ms` }}>
      <button
        type="button"
        onClick={() => void choose(profile)}
        className="flex w-full flex-col items-center gap-2 rounded-3xl bg-surface p-4 pb-3 shadow-sm transition active:scale-95"
      >
        <Avatar avatar={profile.avatar} size={last ? 'md' : 'lg'} />
        <span className="max-w-full font-bold text-ink text-lg">{profile.name}</span>
        <span className="text-ink-soft text-sm">{t('device.onDevice')}</span>
      </button>
      <EditButton name={profile.name} onClick={() => setEditing(profile)} />
    </li>
  );

  return (
    <Screen>
      <PickerHeader context={t('device.title')} lead={last !== undefined} />

      <MovedNotice />

      {last ? (
        <div className="flex flex-col gap-2">
          <LastPlayer
            name={last.name}
            avatar={last.avatar}
            onChoose={() => void choose(last)}
            // Renaming or deleting the one playing is as near as the others': one labelled button.
          />
          <EditButton name={last.name} onClick={() => setEditing(last)} inline />
        </div>
      ) : null}

      {last && (others.length > 0 || list.length < MAX_DEVICE_PROFILES) ? (
        <h2 className="font-bold text-ink text-lg">{t('profiles.others')}</h2>
      ) : null}
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {others.map(tile)}
        {list.length < MAX_DEVICE_PROFILES ? <AddTile onClick={() => setEditing('new')} /> : null}
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

/**
 * The top of "Ai đang chơi?": who the profiles belong to, the theme choice at the other end, and the title — a heading to
 * read when nothing else asks the question, and only for screen readers when the last player's card does ("Vẫn là …?").
 */
function PickerHeader({ context, lead }: { context: string; lead: boolean }) {
  const { t } = useTranslation();
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1 pt-1">
        <p className="font-semibold text-ink-soft">{context}</p>
        <h1 className={lead ? 'sr-only' : 'font-black text-3xl text-brand-ink'}>{t('profiles.title')}</h1>
      </div>
      <ThemeButton />
    </header>
  );
}

/**
 * "Vẫn là {{name}}? Chơi tiếp": the profile played last, big and first, one tap to go on as it. Most opens of the hub
 * are the same player again, so the common case is a single press; anyone else is below.
 */
function LastPlayer({
  name,
  avatar,
  disabled = false,
  onChoose,
}: {
  name: string;
  avatar: string;
  disabled?: boolean;
  onChoose(): void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onChoose}
      disabled={disabled}
      className="flex w-full flex-col items-center gap-4 rounded-3xl bg-surface p-6 text-center shadow-sm transition active:scale-[0.98] disabled:opacity-60 sm:flex-row sm:gap-6 sm:text-left"
    >
      <Avatar avatar={avatar} size="lg" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-black text-2xl text-ink leading-tight">{t('profiles.stillYou', { name })}</span>
      </span>
      <span className="shrink-0 rounded-full bg-brand px-6 py-2.5 font-bold text-on-brand text-xl">
        {t('comingBack.continue')}
      </span>
    </button>
  );
}

/** "Thêm hồ sơ": the dashed tile after the profiles. */
function AddTile({ onClick }: { onClick(): void }) {
  const { t } = useTranslation();
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex size-full min-h-44 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-line-strong border-dashed p-4 text-brand-ink transition active:scale-95"
      >
        <span className="grid size-14 place-items-center rounded-full bg-soft text-3xl">
          <Icon name="plus" />
        </span>
        <span className="font-bold">{t('profiles.add')}</span>
      </button>
    </li>
  );
}

/** "Sửa" with its pencil: renames or deletes a device profile. Inside a tile at its corner, or on a row of its own. */
function EditButton({ name, onClick, inline = false }: { name: string; onClick(): void; inline?: boolean }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('device.editOf', { name })}
      className={`flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 font-semibold text-accent text-sm active:bg-soft ${
        inline ? 'self-center' : 'mx-auto'
      }`}
    >
      <Icon name="pencil-simple" className="text-lg" />
      {t('device.editShort')}
    </button>
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
  // A new profile starts as one animal: its name and its avatar match.
  const [start] = useState(() => funIdentity(i18n.language));
  const [name, setName] = useState(() => profile?.name ?? start.name);
  const [avatar, setAvatar] = useState(() => profile?.avatar ?? start.avatar);
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
        <AnotherName
          onClick={() => {
            // Another animal: the avatar follows the name.
            const next = funIdentity(i18n.language);
            setName(next.name);
            setAvatar(next.avatar);
          }}
        />
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
          <Icon name="device-mobile" />
          {t('transfer.send')}
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
