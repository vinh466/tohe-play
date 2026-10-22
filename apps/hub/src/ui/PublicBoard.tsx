import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { boards, type PublicRow } from '../api/client.ts';
import { formatProfileId } from '../session/profileIds.ts';
import { Avatar } from './AvatarGrid.tsx';
import { Rank } from './Rank.tsx';

/**
 * A community's or the server's board of a game (ADR 0029): the first 50, and the viewer's place with two on each side
 * when it is further down. Names and avatars only; a tap shows a profile's ID, never anything more.
 */
export function PublicBoard({
  gameId,
  scope,
  period,
  playerId,
}: {
  gameId: string;
  scope: 'community' | 'server';
  period: 'week' | 'all';
  playerId: string;
}) {
  const { t, i18n } = useTranslation();
  const board = useQuery({
    queryKey: ['public-board', gameId, scope, period],
    queryFn: () => boards.public(gameId, scope, period),
    staleTime: 30_000,
  });
  const format = new Intl.NumberFormat(i18n.language);

  if (board.isPending) return <p className="text-ink-soft">{t('loading')}</p>;
  if (board.isError) return <p className="text-danger">{t('leaderboard.failed')}</p>;
  const { top, around, listed, hands, reproducible } = board.data;
  // Past the top, the viewer and their neighbours — without the places the top already shows.
  const past = around.filter((row) => !top.some((shown) => shown.rank === row.rank));
  // A board of checked results only says so once; a board that mixes them labels each one (D-16 Q4).
  const shown = [...top, ...past];
  const allUnverified = shown.length > 0 && shown.every((entry) => !entry.verified);
  const row = (entry: PublicRow) => (
    <Row
      key={entry.profileId}
      row={entry}
      mine={entry.profileId === playerId}
      hands={hands}
      label={!entry.verified && !allUnverified}
      format={format}
    />
  );

  return (
    <div className="flex flex-col gap-2">
      {listed ? null : (
        <p className="rounded-2xl bg-notice px-3 py-2 text-notice-ink text-sm">{t('boards.notListed')}</p>
      )}
      {allUnverified ? <p className="text-ink-soft text-sm">{t('boards.unverifiedBoard')}</p> : null}
      {top.length === 0 ? (
        <p className="text-ink-soft">
          {!reproducible && scope === 'server' ? t('boards.notVerifiable') : t('boards.empty')}
        </p>
      ) : (
        <ol className="flex flex-col gap-2">{top.map(row)}</ol>
      )}
      {past.length > 0 ? (
        <>
          <p aria-hidden className="text-center font-black text-ink-soft">
            ⋯
          </p>
          <ol className="flex flex-col gap-2">{past.map(row)}</ol>
        </>
      ) : null}
    </div>
  );
}

function Row({
  row,
  mine,
  hands,
  label,
  format,
}: {
  row: PublicRow;
  mine: boolean;
  hands: boolean;
  label: boolean;
  format: Intl.NumberFormat;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ${mine ? 'bg-soft-strong' : 'bg-surface'}`}
      >
        <Rank place={row.rank} />
        <Avatar avatar={row.avatar} size="sm" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-bold text-ink">
            {row.name}
            {mine ? ` (${t('leaderboard.you')})` : ''}
          </span>
          {hands ? (
            <span className="text-ink-soft text-sm">
              {t('boards.handsLine', { hands: row.hands ?? 0, firsts: row.firsts ?? 0 })}
            </span>
          ) : null}
          {label ? <span className="text-ink-soft text-xs">{t('boards.unverified')}</span> : null}
          {open ? (
            <span className="whitespace-nowrap font-mono text-ink-soft text-sm">
              {t('boards.id', { id: formatProfileId(row.publicId) })}
            </span>
          ) : null}
        </span>
        <span className="font-black text-ink text-xl tabular-nums">{format.format(row.value)}</span>
      </button>
    </li>
  );
}
