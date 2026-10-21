import { useBlocker, useNavigate } from '@tanstack/react-router';
import type {
  EntryResult,
  GameEntry,
  InitProfile,
  Reaction,
  Replay,
  RequiredLevel,
  RequireReason,
  RoomSeat,
  ShellTarget,
} from '@tohe/contract';
import type { JsonValue } from '@tohe/game-sdk';
import { createHost, type HostHandle, iframeTransport } from '@tohe/game-sdk/host';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type GameSummary, runs } from '../api/client.ts';
import { gameEntry } from '../entry/gameEntry.ts';
import { entry as entryIntent } from '../entry/intent.ts';
import { installStore } from '../install/install.ts';
import { TERMS_VERSION } from '../legal/documents.ts';
import { tablesStep } from '../session/serverCopy.ts';
import type { Player } from '../session/session.ts';
import { syncer, syncsWithServer } from '../session/useBackgroundSync.ts';
import { db } from '../storage/db.ts';
import { loadSave, recordRanked, recordScore, storeSave } from '../storage/repository.ts';
import { durationBucket } from '../telemetry/collector.ts';
import { funnel, telemetry, telemetryOn } from '../telemetry/telemetry.ts';
import { useTheme } from '../theme/useTheme.ts';
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx';
import { LeaderboardSheet } from '../ui/Leaderboard.tsx';
import { EntryNotice, type GameAsk, GameAsks, type PlayingSession, Reopening } from './GameAsks.tsx';
import { dailySeed, hasShell, isTrustedEntry, manifestFrom } from './manifest.ts';
import {
  declines,
  ENTRY_ANSWER_MS,
  hostCan,
  LEAVE_WAIT_MS,
  meets,
  profileKind,
  profileLevel,
  takesEntry,
} from './requests.ts';

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

/** Whether a device profile has its copy on the server with the terms the hub shows: the `named` level (ADR 0043). */
async function deviceNamed(id: string): Promise<boolean> {
  const profile = await db.profiles.get(id);
  return profile !== undefined && tablesStep(profile, TERMS_VERSION) === 'play';
}

