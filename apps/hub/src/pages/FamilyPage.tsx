import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { type FormEvent, type ReactNode, useEffect, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, household, type MeView, type ProfileView, session } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { configQuery, profileOptionsQuery } from '../api/queries.ts';
import { RequireSession } from '../session/RequireSession.tsx';
import { parentUnlocked } from '../session/session.ts';
import { useSetMe } from '../session/useSession.ts';
import { Avatar, AvatarGrid } from '../ui/AvatarGrid.tsx';
import { Button } from '../ui/Button.tsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx';
import { Modal } from '../ui/Modal.tsx';
import { Screen } from '../ui/Screen.tsx';
import { TextField } from '../ui/TextField.tsx';
import { ThemeButton } from '../ui/ThemePicker.tsx';

export function FamilyPage() {
  return <RequireSession need="account">{({ me }) => <Family me={me} />}</RequireSession>;
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

function Family({ me }: { me: MeView }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { add } = useSearch({ from: '/family' });
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
    () => void navigate({ to: '/profiles' }),
  );

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <Link
          to="/profiles"
          aria-label={t('back')}
          className="grid size-11 place-items-center rounded-full bg-surface text-accent text-xl shadow-sm active:scale-95"
        >
          ←
        </Link>
        <h1 className="min-w-0 flex-1 font-black text-3xl text-brand-ink">{t('family.title')}</h1>
        <ThemeButton />
      </header>

      {unlocked ? (
        <>
          <HouseholdName me={me} />
          <Profiles me={me} startAdding={add} />
          <Invite me={me} />
          <Members me={me} />
          <footer className="mt-auto flex flex-col items-center gap-2">
            <Button variant="secondary" busy={lock.isPending} onClick={() => lock.mutate(undefined)}>
              🔒 {t('family.lock')}
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

function ParentGate({ me }: { me: MeView }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const unlock = useMeMutation((value: string) => session.unlockParentGate(value));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    unlock.mutate(password);
  };
  return (
    <form
      onSubmit={submit}
      className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-3xl bg-surface p-6 shadow-sm"
    >
      <div className="text-center text-5xl">🔐</div>
      <h2 className="text-center font-black text-2xl text-ink">{t('family.gateTitle')}</h2>
      <p className="text-center text-ink-soft">{t('family.gateBody', { name: me.account.displayName })}</p>
      <TextField
        label={t('welcome.password')}
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={unlock.isError ? t(errorKey(unlock.error)) : null}
      />
      <Button type="submit" busy={unlock.isPending}>
        {t('family.unlock')}
      </Button>
    </form>
  );
}

function HouseholdName({ me }: { me: MeView }) {
  const { t } = useTranslation();
  const [name, setName] = useState(me.household.name);
  const rename = useMeMutation((value: string) => household.rename(value));
  const changed = name.trim() !== me.household.name && name.trim().length > 0;
  return (
    <Card title={t('family.household')}>
      <form
        className="flex items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (changed) rename.mutate(name.trim());
        }}
      >
        <TextField
          className="flex-1"
          label={t('family.householdName')}
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={rename.isError ? t(errorKey(rename.error)) : null}
        />
        <Button type="submit" disabled={!changed} busy={rename.isPending}>
          {t('save')}
        </Button>
      </form>
    </Card>
  );
}

