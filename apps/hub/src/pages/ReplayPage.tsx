import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import type { Replay } from '@tohe/contract';
import type { JsonValue } from '@tohe/game-sdk';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { type HandReplay, rooms } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { configQuery, gamesQuery } from '../api/queries.ts';
import { GameFrame } from '../launcher/GameFrame.tsx';
import { BackLink, useLeaveTo } from '../navigation/leave.tsx';
import { RequireSession } from '../session/RequireSession.tsx';
import type { Player } from '../session/session.ts';
import { Screen } from '../ui/Screen.tsx';

/** A finished online hand played back in the game (ADR 0016), from the seat of the person watching it. */
export function ReplayPage() {
  return (
    <RequireSession need="player" device={false}>
      {({ player }) => <Replayer player={player} />}
    </RequireSession>
  );
}

/**
 * The replay as the game receives it in `init.replay`. A player whose profile was deleted since keeps their seat, under
 * `deletedName` (ADR 0034).
 */
export function replayFor(hand: HandReplay, deletedName: string): Replay {
  return {
    seats: hand.seats.map((seat) => ({
      profile: seat.profileId
        ? {
            id: seat.profileId,
            name: seat.deleted ? deletedName : (seat.name ?? ''),
            avatar: seat.avatar ?? undefined,
          }
        : null,
      bot: seat.bot,
      connected: true,
    })),
    seat: hand.mySeat,
    seed: hand.seed,
    options: hand.options as Record<string, JsonValue>,
    carry: hand.carry as JsonValue,
    actions: hand.actions.map((step) => ({ seat: step.seat, action: step.action as JsonValue })),
  };
}

function Replayer({ player }: { player: Player }) {
  const { gameId, roomId, hand } = useParams({ from: '/play/$gameId/rooms/$roomId/replay/$hand' });
  const { t } = useTranslation();
  const leaveTo = useLeaveTo();
  const games = useQuery(gamesQuery(player.id));
  const config = useQuery(configQuery);
  const record = useQuery({
    queryKey: ['replay', roomId, hand],
    queryFn: () => rooms.replay(roomId, Number(hand)),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const game = games.data?.find((g) => g.id === record.data?.gameId);
  const deletedName = t('rooms.deletedPlayer');
  const replay = useMemo(
    () => (record.data ? replayFor(record.data, deletedName) : undefined),
    [record.data, deletedName],
  );
  const back = () =>
    leaveTo({ to: '/play/$gameId/rooms', params: { gameId: record.data?.gameId ?? gameId } });

  if (record.isError || (record.data && games.isSuccess && !game)) {
    return (
      <Screen narrow>
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-center text-danger">
          {record.isError ? t(errorKey(record.error)) : t('gameNotFound')}
        </p>
        <BackLink to="/play" className="text-center font-semibold text-accent">
          {t('backToGames')}
        </BackLink>
      </Screen>
    );
  }
  // A build replays only its own hands: a newer rules module could tell the story differently.
  if (record.data && game && record.data.gameVersion !== game.version) {
    return (
      <Screen narrow>
        <p className="rounded-2xl bg-notice px-4 py-3 text-center text-notice-ink">
          {t('rooms.replayOldVersion', { version: record.data.gameVersion })}
        </p>
        <BackLink
          to="/play/$gameId/rooms"
          params={{ gameId: game.id }}
          className="text-center font-semibold text-accent"
        >
          {t('rooms.backToLobby')}
        </BackLink>
      </Screen>
    );
  }
  if (!game || !replay || !config.data) return <Screen narrow>{t('loading')}</Screen>;
  return (
    <GameFrame
      game={game}
      gamesOrigin={config.data.gamesOrigin}
      player={player}
      replay={replay}
      exitLabel={t('rooms.backToLobby')}
      onExit={back}
    />
  );
}
