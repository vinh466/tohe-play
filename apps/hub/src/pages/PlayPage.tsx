import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import type { HostHandle } from '@tohe/game-sdk/host';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { configQuery, gamesQuery } from '../api/queries.ts';
import { type EntryIntent, readCodeOf } from '../entry/codes.ts';
import { DeadEnd } from '../entry/DeadEnd.tsx';
import { EntryGate } from '../entry/EntryGate.tsx';
import { gameEntry } from '../entry/gameEntry.ts';
import { entry } from '../entry/intent.ts';
import type { PlayingSession } from '../launcher/GameAsks.tsx';
import { GameFrame } from '../launcher/GameFrame.tsx';
import { hasShell } from '../launcher/manifest.ts';
import { playLevel } from '../launcher/requests.ts';
import { BackLink, useLeaveTo } from '../navigation/leave.tsx';
import type { Player } from '../session/session.ts';
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx';

/**
 * A game's menu, `/play/<gameId>` — an entry like any link (ADR 0044): the intent kept through the profile picker, the
 * gate, then the game, if the profile's catalog has it — and the gate again at the game's own level once the game is
 * known (ADR 0045): a name, or an account.
 */
export function PlayPage() {
  const { gameId } = useParams({ from: '/play/$gameId' });
  const { t } = useTranslation();
  const intent = useMemo(() => readCodeOf('play', gameId), [gameId]);
  // The entry the game opens with — a share link's place, or opening again after signing in — taken once (ADR 0045).
  const [pending] = useState(() => gameEntry.take(gameId));
  if (!intent) return <Message text={t('gameNotFound')} back={t('backToGames')} />;
  return (
    <EntryGate key={gameId} intent={intent} level="any">
      {(player, session) => <Launcher intent={intent} player={player} session={session} pending={pending} />}
    </EntryGate>
  );
}

/** A game on its own: from its catalog card, a share link, or "Chơi với máy" in a rooms lobby. */
function Launcher({
  intent,
  player,
  session,
  pending,
}: {
  intent: EntryIntent;
  player: Player;
  session: PlayingSession;
  pending: ReturnType<typeof gameEntry.take>;
}) {
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
    game?.rooms && !shell
      ? ({ to: '/play/$gameId/rooms', params: { gameId } } as const)
      : ({ to: '/play' } as const);

  // Leaving through the hub's bar is confirmed: the bar sits right above the game, and touch adjustment on phones
  // snaps taps near the top edge of the game onto it. A child must not be thrown out of a round by a stray tap. A
  // shell game has no bar; its "Về Tò He" is a choice made in its menu, so it leaves at once.
  const [confirmingExit, setConfirmingExit] = useState(false);
  const paused = useRef<HostHandle | null>(null);
  const keepPlaying = () => {
    setConfirmingExit(false);
    paused.current?.resume();
  };

  // The game is open, or not in this profile's catalog: either way the intent that led here is over.
  const settled = Boolean(game && gamesOrigin) || (games.isSuccess && !game);
  useEffect(() => {
    if (settled) entry.reached({ kind: 'play', code: gameId });
  }, [settled, gameId]);

  if (games.isSuccess && !game) {
    // A child's catalog lists only the games for its age (ADR 0043, 0044 step 6): said as such, not as "not found".
    if (player.kind === 'child') return <DeadEnd reason="not-for-profile" child />;
    return <Message text={t('gameNotFound')} back={t('backToGames')} />;
  }
  if (!game || !gamesOrigin) return <div className="fixed inset-0 bg-page" />;

  // The game's own level (ADR 0045): asked of the player before it opens, as any entry's.
  const level = playLevel(game);
  const frame = (playing: Player, at: PlayingSession) => (
    <GameFrame
      game={game}
      gamesOrigin={gamesOrigin}
      player={playing}
      session={at}
      entry={pending?.entry ?? null}
      // "Đã đăng nhập — đang mở lại…" only when signing in did make this an account's session.
      reopened={pending?.reopen === true && at.status === 'account'}
      onExit={(host) => {
        if (shell) {
          leaveTo(back);
          return;
        }
        paused.current = host;
        setConfirmingExit(true);
      }}
    />
  );

  return (
    <>
      {level === 'any' ? (
        frame(player, session)
      ) : (
        <EntryGate intent={intent} level={level}>
          {(playing, at) => frame(playing, at)}
        </EntryGate>
      )}
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
          to="/play"
          className="rounded-2xl bg-brand px-5 py-3 font-bold text-on-brand text-xl active:bg-brand-strong"
        >
          {back}
        </BackLink>
      </div>
    </main>
  );
}
