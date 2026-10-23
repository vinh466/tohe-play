// The languages of the public pages (ADR 0047, docs/architecture/hosts-and-paths.md): Vietnamese is the face, at the
// root with the URLs already indexed; English is the support, the same pages under /en/ with the same route names. The
// sitemap pairs them with hreflang alternates; apps/web's build checks that every page has its pair.

/** The public pages' languages, the one without a prefix first. */
export const publicLanguages = ['vi', 'en'] as const;
export type PublicLanguage = (typeof publicLanguages)[number];

/** The language of the pages at the root, without a prefix. */
export const defaultPublicLanguage: PublicLanguage = 'vi';

/** Where the English pages live: `/en/`, then the Vietnamese page's own path (`/en/games/<id>/`). */
export const englishPrefix = '/en';

/** The page a reader of neither language is sent to (`x-default`): English is read more widely. */
export const xDefaultLanguage: PublicLanguage = 'en';

/**
 * The public pages that exist in Vietnamese only, with no English page and so no alternates in the sitemap: the terms
 * of use and the privacy notice, whose English text — with clause ids and a test that keeps the two in step — lands in
 * a later pull request, when the owner syncs the legal texts (ADR 0047). English pages link to them labelled as
 * Vietnamese. apps/web's build allows exactly these pages without a pair and nothing else; **this list empties when the
 * English texts land.**
 */
export const vietnameseOnlyPages: readonly string[] = ['/terms/', '/privacy/'];

/** The language a public page's path is in: English under /en, Vietnamese everywhere else. */
export function languageOfPath(path: string): PublicLanguage {
  return path === englishPrefix || path.startsWith(`${englishPrefix}/`) ? 'en' : 'vi';
}

/** The same page in `language`: `/faq/` ↔ `/en/faq/`, `/` ↔ `/en/`. */
export function pathInLanguage(path: string, language: PublicLanguage): string {
  const from = languageOfPath(path);
  if (from === language) return path;
  return language === 'en' ? `${englishPrefix}${path}` : path.slice(englishPrefix.length) || '/';
}

/**
 * The page's pair in the other language, or undefined for a page declared Vietnamese-only (`vietnameseOnly`). It says
 * where the pair would be, not whether it was built: the sitemap and the build check that.
 */
export function pairOf(
  path: string,
  vietnameseOnly: readonly string[] = vietnameseOnlyPages,
): string | undefined {
  const vietnamese = pathInLanguage(path, 'vi');
  if (vietnameseOnly.includes(vietnamese)) return undefined;
  return pathInLanguage(path, languageOfPath(path) === 'vi' ? 'en' : 'vi');
}
