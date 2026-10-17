import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { rooms } from '../api/client.ts';
import { Avatar } from '../ui/AvatarGrid.tsx';

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/**
 * A game's online results in its lobby (ADR 0016, phase 3): the profile's own, the account's board over the last 7
 * days (the account's profiles only, like every board on Tò He so far), and the last hands, each with a replay.
 */
export function RoomResults({ gameId, playerId }: { gameId: string; playerId: string }) {
  const { t } = useTranslation();
  const stats = useQuery({ queryKey: ['room-stats', gameId, playerId], queryFn: () => rooms.stats(gameId) });
  const history = useQuery({
    queryKey: ['room-history', gameId, playerId],
    queryFn: () => rooms.history(gameId),
  });
  const places = t('rooms.places', { returnObjects: true }) as string[];
  if (!stats.data) return null;
  const { week, allTime, account } = stats.data;

  return (
    <section aria-labelledby="room-results" className="flex flex-col gap-3">
      <h2 id="room-results" className="font-bold text-ink text-xl">
        {t('rooms.stats')}
      </h2>
      <dl className="grid grid-cols-2 gap-2">
        {[
          { label: t('rooms.statsWeek'), line: week },
          { label: t('rooms.statsAll'), line: allTime },
        ].map(({ label, line }) => (
          <div key={label} className="rounded-2xl bg-surface p-3 shadow-sm">
            <dt className="text-ink-soft text-sm">{label}</dt>
            <dd className="font-bold text-ink">
              {t('rooms.statsLine', { hands: line.hands, firsts: line.firsts, points: signed(line.points) })}
            </dd>
          </div>
        ))}
      </dl>

      <h3 className="font-bold text-ink">{t('rooms.board')}</h3>
      {account.length === 0 ? <p className="text-ink-soft">{t('rooms.boardEmpty')}</p> : null}
      <ol className="flex flex-col gap-2">
        {account.map((row, index) => (
          <li
            key={row.profileId}
            className={`flex items-center gap-3 rounded-2xl p-3 ${row.profileId === playerId ? 'bg-notice text-notice-ink' : 'bg-surface text-ink'}`}
          >
            <span className="w-6 text-center font-black">{index + 1}</span>
            <Avatar avatar={row.avatar} size="sm" />
            <span className="min-w-0 flex-1 truncate font-bold">{row.name}</span>
            <span className="text-sm">
              {t('rooms.statsLine', { hands: row.hands, firsts: row.firsts, points: signed(row.points) })}
            </span>
          </li>
        ))}
      </ol>

      {history.data && history.data.length > 0 ? (
        <>
          <h3 className="font-bold text-ink">{t('rooms.recent')}</h3>
          <ul className="flex flex-col gap-2">
            {history.data.slice(0, 5).map((hand) => (
              <li
                key={`${hand.roomId}:${hand.hand}`}
                className="flex items-center gap-3 rounded-2xl bg-surface p-3"
              >
                <span className="min-w-0 flex-1 text-ink">
                  <span className="block text-ink-soft text-xs">
                    {new Date(hand.finishedAt).toLocaleString()}
                  </span>
                  {t('rooms.recentLine', {
                    place: places[hand.place] ?? `#${hand.place + 1}`,
                    points: signed(hand.points),
                    players: hand.players,
                  })}
                </span>
                <Link
                  to="/replay/$roomId/$hand"
                  params={{ roomId: hand.roomId, hand: String(hand.hand) }}
                  className="rounded-full bg-soft px-3 py-2 font-semibold text-accent text-sm"
                >
                  {t('rooms.replay')}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
