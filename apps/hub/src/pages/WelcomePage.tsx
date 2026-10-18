import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { auth } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { RequireSession } from '../session/RequireSession.tsx';
import { guestMode } from '../session/session.ts';
import { useSetMe } from '../session/useSession.ts';
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setMe = useSetMe();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: () => auth.login(username.trim(), password),
    onSuccess: async (me) => {
      guestMode.disable();
      // The session guard of this page moves on to the picker as soon as the session changes; navigating here too
      // would pass through the picker twice.
      await setMe(me);
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate();
  };

  const tryAsGuest = async () => {
    guestMode.enable();
    await queryClient.invalidateQueries({ queryKey: ['me'] });
    await navigate({ to: '/', replace: true });
  };

  return (
    <Screen narrow>
      <Brand subtitle={t('welcome.subtitle')} />
      <form onSubmit={submit} className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm">
        <h2 className="font-bold text-ink text-xl">{t('welcome.title')}</h2>
        <TextField
          label={t('welcome.username')}
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
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
      </form>
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-ink-soft">
          {t('welcome.noAccount')}{' '}
          <Link to="/register" className="font-bold text-brand-ink underline underline-offset-4">
            {t('welcome.createAccount')}
          </Link>
        </p>
        <Button variant="ghost" onClick={() => void tryAsGuest()}>
          {t('welcome.tryAsGuest')}
        </Button>
      </div>
      <DataLink />
    </Screen>
  );
}
