import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { rooms } from '../api/client.ts';
import { gamesQuery } from '../api/queries.ts';
import { nameOf } from '../launcher/gameWords.ts';
import type { Player } from '../session/session.ts';
import { Avatar } from '../ui/AvatarGrid.tsx';

/**
 * Tables another profile asked this profile to (ADR 0016 phase 3, ADR 0033): a banner on the catalog and in Chơi cùng
 * with one tap to the room's preview. Checked every 20 s while the screen shows; an invitation lasts 10 minutes. With
 * none, `empty` (Chơi cùng says so; the catalog says nothing).
 */
export function RoomInvites({ player, empty = null }: { player: Player; empty?: ReactNode }) {
  const { t } = useTranslation();
  const games = useQuery(gamesQuery(player.id));
  const invites = useQuery({
    queryKey: ['room-invites', player.id],
    queryFn: () => rooms.invites(),
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });
  if (!invites.data || invites.data.length === 0) return invites.isPending ? null : empty;
  return (
    <ul className="flex flex-col gap-2" aria-live="polite">
      {invites.data.map((invite) => {
        const game = games.data?.find((g) => g.id === invite.gameId);
        return (
          <li
            key={invite.roomId}
            className="flex items-center gap-3 rounded-2xl bg-notice p-3 text-notice-ink"
          >
            <Avatar avatar={invite.fromAvatar || '🙂'} size="sm" />
            <span className="min-w-0 flex-1 font-semibold">
              {t('rooms.inviteBanner', { from: invite.fromName, game: game ? nameOf(game) : invite.gameId })}
            </span>
            <Link
              to="/r/$code"
              params={{ code: invite.code }}
              className="shrink-0 rounded-full bg-brand px-4 py-2 font-bold text-on-brand text-xl active:bg-brand-strong"
            >
              {t('rooms.inviteGo')}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
