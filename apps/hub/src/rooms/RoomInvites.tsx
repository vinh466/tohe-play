import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { rooms } from '../api/client.ts';
import { gamesQuery } from '../api/queries.ts';
import type { Player } from '../session/session.ts';
import { Avatar } from '../ui/AvatarGrid.tsx';

/**
 * Tables another profile of the account asked this profile to (ADR 0016, phase 3): a banner on the catalog with one tap to the
 * room's preview. Checked every 20 s while the catalog shows; an invitation lasts 10 minutes.
 */
export function RoomInvites({ player }: { player: Player }) {
  const { t } = useTranslation();
  const games = useQuery(gamesQuery(player.id));
  const invites = useQuery({
    queryKey: ['room-invites', player.id],
    queryFn: () => rooms.invites(),
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });
  if (!invites.data || invites.data.length === 0) return null;
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
              {t('rooms.inviteBanner', { from: invite.fromName, game: game?.name ?? invite.gameId })}
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
