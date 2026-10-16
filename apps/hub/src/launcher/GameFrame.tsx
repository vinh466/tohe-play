import type { Reaction, RoomSeat } from '@tohe/contract';
import type { JsonValue } from '@tohe/game-sdk';
import { createHost, type HostHandle, iframeTransport } from '@tohe/game-sdk/host';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameSummary } from '../api/client.ts';
import type { Player } from '../session/session.ts';
import { syncer, syncsWithServer } from '../session/useBackgroundSync.ts';
import { db } from '../storage/db.ts';
import { loadSave, recordScore, storeSave } from '../storage/repository.ts';
import { durationBucket } from '../telemetry/collector.ts';
import { telemetry, telemetryOn } from '../telemetry/telemetry.ts';
import { useTheme } from '../theme/useTheme.ts';
import { dailySeed, isTrustedEntry, manifestFrom } from './manifest.ts';

type Status = 'loading' | 'ready' | 'failed' | 'untrusted';

export interface RoomUpdate {
  view: JsonValue;
  events: JsonValue[];
  seq: number;
  turnMs: number | null;
}

/**
 * A table the game is opened at (ADR 0016): what the game gets in `init.room`, and the way to the rooms hub. The
 * room page owns the hub connection; this only relays between it and the game iframe.
 */
export interface RoomBridge {
  id: string;
  info(): { seat: number; seats: RoomSeat[]; options: Record<string, JsonValue> };
  /** Resolves when the server accepted the action; rejects with the rules' error code. */
  act(action: JsonValue): Promise<void>;
  next(): Promise<void>;
  react(reaction: Reaction): void;
  /** Views, seats and reactions for the game; the latest view is replayed at once. Returns an unsubscribe. */
  subscribe(handlers: {
    view(update: RoomUpdate): void;
    seats(seats: RoomSeat[], seat: number): void;
    reaction(seat: number, reaction: Reaction): void;
  }): () => void;
}

/**
 * The game in its sandboxed iframe with the host side of the contract: the top bar (exit, mute), the handshake,
 * saves and scores to the device (synced later), telemetry, and with `room` the relay of a table.
 */
