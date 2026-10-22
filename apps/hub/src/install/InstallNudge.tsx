import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { funnel } from '../telemetry/telemetry.ts';
import { Button } from '../ui/Button.tsx';
import { copyText } from '../ui/copyText.ts';
import { Modal } from '../ui/Modal.tsx';
import { chooseInstall, type InstallVariant, installStore } from './install.ts';

/** Which way to install fits now (see `chooseInstall`), following what the browser and the player did. */
export function useInstallVariant(trigger: 'auto' | 'menu'): InstallVariant | null {
  const state = useSyncExternalStore(installStore.subscribe, installStore.snapshot);
  return chooseInstall({ ...state, trigger, now: Date.now() });
}

/** True when running as the installed app: there is nothing to install, and Tôi offers nothing. */
export function useStandalone(): boolean {
  return useSyncExternalStore(installStore.subscribe, installStore.snapshot).env.standalone;
}

/**
 * After the first finished game, once per visit, the way to install that fits: a card on Android, Chrome and Edge, the
 * steps of iOS in a sheet on iPhone and iPad. Shown on the catalog, where a round ends up — not over a game.
 */
export function InstallNudge() {
  const wanted = useInstallVariant('auto');
  const [offer, setOffer] = useState<InstallVariant | null>(null);

  // Once on screen, it stays until the player answers, though "once per visit" is spent.
  useEffect(() => {
    if (wanted && wanted !== 'open-in-browser' && offer === null) {
      setOffer(wanted);
      installStore.shown();
      funnel.installOffered(wanted);
    }
  }, [wanted, offer]);

  const { t } = useTranslation();
  const answer = () => {
    installStore.dismiss();
    setOffer(null);
  };

  if (offer === 'prompt') {
    return (
      <section
        aria-labelledby="install-title"
        className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-sm"
      >
        <h2 id="install-title" className="font-bold text-ink text-xl">
          {t('install.title')}
        </h2>
        <p className="text-ink-soft">{t('install.body')}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setOffer(null);
              void installStore.prompt();
            }}
          >
            {t('install.action')}
          </Button>
          <Button variant="ghost" onClick={answer}>
            {t('install.later')}
          </Button>
        </div>
      </section>
    );
  }
  if (offer === 'ios') {
    return (
      <Modal open title={t('install.title')} onClose={answer}>
        <InstallPanel variant="ios" onDone={answer} />
      </Modal>
    );
  }
  return null;
}

/**
 * The in-app browsers of Zalo, Messenger, Facebook and Instagram cannot install, and keep nothing a link began (ADR
 * 0044): on arrival — every screen, a link's entry included — a strip says to open the browser, without blocking.
 */
export function InAppStrip() {
  const { t } = useTranslation();
  const variant = useInstallVariant('auto');
  const inApp = installStore.snapshot().env.inApp;
  useEffect(() => {
    if (variant === 'open-in-browser') funnel.installOffered('open-in-browser');
  }, [variant]);
  if (variant !== 'open-in-browser') return null;
  return (
    <section
      aria-label={t('install.inApp.title')}
      className="flex items-start gap-3 rounded-2xl bg-notice px-4 py-3 text-notice-ink text-sm"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <InAppContent zalo={inApp === 'zalo'} />
      </div>
      <button
        type="button"
        onClick={() => installStore.dismiss()}
        aria-label={t('install.inApp.dismiss')}
        className="grid size-8 shrink-0 place-items-center rounded-full active:scale-95"
      >
        ✕
      </button>
    </section>
  );
}

function InAppContent({ zalo }: { zalo: boolean }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <>
      <p className="font-bold">{t('install.inApp.title')}</p>
      <p>{zalo ? t('install.inApp.zalo') : t('install.inApp.other')}</p>
      <div>
        <button
          type="button"
          onClick={() => void copyText(window.location.href).then(setCopied)}
          className="rounded-full bg-surface px-4 py-1.5 font-bold text-ink active:scale-95"
        >
          {copied ? t('install.inApp.copied') : t('install.inApp.copy')}
        </button>
      </div>
    </>
  );
}

/** "Cài app" in Tôi: the sheet or the prompt, any time, whatever was said before. */
export function InstallSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const { t } = useTranslation();
  const variant = useInstallVariant('menu');
  return (
    <Modal open={open} title={t('install.title')} onClose={onClose}>
      {variant ? <InstallPanel variant={variant} onDone={onClose} /> : null}
    </Modal>
  );
}

/** What a way of installing says and offers; the same in the nudge and in Tôi. */
function InstallPanel({ variant, onDone }: { variant: InstallVariant; onDone(): void }) {
  const { t } = useTranslation();
  const inApp = installStore.snapshot().env.inApp;
  switch (variant) {
    case 'prompt':
      return (
        <div className="flex flex-col gap-4">
          <p className="text-ink">{t('install.body')}</p>
          <Button
            onClick={() => {
              onDone();
              void installStore.prompt();
            }}
          >
            {t('install.action')}
          </Button>
        </div>
      );
    case 'ios':
      return (
        <div className="flex flex-col gap-4">
          <p className="text-ink">{t('install.iosIntro')}</p>
          <ol className="flex list-decimal flex-col gap-2 pl-6 text-ink">
            {(['iosStep1', 'iosStep2', 'iosStep3', 'iosStep4'] as const).map((step) => (
              <li key={step}>{t(`install.${step}`)}</li>
            ))}
          </ol>
          {/* Safari and the installed app keep apart what they store: a device profile does not follow (ADR 0043). */}
          <p className="rounded-2xl bg-notice px-4 py-3 text-notice-ink text-sm">{t('install.iosNote')}</p>
          <Button onClick={onDone}>{t('install.iosDone')}</Button>
        </div>
      );
    case 'open-in-browser':
      return (
        <div className="flex flex-col gap-2 rounded-2xl bg-notice px-4 py-3 text-notice-ink">
          <InAppContent zalo={inApp === 'zalo'} />
        </div>
      );
    case 'generic':
      return <p className="text-ink">{t('install.generic')}</p>;
  }
}
