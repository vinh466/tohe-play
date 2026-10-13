import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { gamesQuery } from '../api/queries.ts';
import { RequireSession } from '../session/RequireSession.tsx';
import type { Player } from '../session/session.ts';
import { Avatar } from '../ui/AvatarGrid.tsx';
import { Screen } from '../ui/Screen.tsx';

export function CatalogPage() {
  return (
    <RequireSession need="player">
      {(session) => (
        <Catalog
          player={session.player}
          household={session.status === 'account' ? session.me.household.name : null}
        />
      )}
    </RequireSession>
  );
}

function Catalog({ player, household }: { player: Player; household: string | null }) {
  const { t } = useTranslation();
  const games = useQuery(gamesQuery(player.id));
  const isGuest = player.kind === 'guest';

  return (
    <Screen>
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-black text-3xl text-orange-700">{t('appName')}</h1>
          <p className="truncate text-orange-900/70">{household ?? t('tagline')}</p>
        </div>
        <Link
          to={isGuest ? '/welcome' : '/profiles'}
          aria-label={t('switchProfile')}
          className="flex shrink-0 items-center gap-2 rounded-full bg-white py-1.5 pr-4 pl-1.5 shadow-sm active:scale-95"
        >
          <Avatar avatar={player.avatar} size="sm" />
          <span className="max-w-28 truncate font-semibold text-orange-900">
            {isGuest ? t('guest.name') : player.name}
          </span>
        </Link>
      </header>

      {isGuest ? (
        <p className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-amber-100 px-4 py-3 text-amber-900 text-sm">
          {t('guest.banner')}
          <Link to="/register" className="font-bold underline underline-offset-4">
            {t('guest.signUp')}
          </Link>
        </p>
      ) : null}

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
          {games.data?.map((game, index) => (
            <li key={game.id} className="animate-pop-in" style={{ animationDelay: `${index * 40}ms` }}>
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
    </Screen>
  );
}