function Profiles({ me, startAdding }: { me: MeView; startAdding: boolean }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<ProfileView | 'new' | null>(startAdding ? 'new' : null);
  return (
    <Card title={t('family.profiles')}>
      <ul className="flex flex-col gap-2">
        {me.profiles.map((profile) => {
          const editable = profile.kind === 'child' || profile.isMine;
          return (
            <li key={profile.id}>
              <button
                type="button"
                disabled={!editable}
                onClick={() => setEditing(profile)}
                className="flex w-full items-center gap-3 rounded-2xl bg-fill p-3 text-left transition active:scale-[0.98] disabled:active:scale-100"
              >
                <Avatar avatar={profile.avatar} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-bold text-ink">{profile.name}</span>
                  <span className="text-ink-soft text-sm">
                    {profile.kind === 'adult'
                      ? t('profiles.adult')
                      : t('family.years', { band: profile.ageBand })}
                    {profile.hasPin ? ` · 🔒 ${t('family.hasPin')}` : ''}
                  </span>
                </span>
                {editable ? (
                  <span aria-hidden className="text-ink-soft text-xl">
                    ›
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <Button variant="secondary" onClick={() => setEditing('new')}>
        + {t('family.addChild')}
      </Button>
      <Modal
        open={editing !== null}
        title={editing === 'new' ? t('family.newChild') : t('family.editProfile')}
        onClose={() => setEditing(null)}
      >
        {editing ? (
          <ProfileForm profile={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
        ) : null}
      </Modal>
    </Card>
  );
}

function ProfileForm({ profile, onDone }: { profile: ProfileView | null; onDone(): void }) {
  const { t } = useTranslation();
  const options = useQuery(profileOptionsQuery);
  const isChild = profile === null || profile.kind === 'child';
  const [name, setName] = useState(profile?.name ?? '');
  const [avatar, setAvatar] = useState(profile?.avatar ?? options.data?.avatars[1] ?? '🐼');
  const [ageBand, setAgeBand] = useState(profile?.ageBand ?? '6-8');
  const [pin, setPin] = useState('');
  const [removePin, setRemovePin] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = useMeMutation(
    () =>
      profile === null
        ? household.addProfile({ name: name.trim(), avatar, ageBand, pin: pin || null })
        : household.updateProfile(profile.id, {
            name: name.trim(),
            avatar,
            ageBand: isChild ? ageBand : null,
            pin: pin || null,
            removePin: removePin || null,
          }),
    onDone,
  );
  const remove = useMeMutation(() => household.deleteProfile(profile?.id ?? ''), onDone);

  const pinInvalid = pin.length > 0 && !/^\d{4}$/.test(pin);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || pinInvalid) return;
    save.mutate(undefined);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <TextField
        label={t('family.name')}
        required
        maxLength={20}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <AvatarGrid
        avatars={options.data?.avatars ?? []}
        value={avatar}
        onChange={setAvatar}
        label={t('family.avatar')}
      />
      {isChild ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 font-semibold text-ink">{t('family.ageBand')}</legend>
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
                {t('family.years', { band })}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
      <TextField
        label={t('family.pin')}
        hint={t('family.pinHint')}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        error={pinInvalid ? t('family.pinHint') : null}
      />
      {profile?.hasPin ? (
        <label className="flex items-center gap-3 font-semibold text-ink">
          <input
            type="checkbox"
            checked={removePin}
            onChange={(e) => setRemovePin(e.target.checked)}
            className="size-6 accent-brand"
          />
          {t('family.removePin')}
        </label>
      ) : null}
      {save.isError ? (
        <p role="alert" className="text-danger">
          {t(errorKey(save.error))}
        </p>
      ) : null}
      <Button type="submit" busy={save.isPending}>
        {t('save')}
      </Button>
      {profile?.kind === 'child' ? (
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          {t('family.delete')}
        </Button>
      ) : null}
      <ConfirmDialog
        open={confirmDelete}
        title={t('family.deleteTitle', { name: profile?.name ?? '' })}
        body={t('family.deleteBody')}
        primary={{ label: t('cancel'), onClick: () => setConfirmDelete(false) }}
        secondary={{
          label: t('family.delete'),
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

function Invite({ me }: { me: MeView }) {
  const { t, i18n } = useTranslation();
  const create = useMeMutation(() => household.createInvite());
  const revoke = useMeMutation(() => household.revokeInvite());
  const invite = me.household.invite;
  return (
    <Card title={t('family.invite')}>
      {invite ? (
        <>
          <p
            className="select-all rounded-2xl bg-fill py-4 text-center font-black font-mono text-4xl text-accent tracking-[0.2em]"
            aria-live="polite"
          >
            {invite.code.slice(0, 4)}-{invite.code.slice(4)}
          </p>
          <p className="text-ink-soft text-sm">
            {t('family.inviteBody', {
              date: new Date(invite.expiresAt).toLocaleDateString(i18n.language, {
                day: 'numeric',
                month: 'long',
              }),
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" busy={create.isPending} onClick={() => create.mutate(undefined)}>
              {t('family.inviteRenew')}
            </Button>
            <Button variant="ghost" busy={revoke.isPending} onClick={() => revoke.mutate(undefined)}>
              {t('family.inviteRevoke')}
            </Button>
          </div>
        </>
      ) : (
        <Button variant="secondary" busy={create.isPending} onClick={() => create.mutate(undefined)}>
          ✉️ {t('family.inviteCreate')}
        </Button>
      )}
    </Card>
  );
}

function Members({ me }: { me: MeView }) {
  const { t } = useTranslation();
  return (
    <Card title={t('family.members')}>
      <ul className="flex flex-col gap-1">
        {me.household.members.map((member) => (
          <li key={member.accountId} className="flex justify-between gap-3 text-ink">
            <span className="font-semibold">
              {member.displayName}
              {member.accountId === me.account.id ? ` (${t('family.you')})` : ''}
            </span>
            <span className="text-ink-soft">@{member.username}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Version() {
  const { t } = useTranslation();
  const config = useQuery(configQuery);
  return config.data ? (
    <p className="text-ink-soft text-xs">{t('family.version', { version: config.data.apiVersion })}</p>
  ) : null;
}
