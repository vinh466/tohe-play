import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { Button } from './Button.tsx';
import { TextField } from './TextField.tsx';

/** How long the API makes one address wait between two codes (ADR 0024). */
const RESEND_AFTER = 60;

/**
 * The step every flow that emails a code shares (ADR 0024): six digits, typed or pasted with their space, a wait of a
 * minute before another code, and what went wrong in words. `children` are fields the step needs besides the code,
 * such as a new password.
 */
export function CodeStep({
  email,
  initialCode = '',
  busy,
  error,
  ready = true,
  submitLabel,
  onSubmit,
  onResend,
  onBack,
  backLabel,
  children,
}: {
  /** Where the code went; null when the page was opened from the email's link. */
  email: string | null;
  initialCode?: string;
  busy: boolean;
  error: unknown;
  /** The other fields are filled in well enough to send. */
  ready?: boolean;
  submitLabel?: string;
  onSubmit(code: string): void;
  /** Asks for a new code (a new attempt); absent when the flow cannot (opened from a link). */
  onResend?: () => Promise<unknown>;
  /** Back to the step before, to fix the address. */
  onBack?: () => void;
  /** What going back means here; "Đổi email" by default. */
  backLabel?: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState(initialCode);
  const [wait, setWait] = useState(initialCode ? 0 : RESEND_AFTER);
  const [resendError, setResendError] = useState<unknown>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const digits = code.replace(/\D/g, '');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (digits.length === 6 && ready) onSubmit(digits);
  };

  const resend = async () => {
    if (!onResend) return;
    setResending(true);
    setResendError(null);
    try {
      await onResend();
      setCode('');
      setWait(RESEND_AFTER);
    } catch (problem) {
      setResendError(problem);
    } finally {
      setResending(false);
    }
  };

  const shown = resendError ?? error;
  const message =
    shown instanceof ApiError && shown.code === 'code_invalid' && shown.triesLeft !== null
      ? t('code.wrong', { count: shown.triesLeft })
      : shown
        ? t(errorKey(shown))
        : null;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <p className="text-ink">{email ? t('code.sentTo', { email }) : t('code.fromLink')}</p>
      <TextField
        label={t('code.label')}
        name="one-time-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        required
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/[^\d ]/g, ''))}
        className="[&_input]:text-center [&_input]:font-bold [&_input]:text-2xl [&_input]:tracking-[0.3em]"
      />
      {children}
      {message ? (
        <p role="alert" className="text-danger">
          {message}
        </p>
      ) : null}
      <Button type="submit" busy={busy} disabled={digits.length !== 6 || !ready}>
        {submitLabel ?? t('code.submit')}
      </Button>
      <p className="text-ink-soft text-sm">{t('code.checkSpam')}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {onResend ? (
          <Button variant="ghost" busy={resending} disabled={wait > 0} onClick={() => void resend()}>
            {wait > 0 ? t('code.resendIn', { seconds: wait }) : t('code.resend')}
          </Button>
        ) : null}
        {onBack ? (
          <Button variant="ghost" onClick={onBack}>
            {backLabel ?? t('code.changeEmail')}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
