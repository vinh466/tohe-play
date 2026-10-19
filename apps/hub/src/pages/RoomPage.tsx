import { useMutation, useQuery } from '@tanstack/react-query';
import { Navigate, useParams } from '@tanstack/react-router';
import type { Reaction, RoomSeat } from '@tohe/contract';
import type { JsonValue } from '@tohe/game-sdk';
import type { HostHandle } from '@tohe/game-sdk/host';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type GameSummary, type ProfileView, type RoomView, rooms } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { configQuery, gamesQuery } from '../api/queries.ts';
import { GameFrame, type RoomBridge, type RoomUpdate } from '../launcher/GameFrame.tsx';
import { BackLink, useLeaveTo } from '../navigation/leave.tsx';
import { ensureConnected, onReconnected, roomsHub } from '../rooms/connection.ts';
import { InviteById } from '../rooms/InviteById.tsx';
import { formatCode, gameSeats, joinLink } from '../rooms/model.ts';
import { RoomSettings, type RoomSettingsValue } from '../rooms/RoomSettings.tsx';
import { RequireSession } from '../session/RequireSession.tsx';
import type { Player } from '../session/session.ts';
import { telemetry } from '../telemetry/telemetry.ts';
import { Avatar } from '../ui/AvatarGrid.tsx';
import { Button } from '../ui/Button.tsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx';
import { copyText } from '../ui/copyText.ts';
import { Modal } from '../ui/Modal.tsx';
import { QrCode } from '../ui/QrCode.tsx';
import { Screen } from '../ui/Screen.tsx';
import { settingsBody } from './RoomsPage.tsx';

export function RoomPage() {
  const { gameId, roomId } = useParams({ from: '/play/$gameId/rooms/$roomId' });
  return (
    <RequireSession need="player" returnTo={`/play/${gameId}/rooms/${roomId}`}>
      {(session) =>
        session.status === 'account' ? (
          <Room
            player={session.player}
            accountProfiles={session.me.profiles}
            mayPlayWithOthers={
              session.me.profiles.find((p) => p.id === session.player.id)?.playWithOthers ?? false
            }
          />
        ) : null
      }
    </RequireSession>
  );
}

type Handlers = Parameters<RoomBridge['subscribe']>[0];

/** The room as this phone sees it: its own seat found by its profile (the hub's broadcasts carry no viewer). */
const forPlayer = (room: RoomView, playerId: string): RoomView => {
  const index = room.seatList.findIndex((seat) => seat.profileId === playerId);
  return { ...room, mySeat: index < 0 ? null : index };
};

