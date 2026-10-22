// The app's language (ADR 0047, docs/architecture/surfaces.md "Languages"): Vietnamese or English, in this order —
// its own setting (Tôi → Ngôn ngữ), kept under the same key as the public pages' VI | EN switch, so a choice made on
// either side holds for both; then `?lang=` of the address the app was opened with (an English public page's links
// carry `?lang=en`); then the browser (`vi…` → Vietnamese, anything else → English); then Vietnamese. Pure functions
// here; i18n.ts applies the result.
import { pairOf } from '@tohe/routes';

/** The `localStorage` key the public pages' switch writes too (apps/web/src/scripts/language.ts). */
export const LANGUAGE_KEY = 'tohe:language';

/** The query parameter an English public page's links into the app carry (`appPath` in apps/web/src/i18n.ts). */
export const LANGUAGE_QUERY = 'lang';

export const languages = ['vi', 'en'] as const;
export type Language = (typeof languages)[number];

const isLanguage = (value: unknown): value is Language => value === 'vi' || value === 'en';

/** The app's language, from what it was given, in the order above. */
export function chooseLanguage({
  saved,
  query,
  browser,
}: {
  /** The remembered choice (`tohe:language`), if any. */
  saved: string | null | undefined;
  /** `?lang=` of the address the app was opened with, if any. */
  query: string | null | undefined;
  /** The browser's languages, most wanted first (`navigator.languages`). */
  browser: readonly string[];
}): Language {
  if (isLanguage(saved)) return saved;
  if (isLanguage(query)) return query;
  const first = browser.find((language) => language.trim() !== '');
  if (first === undefined) return 'vi';
  return first.trim().toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

/** The remembered choice, or null when there is none or storage is blocked. */
export function savedLanguage(storage: Pick<Storage, 'getItem'> | undefined): Language | null {
  try {
    const value = storage?.getItem(LANGUAGE_KEY);
    return isLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

/** Remembers a choice; with storage blocked it holds for this visit only. */
export function saveLanguage(storage: Pick<Storage, 'setItem'> | undefined, language: Language): void {
  try {
    storage?.setItem(LANGUAGE_KEY, language);
  } catch {
    // Nothing to keep it in.
  }
}

/** This origin's localStorage, or undefined where reading it throws (storage blocked). */
export function localStorageOrNothing(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * A public page (`/faq/`, `/terms/`…) in the app's language: its English page under /en/ when it has one, else the
 * Vietnamese page, which `vietnameseOnly` then says (the terms and the privacy notice, for now).
 */
export function publicPage(path: string, language: Language): { href: string; vietnameseOnly: boolean } {
  if (language === 'vi') return { href: path, vietnameseOnly: false };
  const english = pairOf(path);
  return english === undefined
    ? { href: path, vietnameseOnly: true }
    : { href: english, vietnameseOnly: false };
}

/** The language the app starts in, read from this page's address, storage and browser. */
export function startingLanguage(): Language {
  const browser = globalThis.navigator;
  return chooseLanguage({
    saved: savedLanguage(localStorageOrNothing()),
    query: new URLSearchParams(globalThis.location?.search ?? '').get(LANGUAGE_QUERY),
    browser: browser?.languages?.length ? browser.languages : [browser?.language ?? ''],
  });
}
