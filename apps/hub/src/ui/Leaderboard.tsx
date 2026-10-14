import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type GameSummary, progress } from '../api/client.ts';
import type { Player } from '../session/session.ts';
import { syncer } from '../session/useBackgroundSync.ts';
import { db } from '../storage/db.ts';
import { withOfflineCache } from '../storage/repository.ts';
import { Avatar } from './AvatarGrid.tsx';
import { Modal } from './Modal.tsx';

const MEDALS = ['🥇', '🥈', '🥉'];

/** 🏆 in the corner of a game card: the household's best scores for that game (M2). */
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
      <Modal open={open} title={t('leaderboard.title', { game: game.name })} onClose={() => setOpen(false)}>
        <Ranking gameId={game.id} player={player} />
      </Modal>
    </>
  );
}

function Ranking({ gameId, player }: { gameId: string; player: Player }) {
  const { t, i18n } = useTranslation();
  const board = useQuery({
    queryKey: ['leaderboard', gameId],
    queryFn: async () => {
      // Push this device's newest scores first, so a round just played is on the board.
      await syncer.syncNow(player.id).catch(() => {});
      return withOfflineCache(db, `leaderboard:${gameId}`, () => progress.leaderboard(gameId));
    },
    staleTime: 0,
  });
  const format = new Intl.NumberFormat(i18n.language);

  if (board.isPending) return <p className="text-ink-soft">{t('loading')}</p>;
  if (board.isError) return <p className="text-danger">{t('leaderboard.failed')}</p>;
  if (board.data.length === 0) return <p className="text-ink-soft">{t('leaderboard.empty')}</p>;

  return (
    <ol className="flex flex-col gap-2">
      {board.data.map((entry, index) => {
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
            </span>
            <span className="font-black text-ink text-xl tabular-nums">{format.format(entry.value)}</span>
          </li>
        );
      })}
    </ol>
  );
}
