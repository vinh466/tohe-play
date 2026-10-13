import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { gamesQuery, profileQuery } from '../api/queries.ts';

export function CatalogPage() {
  const { t } = useTranslation();
  const games = useQuery(gamesQuery);
  const profile = useQuery(profileQuery);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-black text-3xl text-orange-700">{t('appName')}</h1>
          <p className="text-orange-900/70">{t('tagline')}</p>
        </div>
        {profile.data && (
          <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm">
            <span className="text-2xl" aria-hidden>
              {profile.data.avatar}
            </span>
            <span className="font-semibold text-orange-900">{profile.data.name}</span>
          </div>
        )}
      </header>

      {!navigator.onLine && (
        <p className="rounded-xl bg-amber-100 px-4 py-2 text-amber-900 text-sm">{t('offline')}</p>
      )}

      <section aria-labelledby="games-heading" className="flex flex-col gap-3">
        <h2 id="games-heading" className="font-bold text-orange-900 text-xl">
          {t('games')}
        </h2>
        {games.isPending && <p className="text-orange-900/70">{t('loading')}</p>}
        {games.isError && <p className="text-red-700">{t('loadFailed')}</p>}
        {games.data?.length === 0 && <p className="text-orange-900/70">{t('noGames')}</p>}
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {games.data?.map((game) => (
            <li key={game.id}>
              <Link
                to="/play/$gameId"
                params={{ gameId: game.id }}
                className="flex h-full flex-col items-center gap-2 rounded-3xl bg-white p-4 text-center shadow-sm transition active:scale-95"
              >
                {game.iconUrl ? (
                  <img src={game.iconUrl} alt="" className="size-20 rounded-2xl" />
                ) : (
                  <span className="grid size-20 place-items-center rounded-2xl bg-orange-100 text-4xl">
                    🎲
                  </span>
                )}
                <span className="font-bold text-lg text-orange-900">{game.name}</span>
                <span className="line-clamp-2 text-orange-900/70 text-sm">{game.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
