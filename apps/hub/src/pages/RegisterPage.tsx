import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, auth } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { BackLink } from '../navigation/leave.tsx';
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setMe = useSetMe();
  const [form, setForm] = useState({
    displayName: '',
    username: '',
    password: '',
    confirm: '',
    householdName: '',
    inviteCode: '',
  });
  const [withInvite, setWithInvite] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: event.target.value }));

  const username = form.username.trim().toLowerCase();
  const local = {
    username: username && !USERNAME.test(username) ? t('errors.usernameInvalid') : null,
    password: form.password && form.password.length < 8 ? t('errors.passwordTooShort') : null,
    confirm: form.confirm && form.confirm !== form.password ? t('register.passwordsDiffer') : null,
  };

  const register = useMutation({
    mutationFn: () =>
      auth.register({
        displayName: form.displayName.trim(),
        username,
        password: form.password,
        householdName: withInvite ? null : form.householdName.trim() || null,
        inviteCode: withInvite ? form.inviteCode : null,
      }),
    onSuccess: async (me) => {
      guestMode.disable();
      await setMe(me);
      await navigate({ to: '/profiles', replace: true });
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
        <TextField
          label={t('register.displayName')}
          hint={t('register.displayNameHint')}
          name="displayName"
          autoComplete="name"
          required
          maxLength={40}
          value={form.displayName}
          onChange={set('displayName')}
        />
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

        <label className="flex items-center gap-3 rounded-2xl bg-fill p-3 font-semibold text-ink">
          <input
            type="checkbox"
            checked={withInvite}
            onChange={(e) => setWithInvite(e.target.checked)}
            className="size-6 accent-brand"
          />
          {t('register.haveInvite')}
        </label>
        {withInvite ? (
          <TextField
            label={t('register.inviteCode')}
            hint={t('register.inviteCodeHint')}
            name="inviteCode"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            required
            value={form.inviteCode}
            onChange={set('inviteCode')}
            error={fieldError('inviteCode')}
          />
        ) : (
          <TextField
            label={t('register.householdName')}
            hint={t('register.householdNameHint', { name: form.displayName.trim() || '…' })}
            name="householdName"
            maxLength={40}
            value={form.householdName}
            onChange={set('householdName')}
          />
        )}

        {register.isError &&
        !server?.field('username') &&
        !server?.field('inviteCode') &&
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
