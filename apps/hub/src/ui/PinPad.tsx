import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface PinPadProps {
  /** Called with the digits once they are complete. */
  onComplete(pin: string): void;
  /** 4 for a profile's PIN, 6 for the account's manage PIN. */
  length?: number;
  /** Shake and clear, e.g. after a wrong PIN. Change the value to trigger again. */
  errorKey?: number;
  error?: string | null;
  disabled?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'] as const;

/** Big digit keypad a small child can use: 4 digits for a profile's PIN, 6 for the manage PIN. */
export function PinPad({ onComplete, length = 4, errorKey = 0, error, disabled }: PinPadProps) {
  const { t } = useTranslation();
  const [digits, setDigits] = useState('');
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (errorKey === 0) return;
    setDigits('');
    setShaking(true);
    const timer = setTimeout(() => setShaking(false), 400);
    return () => clearTimeout(timer);
  }, [errorKey]);

  const press = (key: string) => {
    if (disabled) return;
    if (key === '⌫') return setDigits((d) => d.slice(0, -1));
    if (!key || digits.length >= length) return;
    const next = digits + key;
    setDigits(next);
    if (next.length === length) onComplete(next);
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        role="status"
        className={`flex gap-4 ${shaking ? 'animate-shake' : ''}`}
        aria-label={`${digits.length}/${length}`}
      >
        {Array.from({ length }, (_, i) => i).map((i) => (
          <span
            key={i}
            className={`size-5 rounded-full border-2 border-brand transition ${i < digits.length ? 'scale-110 bg-brand' : 'bg-transparent'}`}
          />
        ))}
      </div>
      {error ? <p className="text-center text-danger">{error}</p> : null}
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key) =>
          key ? (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => press(key)}
              aria-label={key === '⌫' ? t('pin.delete') : key}
              className="grid size-18 place-items-center rounded-full bg-surface font-black text-3xl text-ink shadow-sm active:scale-95 active:bg-soft disabled:opacity-50"
            >
              {key}
            </button>
          ) : (
            <span key="blank" />
          ),
        )}
      </div>
    </div>
  );
}
