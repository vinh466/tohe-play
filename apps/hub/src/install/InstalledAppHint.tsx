import { createContext, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { isIos, readEnvironment } from './install.ts';

/**
 * The code of the entry page being shown (`/r/…`, `/s/…`), formatted as a person types it: the screens of an entry page
 * offer it to whoever has the app installed. Null elsewhere.
 */
export const EntryCodeContext = createContext<string | null>(null);

/**
 * Whether an entry page says how to open the link in the installed app: on an iPhone or an iPad, outside the app. A link
 * there opens in Safari (or a chat app's browser), whose storage the installed app does not share, and no
 * `launch_handler` hands it over (ADR 0046).
 */
export function showsInstalledAppHint(env: { standalone: boolean }, ios: boolean): boolean {
  return ios && !env.standalone;
}

/** "Đã cài app Tò He? Mở app → Nhập mã 482 913": one line at the top of an entry page's screens. */
export function InstalledAppHint() {
  const { t } = useTranslation();
  const code = useContext(EntryCodeContext);
  if (
    !code ||
    !showsInstalledAppHint(readEnvironment(), isIos(navigator.userAgent, navigator.maxTouchPoints))
  )
    return null;
  return (
    <p className="rounded-2xl bg-soft px-4 py-2 text-center text-ink text-sm">
      {t('entry.installedApp', { code })}
    </p>
  );
}
