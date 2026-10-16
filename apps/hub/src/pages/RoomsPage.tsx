import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, type GameSummary, type RoomSummary, rooms } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { gamesQuery } from '../api/queries.ts';
import { hasShell } from '../launcher/manifest.ts';
import { ensureConnected, onReconnected } from '../rooms/connection.ts';
import { formatCode, normalizeCode, quickPick } from '../rooms/model.ts';
import { RoomResults } from '../rooms/RoomResults.tsx';
import { defaultSettings, RoomSettings, type RoomSettingsValue } from '../rooms/RoomSettings.tsx';
import { RequireSession } from '../session/RequireSession.tsx';
import type { Player } from '../session/session.ts';
import { Avatar } from '../ui/AvatarGrid.tsx';
import { Button } from '../ui/Button.tsx';
import { Modal } from '../ui/Modal.tsx';
import { Screen } from '../ui/Screen.tsx';
import { TextField } from '../ui/TextField.tsx';

/** The lobby of a game played at a table (ADR 0016): quick play, a new room, a code, the bots, the open rooms. */
export function RoomsPage() {
  return (
    <RequireSession need="player">
      {(session) =>
        session.status === 'account' ? (
          <Lobby
            player={session.player}
            mayPlayWithOthers={
              session.me.profiles.find((p) => p.id === session.player.id)?.playWithOthers ?? false
            }
          />
        ) : (
          <GuestLobby />
        )
      }
    </RequireSession>
  );
}

/** Guests play offline only (ADR 0016): the bots, and a way to sign up. */
function GuestLobby() {
  const { gameId } = useParams({ from: '/rooms/$gameId' });
  const { t } = useTranslation();
  return (
    <Screen narrow>
      <Link to="/" className="font-semibold text-accent">
        ← {t('backToGames')}
      </Link>
      <Link
        to="/play/$gameId"
        params={{ gameId }}
        className="rounded-3xl bg-brand px-5 py-4 text-center font-bold text-on-brand text-xl"
      >
        {t('rooms.playBots')}
      </Link>
      <p className="rounded-2xl bg-notice px-4 py-3 text-notice-ink text-sm">
        {t('guest.banner')}{' '}
        <Link to="/register" className="font-bold underline underline-offset-4">
          {t('guest.signUp')}
        </Link>
      </p>
    </Screen>
  );
}

