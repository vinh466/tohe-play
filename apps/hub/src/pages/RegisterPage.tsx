import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, auth, type MeView } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { configQuery } from '../api/queries.ts';
import { ConsentCheckbox } from '../legal/Consent.tsx';
import { TERMS_VERSION } from '../legal/documents.ts';
import { BackLink } from '../navigation/leave.tsx';
import { invite } from '../session/invite.ts';
import { ProviderButtons } from '../session/ProviderButtons.tsx';
import { cleanName, funName, MAX_NAME_LENGTH, visibleLength } from '../session/profileNames.ts';
import { withProof } from '../session/proofOfWork.ts';
import { RequireSession } from '../session/RequireSession.tsx';
import { guestMode } from '../session/session.ts';
import { useSetMe } from '../session/useSession.ts';
import { funnel } from '../telemetry/telemetry.ts';
import { Button } from '../ui/Button.tsx';
import { CodeStep } from '../ui/CodeStep.tsx';
import { Loading, Screen } from '../ui/Screen.tsx';
import { TextField } from '../ui/TextField.tsx';
import { Brand } from './WelcomePage.tsx';

export function RegisterPage() {
  return (
    <RequireSession need="signedOut">
      <Register />
    </RequireSession>
  );
}

/** The link in the sign-up email: confirms on this device, which may not be the one that started (ADR 0024). */
export function ConfirmRegistrationPage() {
  return (
    <RequireSession need="signedOut">
      <ConfirmFromLink />
    </RequireSession>
  );
}

/** A new account plays at once; the session guard of the page moves on as soon as the session changes. */
function useSignedUp() {
  const setMe = useSetMe();
  return async (me: MeView) => {
    guestMode.disable();
    invite.forget();
    funnel.accountCreated();
    await setMe(me);
  };
}

