import { deviceScheme, resolveTheme, savedChoice } from '@tohe/design-tokens/theme';
import { createHost, iframeTransport } from '@tohe/game-sdk/host';
import { useEffect, useRef, useState } from 'react';
import type { ProfileCard, RunReplay } from '../api/client.ts';
import { Button } from '../ui/forms.tsx';
import { manifestOf, type RunBuild, replayInit } from '../watch.ts';

/**
 * A ranked run played back by the game itself (ADR 0032), in its sandboxed iframe on the games origin. The console is
 * the host: it opens the build that played the run with `init.rankedReplay`, and keeps nothing the game sends.
 * Loaded on demand: the host and the contract's schemas come only with it.
 */
export default function WatchRun({
  run,
  build,
  player,
  onClose,
}: {
  run: RunReplay;
  build: RunBuild;
  player: ProfileCard | null;
  onClose(): void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  // The game says ready once, to its first host: the host starts again only with another build (and so another
  // iframe), and everything else is read from `latest` when the game asks for it.
  const latest = useRef({ run, build, player, onClose });
  latest.current = { run, build, player, onClose };
  const entryUrl = build.entryUrl;

  useEffect(() => {
    const iframe = frame.current;
    if (!iframe) return;
    const { run, build } = latest.current;
    const host = createHost({
      transport: iframeTransport(iframe, new URL(entryUrl).origin),
      manifest: manifestOf(run, build),
      init: () =>
        replayInit(
          latest.current.run,
          latest.current.player,
          resolveTheme(savedChoice(), deviceScheme().matches),
        ),
      // The game's Thoát xem lại.
      onExit: () => latest.current.onClose(),
      onProtocolError: (error) => console.warn(`[game:${run.gameId}] protocol error: ${error}`),
    });
    host.ready.then(
      () => setStatus('ready'),
      () => setStatus('failed'),
    );
    return () => host.dispose();
  }, [entryUrl]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') latest.current.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Xem lại run: ${build.name}`}
      className="fixed inset-0 z-50 flex flex-col bg-page"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-line border-b bg-surface px-4 py-2">
        <span className="font-semibold text-ink">
          Xem lại run · {build.name} {build.version}
          {player ? ` · ${player.avatar} ${player.name}` : ''}
        </span>
        {/* The dialog's way out takes the focus as it opens. */}
        <Button variant="secondary" autoFocus onClick={() => latest.current.onClose()}>
          Đóng
        </Button>
      </div>
      {status === 'loading' ? <p className="px-4 py-2 text-ink-soft text-sm">Đang mở game…</p> : null}
      {status === 'failed' ? (
        <p role="alert" className="px-4 py-2 text-danger">
          Game không trả lời: không mở được bản này.
        </p>
      ) : null}
      <iframe
        ref={frame}
        title={`${build.name}: xem lại run`}
        src={build.entryUrl}
        sandbox="allow-scripts allow-same-origin"
        allow="autoplay; fullscreen"
        className="min-h-0 w-full flex-1 border-0"
      />
    </div>
  );
}