function Room({
  player,
  accountProfiles,
  mayPlayWithOthers,
}: {
  player: Player;
  accountProfiles: ProfileView[];
  mayPlayWithOthers: boolean;
}) {
  const { gameId, roomId } = useParams({ from: '/play/$gameId/rooms/$roomId' });
  const { t } = useTranslation();
  const leaveTo = useLeaveTo();
  const games = useQuery(gamesQuery(player.id));
  const config = useQuery(configQuery);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [gone, setGone] = useState<'closed' | 'notSeated' | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const latestRoom = useRef<RoomView | null>(null);
  const latestView = useRef<RoomUpdate | null>(null);
  const listeners = useRef(new Set<Handlers>());

  // The room's live connection: enter, and enter again after every reconnection (a fresh view comes with it).
  useEffect(() => {
    let stopped = false;
    const hub = roomsHub();
    const show = (view: RoomView) => {
      const next = forPlayer(view, player.id);
      if (next.mySeat === null && !next.watchers.includes(player.id)) setGone('notSeated');
      latestRoom.current = next;
      setRoom(next);
      if (next.status === 'playing' || next.status === 'between') {
        const { seats, seat } = gameSeats(next);
        for (const handlers of listeners.current) handlers.seats(seats, seat);
      }
    };
    const onRoom = (view: RoomView) => {
      if (view.id === roomId) show(view);
    };
    const onView = (id: string, view: JsonValue, events: JsonValue[], seq: number, turnMs: number | null) => {
      if (id !== roomId) return;
      const update = { view, events, seq, turnMs };
      latestView.current = update;
      for (const handlers of listeners.current) handlers.view(update);
    };
    const onReaction = (id: string, seat: number, reaction: Reaction) => {
      if (id !== roomId) return;
      for (const handlers of listeners.current) handlers.reaction(seat, reaction);
    };
    const onClosed = (id: string) => {
      if (id === roomId) setGone('closed');
    };
    hub.on('Room', onRoom);
    hub.on('View', onView);
    hub.on('Reaction', onReaction);
    hub.on('Closed', onClosed);
    hub.onreconnecting(() => setReconnecting(true));
    const enter = async () => {
      try {
        const connected = await ensureConnected();
        const view = await connected.invoke<RoomView | null>('Enter', roomId);
        if (stopped) return;
        setReconnecting(false);
        if (view) show(view);
        else setGone('notSeated');
      } catch {
        setReconnecting(true);
      }
    };
    void enter();
    const off = onReconnected(() => {
      // Telemetry (ADR 0015): how often phones lose the table and come back, per game build.
      const room = latestRoom.current;
      if (room) telemetry.count('hub.room.reconnect', { gameId: room.gameId, gameVersion: room.gameVersion });
      void enter();
    });
    return () => {
      stopped = true;
      off();
      hub.off('Room', onRoom);
      hub.off('View', onView);
      hub.off('Reaction', onReaction);
      hub.off('Closed', onClosed);
      void hub.invoke('Exit', roomId).catch(() => {});
    };
  }, [roomId, player.id]);

  const bridge = useMemo<RoomBridge>(
    () => ({
      id: roomId,
      info: () => {
        const current = latestRoom.current;
        if (!current) return { seat: -1, seats: [], options: {} };
        const { seats, seat } = gameSeats(current);
        return { seat, seats: seats as RoomSeat[], options: current.options as Record<string, JsonValue> };
      },
      act: async (action) => {
        const error = await roomsHub().invoke<string | null>('Act', roomId, action);
        if (error) {
          const room = latestRoom.current;
          if (room)
            telemetry.count('hub.room.refused', { gameId: room.gameId, gameVersion: room.gameVersion });
          throw new Error(error);
        }
      },
      next: async () => {
        const error = await roomsHub().invoke<string | null>('Next', roomId);
        if (error) throw new Error(error);
      },
      react: (reaction) =>
        void roomsHub()
          .invoke('React', roomId, reaction)
          .catch(() => {}),
      subscribe: (handlers) => {
        listeners.current.add(handlers);
        if (latestView.current) handlers.view(latestView.current);
        return () => listeners.current.delete(handlers);
      },
    }),
    [roomId],
  );

  const [askLeave, setAskLeave] = useState(false);
  const paused = useRef<HostHandle | null>(null);
  const leave = useMutation({
    mutationFn: () => rooms.leave(roomId),
    onSettled: () => leaveTo({ to: '/play/$gameId/rooms', params: { gameId: room?.gameId ?? '' } }),
  });
  const game = games.data?.find((g) => g.id === room?.gameId);

  // The address names a game; the room knows its own. A hand-typed address with the wrong game moves to the right one.
  if (room && room.gameId !== gameId) {
    return <Navigate to="/play/$gameId/rooms/$roomId" params={{ gameId: room.gameId, roomId }} replace />;
  }

  if (gone) {
    return (
      <Screen narrow>
        <p className="rounded-2xl bg-notice px-4 py-3 text-center text-notice-ink">
          {gone === 'closed' ? t('rooms.closed') : t('rooms.errors.notFound')}
        </p>
        <BackLink
          to="/play/$gameId/rooms"
          params={{ gameId }}
          className="text-center font-semibold text-accent"
        >
          {t('rooms.backToLobby')}
        </BackLink>
      </Screen>
    );
  }
  if (!room || !game) return <Screen narrow>{t('loading')}</Screen>;

  // A spectator gives up nothing by leaving: no question to ask.
  const askToLeave = () => (room.mySeat === null ? leave.mutate() : setAskLeave(true));
  const leaveDialog = (
    <ConfirmDialog
      open={askLeave}
      title={t('rooms.leaveTitle')}
      body={t('rooms.leaveBody')}
      primary={{
        label: t('rooms.stay'),
        onClick: () => {
          setAskLeave(false);
          paused.current?.resume();
        },
      }}
      secondary={{ label: t('rooms.leave'), onClick: () => leave.mutate() }}
      onDismiss={() => {
        setAskLeave(false);
        paused.current?.resume();
      }}
    />
  );

  if ((room.status === 'playing' || room.status === 'between') && config.data) {
    return (
      <>
        <GameFrame
          game={game}
          gamesOrigin={config.data.gamesOrigin}
          player={player}
          room={bridge}
          exitLabel={t('rooms.leave')}
          topRight={
            reconnecting ? (
              <span role="status" className="text-ink-soft text-sm">
                {t('rooms.reconnecting')}
              </span>
            ) : null
          }
          onExit={(host) => {
            paused.current = host;
            askToLeave();
          }}
        />
        {leaveDialog}
      </>
    );
  }

  return (
    <>
      <WaitingRoom
        room={room}
        game={game}
        player={player}
        accountProfiles={accountProfiles}
        ownAccountOnly={!mayPlayWithOthers}
        onLeave={askToLeave}
      />
      {reconnecting ? (
        <p
          role="status"
          className="fixed inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-notice px-4 py-2 text-notice-ink"
        >
          {t('rooms.reconnecting')}
        </p>
      ) : null}
      {leaveDialog}
    </>
  );
}

