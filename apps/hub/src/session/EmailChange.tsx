import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, account, type MeView } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { Button } from '../ui/Button.tsx';
import { CodeStep } from '../ui/CodeStep.tsx';
import { TextField } from '../ui/TextField.tsx';

/**
 * A new sign-in email, confirmed with a code sent there (ADR 0024): the account's first one, right after an account
 * from before email sign-in signed in (with the password it just typed), or another one from "Quản lý tài khoản"
 * (behind the parent gate).
 */
export function EmailChange({
  password,
  onDone,
}: {
  password?: string;
  onDone(me: MeView): Promise<void> | void;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [attemptId, setAttemptId] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: () => account.changeEmail(email.trim(), password),
    onSuccess: (attempt) => setAttemptId(attempt.attemptId),
  });
  const confirm = useMutation({
    mutationFn: (code: string) => account.confirmEmailChange(attemptId ?? '', code),
    onSuccess: onDone,
  });

  if (attemptId) {
    return (
      <CodeStep
        email={email.trim()}
        busy={confirm.isPending}
        error={confirm.error}
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
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (email.trim()) start.mutate();
  };
  const server = start.error instanceof ApiError ? start.error : null;
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <TextField
        label={t('emailChange.email')}
        hint={t('emailChange.emailHint')}
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
        {t('emailChange.send')}
      </Button>
    </form>
  );
}
