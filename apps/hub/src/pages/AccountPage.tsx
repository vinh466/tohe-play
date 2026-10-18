import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import { type FormEvent, type ReactNode, useEffect, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, account, external, type MeView, type ProfileView, session } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { configQuery, profileOptionsQuery } from '../api/queries.ts';
import { BackLink, useLeaveTo } from '../navigation/leave.tsx';
import { EmailChange } from '../session/EmailChange.tsx';
import { formatProfileId } from '../session/profileIds.ts';
import { cleanName, MAX_NAME_LENGTH, visibleLength } from '../session/profileNames.ts';
import { RequireSession } from '../session/RequireSession.tsx';
import { ManagePinForm, PasswordForm } from '../session/SecurityForms.tsx';
import { StepUp } from '../session/StepUp.tsx';
import { isSecure, parentUnlocked } from '../session/session.ts';
import { useSetMe } from '../session/useSession.ts';
import { Avatar, AvatarGrid } from '../ui/AvatarGrid.tsx';
import { Button, buttonClass } from '../ui/Button.tsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx';
import { copyText } from '../ui/copyText.ts';
import { Modal } from '../ui/Modal.tsx';
import { PinPad } from '../ui/PinPad.tsx';
import { Screen } from '../ui/Screen.tsx';
import { Switch } from '../ui/Switch.tsx';
import { TextField } from '../ui/TextField.tsx';
import { ThemeButton } from '../ui/ThemePicker.tsx';

/** The account's profiles and settings, behind the parent gate (ADR 0011, 0023). */
export function AccountPage() {
  return <RequireSession need="account">{({ me }) => <ManageAccount me={me} />}</RequireSession>;
}

/** A mutation that stores the returned session, and shows the gate again if management locked meanwhile. */
function useMeMutation<T>(run: (input: T) => Promise<MeView>, onDone?: () => void) {
  const setMe = useSetMe();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: async (me) => {
      await setMe(me);
      onDone?.();
    },
    onError: async (error) => {
      if (error instanceof ApiError && error.code === 'parent_gate_required') {
        await queryClient.invalidateQueries({ queryKey: ['me'] });
      }
    },
  });
}

function ManageAccount({ me }: { me: MeView }) {
  const { t } = useTranslation();
  const leaveTo = useLeaveTo();
  const { add } = useSearch({ from: '/account' });
  const unlocked = parentUnlocked(me);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  // Re-render when the gate expires so the page locks itself without a request.
  useEffect(() => {
    if (!me.parentUnlockedUntil) return;
    const ms = new Date(me.parentUnlockedUntil).getTime() - Date.now();
    if (ms <= 0) return;
    const timer = setTimeout(rerender, ms + 100);
    return () => clearTimeout(timer);
  }, [me.parentUnlockedUntil]);

  const lock = useMeMutation(
    () => session.lockParentGate(),
    () => leaveTo({ to: '/profiles' }),
  );

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <BackLink
          to="/profiles"
          aria-label={t('back')}
          className="grid size-11 place-items-center rounded-full bg-surface text-accent text-xl shadow-sm active:scale-95"
        >
          ←
        </BackLink>
        <h1 className="min-w-0 flex-1 font-black text-3xl text-brand-ink">{t('account.title')}</h1>
        <ThemeButton />
      </header>

      {unlocked ? (
        <>
          {me.account.hasManagePin ? null : <ManagePinNudge me={me} />}
          <Profiles me={me} startAdding={add} />
          <Security me={me} />
          <TechnicalData me={me} />
          <footer className="mt-auto flex flex-col items-center gap-2">
            {me.account.role ? (
              // The console is its own app on this origin (ADR 0027): a full navigation, not a hub route.
              <a href="/admin/" className="font-semibold text-accent underline underline-offset-4">
                {t('account.admin')}
              </a>
            ) : null}
            <Button variant="secondary" busy={lock.isPending} onClick={() => lock.mutate(undefined)}>
              🔒 {t('account.lock')}
            </Button>
            <Version />
          </footer>
        </>
      ) : (
        <ParentGate me={me} />
      )}
    </Screen>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm">
      <h2 className="font-bold text-ink text-xl">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Profile management opens with the account's manage PIN (step-up level 1, ADR 0025). Without one yet — or when it is
 * forgotten — the owner proves it is them (level 2), which opens it too and lets them set the PIN.
 */
function ParentGate({ me }: { me: MeView }) {
  const { t } = useTranslation();
  const setMe = useSetMe();
  const [forgot, setForgot] = useState(false);
  const [wrong, setWrong] = useState(0);
  const unlock = useMeMutation((pin: string) => session.unlockParentGate(pin));
  const usePin = me.account.hasManagePin && !forgot;
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-3xl bg-surface p-6 shadow-sm">
      <div className="text-center text-5xl">🔐</div>
      <h2 className="text-center font-black text-2xl text-ink">{t('account.gateTitle')}</h2>
      {usePin ? (
        <>
          <p className="text-center text-ink-soft">
            {t('account.gateBody', { name: me.account.displayName })}
          </p>
          <PinPad
            length={6}
            errorKey={wrong}
            error={unlock.isError ? t(errorKey(unlock.error)) : null}
            disabled={unlock.isPending}
            onComplete={(pin) =>
              unlock.mutate(pin, {
                onError: () => setWrong((n) => n + 1),
              })
            }
          />
          <Button variant="ghost" onClick={() => setForgot(true)}>
            {t('managePin.forgot')}
          </Button>
        </>
      ) : (
        <>
          <p className="text-center text-ink-soft">{t('managePin.firstBody')}</p>
          <StepUp me={me} onDone={setMe} />
        </>
      )}
    </section>
  );
}

