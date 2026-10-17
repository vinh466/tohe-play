import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, auth } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { BackLink } from '../navigation/leave.tsx';
import { cleanName, funName, MAX_NAME_LENGTH, visibleLength } from '../session/profileNames.ts';
import { RequireSession } from '../session/RequireSession.tsx';
import { guestMode } from '../session/session.ts';
import { useSetMe } from '../session/useSession.ts';
import { Button } from '../ui/Button.tsx';
import { Screen } from '../ui/Screen.tsx';
import { TextField } from '../ui/TextField.tsx';
import { Brand } from './WelcomePage.tsx';

export function RegisterPage() {
  return (
    <RequireSession need="signedOut">
      <Register />
    </RequireSession>
  );
}

const USERNAME = /^[a-z0-9._-]{3,32}$/;

function Register() {
  const { t, i18n } = useTranslation();
  const setMe = useSetMe();
  // The first profile's name is public, so it starts as a fun one rather than anyone's real name (D-17).
  const [form, setForm] = useState(() => ({
    displayName: funName(i18n.language),
    username: '',
    password: '',
    confirm: '',
  }));
  const [showErrors, setShowErrors] = useState(false);
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: event.target.value }));

  const username = form.username.trim().toLowerCase();
  const displayName = cleanName(form.displayName);
  const local = {
    displayName: !displayName
      ? t('errors.nameRequired')
      : visibleLength(displayName) > MAX_NAME_LENGTH
        ? t('errors.nameTooLong')
        : null,
    username: username && !USERNAME.test(username) ? t('errors.usernameInvalid') : null,
    password: form.password && form.password.length < 8 ? t('errors.passwordTooShort') : null,
    confirm: form.confirm && form.confirm !== form.password ? t('register.passwordsDiffer') : null,
  };

  const register = useMutation({
    mutationFn: () => auth.register({ displayName, username, password: form.password }),
    onSuccess: async (me) => {
      guestMode.disable();
      // The session guard of this page moves on to the picker as soon as the session changes; navigating here too
      // would pass through the picker twice.
      await setMe(me);
    },
  });

  const server = register.error instanceof ApiError ? register.error : null;
  const fieldError = (field: string) => (server?.field(field) ? t(errorKey(server)) : null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setShowErrors(true);
    if (Object.values(local).some(Boolean) || !form.confirm) return;
    register.mutate();
  };

  return (
    <Screen narrow>
      <Brand subtitle={t('register.subtitle')} />
      <form onSubmit={submit} className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm" noValidate>
        <h2 className="font-bold text-ink text-xl">{t('register.title')}</h2>
        <div className="flex items-end gap-2">
          <TextField
            className="flex-1"
            label={t('register.displayName')}
            hint={t('register.displayNameHint')}
            name="displayName"
            autoComplete="off"
            required
            maxLength={128}
            value={form.displayName}
            onChange={set('displayName')}
            error={(showErrors && local.displayName) || fieldError('displayName')}
          />
          <Button
            variant="secondary"
            aria-label={t('register.anotherName')}
            title={t('register.anotherName')}
            onClick={() => setForm((f) => ({ ...f, displayName: funName(i18n.language) }))}
          >
            🎲
          </Button>
        </div>
        <TextField
          label={t('register.username')}
          hint={t('register.usernameHint')}
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          maxLength={32}
          value={form.username}
          onChange={set('username')}
          error={(showErrors && local.username) || fieldError('username')}
        />
        <TextField
          label={t('register.password')}
          hint={t('register.passwordHint')}
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={set('password')}
          error={(showErrors && local.password) || fieldError('password')}
        />
        <TextField
          label={t('register.confirmPassword')}
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={form.confirm}
          onChange={set('confirm')}
          error={showErrors ? local.confirm : null}
        />

        {register.isError &&
        !server?.field('displayName') &&
        !server?.field('username') &&
        !server?.field('password') ? (
          <p role="alert" className="text-danger">
            {t(errorKey(register.error))}
          </p>
        ) : null}
        <Button type="submit" busy={register.isPending}>
          {t('register.submit')}
        </Button>
      </form>
      <BackLink to="/welcome" className="text-center font-bold text-brand-ink underline underline-offset-4">
        {t('register.haveAccount')}
      </BackLink>
    </Screen>
  );
}
