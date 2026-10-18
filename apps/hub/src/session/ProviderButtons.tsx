import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { external } from '../api/client.ts';
import { configQuery } from '../api/queries.ts';
import { buttonClass } from '../ui/Button.tsx';

/**
 * "Tiếp tục với Google" and every provider this server offers (ADR 0026). Each is a full trip to the provider and
 * back, so it is a link, not a button that fetches.
 */
export function ProviderButtons() {
  const { t } = useTranslation();
  const config = useQuery(configQuery);
  const providers = config.data?.providers ?? [];
  if (providers.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-center text-ink-soft text-sm">{t('external.or')}</p>
      {providers.map((provider) => (
        <a key={provider.id} href={external.startUrl(provider.id)} className={buttonClass('secondary')}>
          {t('external.continueWith', { name: provider.name })}
        </a>
      ))}
    </div>
  );
}
