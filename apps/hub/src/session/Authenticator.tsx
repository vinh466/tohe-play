// The authenticator app the console's sign-in asks for (ADR 0027, 0042). The console cannot add it — nobody signs in
// there without it — so an account with a platform role adds it here, within step-up level 2: a new key, read from a
// QR code or typed, then its first code turns two-factor authentication on and shows the recovery codes once.
import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { account } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { Button } from '../ui/Button.tsx';
import { copyText } from '../ui/copyText.ts';
import { QrCode } from '../ui/QrCode.tsx';
import { TextField } from '../ui/TextField.tsx';

export function AuthenticatorSetup({ onDone }: { onDone(): void }) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const start = useMutation({ mutationFn: account.setUpAuthenticator });
  const enable = useMutation({ mutationFn: () => account.enableTwoFactor(code) });

  if (enable.data) {
    const codes = enable.data.codes;
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="font-semibold text-ink">
          {t('twoFactor.enabled')}
        </p>
        <p className="text-ink">{t('twoFactor.recoveryBody')}</p>
        <ul
          aria-label={t('twoFactor.recoveryList')}
          className="grid grid-cols-2 gap-2 rounded-2xl bg-soft p-4 font-mono text-ink"
        >
          {codes.map((recovery) => (
            <li key={recovery}>{recovery}</li>
          ))}
        </ul>
        <Button
          variant="secondary"
          onClick={() => void copyText(codes.join('\n')).then((ok) => setCopied(ok))}
        >
          {copied ? t('twoFactor.copied') : t('twoFactor.copyAll')}
        </Button>
        <Button onClick={onDone}>{t('twoFactor.saved')}</Button>
      </div>
    );
  }

  if (!start.data) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-ink">{t('twoFactor.hint')}</p>
        {start.isError ? (
          <p role="alert" className="text-danger">
            {t(errorKey(start.error))}
          </p>
        ) : null}
        <Button busy={start.isPending} onClick={() => start.mutate()}>
          {t('twoFactor.create')}
        </Button>
      </div>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    enable.mutate();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-ink">{t('twoFactor.scan')}</p>
      <div className="self-center">
        <QrCode text={start.data.uri} label={t('twoFactor.qr')} />
      </div>
      <TextField
        label={t('twoFactor.key')}
        readOnly
        spellCheck={false}
        value={start.data.sharedKey}
        onFocus={(event) => event.target.select()}
      />
      <TextField
        label={t('twoFactor.code')}
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        error={enable.isError ? t(errorKey(enable.error)) : null}
      />
      <Button type="submit" busy={enable.isPending} disabled={!code.trim()}>
        {t('twoFactor.enable')}
      </Button>
    </form>
  );
}
