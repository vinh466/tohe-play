import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { type FormEvent, type ReactNode, useEffect, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, account, external, type MeView, type ProfileView, session } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { configQuery, profileOptionsQuery } from '../api/queries.ts';
import { BackLink, previousPath, useLeaveTo } from '../navigation/leave.tsx';
import { AuthenticatorSetup } from '../session/Authenticator.tsx';
import { EmailChange } from '../session/EmailChange.tsx';
import { ParentGate } from '../session/ParentGate.tsx';
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
import { Screen } from '../ui/Screen.tsx';
import { Switch } from '../ui/Switch.tsx';
import { TextField } from '../ui/TextField.tsx';
import { ThemeButton } from '../ui/ThemePicker.tsx';
import { shortVersion } from '../ui/version.ts';
import { MePage } from './MePage.tsx';

/** The account's profiles and settings, behind the parent gate (ADR 0011, 0023). */
/** Who may ask a profile to a table by its ID (ADR 0033), as the API names them, with their labels. */
const INVITE_SCOPES = [
  ['anyone', 'account.invitesAnyone'],
  ['played-with', 'account.invitesPlayedWith'],
  ['account', 'account.invitesAccount'],
] as const;

/** What `/account` reads from its address (router.tsx). */
export interface AccountSearch {
  manage?: true;
  add?: true;
  linked?: string;
  link_error?: string;
}

/**
 * `/account` is Tôi, the frame's third tab (ADR 0046); with `?manage=true` — or what comes back to the account's
 * management: `?add=`, `?linked=`, `?link_error=` (the API's `HubPaths.Account`) — Quản lý tài khoản.
 */
export function AccountPage() {
  const search = useSearch({ from: '/_frame/account' });
  if (!(search.manage || search.add || search.linked || search.link_error)) return <MePage />;
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
  const { add } = useSearch({ from: '/_frame/account' });
  // Back where the owner came from: the profile picker ("Quản lý tài khoản", "Thêm hồ sơ"), else Tôi.
  const back = previousPath() === '/account/profiles' ? '/account/profiles' : '/account';
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
    () => leaveTo({ to: back }),
  );

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <BackLink
          to={back}
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
          <Profiles me={me} startAdding={add === true} />
          <Security me={me} />
          <TechnicalData me={me} />
          <DeleteAccount me={me} />
          <footer className="mt-auto flex flex-col items-center gap-2">
            {me.account.consoleUrl ? (
              // The console has a host of its own and a sign-in of its own (ADR 0042): a full navigation there.
              <a
                href={me.account.consoleUrl}
                className="font-semibold text-accent underline underline-offset-4"
              >
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
  const [onPublicBoards, setOnPublicBoards] = useState(profile?.onPublicBoards ?? false);
  // Who may ask this profile to a table by its ID (ADR 0033); a child stays within the account.
  const [invites, setInvites] = useState(profile?.invites ?? 'anyone');
  // A child goes on public boards only once its owner says they asked it (D-06).
  const [askedChild, setAskedChild] = useState(false);
  const showingChild = profile?.kind === 'child' && onPublicBoards && !profile.onPublicBoards;
  const [unasked, setUnasked] = useState(false);
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
            onPublicBoards,
            askedChild: showingChild ? askedChild : null,
            invites: isChild ? null : invites,
          }),
    onDone,
  );
  const remove = useMeMutation(() => account.deleteProfile(profile?.id ?? ''), onDone);

  const pinInvalid = pin.length > 0 && !/^\d{4}$/.test(pin);
  const tooLong = visibleLength(cleanName(name)) > MAX_NAME_LENGTH;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!cleanName(name) || tooLong || pinInvalid) return;
    setUnasked(showingChild && !askedChild);
    if (showingChild && !askedChild) return;
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
      {profile?.kind === 'adult' ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 font-semibold text-ink">{t('account.invites')}</legend>
          <div className="flex flex-wrap gap-2">
            {INVITE_SCOPES.map(([scope, label]) => (
              <button
                key={scope}
                type="button"
                aria-pressed={scope === invites}
                onClick={() => setInvites(scope)}
                className={`min-h-11 rounded-full px-4 font-semibold text-ink transition active:scale-95 ${
                  scope === invites ? 'bg-soft-strong ring-2 ring-brand' : 'bg-surface'
                }`}
              >
                {t(label)}
              </button>
            ))}
          </div>
          <p className="text-ink-soft text-sm">{t('account.invitesHint')}</p>
        </fieldset>
      ) : profile?.kind === 'child' ? (
        <p className="text-ink-soft text-sm">{t('account.invitesChild')}</p>
      ) : null}
      {profile ? (
        <Switch
          label={t('account.onPublicBoards')}
          hint={t(
            profile.kind === 'child' ? 'account.onPublicBoardsChildHint' : 'account.onPublicBoardsHint',
          )}
          checked={onPublicBoards}
          onChange={setOnPublicBoards}
        />
      ) : null}
      {profile?.hiddenFromBoards ? (
        <p role="status" className="rounded-2xl bg-notice px-4 py-3 text-notice-ink">
          {t('account.hiddenFromBoards')}
        </p>
      ) : null}
      {showingChild ? (
        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-3 rounded-2xl bg-notice p-4 text-notice-ink">
            <input
              type="checkbox"
              checked={askedChild}
              onChange={(event) => setAskedChild(event.target.checked)}
              aria-invalid={unasked && !askedChild ? true : undefined}
              className="mt-0.5 size-5 shrink-0 accent-brand-strong"
            />
            <span className="font-semibold">{t('account.askedChild', { name: profile?.name ?? '' })}</span>
          </label>
          {unasked && !askedChild ? (
            <p role="alert" className="text-danger text-sm">
              {t('errors.askedChildRequired')}
            </p>
          ) : null}
        </div>
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
  const { linked, link_error: linkError } = useSearch({ from: '/_frame/account' });
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
      {me.account.role ? <TwoFactor me={me} /> : null}
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
                <a
                  href={external.startUrl(provider.id, { intent: 'link' })}
                  className={buttonClass('primary')}
                >
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

/**
 * The authenticator the console's sign-in asks for, for an account with a platform role (ADR 0027, 0042): added here,
 * within step-up level 2; new recovery codes and turning it off are in the console. The console's sign-in asks for the
 * password too, so an account that signs in only with a provider sets one first (`password_required`).
 */
function TwoFactor({ me }: { me: MeView }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ['account', 'two-factor'], queryFn: account.twoFactor });
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
    void queryClient.invalidateQueries({ queryKey: ['account', 'two-factor'] });
  };
  if (!status.data) return null;
  const needsPassword = !status.data.enabled && !me.account.hasPassword;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-semibold text-ink">
          {t('twoFactor.title')}
          <span className="ml-2 text-ink-soft text-sm">
            ({status.data.enabled ? t('twoFactor.on') : t('twoFactor.off')})
          </span>
        </span>
        {status.data.enabled || needsPassword ? null : (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            {t('twoFactor.add')}
          </Button>
        )}
      </div>
      <p className="text-ink-soft text-sm">
        {status.data.enabled
          ? t('twoFactor.manage')
          : needsPassword
            ? t('twoFactor.passwordFirst')
            : t('twoFactor.hint')}
      </p>
      <SecureModal me={me} open={open} title={t('twoFactor.add')} onClose={close}>
        {() => <AuthenticatorSetup onDone={close} />}
      </SecureModal>
    </div>
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
      <Link to="/account/data" className="font-semibold text-accent underline underline-offset-4">
        {t('data.more')}
      </Link>
    </Card>
  );
}