function WaitingRoom({
  room,
  game,
  player,
  accountProfiles,
  ownAccountOnly,
  onLeave,
}: {
  room: RoomView;
  game: GameSummary;
  player: Player;
  accountProfiles: ProfileView[];
  ownAccountOnly: boolean;
  onLeave(): void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const watching = room.mySeat === null;
  const invite = useMutation({
    mutationFn: (profileId: string) => rooms.invite(room.id, profileId),
    onSuccess: (_, profileId) => setInvited((current) => new Set(current).add(profileId)),
  });
  const seated = new Set(room.seatList.map((s) => s.profileId).filter(Boolean));
  const invitable = accountProfiles.filter((profile) => profile.id !== player.id && !seated.has(profile.id));
  const [copied, setCopied] = useState(false);
  const isHost = room.hostProfileId === player.id;
  const link = joinLink(room.code);
  const bots = game.rooms?.bots ?? [];
  const levelLabel = (level: string) => t(`rooms.botLevels.${level}`, { defaultValue: level });
  const start = useMutation({ mutationFn: () => rooms.start(room.id) });
  const seat = useMutation({
    mutationFn: ({ index, bot }: { index: number; bot: string | null }) => rooms.setSeat(room.id, index, bot),
  });
  const update = useMutation({
    mutationFn: (value: RoomSettingsValue) => rooms.update(room.id, settingsBody(value)),
    onSuccess: () => setEditing(false),
  });

  const share = async () => {
    const text = t('rooms.shareText', { game: game.name, code: formatCode(room.code) });
    if (navigator.share && window.isSecureContext) {
      try {
        await navigator.share({ title: game.name, text, url: link });
        return;
      } catch {
        // dismissed: nothing to do
        return;
      }
    }
    setCopied(await copyText(`${text}\n${link}`));
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Screen narrow>
      <header className="flex items-center justify-between gap-3">
        <BackLink
          to="/play/$gameId/rooms"
          params={{ gameId: room.gameId }}
          aria-label={t('rooms.backToLobby')}
          className="rounded-full bg-surface px-3 py-2 font-bold text-accent"
        >
          ←
        </BackLink>
        <h1 className="font-bold text-ink text-xl">{game.name}</h1>
        <Button variant="secondary" onClick={() => void share()}>
          {t('rooms.share')}
        </Button>
      </header>
      {copied ? (
        <p role="status" className="text-center font-semibold text-ink">
          {t('rooms.copied')}
        </p>
      ) : null}

      <section className="flex flex-col items-center gap-3 rounded-3xl bg-surface p-5 text-center shadow-sm">
        <p className="text-ink-soft">{t('rooms.room', { code: '' }).trim()}</p>
        <p className="font-black text-5xl text-brand-ink tracking-widest">{formatCode(room.code)}</p>
        <QrCode text={link} label={t('rooms.scan')} />
        <p className="text-ink-soft text-sm">{t('rooms.scan')}</p>
      </section>

      <ul className="grid grid-cols-2 gap-3">
        {room.seatList.map((s) => (
          <li
            key={s.seat}
            className="flex flex-col items-center gap-1 rounded-2xl bg-surface p-3 text-center shadow-sm"
          >
            <Avatar avatar={s.profileId ? (s.avatar ?? '🙂') : s.bot ? '🤖' : '➕'} size="sm" />
            <span className="w-full truncate font-bold text-ink">
              {s.profileId
                ? s.name
                : s.bot
                  ? t('rooms.bot', { level: levelLabel(s.bot) })
                  : t('rooms.emptySeat')}
            </span>
            <span className="text-ink-soft text-xs">
              {s.profileId === room.hostProfileId ? t('rooms.host') : ''}
              {s.profileId && !s.connected ? ` · ${t('rooms.offline')}` : ''}
            </span>
            {isHost && s.profileId !== room.hostProfileId ? (
              s.profileId || s.bot ? (
                <button
                  type="button"
                  onClick={() => seat.mutate({ index: s.seat, bot: null })}
                  className="rounded-full bg-soft px-3 py-1 font-semibold text-accent text-sm"
                >
                  {t('rooms.removeSeat')}
                </button>
              ) : bots.length > 0 ? (
                <button
                  type="button"
                  onClick={() => seat.mutate({ index: s.seat, bot: room.botLevel ?? bots[0] ?? null })}
                  className="rounded-full bg-soft px-3 py-1 font-semibold text-accent text-sm"
                >
                  {t('rooms.addBot')}
                </button>
              ) : null
            ) : null}
          </li>
        ))}
      </ul>

      <p className="text-center text-ink-soft text-sm">
        {room.turnSeconds === 0 ? t('rooms.turnOff') : t('rooms.turnSeconds', { seconds: room.turnSeconds })}
        {room.botsFill && room.botLevel ? ` · ${t('rooms.botsFill')} (${levelLabel(room.botLevel)})` : ''}
      </p>

      {start.isError || seat.isError ? (
        <p role="alert" className="text-center text-danger">
          {t(errorKey(start.error ?? seat.error))}
        </p>
      ) : null}

      {watching ? (
        <p className="rounded-2xl bg-notice px-4 py-3 text-center text-notice-ink">{t('rooms.watching')}</p>
      ) : (
        <Button variant="secondary" onClick={() => setInviting(true)}>
          {t('rooms.invite')}
        </Button>
      )}

      {isHost ? (
        <div className="flex flex-col gap-3">
          <Button className="min-h-16 text-2xl" busy={start.isPending} onClick={() => start.mutate()}>
            {t('rooms.start')}
          </Button>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            {t('rooms.settingsTitle')}
          </Button>
        </div>
      ) : watching ? null : (
        <p className="text-center font-semibold text-ink">{t('rooms.waitingHost')}</p>
      )}
      <Button variant="ghost" onClick={onLeave}>
        {t('rooms.leave')}
      </Button>

      <Modal open={inviting} title={t('rooms.invite')} onClose={() => setInviting(false)}>
        <h3 className="mb-2 font-semibold text-ink-soft text-sm">{t('rooms.inviteAccount')}</h3>
        {invitable.length === 0 ? <p className="text-ink-soft">{t('rooms.inviteNone')}</p> : null}
        <ul className="flex flex-col gap-2">
          {invitable.map((profile) => (
            <li key={profile.id}>
              <button
                type="button"
                disabled={invited.has(profile.id) || invite.isPending}
                onClick={() => invite.mutate(profile.id)}
                className="flex w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left disabled:opacity-60"
              >
                <Avatar avatar={profile.avatar} size="sm" />
                <span className="flex-1 font-bold text-ink">{profile.name}</span>
                <span className="font-semibold text-accent text-sm">
                  {invited.has(profile.id) ? `✓ ${t('rooms.invited')}` : t('rooms.inviteOne')}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {invite.isError ? (
          <p role="alert" className="mt-3 text-danger">
            {t(errorKey(invite.error))}
          </p>
        ) : null}
        <InviteById roomId={room.id} accountOnly={room.accountOnly} />
      </Modal>

      <Modal open={editing} title={t('rooms.settingsTitle')} onClose={() => setEditing(false)}>
        <RoomSettings
          game={game}
          initial={{
            seats: room.seats,
            isPublic: room.isPublic,
            accountOnly: room.accountOnly,
            botsFill: room.botsFill,
            botLevel: room.botLevel,
            botsTakeOver: room.botsTakeOver,
            turnSeconds: room.turnSeconds,
            spectators: room.spectators,
            options: room.options as Record<string, unknown>,
          }}
          ownAccountOnly={ownAccountOnly}
          submitLabel={t('rooms.saveSettings')}
          busy={update.isPending}
          error={update.isError ? t(errorKey(update.error)) : null}
          onSubmit={(value) => update.mutate(value)}
        />
      </Modal>
    </Screen>
  );
}
