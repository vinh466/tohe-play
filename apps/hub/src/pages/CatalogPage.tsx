import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameSummary } from '../api/client.ts';
import { gamesQuery } from '../api/queries.ts';
import { EnterCodeButton } from '../entry/EnterCode.tsx';
import { ShareButton } from '../entry/ShareSheet.tsx';
import { TabHeader } from '../frame/AppFrame.tsx';
import { InstallNudge } from '../install/InstallNudge.tsx';
import { byShownName, nameOf } from '../launcher/gameWords.ts';
import { hasShell } from '../launcher/manifest.ts';
import { comingBack, openedBy } from '../launcher/recent.ts';
import { useOnline } from '../net/online.ts';
import { myTablesQuery, tableCode, useTablePlayer } from '../rooms/myTables.ts';
import { RoomInvites } from '../rooms/RoomInvites.tsx';
import { MovedNotice } from '../session/MovedNotice.tsx';
import { RequireSession } from '../session/RequireSession.tsx';
import type { Player, SessionState } from '../session/session.ts';
import { syncsWithServer, useBackgroundSync } from '../session/useBackgroundSync.ts';
import { db } from '../storage/db.ts';
import { Icon } from '../ui/Icon.tsx';
import { LeaderboardButton } from '../ui/Leaderboard.tsx';
import { SaveProgressCard } from '../ui/SaveProgressCard.tsx';
import { Screen } from '../ui/Screen.tsx';

type PlayingSession = Extract<SessionState, { status: 'device' | 'account' }> & { player: Player };

/** The tags a shelf card can be filtered by, in the order the row shows them. */
const TAG_KEYS = ['puzzle', 'numbers', 'cards', 'classic', 'reflex'] as const;

export function CatalogPage() {
  return (
    <RequireSession need="player" door>
      {(session) => <Catalog session={session} />}
    </RequireSession>
  );
}

/**
 * Trò chơi's first screen (ADR 0046): who is playing and "Nhập mã" → the tables the player sits at → invitations →
 * "Chơi tiếp", the game this profile opened last → "Gần đây" → every game, each a picture and a name (a tile has no
 * description: a game's line lives on its public page). A section with nothing to show is not shown; nothing counts
 * days or presses anyone to come back. There is no title: the bar already says where this is.
 */
