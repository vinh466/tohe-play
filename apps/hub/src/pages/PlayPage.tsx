import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import type { HostHandle } from '@tohe/game-sdk/host';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { configQuery, gamesQuery } from '../api/queries.ts';
import { GameFrame } from '../launcher/GameFrame.tsx';
import { hasShell } from '../launcher/manifest.ts';
import { BackLink, useLeaveTo } from '../navigation/leave.tsx';
import { RequireSession } from '../session/RequireSession.tsx';
import type { Player } from '../session/session.ts';
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx';

export function PlayPage() {
  return <RequireSession need="player">{({ player }) => <Launcher player={player} />}</RequireSession>;
}

/** A game on its own: from its catalog card, or "Chơi với máy" in a rooms lobby. */
function Launcher({ player }: { player: Player }) {
  const { gameId } = useParams({ from: '/play/$gameId' });
  const { t } = useTranslation();
  const leaveTo = useLeaveTo();
  const games = useQuery(gamesQuery(player.id));
  const config = useQuery(configQuery);
  const game = games.data?.find((g) => g.id === gameId);
  const gamesOrigin = config.data?.gamesOrigin;
  const shell = game ? hasShell(game) : false;
  // A shell game (ADR 0018) is entered from its card and left from its own main menu: back to the catalog.
  const back =
    game?.rooms && !shell ? ({ to: '/rooms/$gameId', params: { gameId } } as const) : ({ to: '/' } as const);

  // Leaving through the hub's bar is confirmed: the bar sits right above the game, and touch adjustment on phones
  // snaps taps near the top edge of the game onto it. A child must not be thrown out of a round by a stray tap. A
  // shell game has no bar; its "Về Tò He" is a choice made in its menu, so it leaves at once.
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
          if (shell) {
            leaveTo(back);
            return;
          }
          paused.current = host;
          setConfirmingExit(true);
        }}
      />
      <ConfirmDialog
        open={confirmingExit}
        title={t('confirmExitTitle')}
        body={t('confirmExitBody')}
        primary={{ label: t('keepPlaying'), onClick: keepPlaying }}
        secondary={{ label: t('exit'), onClick: () => leaveTo(back) }}
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
        <BackLink
          to="/"
          className="rounded-2xl bg-brand px-5 py-3 font-bold text-on-brand text-xl active:bg-brand-strong"
        >
          {back}
        </BackLink>
      </div>
    </main>
  );
}
