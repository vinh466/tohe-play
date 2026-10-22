import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { boards, type GameSummary } from '../api/client.ts';
import { meQuery } from '../api/queries.ts';
import { nameOf } from '../launcher/gameWords.ts';
import type { Player } from '../session/session.ts';
import { syncer } from '../session/useBackgroundSync.ts';
import { db } from '../storage/db.ts';
import { withOfflineCache } from '../storage/repository.ts';
import { Avatar } from './AvatarGrid.tsx';
import { Icon } from './Icon.tsx';
import { Modal } from './Modal.tsx';
import { PublicBoard } from './PublicBoard.tsx';
import { Rank } from './Rank.tsx';
import { Segmented } from './Segmented.tsx';

type Period = 'week' | 'all';
type Scope = 'account' | 'community' | 'server';

/** "Bảng điểm" under a game's name: the best scores of the account's profiles for that game (M2). */
export function LeaderboardButton({ game, player }: { game: GameSummary; player: Player }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('leaderboard.button', { game: nameOf(game) })}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 font-semibold text-accent text-sm active:bg-soft"
      >
        <Icon name="trophy" className="text-lg" />
        {t('leaderboard.short')}
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
    <Modal open={open} title={t('leaderboard.title', { game: nameOf(game) })} onClose={onClose}>
      {open ? <Ranking gameId={game.id} player={player} /> : null}
    </Modal>
  );
}

/**
 * The account's board, its community's and the server's (ADR 0029) — this week, from Monday 00:00 in Việt Nam, or all
 * time.
 */
function Ranking({ gameId, player }: { gameId: string; player: Player }) {
  const { t } = useTranslation();
  const me = useQuery(meQuery);
  const community = me.data?.account.community ?? null;
  const [scope, setScope] = useState<Scope>('account');
  const [period, setPeriod] = useState<Period>('week');
  const scopes: { value: Scope; label: string }[] = [
    { value: 'account', label: t('boards.account') },
    ...(community ? [{ value: 'community' as const, label: t('boards.community') }] : []),
    { value: 'server', label: t('boards.server') },
  ];
  return (
    <div className="flex flex-col gap-3">
      <Segmented<Scope> legend={t('boards.scope')} options={scopes} value={scope} onChange={setScope} />
      <Segmented<Period>
        legend={t('leaderboard.period')}
        options={[
          { value: 'week', label: t('leaderboard.week') },
          { value: 'all', label: t('leaderboard.allTime') },
        ]}
        value={period}
        onChange={setPeriod}
      />
      {scope === 'community' && community ? <p className="text-ink-soft text-sm">{community}</p> : null}
      {scope === 'account' ? (
        <Rows gameId={gameId} player={player} period={period} />
      ) : (
        <PublicBoard gameId={gameId} scope={scope} period={period} playerId={player.id} />
      )}
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
            <Rank place={index + 1} />
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
