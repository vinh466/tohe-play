import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { auth, type MeView } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { configQuery, deviceProfilesQuery } from '../api/queries.ts';
import { entry } from '../entry/intent.ts';
import { forgetGreeting } from '../launcher/recent.ts';
import { useLeaveTo } from '../navigation/leave.tsx';
import { EmailChange } from '../session/EmailChange.tsx';
import { takeNext } from '../session/next.ts';
import { ProviderButtons } from '../session/ProviderButtons.tsx';
import { cleanName, funIdentity, MAX_NAME_LENGTH, visibleLength } from '../session/profileNames.ts';
import { RequireSession } from '../session/RequireSession.tsx';
import { deviceMode } from '../session/session.ts';
import { useDeviceProfilesChanged, useSetMe } from '../session/useSession.ts';
import { db } from '../storage/db.ts';
import { AVATARS, createDeviceProfile, MAX_DEVICE_PROFILES } from '../storage/deviceProfiles.ts';
import { funnel } from '../telemetry/telemetry.ts';
import { AnotherName } from '../ui/AnotherName.tsx';
import { Avatar, AvatarGrid } from '../ui/AvatarGrid.tsx';
import { Button } from '../ui/Button.tsx';
import { Screen } from '../ui/Screen.tsx';
import { TextField } from '../ui/TextField.tsx';
import { ThemeButton } from '../ui/ThemePicker.tsx';

export function WelcomePage() {
  return (
    <RequireSession need="signedOut">
      <SignIn />
    </RequireSession>
  );
}

/** Logo, name and tagline at the top of the sign-in screens. */
export function Brand({ subtitle }: { subtitle: string }) {
  const { t } = useTranslation();
  return (
    <header className="relative flex flex-col items-center gap-2 pt-4 text-center">
      <div className="absolute top-0 right-0">
        <ThemeButton />
      </div>
      <img src="/favicon.svg" alt="" className="size-20 rounded-3xl shadow-glow shadow-lg" />
      <h1 className="font-black text-4xl text-brand-ink">{t('appName')}</h1>
      <p className="max-w-xs text-ink-soft">{subtitle}</p>
    </header>
  );
}

function SignIn() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const setMe = useSetMe();
  const config = useQuery(configQuery);
  const { external, deleting } = useSearch({ from: '/_frame/account/sign-in' });
  // The console's switches (ADR 0028).
  const passwordOn = config.data?.passwordSignIn ?? true;
  const registration = config.data?.registration ?? 'open';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Signed in, but an account from before email sign-in adds one first (ADR 0024).
  const [needsEmail, setNeedsEmail] = useState(false);

  const login = useMutation({
    mutationFn: () => auth.login(email.trim(), password),
    onSuccess: async (me) => {
      // The device stays in device mode until the profile picker offered to bring its device profiles in (ADR 0043).
      if (me.account.email === null && config.data?.email) {
        setNeedsEmail(true);
        return;
      }
      // The session guard of this page moves on to the picker as soon as the session changes; navigating here too
      // would pass through the picker twice.
      await setMe(me);
    },
  });

  const signOut = useMutation({
    mutationFn: () => auth.logout(),
    onSettled: async () => {
      // Whoever signs in next on this device did not come for this tab's entry (ADR 0044).
      entry.forget();
      // Nor is the next person greeted by this account's name on the public pages (ADR 0055).
      forgetGreeting(globalThis.localStorage);
      // Signing out is a choice, not a session that ended (session/ended.ts): what the hub kept of it goes first.
      await db.cache.delete('me');
      setNeedsEmail(false);
      setPassword('');
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate();
  };

  const deviceProfiles = useQuery(deviceProfilesQuery);
  const hasDeviceProfiles = (deviceProfiles.data?.length ?? 0) > 0;
  const leaveTo = useLeaveTo();
  const [trying, setTrying] = useState(false);

  // Back to the device profiles (ADR 0043), and on to the screen the app's door stood before (ADR 0055). A device with
  // none yet is shown the one the hub suggests first.
  const playOnDevice = async () => {
    if (!hasDeviceProfiles) {
      setTrying(true);
      return;
    }
    deviceMode.enable();
    await queryClient.invalidateQueries({ queryKey: ['me'] });
    leaveTo({ to: takeNext() ?? '/play' });
  };

  if (trying) return <TryOnDevice onBack={() => setTrying(false)} />;

  if (needsEmail) {
    return (
      <Screen narrow>
        <Brand subtitle={t('welcome.subtitle')} />
        <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm">
          <h2 className="font-bold text-ink text-xl">{t('welcome.addEmailTitle')}</h2>
          <p className="text-ink">{t('welcome.addEmailBody')}</p>
          {/* The password typed a moment ago proves the owner; it never leaves this screen otherwise. */}
          <EmailChange password={password} onDone={(me: MeView) => setMe(me)} />
        </section>
        <Button variant="ghost" busy={signOut.isPending} onClick={() => signOut.mutate()}>
          {t('profiles.signOut')}
        </Button>
      </Screen>
    );
  }

  const cameBack = external ? (
    <p role="alert" className="text-danger">
      {external === 'suspended'
        ? t('errors.accountSuspended')
        : external === 'disabled'
          ? t('external.disabled')
          : t('external.failed')}
    </p>
  ) : deleting && !Number.isNaN(Date.parse(deleting)) ? (
    // Just asked to delete the account (ADR 0034): when it goes, and how to keep it.
    <p role="status" className="rounded-2xl bg-notice px-4 py-3 text-notice-ink">
      {t('welcome.deleting', {
        date: new Date(deleting).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'vi-VN'),
      })}
    </p>
  ) : null;

  return (
    <Screen narrow>
      <Brand subtitle={t('welcome.subtitle')} />
      {cameBack}
      {/* Play first (ADR 0056): a game before an account, for a newcomer and for a device that has played. */}
      <div className="flex flex-col gap-2">
        <Button onClick={() => void playOnDevice()}>
          {hasDeviceProfiles ? t('welcome.playOnDevice') : t('welcome.tryOnDevice')}
        </Button>
        <p className="text-center text-ink-soft text-sm">{t('welcome.tryHint')}</p>
      </div>
      <p className="flex items-center gap-3 text-ink-soft text-sm before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
        {t('welcome.orSignIn')}
      </p>
      {passwordOn ? (
        <form onSubmit={submit} className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm">
          <h2 className="font-bold text-ink text-xl">{t('welcome.title')}</h2>
          <TextField
            label={t('welcome.email')}
            hint={t('welcome.emailHint')}
            name="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label={t('welcome.password')}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {login.isError ? (
            <p role="alert" className="text-danger">
              {t(errorKey(login.error))}
            </p>
          ) : null}
          <Button type="submit" busy={login.isPending}>
            {t('welcome.signIn')}
          </Button>
          {config.data?.email ? (
            <Link
              to="/account/password/forgot"
              className="text-center font-semibold text-accent underline underline-offset-4"
            >
              {t('welcome.forgot')}
            </Link>
          ) : null}
        </form>
      ) : (
        <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm">
          <h2 className="font-bold text-ink text-xl">{t('welcome.title')}</h2>
          <ProviderButtons alone />
        </section>
      )}
      {passwordOn ? <ProviderButtons /> : null}
      <div className="flex flex-col items-center gap-3 text-center">
        {registration === 'closed' ? (
          <p className="text-ink-soft">{t('welcome.closed')}</p>
        ) : (
          <p className="text-ink-soft">
            {t('welcome.noAccount')}{' '}
            <Link to="/account/register" className="font-bold text-brand-ink underline underline-offset-4">
              {t('welcome.createAccount')}
            </Link>
          </p>
        )}
      </div>
    </Screen>
  );
}

