import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { account, type MeView } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { Button } from '../ui/Button.tsx';
import { TextField } from '../ui/TextField.tsx';

/** The six-digit manage PIN (ADR 0025), typed twice. Needs step-up level 2; opens profile management. */
export function ManagePinForm({ onDone }: { onDone(next: MeView): Promise<void> | void }) {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const save = useMutation({ mutationFn: () => account.setManagePin(pin), onSuccess: onDone });
  const short = pin.length > 0 && pin.length < 6;
  const differ = again.length === 6 && again !== pin;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pin.length === 6 && pin === again) save.mutate();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <TextField
        label={t('managePin.new')}
        hint={t('managePin.hint')}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={pin}
        onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
        error={short ? t('errors.managePinInvalid') : null}
      />
      <TextField
        label={t('managePin.again')}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={again}
        onChange={(event) => setAgain(event.target.value.replace(/\D/g, ''))}
        error={differ ? t('managePin.differ') : null}
      />
      {save.isError ? (
        <p role="alert" className="text-danger">
          {t(errorKey(save.error))}
        </p>
      ) : null}
      <Button type="submit" busy={save.isPending} disabled={pin.length !== 6 || pin !== again}>
        {t('managePin.save')}
      </Button>
    </form>
  );
}

/** A new password, typed twice. Needs step-up level 2; every other session of the account ends. */
export function PasswordForm({ onDone }: { onDone(next: MeView): Promise<void> | void }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const save = useMutation({ mutationFn: () => account.setPassword(password), onSuccess: onDone });
  const short = password.length > 0 && password.length < 8;
  const differ = again.length > 0 && again !== password;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (password.length >= 8 && password === again) save.mutate();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <TextField
        label={t('security.newPassword')}
        hint={t('register.passwordHint')}
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={short ? t('errors.passwordTooShort') : null}
      />
      <TextField
        label={t('register.confirmPassword')}
        type="password"
        autoComplete="new-password"
        value={again}
        onChange={(event) => setAgain(event.target.value)}
        error={differ ? t('register.passwordsDiffer') : null}
      />
      {save.isError ? (
        <p role="alert" className="text-danger">
          {t(errorKey(save.error))}
        </p>
      ) : null}
      <Button type="submit" busy={save.isPending} disabled={password.length < 8 || password !== again}>
        {t('security.save')}
      </Button>
    </form>
  );
}
