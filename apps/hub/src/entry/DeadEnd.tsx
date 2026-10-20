import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { BackLink } from '../navigation/leave.tsx';
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
  return (
    <Screen narrow>
      <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 text-center shadow-sm">
        <h1 className="font-black text-2xl text-brand-ink">{t(screen.title)}</h1>
        <p className="text-ink">{t(screen.body, { game })}</p>
        {screen.toGame && gameId ? (
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
