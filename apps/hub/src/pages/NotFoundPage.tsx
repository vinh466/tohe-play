import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { buttonClass } from '../ui/Button.tsx';
import { Screen } from '../ui/Screen.tsx';

/**
 * A path of the app's namespaces that is no screen (`/account/foo`, `/play/x/y`): said in the app's language with a way
 * to Trò chơi, where TanStack Router's own would be a bare English "Not Found". A path outside the namespaces never
 * reaches the app: the hub's Caddy answers it with the 404 page (404.html).
 */
export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <Screen narrow back="/play">
      <section
        aria-labelledby="not-found"
        className="mt-8 flex flex-col items-center gap-4 rounded-3xl bg-surface p-5 text-center shadow-sm"
      >
        <div aria-hidden className="text-5xl">
          🧭
        </div>
        <h1 id="not-found" className="font-black text-2xl text-brand-ink">
          {t('notFound.title')}
        </h1>
        <p className="text-ink">{t('notFound.body')}</p>
        <Link to="/play" replace className={buttonClass()}>
          {t('notFound.home')}
        </Link>
      </section>
    </Screen>
  );
}
