// The public pages' two languages (ADR 0047): Vietnamese at the root, English under /en/. Which paths pair with which
// comes from @tohe/routes, which also writes the sitemap's hreflang alternates; this file adds what only the pages need.
// Pure, without Astro, so the build check (scripts/check-build.ts) and the tests read the same rules as the pages.
import {
  defaultPublicLanguage,
  languageOfPath,
  type PublicLanguage,
  pairOf,
  pathInLanguage,
  publicLanguages,
} from '@tohe/routes';

export type Lang = PublicLanguage;
export const languages = publicLanguages;
export { languageOfPath, pairOf, pathInLanguage };

/** The other language: the one the switch leads to. */
export const otherLanguage = (lang: Lang): Lang => (lang === 'vi' ? 'en' : 'vi');

/** `og:locale` for each language (Open Graph wants language_TERRITORY). */
export const ogLocales: Record<Lang, string> = { vi: 'vi_VN', en: 'en_US' };

/** Astro's `currentLocale` as one of ours: the page's language under its i18n routing (astro.config.ts). */
export function pageLanguage(currentLocale: string | undefined): Lang {
  const lang = currentLocale ?? defaultPublicLanguage;
  if (!(languages as readonly string[]).includes(lang)) throw new Error(`no such language: ${lang}`);
  return lang as Lang;
}

/** A public page's path in `lang`, from its Vietnamese path: `localPath('en', '/faq/')` is `/en/faq/`. */
export const localPath = (lang: Lang, path: string): string => pathInLanguage(path, lang);

/** The query parameter that carries a public page's language into the app. */
export const APP_LANGUAGE_QUERY = 'lang';

/**
 * A link into the app (`/play…`) from a page in `lang`. An English page's carries `?lang=en`, so the app can start in
 * the language the player came from; a Vietnamese page's carries nothing, Vietnamese being the default. The hub reads
 * it when it has no language setting of its own yet (docs/architecture/surfaces.md, "Languages").
 */
export const appPath = (lang: Lang, path: string): string =>
  lang === defaultPublicLanguage ? path : `${path}?${APP_LANGUAGE_QUERY}=${lang}`;