export function GameFrame({
  game,
  gamesOrigin,
  player,
  room,
  onExit,
  exitLabel,
  topRight,
}: {
  game: GameSummary;
  gamesOrigin: string;
  player: Player;
  room?: RoomBridge;
  /** The player asked to leave (exit button or the game's `exit()`); the game is paused meanwhile. */
  onExit(host: HostHandle | null): void;
  exitLabel?: string;
  topRight?: React.ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const iframe = useRef<HTMLIFrameElement>(null);
  const host = useRef<HostHandle | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [muted, setMuted] = useState(false);
  const { theme } = useTheme();

  // The session restarts only for a different game build, origin, profile or room. Everything else is read from
  // `latest` at start; later mute and theme changes are sent as `settings` messages.
  const buildKey = `${game.id}@${game.version}`;
  const latest = useRef({ game, player, muted, theme, locale: i18n.language, onExit, room });
  latest.current = { game, player, muted, theme, locale: i18n.language, onExit, room };
  const roomId = room?.id;

  // biome-ignore lint/correctness/useExhaustiveDependencies: restarts only for the keys above, on purpose.
  useEffect(() => {
    const frame = iframe.current;
    const { game, player, muted, theme, locale, room } = latest.current;
    if (!frame) return;
    if (!isTrustedEntry(game.entryUrl, gamesOrigin)) {
      setStatus('untrusted');
      return;
    }

    setStatus('loading');
    const synced = syncsWithServer(player);
    // Telemetry (ADR 0015): a play, how long the game took to answer, its reports, and how long it was played.
    const scope = { gameId: game.id, gameVersion: game.version };
    const started = performance.now();
    telemetry.count(room ? 'hub.room.session' : 'hub.play.session', scope);
    const session = createHost({
      transport: iframeTransport(frame, new URL(gamesOrigin).origin),
      manifest: manifestFrom(game),
      init: async () => {
        if (synced) await catchUp(player.id);
        const table = room?.info();
        return {
          profile: { id: player.id, name: player.name, avatar: player.avatar },
          locale,
          // The theme the hub shows; games that declare both themes follow it (ADR 0013).
          settings: { muted, theme },
          save: await loadSave(db, player.id, game.id),
          seed: dailySeed(),
          telemetry: telemetryOn(),
          room: room && table ? { id: room.id, ...table } : undefined,
        };
      },
      onSave: async (data) => {
        await storeSave(db, player.id, game.id, data);
        if (synced) syncer.syncSoon(player.id);
      },
      onScore: async ({ value, board, run, final }) => {
        await recordScore(db, { profileId: player.id, gameId: game.id, board, value, run, final });
        if (synced) syncer.syncSoon(player.id);
      },
      onRoomAct: (action) => room?.act(action),
      onRoomNext: () => room?.next(),
      onRoomReact: (reaction) => room?.react(reaction),
      onExit: () => latest.current.onExit(session),
      onLog: ({ level, message }) => {
        console[level](`[game:${game.id}] ${message}`);
        if (level !== 'info') {
          telemetry.record(
            { kind: 'error', message: `[${level}] ${message}`.slice(0, 300), count: 1 },
            'game',
            scope,
          );
        }
      },
      onTelemetry: (events) => {
        for (const event of events) telemetry.record(event, 'game', scope);
      },
      onProtocolError: (error) => {
        console.warn(`[game:${game.id}] protocol error: ${error}`);
        telemetry.record(
          { kind: 'error', message: `protocol: ${error}`.slice(0, 300), count: 1 },
          'hub',
          scope,
        );
      },
    });
    host.current = session;
    let unsubscribe = () => {};
    session.ready.then(
      () => {
        setStatus('ready');
        telemetry.metric('hub.game.ready-ms', Math.round(performance.now() - started), scope);
        // The table's views reach the game only after its handshake.
        if (room) {
          unsubscribe = room.subscribe({
            view: (update) => session.roomView(update),
            seats: (seats, seat) => session.roomSeats(seats, seat),
            reaction: (seat, reaction) => session.roomReaction(seat, reaction),
          });
        }
      },
      () => {
        setStatus('failed');
        telemetry.count('hub.game.failed', scope);
      },
    );
    // Load the game only after the host listens, so its `ready` cannot be missed. `?perf` on this page turns on the
    // game kit's frame-rate readout, for testing on phones.
    const perf = new URLSearchParams(window.location.search).has('perf');
    frame.src = perf ? `${game.entryUrl}#perf` : game.entryUrl;

    const onVisibility = () => (document.hidden ? session.pause() : session.resume());
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      telemetry.count(`hub.play.duration.${durationBucket(performance.now() - started)}`, scope);
      document.removeEventListener('visibilitychange', onVisibility);
      unsubscribe();
      session.dispose();
      host.current = null;
      frame.src = 'about:blank';
    };
  }, [buildKey, gamesOrigin, player.id, roomId]);

  // Mute and theme changes reach a running game as `settings` (e.g. "Theo máy" turning dark mid-round).
  useEffect(() => {
    host.current?.setSettings({ muted, theme });
  }, [muted, theme]);

  return (
    <div className="fixed inset-0 flex flex-col bg-page">
      <nav className="flex h-14 shrink-0 items-center justify-between border-line border-b-2 px-2 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={() => {
            host.current?.pause();
            onExit(host.current);
          }}
          className="rounded-full px-3 py-1.5 font-semibold text-accent active:bg-soft"
        >
          ← {exitLabel ?? t('exit')}
        </button>
        <span className="truncate font-bold text-ink">{game.name}</span>
        <span className="flex items-center gap-1">
          {topRight}
          <button
            type="button"
            onClick={() => setMuted((value) => !value)}
            aria-label={muted ? t('unmute') : t('mute')}
            className="rounded-full px-3 py-1.5 text-xl active:bg-soft"
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </span>
      </nav>
      <div className="relative min-h-0 flex-1">
        <iframe
          ref={iframe}
          title={game.name}
          sandbox="allow-scripts allow-same-origin"
          allow="autoplay; fullscreen"
          className="absolute inset-0 size-full border-0"
        />
        {/* Fades out once the game is ready, covering its first frames while it applies its theme. Then hidden, so
            the compositor has no layer over the game while it plays. */}
        <div
          aria-hidden={status === 'ready'}
          className={`absolute inset-0 grid place-items-center bg-page p-6 text-center text-ink transition-[opacity,visibility] duration-300 ${
            status === 'ready' ? 'pointer-events-none invisible opacity-0' : ''
          }`}
        >
          {status === 'loading' && t('loading')}
          {status === 'failed' && t('gameFailed')}
          {status === 'untrusted' && t('untrusted')}
        </div>
      </div>
    </div>
  );
}

/**
 * Before a game starts, fetch the newest save from other devices (M2) — but never make a child wait: after 2.5 s,
 * or offline, the game opens with what this device has.
 */
async function catchUp(profileId: string): Promise<void> {
  const timeout = new Promise((resolve) => setTimeout(resolve, 2500));
  await Promise.race([syncer.syncNow(profileId).catch(() => {}), timeout]);
}
