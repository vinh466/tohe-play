import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, type LinkIntent, links, rooms } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { gamesQuery } from '../api/queries.ts';
import {
  type EntryIntent,
  formatEntryCode,
  highestLevel,
  type Level,
  readCodeOf,
  readLevel,
} from '../entry/codes.ts';
import { DeadEnd, EntryTrouble } from '../entry/DeadEnd.tsx';
import { linkDeadEnds } from '../entry/deadEnds.ts';
import { EntryGate } from '../entry/EntryGate.tsx';
import { entry, once } from '../entry/intent.ts';
import { BackLink } from '../navigation/leave.tsx';
import { rememberNext } from '../session/next.ts';
import type { Player } from '../session/session.ts';
import { Avatar } from '../ui/AvatarGrid.tsx';
import { Button } from '../ui/Button.tsx';
import { Loading, Screen } from '../ui/Screen.tsx';

// The entry pipeline's pages (ADR 0044): a table's link /r/<code> and a share link /s/<code>. A typed code ("Nhập mã")
// comes here too, and a game's own address /play/<gameId> goes through the same gate (PlayPage).
// docs/architecture/entry-links.md#the-hubs-entry-pipeline

/** Until a game declares its own level (ADR 0045, step I4), every game asks for `any`. */
const GAME_LEVEL = 'any';

/**
 * A table's link, /r/<code> (ADR 0016, 0043, 0044): the code is looked up only after the identity gate — a table asks
 * for a name — as there is no anonymous lookup of a table. Then a preview of the table and one tap to sit down.
 */
export function RoomEntryPage() {
  const { code: raw } = useParams({ from: '/r/$code' });
  const intent = useMemo(() => readCodeOf('room', raw), [raw]);
  if (!intent) return <DeadEnd reason="unknown" />;
  return (
    <EntryGate key={intent.code} intent={intent} level={highestLevel(GAME_LEVEL, 'named')}>
      {(player, session) => (
        <RoomPreview intent={intent} player={player} device={session.status === 'device'} />
      )}
    </EntryGate>
  );
}

