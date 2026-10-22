import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { type GameSummary, links, type RoomSummary, type ShareLinkView } from '../api/client.ts';
import { gamesQuery } from '../api/queries.ts';
import { formatEntryCode } from '../entry/codes.ts';
import { EnterCodeForm } from '../entry/EnterCode.tsx';
import { TabHeader } from '../frame/AppFrame.tsx';
import { nameOf } from '../launcher/gameWords.ts';
import { myTablesQuery, useTablePlayer } from '../rooms/myTables.ts';
import { RoomInvites } from '../rooms/RoomInvites.tsx';
import { RequireSession } from '../session/RequireSession.tsx';
import type { Player, SessionState } from '../session/session.ts';
import { syncsWithServer } from '../session/useBackgroundSync.ts';
import { Avatar } from '../ui/AvatarGrid.tsx';
import { Screen } from '../ui/Screen.tsx';

type PlayingSession = Extract<SessionState, { status: 'device' | 'account' }> & { player: Player };

/** How many of the newest links Chơi cùng shows; the full list stays at /account/links. */
const NEWEST_LINKS = 3;

/**
 * Chơi cùng, the frame's second tab (ADR 0046): the box for a table's or a link's code, the tables the player sits at,
 * the invitations to them and the newest links they sent. Only what the API already lists: `GET /api/rooms/mine`,
 * `GET /api/rooms/invites` (a profile of an account: a device profile has no public ID to be invited by, ADR 0033) and
 * `GET /api/links/mine`. A device profile that never reached the server has sat at no table and sent no link, so it is
 * not asked for a name only to see that; it acts with its device's key once it has (ADR 0043).
 */
export function TogetherPage() {
  return <RequireSession need="player">{(session) => <Together session={session} />}</RequireSession>;
}

function Together({ session }: { session: PlayingSession }) {
  const { t } = useTranslation();
  // Who acts at the tables and on links: the account's session, or the device profile with a copy on the server.
  const { acting, waiting } = useTablePlayer(session);

  return (
    <Screen>
      <TabHeader title={t('frame.together')} player={session.player} />

      <Section id="together-code" title={t('together.codeTitle')}>
        <p className="-mt-2 text-ink-soft">{t('entry.codeBody')}</p>
        <EnterCodeForm />
      </Section>

      {waiting ? (
        <p className="text-center text-ink-soft">{t('loading')}</p>
      ) : (
        <>
          <Section id="together-tables" title={t('together.tablesTitle')}>
            {acting ? <Tables player={acting} /> : <Empty text={t('together.tablesEmpty')} />}
          </Section>
          {syncsWithServer(session.player) ? (
            <Section id="together-invites" title={t('together.invitesTitle')}>
              <RoomInvites player={session.player} empty={<Empty text={t('together.invitesEmpty')} />} />
            </Section>
          ) : null}
          <Section id="together-links" title={t('together.linksTitle')}>
            {acting ? <NewestLinks player={acting} /> : <Empty text={t('links.empty')} />}
            <Link
              to="/account/links"
              className="self-start font-semibold text-accent underline underline-offset-4"
            >
              {t('together.allLinks')}
            </Link>
          </Section>
        </>
      )}
    </Screen>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="font-bold text-ink text-xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl bg-surface p-4 text-center text-ink-soft shadow-sm">{text}</p>;
}

function GameIcon({ game }: { game?: GameSummary }) {
  return game?.iconUrl ? (
    <img src={game.iconUrl} alt="" className="size-12 shrink-0 rounded-xl" />
  ) : (
    <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-soft text-2xl">🎲</span>
  );
}

/** The open tables the player sits at, to go back to one. */
function Tables({ player }: { player: Player }) {
  const { t } = useTranslation();
  const games = useQuery(gamesQuery(player.id));
  const mine = useQuery(myTablesQuery(player.id));
  if (mine.isPending) return <p className="text-ink-soft">{t('loading')}</p>;
  if (mine.isError || mine.data.length === 0) return <Empty text={t('together.tablesEmpty')} />;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {mine.data.map((room) => (
        <TableRow key={room.id} room={room} game={games.data?.find((game) => game.id === room.gameId)} />
      ))}
    </ul>
  );
}

function TableRow({ room, game }: { room: RoomSummary; game?: GameSummary }) {
  const { t } = useTranslation();
  return (
    <li>
      <Link
        to="/play/$gameId/rooms/$roomId"
        params={{ gameId: room.gameId, roomId: room.id }}
        className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-sm transition active:scale-[0.98]"
      >
        <GameIcon game={game} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-bold text-ink">{game ? nameOf(game) : room.gameId}</span>
          <span className="flex items-center gap-1.5 text-ink-soft text-sm">
            <Avatar avatar={room.hostAvatar || '🙂'} size="sm" />
            <span className="truncate">
              {t('together.tableLine', { host: room.hostName, taken: room.taken, seats: room.seats })}
            </span>
          </span>
        </span>
        <span aria-hidden className="text-ink-soft text-xl">
          ›
        </span>
      </Link>
    </li>
  );
}

/** The newest links the player sent, as "Link của tôi" lists them; all of them there. */
function NewestLinks({ player }: { player: Player }) {
  const { t } = useTranslation();
  const games = useQuery(gamesQuery(player.id));
  const mine = useQuery({ queryKey: ['links-mine', player.id], queryFn: () => links.mine(), retry: false });
  if (mine.isPending) return <p className="text-ink-soft">{t('loading')}</p>;
  if (mine.isError || mine.data.length === 0) return <Empty text={t('links.empty')} />;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {mine.data.slice(0, NEWEST_LINKS).map((link) => (
        <LinkRow key={link.code} link={link} game={games.data?.find((game) => game.id === link.gameId)} />
      ))}
    </ul>
  );
}

function LinkRow({ link, game }: { link: ShareLinkView; game?: GameSummary }) {
  const { t } = useTranslation();
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-sm">
      <GameIcon game={game} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-bold text-ink">{game ? nameOf(game) : link.gameId}</span>
        <span className="font-semibold text-ink-soft text-sm tracking-wider">
          {formatEntryCode({ kind: 'share', code: link.code })}
        </span>
      </span>
      <span className="shrink-0 text-ink-soft text-sm">
        {t(`links.state.${link.state}`, { defaultValue: link.state })}
      </span>
    </li>
  );
}
