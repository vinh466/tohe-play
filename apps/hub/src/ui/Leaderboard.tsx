import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { boards, type GameSummary } from '../api/client.ts';
import type { Player } from '../session/session.ts';
import { syncer } from '../session/useBackgroundSync.ts';
import { db } from '../storage/db.ts';
import { withOfflineCache } from '../storage/repository.ts';
import { Avatar } from './AvatarGrid.tsx';
import { Modal } from './Modal.tsx';

const MEDALS = ['🥇', '🥈', '🥉'];

const PERIODS = ['week', 'all'] as const;
type Period = (typeof PERIODS)[number];

/** 🏆 in the corner of a game card: the best scores of the account's profiles for that game (M2). */
export function LeaderboardButton({ game, player }: { game: GameSummary; player: Player }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('leaderboard.button', { game: game.name })}
        className="absolute top-1.5 right-1.5 grid size-10 place-items-center rounded-full bg-soft text-xl active:scale-95"
      >
        <span aria-hidden>🏆</span>
      </button>
      <LeaderboardSheet game={game} player={player} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** The account's board for a game in a sheet: from its catalog card, or over the game when it asks (ADR 0018). */
export function LeaderboardSheet({
  game,
  player,
  open,
  onClose,
}: {
  game: GameSummary;
  player: Player;
  open: boolean;
  onClose(): void;
}) {
  const { t } = useTranslation();
  return (
    <Modal open={open} title={t('leaderboard.title', { game: game.name })} onClose={onClose}>
      {open ? <Ranking gameId={game.id} player={player} /> : null}
    </Modal>
  );
}

/** This week — from Monday 00:00 in Việt Nam — or all time (ADR 0029). */
function Ranking({ gameId, player }: { gameId: string; player: Player }) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>('week');
  return (
    <div className="flex flex-col gap-3">
      <fieldset className="grid min-w-0 grid-cols-2 gap-1 rounded-2xl bg-soft p-1">
        <legend className="sr-only">{t('leaderboard.period')}</legend>
        {PERIODS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={value === period}
            onClick={() => setPeriod(value)}
            className={`rounded-xl px-3 py-2 font-bold ${value === period ? 'bg-surface text-ink shadow-sm' : 'text-ink-soft'}`}
          >
            {t(value === 'week' ? 'leaderboard.week' : 'leaderboard.allTime')}
          </button>
        ))}
      </fieldset>
      <Rows gameId={gameId} player={player} period={period} />
    </div>
  );
}

function Rows({ gameId, player, period }: { gameId: string; player: Player; period: Period }) {
  const { t, i18n } = useTranslation();
  const board = useQuery({
    queryKey: ['leaderboard', gameId, period],
    queryFn: async () => {
      // Push this device's newest scores first, so a round just played is on the board.
      await syncer.syncNow(player.id).catch(() => {});
      return withOfflineCache(db, `leaderboard:${gameId}:${period}`, () => boards.account(gameId, period));
    },
    staleTime: 0,
  });
  const format = new Intl.NumberFormat(i18n.language);

  if (board.isPending) return <p className="text-ink-soft">{t('loading')}</p>;
  if (board.isError) return <p className="text-danger">{t('leaderboard.failed')}</p>;
  if (board.data.rows.length === 0) {
    return (
      <p className="text-ink-soft">{t(period === 'week' ? 'leaderboard.emptyWeek' : 'leaderboard.empty')}</p>
    );
  }

  return (
    <ol className="flex flex-col gap-2">
      {board.data.rows.map((entry, index) => {
        const mine = entry.profileId === player.id;
        return (
          <li
            key={entry.profileId}
            className={`flex items-center gap-3 rounded-2xl p-3 ${mine ? 'bg-soft-strong' : 'bg-surface'}`}
          >
            <span className="w-8 text-center font-black text-2xl text-ink">{MEDALS[index] ?? index + 1}</span>
            <Avatar avatar={entry.avatar} size="sm" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-bold text-ink">
                {entry.name}
                {mine ? ` (${t('leaderboard.you')})` : ''}
              </span>
              {entry.inProgress ? (
                <span className="text-ink-soft text-sm">{t('leaderboard.inProgress')}</span>
              ) : null}
              {entry.underReview ? (
                <span className="w-fit rounded-full bg-notice px-2 py-0.5 font-semibold text-notice-ink text-xs">
                  {t('leaderboard.underReview')}
                </span>
              ) : null}
            </span>
            <span className="font-black text-ink text-xl tabular-nums">{format.format(entry.value)}</span>
          </li>
        );
      })}
    </ol>
  );
}