function RoomPreview({ intent, player, device }: { intent: EntryIntent; player: Player; device: boolean }) {
  const { code } = intent;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const games = useQuery(gamesQuery(player.id));
  const room = useQuery({ queryKey: ['room-code', code], queryFn: () => rooms.byCode(code), retry: false });
  const toRoom = (view: { gameId: string; id: string }) =>
    void navigate({
      to: '/play/$gameId/rooms/$roomId',
      params: { gameId: view.gameId, roomId: view.id },
      replace: true,
    });
  const join = useMutation({ mutationFn: (id: string) => rooms.join(id), onSuccess: toRoom });
  const watch = useMutation({ mutationFn: (id: string) => rooms.watch(id), onSuccess: toRoom });
  const view = room.data;
  const game = games.data?.find((g) => g.id === view?.gameId);
  const host = view?.seatList.find((seat) => seat.profileId === view.hostProfileId);
  // No table has this code — never used, or closed (its code is not given out again for a day). Any other 404 — the
  // device profile's copy gone (`device_profile_not_found`) — is the device's trouble: the intent stays.
  const gone =
    room.error instanceof ApiError &&
    (room.error.code === 'room_not_found' ||
      room.error.code === 'room_closed' ||
      (room.error.status === 404 && room.error.code === null));

  // The table's lobby is open, or the code leads nowhere: either way the intent is over.
  const settled = Boolean(view) || gone;
  useEffect(() => {
    if (settled) entry.reached(intent);
  }, [settled, intent]);

  if (gone) return <DeadEnd reason="unknown" />;
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
        {t('rooms.room', { code: formatEntryCode(intent) })}
      </h1>
      {room.isPending ? <p className="text-center text-ink-soft">{t('loading')}</p> : null}
      {room.isError ? (
        <>
          <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-center text-danger">
            {t(errorKey(room.error))}
          </p>
          <Button variant="secondary" onClick={() => void room.refetch()}>
            {t('named.retry')}
          </Button>
        </>
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
              onClick={() => {
                // Back to this table after signing in: the intent again, as it was reached already.
                entry.keep(intent);
                rememberNext(`/r/${code}`);
              }}
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

/**
 * A share link, /s/<code> (ADR 0044): resolved at once — `open` is public and counts it opened, once per kept intent —
 * then the gate at the link's level, the game checked against the profile, and `play` once, which takes a use and
 * opens the game's menu.
 */
export function ShareEntryPage() {
  const { code: raw } = useParams({ from: '/s/$code' });
  const intent = useMemo(() => readCodeOf('share', raw), [raw]);
  if (!intent) return <DeadEnd reason="unknown" />;
  return <ShareResolve key={intent.code} intent={intent} />;
}

function ShareResolve({ intent }: { intent: EntryIntent }) {
  const { t } = useTranslation();
  // Raised when `play` answers `level_required` (the API's backstop): the player goes back through the gate at that
  // level — the named screen, or signing in — rather than trying the same again.
  const [floor, setFloor] = useState<Level>('any');
  // Kept once, when the page opens: once reached, a later drawing of this screen must not keep it again.
  const [kept] = useState(() => entry.keep(intent));
  const opened = useQuery({
    queryKey: ['entry-open', intent.code, kept.at],
    queryFn: async (): Promise<LinkIntent> => {
      const link = kept.link ?? (await once(`open:${intent.code}:${kept.at}`, () => links.open(intent.code)));
      entry.resolved(intent.code, link);
      return link;
    },
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const link = opened.data;
  const over = link !== undefined && link.state !== 'ok';
  useEffect(() => {
    if (over) entry.reached(intent);
  }, [over, intent]);

  if (opened.isError)
    return <EntryTrouble message={t(errorKey(opened.error))} onRetry={() => void opened.refetch()} />;
  if (!link) return <Loading label={t('loading')} />;
  if (link.state !== 'ok') {
    return linkDeadEnds.includes(link.state) ? (
      <DeadEnd
        reason={link.state as 'expired' | 'revoked' | 'used_up'}
        gameId={link.gameId}
        gameName={link.gameName}
      />
    ) : (
      <DeadEnd reason="unknown" />
    );
  }
  const level = highestLevel(GAME_LEVEL, readLevel(link.level), floor);
  return (
    <EntryGate intent={intent} level={level}>
      {(player) => (
        <OpenShare
          intent={intent}
          at={kept.at}
          link={link}
          player={player}
          level={level}
          onLevel={(asked) => {
            // Back to the gate, and play asked again behind it — never a loop at the same level.
            entry.keep(intent);
            setFloor(asked);
          }}
        />
      )}
    </EntryGate>
  );
}

function OpenShare({
  intent,
  at,
  link,
  player,
  level,
  onLevel,
}: {
  intent: EntryIntent;
  at: number;
  link: LinkIntent;
  player: Player;
  /** The level the gate asked. */
  level: Level;
  /** The API asked a higher level than the gate did: back to the gate at that level. */
  onLevel(level: Level): void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const games = useQuery(gamesQuery(player.id));
  // The profile's catalog has the game: a child's lists only the games for its age (ADR 0043, step 6).
  const game = games.data?.find((g) => g.id === link.gameId);
  const play = useQuery({
    queryKey: ['entry-play', intent.code, at, level],
    queryFn: () => once(`play:${intent.code}:${at}`, () => links.play(intent.code)),
    enabled: Boolean(game),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const result = play.data;
  const missing = games.isSuccess && !game;
  const settled = missing || result !== undefined;
  useEffect(() => {
    if (!settled) return;
    entry.reached(intent);
    if (result?.state === 'ok' && result.gameId)
      void navigate({ to: '/play/$gameId', params: { gameId: result.gameId }, replace: true });
  }, [settled, result, intent, navigate]);
  // `level_required`: the link asks more than this player has — the gate again, at the level the API names.
  const required =
    play.error instanceof ApiError && play.error.code === 'level_required'
      ? readLevel(play.error.level)
      : null;
  const higher = required !== null && highestLevel(level, required) !== level ? required : null;
  useEffect(() => {
    if (higher) onLevel(higher);
  }, [higher, onLevel]);

  if (higher) return <Loading label={t('loading')} />;
  if (missing)
    return <DeadEnd reason="not-for-profile" gameName={link.gameName} child={player.kind === 'child'} />;
  if (games.isError) return <EntryTrouble message={t('loadFailed')} onRetry={() => void games.refetch()} />;
  if (play.isError)
    return <EntryTrouble message={t(errorKey(play.error))} onRetry={() => void play.refetch()} />;
  if (result && result.state !== 'ok') {
    return linkDeadEnds.includes(result.state) ? (
      <DeadEnd
        reason={result.state as 'expired' | 'revoked' | 'used_up'}
        gameId={result.gameId ?? link.gameId}
        gameName={result.gameName ?? link.gameName}
      />
    ) : (
      <DeadEnd reason="unknown" />
    );
  }
  return <Loading label={t('loading')} />;
}