/** A game reported a final score: the moment the install card may show, and the newcomer funnel's first game. */
function gameFinished() {
  installStore.gameFinished();
  funnel.firstGame();
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
  entry,
  reopened = false,
  session: playing,
}: {
  game: GameSummary;
  gamesOrigin: string;
  player: Player;
  room?: RoomBridge;
  /** A finished hand for the game to replay with its own rules module (ADR 0016). */
  replay?: Replay;
  /** The entry the game is opened with (ADR 0045): sent only to a build that declares its kind. */
  entry?: GameEntry | null;
  /** The game opens again after the player signed in at its request (ADR 0045). */
  reopened?: boolean;
  /**
   * The player's session, so the game may ask for a name, an account or a share (ADR 0045). Without it — a table, a
   * replay — it may ask for neither.
   */
  session?: PlayingSession;
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
  /** The sheet a game asked for (ADR 0045): one at a time. */
  const [ask, setAsk] = useState<GameAsk | null>(null);
  /** The link's place did not open in this build: the hub says so over the game's menu (ADR 0045). */
  const [notice, setNotice] = useState(false);
  /** A sheet is open, or one is being opened: the game's next request is `busy`. */
  const asking = useRef(false);
  /** The game showed its first screen: before it, a request is `busy`. */
  const shownFirst = useRef(false);
  /** Who waits for the game's next save: leaving to sign in waits for it, at most a second. */
  const saveWaiters = useRef<(() => void)[]>([]);
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
  // What the hub answers in this session (ADR 0045). A child kept to its account shares nothing with outsiders.
  const mayPlayWithOthers =
    player.kind !== 'child' ||
    (playing?.status === 'account' &&
      playing.me.profiles.find((profile) => profile.id === player.id)?.playWithOthers === true);
  const can = hostCan({
    asking: playing !== undefined,
    elsewhere: Boolean(room || replay),
    entries: game.entries,
    mayPlayWithOthers,
  });
  const canKey = `${can.require}:${can.share}`;

  const buildKey = `${game.id}@${game.version}`;
  const latest = useRef({
    game,
    player,
    muted,
    theme,
    locale: i18n.language,
    onExit,
    room,
    replay,
    entry,
    can,
  });
  latest.current = { game, player, muted, theme, locale: i18n.language, onExit, room, replay, entry, can };
  const roomId = room?.id;

  /** Opens a sheet over the paused game; `busy` while another is open or before the game's first screen. */
  const openAsk = (make: (close: () => void) => GameAsk) => {
    const close = () => {
      asking.current = false;
      setAsk(null);
      host.current?.resume();
    };
    host.current?.pause();
    setAsk(make(close));
  };
  const busy = () => asking.current || !shownFirst.current;

  /**
   * `identity.require` (ADR 0045): ok at once for a level the profile has; `declined` without asking for ten minutes
   * after "Để sau"; else the hub's sheet — the name screen, or signing in, after which the game opens again.
   */
  const require = async (level: RequiredLevel, reason: RequireReason): Promise<InitProfile> => {
    if (busy()) throw new Error('busy');
    asking.current = true;
    const profile: InitProfile = {
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      kind: profileKind(player),
    };
    const named = player.kind === 'device' ? await deviceNamed(player.id).catch(() => false) : true;
    if (meets(profileLevel(player, named), level)) {
      asking.current = false;
      return profile;
    }
    if (declines.declined(game.id, player.id)) {
      asking.current = false;
      throw new Error('declined');
    }
    return new Promise<InitProfile>((resolve, reject) => {
      openAsk((close) => {
        const decline = () => {
          declines.decline(game.id, player.id);
          close();
          reject(new Error('declined'));
        };
        return level === 'named'
          ? {
              kind: 'named',
              reason,
              done: (now) => {
                close();
                resolve(now);
              },
              decline,
              signIn: () => void leaveToSignIn('sign-in'),
            }
          : { kind: 'account', reason, go: (to) => void leaveToSignIn(to), decline };
      });
    });
  };

  /**
   * Becoming an account opens the game again (ADR 0045): the game paused and given a second to save, the game and its
   * entry kept for after signing in — the link is not resolved again — then the sign-in. The request never settles.
   */
  const leaveToSignIn = async (to: 'sign-in' | 'register') => {
    setAsk(null);
    host.current?.pause();
    await new Promise<void>((resolve) => {
      saveWaiters.current.push(resolve);
      setTimeout(resolve, LEAVE_WAIT_MS);
    });
    entryIntent.keep({ kind: 'play', code: game.id });
    gameEntry.keep(game.id, sent.current, true);
    void navigate({ to: to === 'register' ? '/account/register' : '/account/sign-in' });
  };

  /** `share` (ADR 0045): the hub's sheet; ok once the player sent, copied or showed the link. */
  const share = async (request: { payload: JsonValue; text?: string; level?: string }) => {
    if (busy()) throw new Error('busy');
    asking.current = true;
    return new Promise<void>((resolve, reject) => {
      openAsk((close) => {
        let settled = false;
        return {
          kind: 'share',
          payload: request.payload,
          text: request.text,
          level:
            request.level === 'any' || request.level === 'named' || request.level === 'account'
              ? request.level
              : undefined,
          sent: () => {
            if (settled) return;
            settled = true;
            resolve();
          },
          close: (error) => {
            close();
            if (settled) return;
            settled = true;
            reject(new Error(error ?? 'cancelled'));
          },
          // Leaving to sign in: the game opens again afterwards, so the request never settles (as `account`'s).
          signIn: () => void leaveToSignIn('sign-in'),
        };
      });
    });
  };
  const asks = useRef({ require, share });
  asks.current = { require, share };
  /** The entry this session sent the game, kept to open it with again after signing in. */
  const sent = useRef<GameEntry | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: restarts only for the keys above, on purpose.
  useEffect(() => {
    const frame = iframe.current;
    const { game, player, muted, theme, locale, room, replay, entry } = latest.current;
    if (!frame) return;
    if (!isTrustedEntry(game.entryUrl, gamesOrigin)) {
      setStatus('untrusted');
      return;
    }

    setStatus('loading');
    shownFirst.current = false;
    asking.current = false;
    setAsk(null);
    setNotice(false);
    const synced = syncsWithServer(player);
    // The entry goes only to a build that declares its kind, never at a table or in a replay (ADR 0045).
    const given = entry && !room && !replay ? entry : null;
    const sending = given && takesEntry(game, given.kind) ? given : null;
    sent.current = given;
    let entryTimer: ReturnType<typeof setTimeout> | undefined;
    const entryAnswered = (answer: EntryResult | 'late' | 'undeclared') => {
      clearTimeout(entryTimer);
      telemetry.count(`hub.entry.${answer}`, scope);
      // A `handled` that comes after the five seconds takes the notice back: the game did open at its place.
      setNotice(answer !== 'handled');
    };
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
      shownFirst.current = true;
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
          // A device profile, or an account's (a child's profile is an account's): ADR 0043, 0045.
          profile: { id: player.id, name: player.name, avatar: player.avatar, kind: profileKind(player) },
          locale,
          // The theme the hub shows; games that declare both themes follow it (ADR 0013).
          settings: { muted, theme },
          save: await loadSave(db, player.id, game.id),
          seed: dailySeed(),
          telemetry: telemetryOn(),
          room: room && table ? { id: room.id, ...table } : undefined,
          replay,
          // What the game's menu may offer (ADR 0018): signed-in profiles have boards and rooms; device profiles do not.
          shell: hasShell(game)
            ? {
                leaderboard: synced && game.capabilities.includes('scores'),
                rooms: synced && game.rooms !== null && game.rooms !== undefined,
              }
            : undefined,
          entry: sending ?? undefined,
          // What the hub answers in this session: changing it opens the game again (ADR 0045).
          can: latest.current.can,
        };
      },
      onSave: async (data) => {
        await storeSave(db, player.id, game.id, data);
        if (synced) syncer.syncSoon(player.id);
        for (const waiting of saveWaiters.current.splice(0)) waiting();
      },
      onEntry: (result) => entryAnswered(result),
      onIdentityRequire: ({ level, reason }) => asks.current.require(level, reason),
      onShare: (request) => asks.current.share(request),
      onScore: async ({ value, board, run, final }) => {
        await recordScore(db, { profileId: player.id, gameId: game.id, board, value, run, final });
        // A final score is a finished round: the moment Tò He may offer to be installed (install/install.ts).
        if (final) gameFinished();
        if (synced) syncer.syncSoon(player.id);
      },
      // Ranked runs (ADR 0030) for signed-in profiles: the API deals the seed; without it the game plays unranked.
      onRankedStart: synced ? () => runs.start(game.id) : undefined,
      onRankedFinish: async ({ run, moves, score }) => {
        await recordRanked(db, { profileId: player.id, gameId: game.id, run, moves, score });
        gameFinished();
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
        // The game has five seconds to answer its entry; a build that does not take it gets the notice at once.
        if (sending) entryTimer = setTimeout(() => entryAnswered('late'), ENTRY_ANSWER_MS);
        else if (given) entryAnswered('undeclared');
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

    // A sheet over the game keeps it paused: it resumes when the sheet closes (ADR 0045).
    const onVisibility = () => {
      if (document.hidden) session.pause();
      else if (!asking.current) session.resume();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(late);
      clearTimeout(entryTimer);
      telemetry.count(`hub.play.duration.${durationBucket(performance.now() - started)}`, scope);
      document.removeEventListener('visibilitychange', onVisibility);
      unsubscribe();
      session.dispose();
      host.current = null;
      frame.src = 'about:blank';
    };
  }, [buildKey, gamesOrigin, player.id, roomId, canKey]);

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
              {reopened ? <Reopening game={game} /> : null}
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
      <GameAsks ask={ask} game={game} session={playing} />
      <EntryNotice open={notice && status === 'ready' && !ask} game={game} onClose={() => setNotice(false)} />
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
