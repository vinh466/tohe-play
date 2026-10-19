import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { gamesQuery } from '../api/queries.ts';
import { InstallNudge } from '../install/InstallNudge.tsx';
import { hasShell } from '../launcher/manifest.ts';
import { RoomInvites } from '../rooms/RoomInvites.tsx';
import { RequireSession } from '../session/RequireSession.tsx';
import type { Player } from '../session/session.ts';
import { syncsWithServer, useBackgroundSync } from '../session/useBackgroundSync.ts';
import { Avatar } from '../ui/AvatarGrid.tsx';
import { DataLink } from '../ui/DataLink.tsx';
import { LeaderboardButton } from '../ui/Leaderboard.tsx';
import { MenuButton } from '../ui/MenuButton.tsx';
import { Screen } from '../ui/Screen.tsx';
import { ThemeButton } from '../ui/ThemePicker.tsx';

export function CatalogPage() {
  return <RequireSession need="player">{(session) => <Catalog player={session.player} />}</RequireSession>;
}

function Catalog({ player }: { player: Player }) {
  const { t } = useTranslation();
  const games = useQuery(gamesQuery(player.id));
  const isGuest = player.kind === 'guest';
  useBackgroundSync(player);

  return (
    <Screen>
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-black text-3xl text-brand-ink">{t('appName')}</h1>
          <p className="text-ink-soft leading-snug">{t('tagline')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeButton />
          <MenuButton />
          <Link
            to={isGuest ? '/account/sign-in' : '/account/profiles'}
            aria-label={t('switchProfile')}
            className="flex items-center gap-2 rounded-full bg-surface py-1.5 pr-4 pl-1.5 shadow-sm active:scale-95"
          >
            <Avatar avatar={player.avatar} size="sm" />
            <span className="max-w-28 truncate font-semibold text-ink">
              {isGuest ? t('guest.name') : player.name}
            </span>
          </Link>
        </div>
      </header>

      {/* Opening Tò He is playing: a guest sees only this slim strip, and signs in when it is worth it. */}
      {isGuest ? (
        <p className="flex items-center justify-between gap-3 rounded-2xl bg-notice px-4 py-2 text-notice-ink text-sm">
          {t('guest.banner')}
          <Link to="/account/sign-in" className="font-bold underline underline-offset-4">
            {t('guest.signIn')}
          </Link>
        </p>
      ) : null}

      <InstallNudge />

      {syncsWithServer(player) ? <RoomInvites player={player} /> : null}

      {!navigator.onLine && (
        <p className="rounded-xl bg-notice px-4 py-2 text-notice-ink text-sm">{t('offline')}</p>
      )}

      <section aria-labelledby="games-heading" className="flex flex-col gap-3">
        <h2 id="games-heading" className="font-bold text-ink text-xl">
          {t('games')}
        </h2>
        {games.isPending && <p className="text-ink-soft">{t('loading')}</p>}
        {games.isError && <p className="text-danger">{t('loadFailed')}</p>}
        {games.data?.length === 0 && <p className="text-ink-soft">{t('noGames')}</p>}
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {games.data?.map((game, index) => (
            <li
              key={game.id}
              className="relative animate-pop-in"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <Link
                to={game.rooms && !hasShell(game) ? '/play/$gameId/rooms' : '/play/$gameId'}
                params={{ gameId: game.id }}
                className="flex h-full flex-col items-center gap-2 rounded-3xl bg-surface p-4 text-center shadow-sm transition active:scale-95"
              >
                {game.iconUrl ? (
                  <img src={game.iconUrl} alt="" className="size-20 rounded-2xl" />
                ) : (
                  <span className="grid size-20 place-items-center rounded-2xl bg-soft text-4xl">🎲</span>
                )}
                <span className="font-bold text-ink text-lg">{game.name}</span>
                <span className="line-clamp-2 text-ink-soft text-sm">{game.description}</span>
              </Link>
              {syncsWithServer(player) ? <LeaderboardButton game={game} player={player} /> : null}
            </li>
          ))}
        </ul>
      </section>
      <footer className="mt-auto flex justify-center">
        <DataLink />
      </footer>
    </Screen>
  );
}
