import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import type { HostHandle } from '@tohe/game-sdk/host';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { configQuery, gamesQuery } from '../api/queries.ts';
import { GameFrame } from '../launcher/GameFrame.tsx';
import { RequireSession } from '../session/RequireSession.tsx';
import type { Player } from '../session/session.ts';
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx';

export function PlayPage() {
  return <RequireSession need="player">{({ player }) => <Launcher player={player} />}</RequireSession>;
}

/** A game on its own (for a game with rooms, "Chơi với máy" from its lobby). */
function Launcher({ player }: { player: Player }) {
  const { gameId } = useParams({ from: '/play/$gameId' });
  const { t } = useTranslation();
  const navigate = useNavigate();
  const games = useQuery(gamesQuery(player.id));
  const config = useQuery(configQuery);
  const game = games.data?.find((g) => g.id === gameId);
  const gamesOrigin = config.data?.gamesOrigin;
  const back = game?.rooms ? ({ to: '/rooms/$gameId', params: { gameId } } as const) : ({ to: '/' } as const);

  // Leaving is confirmed: the bar sits right above the game, and touch adjustment on phones snaps taps near the
  // top edge of the game onto this button. A child must not be thrown out of a round by a stray tap.
  const [confirmingExit, setConfirmingExit] = useState(false);
  const paused = useRef<HostHandle | null>(null);
  const keepPlaying = () => {
    setConfirmingExit(false);
    paused.current?.resume();
  };

  if (games.isSuccess && !game) {
    return <Message text={t('gameNotFound')} back={t('backToGames')} />;
  }
  if (!game || !gamesOrigin) return <div className="fixed inset-0 bg-page" />;

  return (
    <>
      <GameFrame
        game={game}
        gamesOrigin={gamesOrigin}
        player={player}
        onExit={(host) => {
          paused.current = host;
          setConfirmingExit(true);
        }}
      />
      <ConfirmDialog
        open={confirmingExit}
        title={t('confirmExitTitle')}
        body={t('confirmExitBody')}
        primary={{ label: t('keepPlaying'), onClick: keepPlaying }}
        secondary={{ label: t('exit'), onClick: () => void navigate(back) }}
        onDismiss={keepPlaying}
      />
    </>
  );
}

export function Message({ text, back }: { text: string; back: string }) {
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