/**
 * Deleting the account (ADR 0034, design §3.14): step-up level 2, then a last look at what goes and what stays. Every
 * session ends — this one too — and the account goes for good after seven days, unless someone signs in to it.
 */
function DeleteAccount({ me }: { me: MeView }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Card title={t('deleteAccount.title')}>
      <p className="text-ink-soft">{t('deleteAccount.hint')}</p>
      <Button variant="danger" onClick={() => setOpen(true)}>
        {t('deleteAccount.start')}
      </Button>
      <SecureModal me={me} open={open} title={t('deleteAccount.title')} onClose={() => setOpen(false)}>
        {() => <ConfirmDeletion />}
      </SecureModal>
    </Card>
  );
}

function ConfirmDeletion() {
  const { t } = useTranslation();
  const setMe = useSetMe();
  const navigate = useNavigate();
  const remove = useMutation({
    mutationFn: () => account.deleteAccount(),
    onSuccess: async ({ deleteAfter }) => {
      // This device is signed out too: what the hub knew of the session goes with it.
      await setMe(null);
      await navigate({ to: '/account/sign-in', search: { deleting: deleteAfter }, replace: true });
    },
  });
  return (
    <div className="flex flex-col gap-4">
      <p className="font-semibold text-ink">{t('deleteAccount.body')}</p>
      <ul className="flex list-disc flex-col gap-2 pl-5 text-ink-soft">
        <li>{t('deleteAccount.goes')}</li>
        <li>{t('deleteAccount.stays')}</li>
        <li>{t('deleteAccount.keep')}</li>
      </ul>
      {remove.isError ? (
        <p role="alert" className="text-danger">
          {t(errorKey(remove.error))}
        </p>
      ) : null}
      <Button variant="danger" busy={remove.isPending} onClick={() => remove.mutate()}>
        {t('deleteAccount.confirm')}
      </Button>
    </div>
  );
}

function Version() {
  const { t } = useTranslation();
  const config = useQuery(configQuery);
  return config.data ? (
    <p className="text-ink-soft text-xs">
      {t('account.version', { version: shortVersion(config.data.apiVersion) })}
    </p>
  ) : null;
}