function Catalog({ session }: { session: PlayingSession }) {
  const { t, i18n } = useTranslation();
  const { player } = session;
  const games = useQuery(gamesQuery(player.id));
  const shown = useMemo(() => byShownName(games.data ?? [], i18n.language), [games.data, i18n.language]);
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const availableTags = useMemo(
    () => TAG_KEYS.filter((tag) => shown.some((game) => game.tags.includes(tag))),
    [shown],
  );
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(i18n.language);
    return shown.filter(
      (game) =>
        (!activeTag || game.tags.includes(activeTag)) &&
        (!needle || nameOf(game).toLocaleLowerCase(i18n.language).includes(needle)),
    );
  }, [shown, activeTag, query, i18n.language]);
  const filtering = query.trim().length > 0 || activeTag !== null;
  const opened = useQuery({ queryKey: ['opened', player.id], queryFn: () => openedBy(db, player.id) });
  const back = useMemo(() => comingBack(opened.data ?? [], games.data ?? []), [opened.data, games.data]);
  const { acting } = useTablePlayer(session);
  // Follows the connection live: the strip comes and goes with `online` and `offline`.
  const online = useOnline();
  useBackgroundSync(player);
  // "Tất cả trò chơi" is a heading to read only when something else is above it to tell it from.
  const sectionsAbove = back.last !== null || back.recent.length > 0 || filtering;

  return (
    <Screen wide>
      {/* Who is playing (tap: change), and "Nhập mã" in sight on the first screen (ADR 0044, 0046): the installed app
          on an iPhone cannot follow a link. */}
      <TabHeader title={t('frame.games')} player={player} action={<EnterCodeButton />} />

      {/* A device profile moved to another device with a transfer code (ADR 0043): said once, when the hub opens. */}
      <MovedNotice />

      <InstallNudge />
      {player.kind === 'device' ? <SaveProgressCard /> : null}

      {acting ? <SeatedTables player={acting} games={games.data ?? []} /> : null}

      {syncsWithServer(player) ? <RoomInvites player={player} /> : null}

      {back.last ? (
        <section aria-label={t('comingBack.continue')}>
          <ContinueTile game={back.last} />
        </section>
      ) : null}

      {back.recent.length > 0 ? (
        <section aria-labelledby="recent-heading" className="flex flex-col gap-3">
          <h2 id="recent-heading" className="font-bold text-ink text-lg">
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
                  <GameIcon game={game} className="size-14" />
                  <span className="font-semibold text-ink text-sm">{nameOf(game)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!online && <p className="rounded-xl bg-notice px-4 py-2 text-notice-ink text-sm">{t('offline')}</p>}

      <section aria-label={t('catalog.search')} className="flex flex-col gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('catalog.searchPlaceholder')}
          aria-label={t('catalog.search')}
          className="min-h-12 rounded-xl border border-line bg-surface px-4 text-ink placeholder:text-ink-faint"
        />
        {availableTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={activeTag === null}
              onClick={() => setActiveTag(null)}
              className={`min-h-11 rounded-full px-4 font-bold text-sm ${
                activeTag === null ? 'bg-ink text-page' : 'border border-line text-ink-soft'
              }`}
            >
              {t('catalog.all')}
            </button>
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                aria-pressed={activeTag === tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`min-h-11 rounded-full px-4 font-bold text-sm ${
                  activeTag === tag ? 'bg-ink text-page' : 'border border-line text-ink-soft'
                }`}
              >
                {t(`catalog.tags.${tag}`)}
              </button>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="games-heading" className="flex flex-col gap-3">
        <h2 id="games-heading" className={sectionsAbove ? 'font-bold text-ink text-lg' : 'sr-only'}>
          {t('allGames')}
        </h2>
        {games.isPending && <p className="text-ink-soft">{t('loading')}</p>}
        {games.isError && <p className="text-danger">{t('loadFailed')}</p>}
        {games.data?.length === 0 && <p className="text-ink-soft">{t('noGames')}</p>}
        {!games.isPending && visible.length === 0 && <p className="text-ink-soft">{t('catalog.noMatch')}</p>}
        {/* The columns follow the room: as many as fit tiles of a width that grows with the screen, stretched to fill
            the row, so a few games are big on a tablet or a computer and the width is never left empty. */}
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9.5rem),1fr))] gap-4 md:grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] lg:grid-cols-[repeat(auto-fill,minmax(15rem,18rem))] lg:justify-center portrait:md:grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] short:grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] short:gap-2">
          {visible.map((game) => (
            <li key={game.id} className="flex flex-col rounded-3xl bg-surface p-3 shadow-sm short:p-2">
              <Link
                {...gameLink(game)}
                data-tile
                className="flex flex-col items-center gap-2 rounded-2xl text-center transition active:scale-95 short:gap-1"
              >
                <GameCover game={game} className="aspect-video w-full short:w-24" />
                <span className="font-bold text-ink text-lg leading-tight">{nameOf(game)}</span>
              </Link>
              <Link
                {...gameLink(game)}
                className="mt-2 flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 font-bold text-on-brand text-xl transition active:scale-95"
              >
                {t('play')}
              </Link>
              <div className="mt-1 flex flex-wrap justify-center">
                <ShareButton game={game} session={session} />
                {syncsWithServer(player) ? <LeaderboardButton game={game} player={player} /> : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </Screen>
  );
}

/** Where a game's tile leads: its menu, or the lobby of a game played only at tables. */
function gameLink(game: GameSummary) {
  return game.rooms && !hasShell(game)
    ? ({ to: '/play/$gameId/rooms', params: { gameId: game.id } } as const)
    : ({ to: '/play/$gameId', params: { gameId: game.id } } as const);
}

/** A game's cover: its picture, cropped to 16:9; a game without one gets a die on the soft surface. */
function GameCover({ game, className }: { game: GameSummary; className: string }) {
  return game.iconUrl ? (
    <img src={game.iconUrl} alt="" className={`${className} shrink-0 rounded-2xl object-cover`} />
  ) : (
    <span
      className={`grid ${className} shrink-0 place-items-center rounded-2xl bg-soft text-accent text-4xl`}
    >
      <Icon name="dice-five" weight="fill" />
    </span>
  );
}

/** A game's picture; a game without one gets a die. `className` sizes it (the picture is a square). */
function GameIcon({ game, className }: { game: GameSummary; className: string }) {
  return game.iconUrl ? (
    <img src={game.iconUrl} alt="" className={`${className} shrink-0 rounded-2xl`} />
  ) : (
    <span
      className={`grid ${className} shrink-0 place-items-center rounded-2xl bg-soft text-accent text-4xl`}
    >
      <Icon name="dice-five" weight="fill" />
    </span>
  );
}

/** "Chơi tiếp": the game this profile opened last, one big tile. What is left in it, the game says on its own screen. */
function ContinueTile({ game }: { game: GameSummary }) {
  const { t } = useTranslation();
  return (
    <Link
      {...gameLink(game)}
      data-tile
      className="flex items-center gap-4 rounded-3xl bg-surface p-4 shadow-sm transition active:scale-[0.98] md:max-w-2xl md:gap-6 md:p-5 short:gap-3 short:p-2"
    >
      <GameCover game={game} className="aspect-video w-32 md:w-48 short:w-24" />
      <span className="min-w-0 flex-1 font-black text-2xl text-ink leading-tight md:text-3xl short:text-xl">
        {nameOf(game)}
      </span>
      <span className="shrink-0 rounded-full bg-brand px-5 py-2 font-bold text-on-brand text-xl">
        {t('comingBack.continue')}
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
                  <GameIcon game={game} className="size-14" />
                ) : (
                  <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-soft text-3xl text-accent">
                    <Icon name="dice-five" weight="fill" />
                  </span>
                )}
                <span className="min-w-0 flex-1 font-bold text-ink">
                  {room.code
                    ? t('comingBack.tableCode', {
                        game: game ? nameOf(game) : room.gameId,
                        code: tableCode(room.code),
                      })
                    : t('comingBack.table', { game: game ? nameOf(game) : room.gameId, host: room.hostName })}
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
