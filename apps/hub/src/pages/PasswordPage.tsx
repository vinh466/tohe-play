import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import { type FormEvent, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, auth, type MeView } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { configQuery } from '../api/queries.ts';
import { BackLink } from '../navigation/leave.tsx';
import { withProof } from '../session/proofOfWork.ts';
import { RequireSession } from '../session/RequireSession.tsx';
import { guestMode } from '../session/session.ts';
import { useSetMe } from '../session/useSession.ts';
import { Button } from '../ui/Button.tsx';
import { CodeStep } from '../ui/CodeStep.tsx';
import { Screen } from '../ui/Screen.tsx';
import { TextField } from '../ui/TextField.tsx';
import { Brand } from './WelcomePage.tsx';

/** "Quên mật khẩu?": an email, then its code and a new password (ADR 0024). */
export function ForgotPasswordPage() {
  return (
    <RequireSession need="signedOut">
      <Forgot />
    </RequireSession>
  );
}

/** The link in the reset email: the code is in it, the new password is asked here. */
export function ResetPasswordPage() {
  return (
    <RequireSession need="signedOut">
      <ResetFromLink />
    </RequireSession>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Screen narrow>
      <Brand subtitle={t('welcome.subtitle')} />
      <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm">
        <h2 className="font-bold text-ink text-xl">{t('forgot.title')}</h2>
        {children}
      </section>
      <BackLink to="/welcome" className="text-center font-bold text-brand-ink underline underline-offset-4">
        {t('forgot.back')}
      </BackLink>
    </Screen>
  );
}

function Forgot() {
  const { t } = useTranslation();
  const config = useQuery(configQuery);
  const [email, setEmail] = useState('');
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const start = useMutation({
    mutationFn: () =>
      withProof(config.data?.proofOfWork, (proof) => auth.forgotPassword(email.trim(), proof)),
    onSuccess: (attempt) => setAttemptId(attempt.attemptId),
  });

  if (attemptId) {
    return (
      <Frame>
        <NewPassword
          attemptId={attemptId}
          email={email.trim()}
          onResend={() => start.mutateAsync()}
          onBack={() => setAttemptId(null)}
        />
      </Frame>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (email.trim()) start.mutate();
  };
  const server = start.error instanceof ApiError ? start.error : null;
  return (
    <Frame>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <p className="text-ink">{t('forgot.body')}</p>
        <TextField
          label={t('welcome.email')}
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={server?.field('email') ? t(errorKey(server)) : null}
        />
        {start.isError && !server?.field('email') ? (
          <p role="alert" className="text-danger">
            {t(errorKey(start.error))}
          </p>
        ) : null}
        <Button type="submit" busy={start.isPending} disabled={!email.trim()}>
          {t('forgot.send')}
        </Button>
      </form>
    </Frame>
  );
}

function ResetFromLink() {
  const { t } = useTranslation();
  const { attempt, code } = useSearch({ from: '/password/reset' });
  return (
    <Frame>
      <NewPassword attemptId={attempt} email={null} initialCode={code} />
      <Link
        to="/password/forgot"
        className="text-center font-semibold text-accent underline underline-offset-4"
      >
        {t('forgot.again')}
      </Link>
    </Frame>
  );
}

/** The code and the new password, together: the API checks the password first, so a weak one costs no try. */
function NewPassword({
  attemptId,
  email,
  initialCode,
  onResend,
  onBack,
}: {
  attemptId: string;
  email: string | null;
  initialCode?: string;
  onResend?: () => Promise<unknown>;
  onBack?: () => void;
}) {
  const { t } = useTranslation();
  const setMe = useSetMe();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const reset = useMutation({
    mutationFn: (code: string) => auth.resetPassword(attemptId, code, password),
    onSuccess: async (me: MeView) => {
      guestMode.disable();
      // A fresh session on this device; the page's session guard moves on.
      await setMe(me);
    },
  });
  const short = password.length > 0 && password.length < 8;
  const differ = again.length > 0 && again !== password;
  return (
    <CodeStep
      email={email}
      initialCode={initialCode}
      busy={reset.isPending}
      error={reset.error}
      ready={password.length >= 8 && again === password}
      submitLabel={t('forgot.reset')}
      onSubmit={(code) => reset.mutate(code)}
      onResend={
        onResend &&
        (async () => {
          reset.reset();
          await onResend();
        })
      }
      onBack={onBack}
    >
      <TextField
        label={t('forgot.newPassword')}
        hint={t('register.passwordHint')}
        name="new-password"
        type="password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={short ? t('errors.passwordTooShort') : null}
      />
      <TextField
        label={t('register.confirmPassword')}
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        value={again}
        onChange={(event) => setAgain(event.target.value)}
        error={differ ? t('register.passwordsDiffer') : null}
      />
    </CodeStep>
  );
}
