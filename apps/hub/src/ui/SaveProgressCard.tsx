import { Link } from '@tanstack/react-router';
import { useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { installStore } from '../install/install.ts';
import { dismiss, dismissedRecently, readDismissed } from '../session/signInNudge.ts';
import { Button, buttonClass } from '../ui/Button.tsx';

/**
 * After the first finished game, a device profile is offered an account that keeps its score (ADR 0057, D-05). It
 * never blocks a game, and "Để sau" keeps it quiet for seven days. When the install card already took this visit's one
 * offer, this waits for the next one.
 */
export function SaveProgressCard() {
  const { t } = useTranslation();
  const finished = useSyncExternalStore(installStore.subscribe, () => installStore.snapshot().finishedGame);
  const installShown = useSyncExternalStore(
    installStore.subscribe,
    () => installStore.snapshot().shownThisVisit,
  );
  const [dismissed, setDismissed] = useState(() => dismissedRecently(readDismissed(), Date.now()));
  if (!finished || installShown || dismissed) return null;
  return (
    <section
      aria-labelledby="save-progress-title"
      className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-sm"
    >
      <h2 id="save-progress-title" className="font-bold text-ink text-xl">
        {t('saveProgress.title')}
      </h2>
      <p className="text-ink-soft">{t('saveProgress.body')}</p>
      <div className="flex flex-wrap gap-2">
        <Link to="/account/register" className={buttonClass('primary')}>
          {t('saveProgress.signUp')}
        </Link>
        <Button
          variant="ghost"
          onClick={() => {
            dismiss();
            setDismissed(true);
          }}
        >
          {t('saveProgress.later')}
        </Button>
      </div>
    </section>
  );
}