function Register() {
  const { t, i18n } = useTranslation();
  const signedUp = useSignedUp();
  const config = useQuery(configQuery);
  const { invite: linked } = useSearch({ from: '/account/register' });
  // A code from an invite link survives a trip to a sign-in provider (ADR 0028).
  useEffect(() => {
    if (linked) invite.remember(linked);
  }, [linked]);
  const registration = config.data?.registration ?? 'open';
  // The first profile's name is public, so it starts as a fun one rather than anyone's real name (D-17).
  const [form, setForm] = useState(() => ({
    email: '',
    displayName: funName(i18n.language),
    password: '',
    confirm: '',
    inviteCode: (linked ?? invite.get()).toUpperCase(),
  }));
  const [showErrors, setShowErrors] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: event.target.value }));

  const email = form.email.trim();
  const displayName = cleanName(form.displayName);
  const local = {
    email: email ? null : t('errors.emailInvalid'),
    displayName: !displayName
      ? t('errors.nameRequired')
      : visibleLength(displayName) > MAX_NAME_LENGTH
        ? t('errors.nameTooLong')
        : null,
    password: form.password.length < 8 ? t('errors.passwordTooShort') : null,
    confirm: form.confirm !== form.password ? t('register.passwordsDiffer') : null,
    terms: agreed ? null : t('errors.termsRequired'),
    inviteCode: registration === 'invite' && !form.inviteCode.trim() ? t('errors.inviteRequired') : null,
  };

  const start = useMutation({
    mutationFn: () =>
      withProof(config.data?.proofOfWork, (proof) =>
        auth.register({
          email,
          password: form.password,
          displayName,
          acceptTerms: agreed,
          termsVersion: TERMS_VERSION,
          inviteCode: form.inviteCode.trim() || null,
          proof,
        }),
      ),
    onSuccess: (attempt) => setAttemptId(attempt.attemptId),
  });
  const confirm = useMutation({
    mutationFn: (code: string) => auth.confirmRegistration(attemptId ?? '', code),
    onSuccess: signedUp,
  });

  const server = start.error instanceof ApiError ? start.error : null;
  const fieldError = (field: string) => (server?.field(field) ? t(errorKey(server)) : null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setShowErrors(true);
    if (Object.values(local).some(Boolean)) return;
    start.mutate();
  };

  // By invite it is the way in, so it comes first; otherwise a community's code is a bonus, so it comes last.
  const inviteField = (
    <TextField
      label={registration === 'invite' ? t('register.invite') : t('register.inviteOptional')}
      hint={registration === 'invite' ? t('register.inviteRequiredHint') : t('register.inviteHint')}
      name="inviteCode"
      autoComplete="off"
      autoCapitalize="characters"
      spellCheck={false}
      maxLength={40}
      value={form.inviteCode}
      onChange={(event) => setForm((f) => ({ ...f, inviteCode: event.target.value.toUpperCase() }))}
      error={(showErrors && local.inviteCode) || fieldError('inviteCode')}
    />
  );

  if (registration === 'closed') {
    return (
      <Screen narrow>
        <Brand subtitle={t('register.subtitle')} />
        <p role="status" className="rounded-2xl bg-notice px-4 py-3 text-notice-ink">
          {t('register.closed')}
        </p>
        <BackLink
          to="/account/sign-in"
          className="text-center font-bold text-brand-ink underline underline-offset-4"
        >
          {t('register.haveAccount')}
        </BackLink>
      </Screen>
    );
  }

  // Signing up by email is off: only the providers that are on (ADR 0028).
  if (config.data && !config.data.passwordSignIn) {
    return (
      <Screen narrow>
        <Brand subtitle={t('register.subtitle')} />
        <p role="status" className="rounded-2xl bg-notice px-4 py-3 text-notice-ink">
          {t('register.passwordOff')}
        </p>
        <ProviderButtons alone />
        <BackLink
          to="/account/sign-in"
          className="text-center font-bold text-brand-ink underline underline-offset-4"
        >
          {t('register.haveAccount')}
        </BackLink>
      </Screen>
    );
  }

  if (config.data && !config.data.email) {
    return (
      <Screen narrow>
        <Brand subtitle={t('register.subtitle')} />
        <p role="status" className="rounded-2xl bg-notice px-4 py-3 text-notice-ink">
          {t('register.emailOff')}
        </p>
        <BackLink
          to="/account/sign-in"
          className="text-center font-bold text-brand-ink underline underline-offset-4"
        >
          {t('register.haveAccount')}
        </BackLink>
      </Screen>
    );
  }

  return (
    <Screen narrow>
      <Brand subtitle={t('register.subtitle')} />
      <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm">
        <h2 className="font-bold text-ink text-xl">{attemptId ? t('code.title') : t('register.title')}</h2>
        {attemptId ? (
          <CodeStep
            email={email}
            busy={confirm.isPending}
            error={confirm.error}
            submitLabel={t('register.confirm')}
            onSubmit={(code) => confirm.mutate(code)}
            onResend={async () => {
              confirm.reset();
              await start.mutateAsync();
            }}
            onBack={() => {
              confirm.reset();
              setAttemptId(null);
            }}
          />
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            {registration === 'invite' ? inviteField : null}
            <TextField
              label={t('register.email')}
              hint={t('register.emailHint')}
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              maxLength={254}
              value={form.email}
              onChange={set('email')}
              error={(showErrors && local.email) || fieldError('email')}
            />
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
            {registration === 'invite' ? null : inviteField}
            <ConsentCheckbox
              checked={agreed}
              onChange={setAgreed}
              error={(showErrors && local.terms) || fieldError('acceptTerms')}
            />
            {start.isError &&
            !server?.field('acceptTerms') &&
            !server?.field('inviteCode') &&
            !server?.field('email') &&
            !server?.field('displayName') &&
            !server?.field('password') ? (
              <p role="alert" className="text-danger">
                {t(errorKey(start.error))}
              </p>
            ) : null}
            <Button type="submit" busy={start.isPending}>
              {t('register.submit')}
            </Button>
            <p className="text-ink-soft text-sm">{t('consent.under16')}</p>
          </form>
        )}
      </section>
      {attemptId ? null : <ProviderButtons />}
      <BackLink
        to="/account/sign-in"
        className="text-center font-bold text-brand-ink underline underline-offset-4"
      >
        {t('register.haveAccount')}
      </BackLink>
    </Screen>
  );
}

function ConfirmFromLink() {
  const { t } = useTranslation();
  const { attempt, code } = useSearch({ from: '/account/register/confirm' });
  const signedUp = useSignedUp();
  const confirm = useMutation({
    mutationFn: () => auth.confirmRegistration(attempt, code),
    onSuccess: signedUp,
  });

  const started = useRef(false);
  const run = confirm.mutate;
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
  }, [run]);

  return (
    <Screen narrow>
      <Brand subtitle={t('register.subtitle')} />
      {confirm.isError ? (
        <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 text-center shadow-sm">
          <p role="alert" className="text-danger">
            {t(errorKey(confirm.error))}
          </p>
          <Link to="/account/register" className="font-bold text-brand-ink underline underline-offset-4">
            {t('register.again')}
          </Link>
        </section>
      ) : (
        <Loading label={t('code.confirming')} />
      )}
    </Screen>
  );
}
