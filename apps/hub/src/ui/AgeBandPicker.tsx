import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { profileOptionsQuery } from '../api/queries.ts';

/** The API's age bands, for a device that has not fetched them yet. */
const FALLBACK = ['3-5', '6-8', '9-12', '13-17'];

/** A child's age band (ADR 0025's child template), as the API's options list them. */
export function AgeBandPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange(band: string): void;
  label: string;
}) {
  const { t } = useTranslation();
  const options = useQuery(profileOptionsQuery);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 font-semibold text-ink">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {(options.data?.ageBands ?? FALLBACK).map((band) => (
          <button
            key={band}
            type="button"
            aria-pressed={band === value}
            onClick={() => onChange(band)}
            className={`min-h-11 rounded-full px-4 font-semibold text-ink transition active:scale-95 ${
              band === value ? 'bg-soft-strong ring-2 ring-brand' : 'bg-surface'
            }`}
          >
            {t('account.years', { band })}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
