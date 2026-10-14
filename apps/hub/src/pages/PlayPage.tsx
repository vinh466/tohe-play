import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { createHost, type HostHandle, iframeTransport } from '@tohe/game-sdk/host';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { configQuery, gamesQuery } from '../api/queries.ts';
import { dailySeed, isTrustedEntry, manifestFrom } from '../launcher/manifest.ts';
import { RequireSession } from '../session/RequireSession.tsx';
import type { Player } from '../session/session.ts';
import { syncer, syncsWithServer } from '../session/useBackgroundSync.ts';
import { db } from '../storage/db.ts';
import { loadSave, recordScore, storeSave } from '../storage/repository.ts';
import { useTheme } from '../theme/useTheme.ts';
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx';

type Status = 'loading' | 'ready' | 'failed' | 'untrusted';

export function PlayPage() {
  return <RequireSession need="player">{({ player }) => <Launcher player={player} />}</RequireSession>;
}

function Launcher({ player }: { player: Player }) {
  const { gameId } = useParams({ from: '/play/$gameId' });
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const games = useQuery(gamesQuery(player.id));
  const config = useQuery(configQuery);
  const iframe = useRef<HTMLIFrameElement>(null);
  const host = useRef<HostHandle | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [muted, setMuted] = useState(false);
  const { theme } = useTheme();

  const game = games.data?.find((g) => g.id === gameId);
  const gamesOrigin = config.data?.gamesOrigin;

  // The session restarts only for a different game build, origin or profile. Everything else the session
  // needs is read from `latest` at start; later mute and theme changes are sent as `settings` messages.
  const buildKey = game ? `${game.id}@${game.version}` : undefined;
  const playerId = player.id;
  const latest = useRef({ game, player, muted, theme, locale: i18n.language, navigate });
  latest.current = { game, player, muted, theme, locale: i18n.language, navigate };

  useEffect(() => {
    const frame = iframe.current;
    const { game, player, muted, theme, locale, navigate } = latest.current;
    if (!buildKey || !gamesOrigin || !playerId || !game || !player || !frame) return;
    if (!isTrustedEntry(game.entryUrl, gamesOrigin)) {
      setStatus('untrusted');
      return;
    }

    setStatus('loading');
    const synced = syncsWithServer(player);
    const session = createHost({
      transport: iframeTransport(frame, new URL(gamesOrigin).origin),
      manifest: manifestFrom(game),
      init: async () => {
        if (synced) await catchUp(player.id);
        return {
          profile: { id: player.id, name: player.name, avatar: player.avatar },
          locale,
          // The theme the hub shows; games that declare both themes follow it (ADR 0013).
          settings: { muted, theme },
          save: await loadSave(db, player.id, game.id),
          seed: dailySeed(),
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
      onExit: () => {
        console.info(`[game:${game.id}] requested exit`);
        void navigate({ to: '/' });
      },
      onLog: ({ level, message }) => console[level](`[game:${game.id}] ${message}`),
      onProtocolError: (error) => console.warn(`[game:${game.id}] protocol error: ${error}`),
    });
    host.current = session;
    session.ready.then(
      () => setStatus('ready'),
      () => setStatus('failed'),
    );
    // Load the game only after the host listens, so its `ready` cannot be missed.
    frame.src = game.entryUrl;

    const onVisibility = () => (document.hidden ? session.pause() : session.resume());
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      session.dispose();
      host.current = null;
      frame.src = 'about:blank';
    };
  }, [buildKey, gamesOrigin, playerId]);

  // Mute and theme changes reach a running game as `settings` (e.g. "Theo máy" turning dark mid-round).
  useEffect(() => {
    host.current?.setSettings({ muted, theme });
  }, [muted, theme]);

  const toggleMute = () => setMuted((value) => !value);

  // Leaving is confirmed: the bar sits right above the game, and touch adjustment on phones snaps taps near the
  // top edge of the game onto this button. A child must not be thrown out of a round by a stray tap.
  const [confirmingExit, setConfirmingExit] = useState(false);
  const askToExit = () => {
    host.current?.pause();
    setConfirmingExit(true);
  };
  const keepPlaying = () => {
    setConfirmingExit(false);
    host.current?.resume();
  };

  if (games.isSuccess && !game) {
    return <Message text={t('gameNotFound')} back={t('backToGames')} />;
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-page">
      <nav className="flex h-14 shrink-0 items-center justify-between border-line border-b-2 px-2 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={askToExit}
          className="rounded-full px-3 py-1.5 font-semibold text-accent active:bg-soft"
        >
          ← {t('exit')}
        </button>
        <span className="font-bold text-ink">{game?.name}</span>
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? t('unmute') : t('mute')}
          className="rounded-full px-3 py-1.5 text-xl active:bg-soft"
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </nav>
      <div className="relative min-h-0 flex-1">
        <iframe
          ref={iframe}
          title={game?.name ?? gameId}
          sandbox="allow-scripts allow-same-origin"
          allow="autoplay; fullscreen"
          className="absolute inset-0 size-full border-0"
        />
        {/* Fades out once the game is ready, covering its first frames while it applies its theme. */}
        <div
          aria-hidden={status === 'ready'}
          className={`absolute inset-0 grid place-items-center bg-page p-6 text-center text-ink transition-opacity duration-300 ${
            status === 'ready' ? 'pointer-events-none opacity-0' : ''
          }`}
        >
          {status === 'loading' && t('loading')}
          {status === 'failed' && t('gameFailed')}
          {status === 'untrusted' && t('untrusted')}
        </div>
      </div>
      <ConfirmDialog
        open={confirmingExit}
        title={t('confirmExitTitle')}
        body={t('confirmExitBody')}
        primary={{ label: t('keepPlaying'), onClick: keepPlaying }}
        secondary={{ label: t('exit'), onClick: () => void navigate({ to: '/' }) }}
        onDismiss={keepPlaying}
      />
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

function Message({ text, back }: { text: string; back: string }) {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <p className="text-ink text-lg">{text}</p>
        <Link
          to="/"
          className="rounded-2xl bg-brand px-5 py-3 font-bold text-on-brand text-xl active:bg-brand-strong"
        >
          {back}
        </Link>
      </div>
    </main>
  );
}
