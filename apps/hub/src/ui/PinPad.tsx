import { useEffect, useState } from 'react';

interface PinPadProps {
  /** Called with the 4 digits once they are complete. */
  onComplete(pin: string): void;
  /** Shake and clear, e.g. after a wrong PIN. Change the value to trigger again. */
  errorKey?: number;
  error?: string | null;
  disabled?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'] as const;

/** Big 4-digit keypad a small child can use. */
export function PinPad({ onComplete, errorKey = 0, error, disabled }: PinPadProps) {
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
    if (!key || digits.length >= 4) return;
    const next = digits + key;
    setDigits(next);
    if (next.length === 4) onComplete(next);
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        role="status"
        className={`flex gap-4 ${shaking ? 'animate-shake' : ''}`}
        aria-label={`${digits.length}/4`}
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`size-5 rounded-full border-2 border-orange-500 transition ${i < digits.length ? 'scale-110 bg-orange-500' : 'bg-transparent'}`}
          />
        ))}
      </div>
      {error ? <p className="text-center text-red-700">{error}</p> : null}
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key) =>
          key ? (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => press(key)}
              aria-label={key === '⌫' ? 'Xoá' : key}
              className="grid size-18 place-items-center rounded-full bg-white font-black text-3xl text-orange-900 shadow-sm active:scale-95 active:bg-orange-100 disabled:opacity-50"
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
