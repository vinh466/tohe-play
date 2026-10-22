// A game's name and description in the hub's language (ADR 0048): its words in that language when it has them, else
// its standard ones. The hub's language is its setting, else the page it came from, else the browser's (i18n.ts).
import { gameDescription, gameName, type PerLanguage } from '@tohe/contract';
import i18n from '../i18n.ts';

interface Named {
  name: string;
  /** Absent from a catalog cached before the API returned it. */
  names?: PerLanguage | null;
}

interface Described {
  description: string;
  descriptions?: PerLanguage | null;
}

/** The game's name in the hub's language. */
export const nameOf = (game: Named, language = i18n.language) => gameName(game, language);

/**
 * The games in the order a reader of `language` expects: by the name shown to them, in that language's alphabet — a
 * Vietnamese reader does not get the English names' order.
 */
export function byShownName<T extends Named>(games: readonly T[], language = i18n.language): T[] {
  const collator = new Intl.Collator(language, { sensitivity: 'base', numeric: true });
  return [...games].sort((a, b) => collator.compare(gameName(a, language), gameName(b, language)));
}

/** The game's description in the hub's language. */
export const descriptionOf = (game: Described, language = i18n.language) => gameDescription(game, language);

/** The game's name as a resolved link carries it (ADR 0044), in the hub's language; null when it is not listed. */
export const linkGameName = (
  link: { gameName?: string | null; gameNames?: PerLanguage | null },
  language = i18n.language,
): string | null =>
  link.gameName ? gameName({ name: link.gameName, names: link.gameNames }, language) : null;