/** Profile management is open without a manage PIN: setting one now makes the next time six digits. */
function ManagePinNudge({ me }: { me: MeView }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-notice p-5 text-notice-ink">
      <p>{t('managePin.nudge')}</p>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t('managePin.setTitle')}
      </Button>
      <SecureModal me={me} open={open} title={t('managePin.setTitle')} onClose={() => setOpen(false)}>
        {(done) => <ManagePinForm onDone={done} />}
      </SecureModal>
    </section>
  );
}

/**
 * A change to account security (ADR 0025): first step-up level 2 when it is not open on this device, then the form.
 * `done` stores the new session and closes the sheet.
 */
function SecureModal({
  me,
  open,
  title,
  onClose,
  children,
}: {
  me: MeView;
  open: boolean;
  title: string;
  onClose(): void;
  children: (done: (next: MeView) => Promise<void>) => ReactNode;
}) {
  const setMe = useSetMe();
  const done = async (next: MeView) => {
    await setMe(next);
    onClose();
  };
  return (
    <Modal open={open} title={title} onClose={onClose}>
      {open ? isSecure(me) ? children(done) : <StepUp me={me} onDone={setMe} /> : null}
    </Modal>
  );
}

function Profiles({ me, startAdding }: { me: MeView; startAdding: boolean }) {
  const { t } = useTranslation();
  const options = useQuery(profileOptionsQuery);
  const max = options.data?.maxProfiles ?? null;
  const full = max !== null && me.profiles.length >= max;
  const [editing, setEditing] = useState<ProfileView | 'new' | null>(startAdding ? 'new' : null);
  return (
    <Card title={t('account.profiles')}>
      {max !== null ? (
        <p className="-mt-2 text-ink-soft text-sm">{t('account.profilesHint', { max })}</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {me.profiles.map((profile) => (
          <li key={profile.id}>
            <button
              type="button"
              onClick={() => setEditing(profile)}
              className="flex w-full items-center gap-3 rounded-2xl bg-fill p-3 text-left transition active:scale-[0.98]"
            >
              <Avatar avatar={profile.avatar} size="sm" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-bold text-ink">{profile.name}</span>
                <span className="text-ink-soft text-sm">
                  {profile.kind === 'adult'
                    ? t('profiles.adult')
                    : t('account.years', { band: profile.ageBand })}
                  {profile.hasPin ? ` · 🔒 ${t('account.hasPin')}` : ''}
                </span>
                <span className="font-mono text-ink-soft text-xs tabular-nums">
                  {t('account.publicId')} {formatProfileId(profile.publicId)}
                </span>
              </span>
              <span aria-hidden className="text-ink-soft text-xl">
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
      {full ? (
        <p className="text-ink-soft text-sm">{t('account.full', { max })}</p>
      ) : (
        <Button variant="secondary" onClick={() => setEditing('new')}>
          + {t('account.addProfile')}
        </Button>
      )}
      <Modal
        open={editing !== null}
        title={editing === 'new' ? t('account.newProfile') : t('account.editProfile')}
        onClose={() => setEditing(null)}
      >
        {editing ? (
          <ProfileForm
            profile={editing === 'new' ? null : editing}
            canDelete={me.profiles.length > 1}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Modal>
    </Card>
  );
}

/** The profile's public ID, to read out or paste to a friend. */
function PublicId({ id }: { id: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-fill px-4 py-3">
      <span className="flex min-w-0 flex-col">
        <span className="text-ink-soft text-sm">{t('account.publicId')}</span>
        <span className="select-all font-bold font-mono text-ink text-xl tabular-nums">
          {formatProfileId(id)}
        </span>
      </span>
      <Button variant="ghost" onClick={() => void copyText(id).then(setCopied)}>
        {copied ? `✓ ${t('account.copied')}` : t('account.copyId')}
      </Button>
    </div>
  );
}

function ProfileForm({
  profile,
  canDelete,
  onDone,
}: {
  profile: ProfileView | null;
  canDelete: boolean;
  onDone(): void;
}) {
  const { t } = useTranslation();
  const options = useQuery(profileOptionsQuery);
  // Chosen once, when the profile is made (ADR 0023): a child's age band filters games and rooms.
  const [kind, setKind] = useState<'adult' | 'child'>(profile?.kind === 'adult' ? 'adult' : 'child');
  const isChild = kind === 'child';
  const [name, setName] = useState(profile?.name ?? '');
  const [avatar, setAvatar] = useState(profile?.avatar ?? options.data?.avatars[1] ?? '🐼');
  const [ageBand, setAgeBand] = useState(profile?.ageBand ?? '6-8');
  const [pin, setPin] = useState('');
  const [removePin, setRemovePin] = useState(false);
  const [playWithOthers, setPlayWithOthers] = useState(profile?.playWithOthers ?? false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = useMeMutation(
    () =>
      profile === null
        ? account.addProfile({
            name: cleanName(name),
            avatar,
            ageBand: isChild ? ageBand : null,
            pin: pin || null,
          })
        : account.updateProfile(profile.id, {
            name: cleanName(name),
            avatar,
            ageBand: isChild ? ageBand : null,
            pin: pin || null,
            removePin: removePin || null,
            playWithOthers: isChild ? playWithOthers : null,
          }),
    onDone,
  );
  const remove = useMeMutation(() => account.deleteProfile(profile?.id ?? ''), onDone);

  const pinInvalid = pin.length > 0 && !/^\d{4}$/.test(pin);
  const tooLong = visibleLength(cleanName(name)) > MAX_NAME_LENGTH;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!cleanName(name) || tooLong || pinInvalid) return;
    save.mutate(undefined);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {profile ? <PublicId id={profile.publicId} /> : null}
      {profile === null ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 font-semibold text-ink">{t('account.kind')}</legend>
          <div className="flex flex-wrap gap-2">
            {(['child', 'adult'] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                aria-pressed={choice === kind}
                onClick={() => setKind(choice)}
                className={`min-h-11 rounded-full px-4 font-semibold text-ink transition active:scale-95 ${
                  choice === kind ? 'bg-soft-strong ring-2 ring-brand' : 'bg-surface'
                }`}
              >
                {choice === 'child' ? t('account.kindChild') : t('account.kindAdult')}
              </button>
            ))}
          </div>
          {isChild ? <p className="text-ink-soft text-sm">{t('account.kidPreset')}</p> : null}
        </fieldset>
      ) : null}
      <TextField
        label={t('account.name')}
        hint={t('account.nameHint')}
        required
        maxLength={128}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={tooLong ? t('errors.nameTooLong') : null}
      />
      <AvatarGrid
        avatars={options.data?.avatars ?? []}
        value={avatar}
        onChange={setAvatar}
        label={t('account.avatar')}
      />
      {isChild ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 font-semibold text-ink">{t('account.ageBand')}</legend>
          <div className="flex flex-wrap gap-2">
            {(options.data?.ageBands ?? []).map((band) => (
              <button
                key={band}
                type="button"
                aria-pressed={band === ageBand}
                onClick={() => setAgeBand(band)}
                className={`min-h-11 rounded-full px-4 font-semibold text-ink transition active:scale-95 ${
                  band === ageBand ? 'bg-soft-strong ring-2 ring-brand' : 'bg-surface'
                }`}
              >
                {t('account.years', { band })}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
      <TextField
        label={t('account.pin')}
        hint={t('account.pinHint')}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        error={pinInvalid ? t('account.pinHint') : null}
      />
      {profile?.hasPin ? (
        <label className="flex items-center gap-3 font-semibold text-ink">
          <input
            type="checkbox"
            checked={removePin}
            onChange={(e) => setRemovePin(e.target.checked)}
            className="size-6 accent-brand"
          />
          {t('account.removePin')}
        </label>
      ) : null}
      {profile?.kind === 'child' ? (
        <Switch
          label={t('account.playWithOthers')}
          hint={t('account.playWithOthersHint')}
          checked={playWithOthers}
          onChange={setPlayWithOthers}
        />
      ) : null}
      {save.isError || remove.isError ? (
        <p role="alert" className="text-danger">
          {t(errorKey(save.error ?? remove.error))}
        </p>
      ) : null}
      <Button type="submit" busy={save.isPending}>
        {t('save')}
      </Button>
      {profile && canDelete ? (
        <Button variant="danger" busy={remove.isPending} onClick={() => setConfirmDelete(true)}>
          {t('account.delete')}
        </Button>
      ) : null}
      <ConfirmDialog
        open={confirmDelete}
        title={t('account.deleteTitle', { name: profile?.name ?? '' })}
        body={t('account.deleteBody')}
        primary={{ label: t('cancel'), onClick: () => setConfirmDelete(false) }}
        secondary={{
          label: t('account.delete'),
          onClick: () => {
            setConfirmDelete(false);
            remove.mutate(undefined);
          },
        }}
        onDismiss={() => setConfirmDelete(false)}
      />
    </form>
  );
}

/**
 * What protects the account (ADR 0024, 0025): the sign-in email — changed, or added by an account from before email
 * sign-in, with a code sent to the new one — the password and the manage PIN. Each change asks for step-up level 2
 * first when it is not open on this device.
 */
function Security({ me }: { me: MeView }) {
  const { t } = useTranslation();
  const config = useQuery(configQuery);
  const { linked, link_error: linkError } = useSearch({ from: '/account' });
  const [open, setOpen] = useState<string | null>(null);
  const email = me.account.email;
  const close = () => setOpen(null);
  const row = 'flex flex-wrap items-center justify-between gap-3';
  const providers = config.data?.providers ?? [];
  const nameOf = (id: string) => providers.find((provider) => provider.id === id)?.name ?? id;
  return (
    <Card title={t('security.title')}>
      {linked ? (
        <p role="status" className="rounded-2xl bg-notice px-4 py-3 text-notice-ink">
          {t('external.linked', { provider: nameOf(linked) })}
        </p>
      ) : null}
      {linkError ? (
        <p role="alert" className="text-danger">
          {t(errorKey(new ApiError(400, linkError)))}
        </p>
      ) : null}
      <div className={row}>
        <div className="flex min-w-0 flex-col">
          <span className="text-ink-soft text-sm">{t('account.emailTitle')}</span>
          <span className={email ? 'break-all font-semibold text-ink' : 'text-ink-soft'}>
            {email ?? t('account.emailNone')}
          </span>
        </div>
        {config.data?.email ? (
          <Button variant="secondary" onClick={() => setOpen('email')}>
            {email ? t('account.emailChange') : t('account.emailAdd')}
          </Button>
        ) : null}
      </div>
      <div className={row}>
        <span className="font-semibold text-ink">{t('security.password')}</span>
        <Button variant="secondary" onClick={() => setOpen('password')}>
          {me.account.hasPassword ? t('security.passwordChange') : t('security.passwordSet')}
        </Button>
      </div>
      <div className={row}>
        <span className="font-semibold text-ink">{t('managePin.title')}</span>
        <Button variant="secondary" onClick={() => setOpen('pin')}>
          {me.account.hasManagePin ? t('managePin.change') : t('managePin.setTitle')}
        </Button>
      </div>
      <SecureModal
        me={me}
        open={open === 'email'}
        title={email ? t('account.emailChange') : t('account.emailAdd')}
        onClose={close}
      >
        {(done) => <EmailChange onDone={done} />}
      </SecureModal>
      <SecureModal
        me={me}
        open={open === 'password'}
        title={me.account.hasPassword ? t('security.passwordChange') : t('security.passwordSet')}
        onClose={close}
      >
        {(done) => <PasswordForm onDone={done} />}
      </SecureModal>
      <SecureModal
        me={me}
        open={open === 'pin'}
        title={me.account.hasManagePin ? t('managePin.change') : t('managePin.setTitle')}
        onClose={close}
      >
        {(done) => <ManagePinForm onDone={done} />}
      </SecureModal>
      {providers.map((provider) => {
        const isLinked = me.account.logins.includes(provider.id);
        return (
          <div key={provider.id} className={row}>
            <span className="font-semibold text-ink">
              {provider.name}
              {isLinked ? <span className="ml-2 text-ink-soft text-sm">{t('external.isLinked')}</span> : null}
            </span>
            <Button
              variant="secondary"
              onClick={() => setOpen(`${isLinked ? 'unlink' : 'link'}:${provider.id}`)}
            >
              {isLinked ? t('external.unlink') : t('external.link')}
            </Button>
            <SecureModal
              me={me}
              open={open === `link:${provider.id}`}
              title={t('external.linkTitle', { provider: provider.name })}
              onClose={close}
            >
              {() => (
                // A full trip to the provider and back, within the step-up just made (ADR 0026).
                <a href={external.startUrl(provider.id, 'link')} className={buttonClass('primary')}>
                  {t('external.continueWith', { name: provider.name })}
                </a>
              )}
            </SecureModal>
            <SecureModal
              me={me}
              open={open === `unlink:${provider.id}`}
              title={t('external.unlinkTitle', { provider: provider.name })}
              onClose={close}
            >
              {(done) => <Unlink provider={provider.id} name={provider.name} onDone={done} />}
            </SecureModal>
          </div>
        );
      })}
    </Card>
  );
}

/** Removing a provider: never the last way in, and every other session ends (ADR 0026). */
function Unlink({
  provider,
  name,
  onDone,
}: {
  provider: string;
  name: string;
  onDone(next: MeView): Promise<void>;
}) {
  const { t } = useTranslation();
  const unlink = useMutation({ mutationFn: () => account.unlink(provider), onSuccess: onDone });
  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink">{t('external.unlinkBody', { provider: name })}</p>
      {unlink.isError ? (
        <p role="alert" className="text-danger">
          {t(errorKey(unlink.error))}
        </p>
      ) : null}
      <Button variant="danger" busy={unlink.isPending} onClick={() => unlink.mutate()}>
        {t('external.unlink')}
      </Button>
    </div>
  );
}

/** The account's telemetry switch (ADR 0015); the details and the device switch are on the "Dữ liệu kỹ thuật" page. */
function TechnicalData({ me }: { me: MeView }) {
  const { t } = useTranslation();
  const update = useMeMutation((on: boolean) => account.setTelemetry(on));
  return (
    <Card title={t('data.title')}>
      <Switch
        label={t('data.account')}
        hint={t('data.accountHint')}
        checked={update.isPending ? update.variables : me.account.telemetry}
        disabled={update.isPending}
        onChange={(on) => update.mutate(on)}
      />
      {update.isError ? (
        <p role="alert" className="text-danger">
          {t(errorKey(update.error))}
        </p>
      ) : null}
      <Link to="/data" className="font-semibold text-accent underline underline-offset-4">
        {t('data.more')}
      </Link>
    </Card>
  );
}

function Version() {
  const { t } = useTranslation();
  const config = useQuery(configQuery);
  return config.data ? (
    <p className="text-ink-soft text-xs">{t('account.version', { version: config.data.apiVersion })}</p>
  ) : null;
}
