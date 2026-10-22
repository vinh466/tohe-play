import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { gamesQuery } from '../api/queries.ts';
import { EnterCodeButton } from '../entry/EnterCode.tsx';
import { ShareButton } from '../entry/ShareSheet.tsx';
import { TabHeader } from '../frame/AppFrame.tsx';
import { InstallNudge } from '../install/InstallNudge.tsx';
import { byShownName, descriptionOf, nameOf } from '../launcher/gameWords.ts';
import { hasShell } from '../launcher/manifest.ts';
import { RoomInvites } from '../rooms/RoomInvites.tsx';
import { MovedNotice } from '../session/MovedNotice.tsx';
import { RequireSession } from '../session/RequireSession.tsx';
import type { Player, SessionState } from '../session/session.ts';
import { syncsWithServer, useBackgroundSync } from '../session/useBackgroundSync.ts';
import { funnel } from '../telemetry/telemetry.ts';
import { DataLink } from '../ui/DataLink.tsx';
import { LeaderboardButton } from '../ui/Leaderboard.tsx';
import { Screen } from '../ui/Screen.tsx';

type PlayingSession = Extract<SessionState, { status: 'device' | 'account' }> & { player: Player };

export function CatalogPage() {
  return <RequireSession need="player">{(session) => <Catalog session={session} />}</RequireSession>;
}

function Catalog({ session }: { session: PlayingSession }) {
  const { t, i18n } = useTranslation();
  const { player } = session;
  const games = useQuery(gamesQuery(player.id));
  const shown = useMemo(() => byShownName(games.data ?? [], i18n.language), [games.data, i18n.language]);
  const onDevice = player.kind === 'device';
  useBackgroundSync(player);

  return (
    <Screen wide>
      {/* Who is playing (tap: change), and "Nhập mã" in sight on the first screen (ADR 0044, 0046): the installed app
          on an iPhone cannot follow a link. */}
      <TabHeader title={t('frame.games')} player={player} />
      <div className="-mt-2 flex">
        <EnterCodeButton />
      </div>

      {/* A device profile moved to another device with a transfer code (ADR 0043): said once, when the hub opens. */}
      <MovedNotice />

      {/* Opening Tò He is playing: a device profile sees only this slim strip, and signs in when it is worth it. */}
      {onDevice ? (
        <p className="flex items-center justify-between gap-3 rounded-2xl bg-notice px-4 py-2 text-notice-ink text-sm">
          {t('device.banner')}
          <Link
            to="/account/sign-in"
            onClick={() => funnel.signInOpened()}
            className="font-bold underline underline-offset-4"
          >
            {t('device.signIn')}
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
          {t('allGames')}
        </h2>
        {games.isPending && <p className="text-ink-soft">{t('loading')}</p>}
        {games.isError && <p className="text-danger">{t('loadFailed')}</p>}
        {games.data?.length === 0 && <p className="text-ink-soft">{t('noGames')}</p>}
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {shown.map((game, index) => (
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
                <span className="font-bold text-ink text-lg">{nameOf(game)}</span>
                <span className="line-clamp-2 text-ink-soft text-sm">{descriptionOf(game)}</span>
              </Link>
              <ShareButton game={game} session={session} />
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
