import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { gamesQuery } from '../api/queries.ts';
import { EntryCodeContext } from '../install/InstalledAppHint.tsx';
import { BackLink } from '../navigation/leave.tsx';
import { useSession } from '../session/useSession.ts';
import { Button, buttonClass } from '../ui/Button.tsx';
import { Screen } from '../ui/Screen.tsx';
import { type DeadEndReason, deadEndScreen } from './deadEnds.ts';
import { EnterCodeForm } from './EnterCode.tsx';

/** A dead end with its ways out: the catalog always; the "Nhập mã" box or the game's menu, as the reason allows. */
export function DeadEnd({
  reason,
  gameId,
  gameName,
  child = false,
}: {
  reason: DeadEndReason;
  gameId?: string | null;
  gameName?: string | null;
  child?: boolean;
}) {
  const { t } = useTranslation();
  const screen = deadEndScreen(reason, { id: gameId, name: gameName }, child);
  const game = gameName ?? '';
  // "Chơi {game}" only when the game is in the catalog of whoever plays here — a child's lists only the games for its
  // age, and a game may have left the catalog since the link was made.
  const session = useSession();
  const playerId =
    session.status === 'account' || session.status === 'device' ? (session.player?.id ?? null) : null;
  const catalog = useQuery({ ...gamesQuery(playerId), enabled: screen.toGame && Boolean(gameId) });
  const playable = Boolean(gameId) && Boolean(catalog.data?.some((listed) => listed.id === gameId));
  // A link that leads nowhere does not lead anywhere in the installed app either: no "Đã cài app?" line here.
  return (
    <EntryCodeContext.Provider value={null}>
      <Screen narrow>
        <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 text-center shadow-sm">
          <h1 className="font-black text-2xl text-brand-ink">{t(screen.title)}</h1>
          <p className="text-ink">{t(screen.body, { game })}</p>
          {screen.toGame && gameId && playable ? (
            <Link to="/play/$gameId" params={{ gameId }} replace className={buttonClass()}>
              {t('entry.toGame', { game: game || gameId })}
            </Link>
          ) : null}
        </section>
        {screen.codeBox ? (
          <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-sm">
            <h2 className="font-bold text-ink text-xl">{t('entry.codeTitle')}</h2>
            <EnterCodeForm />
          </section>
        ) : null}
        <BackLink to="/play" className="text-center font-semibold text-accent">
          {t('entry.toCatalog')}
        </BackLink>
      </Screen>
    </EntryCodeContext.Provider>
  );
}

/** A request that failed on the way — offline, or too many at once: said in words, with another try. */
export function EntryTrouble({ message, onRetry }: { message: string; onRetry(): void }) {
  const { t } = useTranslation();
  return (
    <Screen narrow>
      <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-center text-danger">
        {message}
      </p>
      <Button onClick={onRetry}>{t('named.retry')}</Button>
      <BackLink to="/play" className="text-center font-semibold text-accent">
        {t('entry.toCatalog')}
      </BackLink>
    </Screen>
  );
}
