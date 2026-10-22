import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { auth, type MeView } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { configQuery } from '../api/queries.ts';
import { entry } from '../entry/intent.ts';
import { EmailChange } from '../session/EmailChange.tsx';
import { ProviderButtons } from '../session/ProviderButtons.tsx';
import { RequireSession } from '../session/RequireSession.tsx';
import { deviceMode } from '../session/session.ts';
import { useSetMe } from '../session/useSession.ts';
import { db } from '../storage/db.ts';
import { Button } from '../ui/Button.tsx';
import { DataLink } from '../ui/DataLink.tsx';
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
  const navigate = useNavigate();
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

  // Back to the device profiles (ADR 0043): the first one is made then, if the device has none.
  const playOnDevice = async () => {
    deviceMode.enable();
    await queryClient.invalidateQueries({ queryKey: ['me'] });
    await navigate({ to: '/', replace: true });
  };

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
      {passwordOn ? (
        <form onSubmit={submit} className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm">
          <h2 className="font-bold text-ink text-xl">{t('welcome.title')}</h2>
          {cameBack}
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
          {cameBack}
          <p className="text-ink-soft">{t('welcome.passwordOff')}</p>
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
        <Button variant="ghost" onClick={() => void playOnDevice()}>
          {t('welcome.playOnDevice')}
        </Button>
      </div>
      <DataLink />
    </Screen>
  );
}
