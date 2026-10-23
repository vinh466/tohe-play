// The VI | EN switch and the suggestion to read in English (ADR 0047, docs/architecture/surfaces.md). Both are plain
// links that work without this script; it remembers the reader's choice and, on a Vietnamese page, shows the
// suggestion to the readers it is for. Never a redirect. The page's CSP allows no inline script: Page.astro imports
// this file, which the build writes under /_web/.
//
// The choice lives in this origin's localStorage under one key, LANGUAGE_KEY, `vi` or `en`. The app reads the same key
// for its language setting (Me → Language): a choice made here is kept for the app too.

export const LANGUAGE_KEY = 'tohe:language';

export type Choice = 'vi' | 'en';

/** The remembered choice, or undefined when there is none or storage is blocked. */
export function readChoice(storage: Pick<Storage, 'getItem'> | undefined): Choice | undefined {
  try {
    const value = storage?.getItem(LANGUAGE_KEY);
    return value === 'vi' || value === 'en' ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Remembers a choice; with storage blocked (private mode, cookies off) the links still work, unremembered. */
export function saveChoice(storage: Pick<Storage, 'setItem'> | undefined, choice: Choice): void {
  try {
    storage?.setItem(LANGUAGE_KEY, choice);
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
 * Whether a Vietnamese page suggests its English one: when the reader chose English, or made no choice and the
 * browser's first language is not Vietnamese. A reader who chose Vietnamese is left alone.
 */
export function suggestsEnglish(choice: Choice | undefined, browserLanguages: readonly string[]): boolean {
  if (choice !== undefined) return choice === 'en';
  const first = browserLanguages[0];
  return first !== undefined && first !== '' && !first.toLowerCase().startsWith('vi');
}

/** Wires up the page: every `[data-language]` link or button remembers its language; the suggestion shows if it should. */
export function startLanguage(
  document: Document,
  storage: Storage | undefined,
  browserLanguages: readonly string[],
): void {
  for (const element of document.querySelectorAll<HTMLElement>('[data-language]')) {
    element.addEventListener('click', () => {
      const choice = element.dataset.language;
      if (choice === 'vi' || choice === 'en') saveChoice(storage, choice);
    });
  }
  const suggestion = document.querySelector<HTMLElement>('[data-language-suggestion]');
  if (suggestion === null) return;
  if (suggestsEnglish(readChoice(storage), browserLanguages)) suggestion.hidden = false;
  suggestion.querySelector('button')?.addEventListener('click', () => {
    suggestion.hidden = true;
  });
}
