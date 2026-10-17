import { useMutation, useQuery } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type MeView, session } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { configQuery } from '../api/queries.ts';
import { Button } from '../ui/Button.tsx';
import { CodeStep } from '../ui/CodeStep.tsx';
import { TextField } from '../ui/TextField.tsx';

/**
 * Step-up level 2 (ADR 0025): the password, or a code to the account's email — for an account without a password, or
 * someone who forgot it. Opens account security, and profile management, on this device for ten minutes.
 */
export function StepUp({ me, onDone }: { me: MeView; onDone(next: MeView): Promise<void> | void }) {
  const { t } = useTranslation();
  const config = useQuery(configQuery);
  const canCode = me.account.email !== null && config.data?.email === true;
  const [mode, setMode] = useState<'password' | 'code'>(me.account.hasPassword ? 'password' : 'code');
  const [password, setPassword] = useState('');
  const [attemptId, setAttemptId] = useState<string | null>(null);

  const byPassword = useMutation({ mutationFn: () => session.stepUp(password), onSuccess: onDone });
  const sendCode = useMutation({
    mutationFn: () => session.stepUpCode(),
    onSuccess: (attempt) => setAttemptId(attempt.attemptId),
  });
  const byCode = useMutation({
    mutationFn: (code: string) => session.confirmStepUp(attemptId ?? '', code),
    onSuccess: onDone,
  });

  const usePassword = me.account.hasPassword
    ? () => {
        byCode.reset();
        setAttemptId(null);
        setMode('password');
      }
    : undefined;

  if (mode === 'code' && attemptId) {
    return (
      <CodeStep
        email={me.account.email}
        busy={byCode.isPending}
        error={byCode.error}
        onSubmit={(code) => byCode.mutate(code)}
        onResend={async () => {
          byCode.reset();
          await sendCode.mutateAsync();
        }}
        onBack={usePassword}
        backLabel={t('stepUp.usePassword')}
      />
    );
  }

  if (mode === 'code') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-ink">
          {canCode ? t('stepUp.codeBody', { email: me.account.email }) : t('stepUp.noWay')}
        </p>
        {sendCode.isError ? (
          <p role="alert" className="text-danger">
            {t(errorKey(sendCode.error))}
          </p>
        ) : null}
        {canCode ? (
          <Button busy={sendCode.isPending} onClick={() => sendCode.mutate()}>
            {t('stepUp.sendCode')}
          </Button>
        ) : null}
        {usePassword ? (
          <Button variant="ghost" onClick={usePassword}>
            {t('stepUp.usePassword')}
          </Button>
        ) : null}
      </div>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    byPassword.mutate();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-ink">{t('stepUp.passwordBody', { name: me.account.displayName })}</p>
      <TextField
        label={t('welcome.password')}
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={byPassword.isError ? t(errorKey(byPassword.error)) : null}
      />
      <Button type="submit" busy={byPassword.isPending}>
        {t('stepUp.confirm')}
      </Button>
      {canCode ? (
        <Button variant="ghost" onClick={() => setMode('code')}>
          {t('stepUp.useCode')}
        </Button>
      ) : null}
    </form>
  );
}
