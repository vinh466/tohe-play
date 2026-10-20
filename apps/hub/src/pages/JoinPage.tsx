import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { rooms } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { gamesQuery } from '../api/queries.ts';
import { BackLink } from '../navigation/leave.tsx';
import { formatCode, normalizeCode } from '../rooms/model.ts';
import { AtTables } from '../session/AtTables.tsx';
import { rememberNext } from '../session/next.ts';
import { RequireSession } from '../session/RequireSession.tsx';
import type { Player } from '../session/session.ts';
import { Avatar } from '../ui/AvatarGrid.tsx';
import { Button } from '../ui/Button.tsx';
import { Screen } from '../ui/Screen.tsx';

/**
 * A room link, /r/<code> (ADR 0016, 0043): a phone with no account plays as its device profile — the `named` screen
 * the first time, its copy on the server, then the room — and a signed-in one picks a profile first (the link is kept
 * through it). Then a preview of the room and one tap to sit down.
 */
export function JoinPage() {
  const { code } = useParams({ from: '/r/$code' });
  return (
    <RequireSession need="player" returnTo={`/r/${normalizeCode(code)}`}>
      {(session) => (
        <AtTables session={session}>
          {(player) => <Preview player={player} device={session.status === 'device'} />}
        </AtTables>
      )}
    </RequireSession>
  );
}

function Preview({ player, device }: { player: Player; device: boolean }) {
  const { code: raw } = useParams({ from: '/r/$code' });
  const code = normalizeCode(raw);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const games = useQuery(gamesQuery(player.id));
  const room = useQuery({ queryKey: ['room-code', code], queryFn: () => rooms.byCode(code), retry: false });
  const join = useMutation({
    mutationFn: (id: string) => rooms.join(id),
    onSuccess: (view) =>
      void navigate({
        to: '/play/$gameId/rooms/$roomId',
        params: { gameId: view.gameId, roomId: view.id },
        replace: true,
      }),
  });
  const watch = useMutation({
    mutationFn: (id: string) => rooms.watch(id),
    onSuccess: (view) =>
      void navigate({
        to: '/play/$gameId/rooms/$roomId',
        params: { gameId: view.gameId, roomId: view.id },
        replace: true,
      }),
  });
  const view = room.data;
  const game = games.data?.find((g) => g.id === view?.gameId);
  const host = view?.seatList.find((seat) => seat.profileId === view.hostProfileId);

  if (view && (view.mySeat !== null || view.watchers.includes(player.id)))
    return (
      <Navigate to="/play/$gameId/rooms/$roomId" params={{ gameId: view.gameId, roomId: view.id }} replace />
    );

  return (
    <Screen narrow>
      <BackLink to="/play" className="font-semibold text-accent">
        ← {t('backToGames')}
      </BackLink>
      <h1 className="text-center font-black text-3xl text-brand-ink">
        {t('rooms.room', { code: formatCode(code) })}
      </h1>
      {room.isPending ? <p className="text-center text-ink-soft">{t('loading')}</p> : null}
      {room.isError ? (
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-center text-danger">
          {t(errorKey(room.error))}
        </p>
      ) : null}
      {view ? (
        <section className="flex flex-col items-center gap-4 rounded-3xl bg-surface p-6 text-center shadow-sm">
          {game?.iconUrl ? <img src={game.iconUrl} alt="" className="size-20 rounded-2xl" /> : null}
          <p className="font-bold text-ink text-xl">{game?.name ?? view.gameId}</p>
          <div className="flex items-center gap-2">
            <Avatar avatar={host?.avatar ?? '🙂'} size="sm" />
            <span className="font-semibold text-ink">{t('rooms.preview', { host: host?.name ?? '' })}</span>
          </div>
          <p className="text-ink-soft">
            {t('rooms.previewSeats', {
              taken: view.seatList.filter((seat) => seat.profileId).length,
              seats: view.seats,
              status: t(`rooms.status.${view.status}`),
            })}
          </p>
          <Button className="w-full" busy={join.isPending} onClick={() => join.mutate(view.id)}>
            {t('rooms.sit')}
          </Button>
          {view.spectators ? (
            <Button
              variant="secondary"
              className="w-full"
              busy={watch.isPending}
              onClick={() => watch.mutate(view.id)}
            >
              {t('rooms.watch')}
            </Button>
          ) : null}
          {join.isError || watch.isError ? (
            <p role="alert" className="text-danger">
              {t(errorKey(watch.error ?? join.error))}
            </p>
          ) : null}
          {device && view.entry === 'account' ? (
            <Link
              to="/account/sign-in"
              onClick={() => rememberNext(`/r/${code}`)}
              className="font-bold text-accent underline underline-offset-4"
            >
              {t('named.signIn')}
            </Link>
          ) : null}
        </section>
      ) : null}
      {view ? (
        <BackLink
          to="/play/$gameId/rooms"
          params={{ gameId: view.gameId }}
          className="text-center font-semibold text-accent"
        >
          {t('rooms.backToLobby')}
        </BackLink>
      ) : null}
    </Screen>
  );
}