/**
 * "Chơi thử trên máy này" on a device with no device profile yet (ADR 0055): the profile the hub suggests — one animal
 * for its name and avatar — shown before it plays, with *Đổi tên, hình*. Nothing to type: a name is asked for only
 * where others will see it. Nothing reaches the server; the profile lives on this device (ADR 0043).
 */
function TryOnDevice({ onBack }: { onBack(): void }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const changed = useDeviceProfilesChanged();
  const leaveTo = useLeaveTo();
  const [start] = useState(() => funIdentity(i18n.language));
  const [name, setName] = useState(start.name);
  const [avatar, setAvatar] = useState(start.avatar);
  const [editing, setEditing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const clean = cleanName(name);
  const nameError = !clean
    ? t('errors.nameRequired')
    : visibleLength(clean) > MAX_NAME_LENGTH
      ? t('errors.nameTooLong')
      : null;

  const play = useMutation({
    mutationFn: async () => {
      // `chosen` once the player changed what the hub suggested: a sign-up then asks about this profile (ADR 0043).
      await createDeviceProfile(db, { name: clean, avatar, chosen: editing });
      // The device's first device profile is its first step in the newcomer funnel, as when the hub makes one.
      funnel.guestStart();
      deviceMode.enable();
      await changed();
      await queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onSuccess: () => leaveTo({ to: takeNext() ?? '/play' }),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setShowErrors(true);
    if (!nameError) play.mutate();
  };

  return (
    <Screen narrow>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <header className="flex flex-col items-center gap-3 pt-4 text-center">
          <Avatar avatar={avatar} />
          <h1 className="font-black text-3xl text-brand-ink">{clean || start.name}</h1>
          <p className="max-w-xs text-ink-soft">{t('welcome.try.hint')}</p>
        </header>
        {editing ? (
          <section className="flex flex-col gap-5 rounded-3xl bg-surface p-5 shadow-sm">
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
          </section>
        ) : null}
        {play.isError ? (
          <p role="alert" className="text-danger">
            {t('device.full', { max: MAX_DEVICE_PROFILES })}
          </p>
        ) : null}
        <Button type="submit" busy={play.isPending}>
          {t('welcome.try.play')}
        </Button>
        {editing ? null : (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            {t('welcome.try.edit')}
          </Button>
        )}
        <Button variant="ghost" onClick={onBack}>
          {t('welcome.try.other')}
        </Button>
      </form>
    </Screen>
  );
}