function Lobby({ player, mayPlayWithOthers }: { player: Player; mayPlayWithOthers: boolean }) {
  const { gameId } = useParams({ from: '/rooms/$gameId' });
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const games = useQuery(gamesQuery(player.id));
  const game = games.data?.find((g) => g.id === gameId);
  const list = useQuery({
    queryKey: ['rooms', gameId, player.id],
    queryFn: () => rooms.list(gameId),
    refetchInterval: 15_000,
  });
  const [creating, setCreating] = useState(false);
  const [entering, setEntering] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);

  // The lobby is live: the rooms hub says when it changed, and the list is fetched again.
  useEffect(() => {
    let stopped = false;
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ['rooms', gameId] });
    const watch = async () => {
      try {
        const hub = await ensureConnected();
        if (stopped) return;
        hub.on('LobbyChanged', refresh);
        await hub.invoke('WatchLobby', gameId);
      } catch {
        // Offline or the API is down: the list shows what it has, and polling tries again.
      }
    };
    void watch();
    const off = onReconnected(() => {
      void watch();
      refresh();
    });
    const goOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOnline);
    return () => {
      stopped = true;
      off();
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOnline);
      void ensureConnected()
        .then((hub) => {
          hub.off('LobbyChanged', refresh);
          return hub.invoke('UnwatchLobby', gameId);
        })
        .catch(() => {});
    };
  }, [gameId, queryClient]);

  const open = (roomId: string) => void navigate({ to: '/room/$roomId', params: { roomId } });
  // A full table, or a hand going on, can still be watched when its host allows it.
  const join = useMutation({
    mutationFn: async (room: RoomSummary) => {
      if (room.mine) return null;
      try {
        return await rooms.join(room.id);
      } catch (error) {
        const code = error instanceof ApiError ? error.code : null;
        if (room.spectators && (code === 'room_full' || code === 'room_locked')) return rooms.watch(room.id);
        throw error;
      }
    },
    onSuccess: (_, room) => open(room.id),
  });
  const quick = useMutation({
    mutationFn: async () => {
      const pick = quickPick(list.data ?? []);
      if (pick) return rooms.join(pick.id);
      if (!game) throw new Error('no game');
      return rooms.create({ gameId, ...settingsBody(defaultSettings(game)) });
    },
    onSuccess: (room) => open(room.id),
  });

  return (
    <Screen narrow>
      <header className="flex items-center gap-3">
        {/* A shell game's lobby is reached from its main menu (ADR 0018): ← goes back there. */}
        {game && hasShell(game) ? (
          <Link
            to="/play/$gameId"
            params={{ gameId }}
            aria-label={t('rooms.backToGame', { game: game.name })}
            className="rounded-full bg-surface px-3 py-2 font-bold text-accent"
          >
            ←
          </Link>
        ) : (
          <Link
            to="/"
            aria-label={t('backToGames')}
            className="rounded-full bg-surface px-3 py-2 font-bold text-accent"
          >
            ←
          </Link>
        )}
        {game?.iconUrl ? <img src={game.iconUrl} alt="" className="size-12 rounded-2xl" /> : null}
        <h1 className="min-w-0 truncate font-black text-3xl text-brand-ink">{game?.name ?? gameId}</h1>
      </header>

      {!online ? (
        <p className="rounded-xl bg-notice px-4 py-3 text-notice-ink">{t('rooms.needNetwork')}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Button
          className="col-span-2 min-h-16 text-2xl"
          busy={quick.isPending}
          disabled={!online || !game}
          onClick={() => quick.mutate()}
        >
          {t('rooms.quickPlay')}
        </Button>
        <Button variant="secondary" disabled={!online || !game} onClick={() => setCreating(true)}>
          {t('rooms.create')}
        </Button>
        <Button variant="secondary" disabled={!online} onClick={() => setEntering(true)}>
          {t('rooms.enterCode')}
        </Button>
        <Link
          to="/play/$gameId"
          params={{ gameId }}
          className="col-span-2 flex min-h-12 items-center justify-center rounded-2xl bg-surface px-5 font-bold text-accent text-xl active:scale-[0.97]"
        >
          {t('rooms.playBots')}
        </Link>
      </div>
      {quick.isError || join.isError ? (
        <p role="alert" className="text-danger">
          {t(errorKey(quick.error ?? join.error))}
        </p>
      ) : null}

      <section aria-labelledby="open-rooms" className="flex flex-col gap-3">
        <h2 id="open-rooms" className="font-bold text-ink text-xl">
          {t('rooms.openRooms')}
        </h2>
        {list.data?.length === 0 ? <p className="text-ink-soft">{t('rooms.noRooms')}</p> : null}
        <ul className="flex flex-col gap-2">
          {list.data?.map((room) => (
            <li key={room.id}>
              <button
                type="button"
                onClick={() => join.mutate(room)}
                className="flex w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left shadow-sm active:scale-[0.99]"
              >
                <Avatar avatar={room.hostAvatar || '🙂'} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-bold text-ink">
                    {room.hostName} {room.locked ? t('rooms.locked') : ''}
                  </span>
                  <span className="text-ink-soft text-sm">
                    {t('rooms.seatsTaken', { taken: room.taken, seats: room.seats })} ·{' '}
                    {t(`rooms.status.${room.status}`)}
                    {room.mine ? ` · ${t('rooms.yours')}` : ''}
                    {room.spectators ? ' · 👁' : ''}
                  </span>
                </span>
                <span aria-hidden className="text-accent text-xl">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <RoomResults gameId={gameId} playerId={player.id} />

      {game ? (
        <CreateRoom
          game={game}
          open={creating}
          familyOnly={!mayPlayWithOthers}
          onClose={() => setCreating(false)}
          onCreated={open}
        />
      ) : null}
      <EnterCode open={entering} onClose={() => setEntering(false)} />
    </Screen>
  );
}

export const settingsBody = (value: RoomSettingsValue) => ({
  seats: value.seats,
  isPublic: value.isPublic,
  householdOnly: value.householdOnly,
  botsFill: value.botsFill,
  botLevel: value.botLevel,
  botsTakeOver: value.botsTakeOver,
  turnSeconds: value.turnSeconds,
  spectators: value.spectators,
  options: value.options as never,
});

function CreateRoom({
  game,
  open,
  familyOnly,
  onClose,
  onCreated,
}: {
  game: GameSummary;
  open: boolean;
  familyOnly: boolean;
  onClose(): void;
  onCreated(roomId: string): void;
}) {
  const { t } = useTranslation();
  const create = useMutation({
    mutationFn: (value: RoomSettingsValue) => rooms.create({ gameId: game.id, ...settingsBody(value) }),
    onSuccess: (room) => onCreated(room.id),
  });
  return (
    <Modal open={open} title={t('rooms.createTitle')} onClose={onClose}>
      <RoomSettings
        game={game}
        initial={defaultSettings(game)}
        familyOnly={familyOnly}
        submitLabel={t('rooms.createGo')}
        busy={create.isPending}
        error={create.isError ? t(errorKey(create.error)) : null}
        onSubmit={(value) => create.mutate(value)}
      />
    </Modal>
  );
}

/** Six digits on the numeric keypad; the sixth one goes straight to the room's preview (SPEC: Joining with a code). */
function EnterCode({ open, onClose }: { open: boolean; onClose(): void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const go = (value: string) => void navigate({ to: '/r/$code', params: { code: value } });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (code.length === 6) go(code);
  };
  return (
    <Modal open={open} title={t('rooms.codeTitle')} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label={t('rooms.codeTitle')}
          hint={t('rooms.codeHint')}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          value={code.length > 3 ? formatCode(code) : code}
          onChange={(event) => {
            const next = normalizeCode(event.target.value);
            setCode(next);
            if (next.length === 6) go(next);
          }}
        />
        <Button type="submit" disabled={code.length !== 6}>
          {t('rooms.codeGo')}
        </Button>
      </form>
    </Modal>
  );
}
