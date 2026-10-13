import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { createHost, type HostHandle, iframeTransport } from '@tohe/game-sdk/host';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { configQuery, gamesQuery } from '../api/queries.ts';
import { dailySeed, isTrustedEntry, manifestFrom } from '../launcher/manifest.ts';
import { RequireSession } from '../session/RequireSession.tsx';
import type { Player } from '../session/session.ts';
import { db } from '../storage/db.ts';
import { loadSave, recordScore, storeSave } from '../storage/repository.ts';
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

  const game = games.data?.find((g) => g.id === gameId);
  const gamesOrigin = config.data?.gamesOrigin;

  // The session restarts only for a different game build, origin or profile. Everything else the session
  // needs is read from `latest` at start; later mute changes are sent as messages instead (see toggleMute).
  const buildKey = game ? `${game.id}@${game.version}` : undefined;
  const playerId = player.id;
  const latest = useRef({ game, player, muted, locale: i18n.language, navigate });
  latest.current = { game, player, muted, locale: i18n.language, navigate };

  useEffect(() => {
    const frame = iframe.current;
    const { game, player, muted, locale, navigate } = latest.current;
    if (!buildKey || !gamesOrigin || !playerId || !game || !player || !frame) return;
    if (!isTrustedEntry(game.entryUrl, gamesOrigin)) {
      setStatus('untrusted');
      return;
    }

    setStatus('loading');
    const session = createHost({
      transport: iframeTransport(frame, new URL(gamesOrigin).origin),
      manifest: manifestFrom(game),
      init: async () => ({
        profile: { id: player.id, name: player.name, avatar: player.avatar },
        locale,
        settings: { muted },
        save: await loadSave(db, player.id, game.id),
        seed: dailySeed(),
      }),
      onSave: (data) => storeSave(db, player.id, game.id, data),
      onScore: ({ value, board }) => recordScore(db, { profileId: player.id, gameId: game.id, board, value }),
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

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    host.current?.setSettings({ muted: next });
  };

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
    <div className="fixed inset-0 flex flex-col bg-orange-50">
      <nav className="flex h-14 shrink-0 items-center justify-between border-orange-200 border-b-2 px-2 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={askToExit}
          className="rounded-full px-3 py-1.5 font-semibold text-orange-800 active:bg-orange-100"
        >
          ← {t('exit')}
        </button>
        <span className="font-bold text-orange-900">{game?.name}</span>
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? t('unmute') : t('mute')}
          className="rounded-full px-3 py-1.5 text-xl active:bg-orange-100"
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
        {status !== 'ready' && (
          <div className="absolute inset-0 grid place-items-center bg-orange-50 p-6 text-center text-orange-900">
            {status === 'loading' && t('loading')}
            {status === 'failed' && t('gameFailed')}
            {status === 'untrusted' && t('untrusted')}
          </div>
        )}
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

function Message({ text, back }: { text: string; back: string }) {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <p className="text-lg text-orange-900">{text}</p>
        <Link to="/" className="rounded-2xl bg-orange-500 px-5 py-3 font-bold text-white">
          {back}
        </Link>
      </div>
    </main>
  );
}
