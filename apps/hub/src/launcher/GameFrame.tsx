import { useBlocker, useNavigate } from '@tanstack/react-router';
import type { Reaction, Replay, RoomSeat, ShellTarget } from '@tohe/contract';
import type { JsonValue } from '@tohe/game-sdk';
import { createHost, type HostHandle, iframeTransport } from '@tohe/game-sdk/host';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type GameSummary, runs } from '../api/client.ts';
import type { Player } from '../session/session.ts';
import { syncer, syncsWithServer } from '../session/useBackgroundSync.ts';
import { db } from '../storage/db.ts';
import { loadSave, recordRanked, recordScore, storeSave } from '../storage/repository.ts';
import { durationBucket } from '../telemetry/collector.ts';
import { telemetry, telemetryOn } from '../telemetry/telemetry.ts';
import { useTheme } from '../theme/useTheme.ts';
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx';
import { LeaderboardSheet } from '../ui/Leaderboard.tsx';
import { dailySeed, hasShell, isTrustedEntry, manifestFrom } from './manifest.ts';

/** `starting`: the game answered, but a shell game has not shown its first screen yet (ADR 0019). */
type Status = 'loading' | 'starting' | 'ready' | 'failed' | 'untrusted';

/** Sound on or off for this device, whichever game switched it (ADR 0018). */
const MUTED_KEY = 'tohe:muted';
const readMuted = () => {
  try {
    return localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
};

/** How long a shell game has to answer Back before the hub offers its own way out. */
const BACK_ANSWER_MS = 1500;
/** At most how long the browser takes to put back the page a blocked Back left. */
const BACK_RESTORE_MS = 500;
/** How long the loading screen waits for a shell game's first screen after the handshake before it lifts anyway. */
const FIRST_SCREEN_MS = 8000;

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
 * saves and scores to the device (synced later), telemetry, and with `room` the relay of a table. A game with the
 * `shell` capability (ADR 0018) gets the whole screen: its own menu holds the way out, phone Back opens that menu, and
 * the hub only steps in when the game does not load or does not answer.
 */
export function GameFrame({
  game,
  gamesOrigin,
  player,
  room,
  replay,
  onExit,
  exitLabel,
  topRight,
}: {
  game: GameSummary;
  gamesOrigin: string;
  player: Player;
  room?: RoomBridge;
  /** A finished hand for the game to replay with its own rules module (ADR 0016). */
  replay?: Replay;
  /** The player asked to leave (exit button or the game's `exit()`); the game is paused meanwhile. */
  onExit(host: HostHandle | null): void;
  exitLabel?: string;
  topRight?: React.ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const iframe = useRef<HTMLIFrameElement>(null);
  const host = useRef<HostHandle | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [muted, setMuted] = useState(readMuted);
  const { theme } = useTheme();
  const navigate = useNavigate();
  const shell = hasShell(game);
  const [board, setBoard] = useState(false);
  const [stuck, setStuck] = useState(false);
  /** When the game last answered Back (a menu state, or leaving). */
  const answered = useRef(0);
  /**
   * Settles once the browser has put back the page a blocked Back left (the router goes forward again). Leaving the
   * game before that — a game answers Back on its title screen by leaving — would start a second history traversal
   * while the first is pending, and the browser drops one: the player stayed in the game, or the catalog was stacked.
   */
  const backRestored = useRef<Promise<void>>(Promise.resolve());

  // The device remembers sound, whichever game or bar switched it.
  useEffect(() => {
    try {
      localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
    } catch {
      // Private mode: sound stays as it is for this visit.
    }
  }, [muted]);

  // Phone Back (or the browser's) on a shell game opens its menu instead of leaving the page. Leaving the game goes
  // through its own way out, which navigates forward.
  useBlocker({
    shouldBlockFn: ({ action }) => {
      if (!shell || action !== 'BACK' || status !== 'ready' || !host.current) return false;
      backRestored.current = new Promise((resolve) => {
        const done = () => {
          window.removeEventListener('popstate', done);
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(done, BACK_RESTORE_MS);
        window.addEventListener('popstate', done);
      });
      const asked = Date.now();
      host.current.menu();
      setTimeout(() => {
        if (answered.current < asked) setStuck(true);
      }, BACK_ANSWER_MS);
      return true;
    },
    enableBeforeUnload: false,
  });

  // The session restarts only for a different game build, origin, profile or room. Everything else is read from
  // `latest` at start; later mute and theme changes are sent as `settings` messages.
  const buildKey = `${game.id}@${game.version}`;
  const latest = useRef({ game, player, muted, theme, locale: i18n.language, onExit, room, replay });
  latest.current = { game, player, muted, theme, locale: i18n.language, onExit, room, replay };
  const roomId = room?.id;

  // biome-ignore lint/correctness/useExhaustiveDependencies: restarts only for the keys above, on purpose.
  useEffect(() => {
    const frame = iframe.current;
    const { game, player, muted, theme, locale, room, replay } = latest.current;
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
    telemetry.count(room ? 'hub.room.session' : replay ? 'hub.room.replay' : 'hub.play.session', scope);
    // A shell game draws its board, then its title screen, after the handshake: the loading screen stays until that
    // first screen reports itself (its first `menu`), so the player never sees a half-drawn game (ADR 0019).
    let late: ReturnType<typeof setTimeout> | undefined;
    let shown = false;
    const firstScreen = () => {
      if (shown) return;
      shown = true;
      clearTimeout(late);
      setStatus('ready');
      telemetry.metric('hub.game.first-screen-ms', Math.round(performance.now() - started), scope);
    };
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
          replay,
          // What the game's menu may offer (ADR 0018): signed-in profiles have boards and rooms; guests do not.
          shell: hasShell(game)
            ? {
                leaderboard: synced && game.capabilities.includes('scores'),
                rooms: synced && game.rooms !== null && game.rooms !== undefined,
              }
            : undefined,
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
      // Ranked runs (ADR 0030) for signed-in profiles: the API deals the seed; without it the game plays unranked.
      onRankedStart: synced ? () => runs.start(game.id) : undefined,
      onRankedFinish: async ({ run, moves, score }) => {
        await recordRanked(db, { profileId: player.id, gameId: game.id, run, moves, score });
        if (synced) syncer.syncSoon(player.id);
      },
      onRoomAct: (action) => room?.act(action),
      onRoomNext: () => room?.next(),
      onRoomReact: (reaction) => room?.react(reaction),
      onExit: () => {
        answered.current = Date.now();
        void backRestored.current.then(() => latest.current.onExit(session));
      },
      onMenu: () => {
        answered.current = Date.now();
        firstScreen();
      },
      onOpen: (what: ShellTarget) => {
        if (what === 'leaderboard') setBoard(true);
        else void navigate({ to: '/play/$gameId/rooms', params: { gameId: game.id } });
      },
      onSettings: (change) => setMuted(change.muted),
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
        telemetry.metric('hub.game.ready-ms', Math.round(performance.now() - started), scope);
        if (hasShell(game) && !shown) {
          setStatus('starting');
          late = setTimeout(() => {
            telemetry.count('hub.game.first-screen-late', scope);
            firstScreen();
          }, FIRST_SCREEN_MS);
        } else firstScreen();
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
      clearTimeout(late);
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

  const leave = () => {
    host.current?.pause();
    onExit(host.current);
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-page">
      {shell ? null : (
        <nav className="flex h-14 shrink-0 items-center justify-between border-line border-b-2 px-2 pt-[env(safe-area-inset-top)]">
          <button
            type="button"
            onClick={leave}
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
      )}
      <div className="relative min-h-0 flex-1">
        <iframe
          ref={iframe}
          title={game.name}
          sandbox="allow-scripts allow-same-origin"
          allow="autoplay; fullscreen"
          className="absolute inset-0 size-full border-0"
        />
        {/* The game's card, carried on from the catalog while it loads; fades out once the game shows its first
            screen (a shell game) or answers (any other). Then hidden, so the compositor has no layer over the game
            while it plays. */}
        <div
          aria-hidden={status === 'ready'}
          className={`absolute inset-0 grid place-items-center bg-page p-6 text-center text-ink transition-[opacity,visibility] duration-300 ${
            status === 'ready' ? 'pointer-events-none invisible opacity-0' : ''
          }`}
        >
          {status === 'loading' || status === 'starting' ? (
            <div className="flex flex-col items-center gap-3">
              {game.iconUrl ? (
                <img src={game.iconUrl} alt="" className="size-24 rounded-3xl shadow-sm" />
              ) : (
                <span className="grid size-24 place-items-center rounded-3xl bg-soft text-5xl">🎲</span>
              )}
              <span className="font-black text-2xl text-brand-ink">{game.name}</span>
              <span role="status" className="flex h-6 items-end gap-1.5">
                <span className="sr-only">{t('loading')}</span>
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    aria-hidden="true"
                    className="size-2.5 animate-bounce rounded-full bg-brand motion-reduce:animate-none"
                    style={{ animationDelay: `${dot * 150}ms` }}
                  />
                ))}
              </span>
            </div>
          ) : null}
          {status === 'failed' && t('gameFailed')}
          {status === 'untrusted' && t('untrusted')}
          {/* A shell game holds the way out in its own menu; until it is up (or if it never is), the hub's. */}
          {shell && status !== 'ready' ? (
            <button
              type="button"
              onClick={leave}
              className="absolute top-[max(0.5rem,env(safe-area-inset-top))] left-2 rounded-full px-3 py-1.5 font-semibold text-accent active:bg-soft"
            >
              {t('shell.leave')}
            </button>
          ) : null}
        </div>
        {shell && topRight ? (
          <div className="pointer-events-none absolute inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] flex justify-center">
            <span className="rounded-full bg-notice px-3 py-1 text-notice-ink text-sm">{topRight}</span>
          </div>
        ) : null}
      </div>
      {shell ? (
        <>
          <LeaderboardSheet game={game} player={player} open={board} onClose={() => setBoard(false)} />
          <ConfirmDialog
            open={stuck}
            title={t('shell.stuckTitle')}
            body={t('shell.stuckBody')}
            primary={{ label: t('shell.wait'), onClick: () => setStuck(false) }}
            secondary={{
              label: t('shell.leave'),
              onClick: () => {
                setStuck(false);
                leave();
              },
            }}
            onDismiss={() => setStuck(false)}
          />
        </>
      ) : null}
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
