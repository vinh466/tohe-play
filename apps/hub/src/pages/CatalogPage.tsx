import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameSummary } from '../api/client.ts';
import { gamesQuery } from '../api/queries.ts';
import { EnterCodeButton } from '../entry/EnterCode.tsx';
import { ShareButton } from '../entry/ShareSheet.tsx';
import { TabHeader } from '../frame/AppFrame.tsx';
import { InstallNudge } from '../install/InstallNudge.tsx';
import { byShownName, descriptionOf, nameOf } from '../launcher/gameWords.ts';
import { hasShell } from '../launcher/manifest.ts';
import { comingBack, openedBy } from '../launcher/recent.ts';
import { useOnline } from '../net/online.ts';
import { myTablesQuery, useTablePlayer } from '../rooms/myTables.ts';
import { RoomInvites } from '../rooms/RoomInvites.tsx';
import { MovedNotice } from '../session/MovedNotice.tsx';
import { RequireSession } from '../session/RequireSession.tsx';
import type { Player, SessionState } from '../session/session.ts';
import { syncsWithServer, useBackgroundSync } from '../session/useBackgroundSync.ts';
import { db } from '../storage/db.ts';
import { funnel } from '../telemetry/telemetry.ts';
import { DataLink } from '../ui/DataLink.tsx';
import { LeaderboardButton } from '../ui/Leaderboard.tsx';
import { Screen } from '../ui/Screen.tsx';

type PlayingSession = Extract<SessionState, { status: 'device' | 'account' }> & { player: Player };

export function CatalogPage() {
  return <RequireSession need="player">{(session) => <Catalog session={session} />}</RequireSession>;
}

/**
 * Trò chơi's first screen (ADR 0046): who is playing and "Nhập mã" → the tables the player sits at → invitations →
 * "Chơi tiếp", the game this profile opened last → "Gần đây" → every game. A section with nothing to show is not shown;
 * nothing counts days or presses anyone to come back.
 */
function Catalog({ session }: { session: PlayingSession }) {
  const { t, i18n } = useTranslation();
  const { player } = session;
  const games = useQuery(gamesQuery(player.id));
  const shown = useMemo(() => byShownName(games.data ?? [], i18n.language), [games.data, i18n.language]);
  const opened = useQuery({ queryKey: ['opened', player.id], queryFn: () => openedBy(db, player.id) });
  const back = useMemo(() => comingBack(opened.data ?? [], games.data ?? []), [opened.data, games.data]);
  const { acting } = useTablePlayer(session);
  const onDevice = player.kind === 'device';
  // Follows the connection live: the strip comes and goes with `online` and `offline`.
  const online = useOnline();
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

      {acting ? <SeatedTables player={acting} games={games.data ?? []} /> : null}

      {syncsWithServer(player) ? <RoomInvites player={player} /> : null}

      {back.last ? (
        <section aria-labelledby="continue-heading" className="flex flex-col gap-3">
          <h2 id="continue-heading" className="font-bold text-ink text-xl">
            {t('comingBack.continue')}
          </h2>
          <ContinueTile game={back.last} />
        </section>
      ) : null}

      {back.recent.length > 0 ? (
        <section aria-labelledby="recent-heading" className="flex flex-col gap-3">
          <h2 id="recent-heading" className="font-bold text-ink text-xl">
            {t('comingBack.recent')}
          </h2>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {back.recent.map((game) => (
              <li key={game.id}>
                <Link
                  {...gameLink(game)}
                  data-tile
                  className="flex h-full flex-col items-center gap-1.5 rounded-2xl bg-surface p-3 text-center shadow-sm transition active:scale-95"
                >
                  <GameIcon game={game} size="size-14" />
                  <span className="line-clamp-2 font-semibold text-ink text-sm">{nameOf(game)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!online && <p className="rounded-xl bg-notice px-4 py-2 text-notice-ink text-sm">{t('offline')}</p>}

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
                {...gameLink(game)}
                data-tile
                className="flex h-full flex-col items-center gap-2 rounded-3xl bg-surface p-4 text-center shadow-sm transition active:scale-95"
              >
                <GameIcon game={game} size="size-20" />
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

/** Where a game's tile leads: its menu, or the lobby of a game played only at tables. */
function gameLink(game: GameSummary) {
  return game.rooms && !hasShell(game)
    ? ({ to: '/play/$gameId/rooms', params: { gameId: game.id } } as const)
    : ({ to: '/play/$gameId', params: { gameId: game.id } } as const);
}

function GameIcon({ game, size }: { game: GameSummary; size: 'size-14' | 'size-20' }) {
  return game.iconUrl ? (
    <img src={game.iconUrl} alt="" className={`${size} shrink-0 rounded-2xl`} />
  ) : (
    <span className={`grid ${size} shrink-0 place-items-center rounded-2xl bg-soft text-4xl`}>🎲</span>
  );
}

/** "Chơi tiếp": the game this profile opened last, one big tile. What is left in it, the game says on its own screen. */
function ContinueTile({ game }: { game: GameSummary }) {
  const { t } = useTranslation();
  return (
    <Link
      {...gameLink(game)}
      data-tile
      className="flex items-center gap-4 rounded-3xl bg-surface p-4 shadow-sm transition active:scale-[0.98] md:max-w-xl"
    >
      <GameIcon game={game} size="size-20" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="line-clamp-2 font-black text-ink text-xl leading-tight">{nameOf(game)}</span>
        <span className="line-clamp-2 text-ink-soft text-sm">{descriptionOf(game)}</span>
      </span>
      <span className="shrink-0 rounded-full bg-brand px-5 py-2 font-bold text-on-brand text-xl">
        {t('play')}
      </span>
    </Link>
  );
}

/**
 * The tables the player sits at (`GET /api/rooms/mine`): "Tiến Lên · bàn của Bố — Vào lại", one tap back to each.
 * Nothing while there are none (the list, with its empty state, is Chơi cùng's).
 */
function SeatedTables({ player, games }: { player: Player; games: readonly GameSummary[] }) {
  const { t } = useTranslation();
  const mine = useQuery(myTablesQuery(player.id));
  if (!mine.data || mine.data.length === 0) return null;
  return (
    <section aria-labelledby="seated-heading" className="flex flex-col gap-3">
      <h2 id="seated-heading" className="font-bold text-ink text-xl">
        {t('together.tablesTitle')}
      </h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {mine.data.map((room) => {
          const game = games.find((g) => g.id === room.gameId);
          return (
            <li key={room.id}>
              <Link
                to="/play/$gameId/rooms/$roomId"
                params={{ gameId: room.gameId, roomId: room.id }}
                data-tile
                className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-sm transition active:scale-[0.98]"
              >
                {game ? (
                  <GameIcon game={game} size="size-14" />
                ) : (
                  <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-soft text-3xl">
                    🎲
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate font-bold text-ink">
                  {t('comingBack.table', { game: game ? nameOf(game) : room.gameId, host: room.hostName })}
                </span>
                <span className="shrink-0 rounded-full bg-brand px-4 py-2 font-bold text-on-brand text-xl">
                  {t('comingBack.backToTable')}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
