// The build's language rules (ADR 0047), as pure functions of the sitemap and of a page's HTML, so a test can break a
// page on purpose and see each rule fail (language-rules.test.ts). check-build.ts runs them on every page it built.
//  - pairs: every page the sitemap lists has its pair in the other language, but the pages declared Vietnamese-only
//    (`vietnameseOnlyPages` in @tohe/routes) — exactly those, and they have no English page;
//  - a page says its language: `<html lang>` is the language of its path, `og:locale` is that language's, and
//    `og:locale:alternate` names the other language when the page has a pair (and is absent when it has none);
//  - its canonical link is the page itself;
//  - its structured data is in its language: at least one JSON-LD block, each with the page's `inLanguage` (an
//    Organization is no text and has none);
//  - its links stay in its language: a link to a public page of the other language says so (`hreflang`) — the
//    switch, and an English page's links to the Vietnamese-only terms and privacy notice — and the switch leads to the
//    page's pair;
//  - a page's links into the app carry `?lang=` with the page's own language (`?lang=vi` on a Vietnamese page).
import { languageOfPath, matchHubPath, pairOf, pathInLanguage, vietnameseOnlyPages } from '@tohe/routes';
import { APP_LANGUAGE_QUERY, ogLocales, otherLanguage } from '../src/i18n.ts';

/** Every page of the sitemap has its pair listed, but the Vietnamese-only ones, which are listed and stand alone. */
export function pairProblems(
  sitemap: readonly string[],
  vietnameseOnly: readonly string[] = vietnameseOnlyPages,
): string[] {
  const problems: string[] = [];
  const listed = new Set(sitemap);
  for (const path of vietnameseOnly) {
    if (!listed.has(path) || languageOfPath(path) !== 'vi') {
      problems.push(`${path} is declared Vietnamese-only and is no Vietnamese page of the sitemap`);
    } else if (listed.has(pathInLanguage(path, 'en'))) {
      problems.push(`${path} is declared Vietnamese-only and has an English page`);
    }
  }
  for (const path of sitemap) {
    const pair = pairOf(path, vietnameseOnly);
    if (pair !== undefined && !listed.has(pair)) {
      problems.push(
        `${path} has no ${languageOfPath(pair) === 'en' ? 'English' : 'Vietnamese'} page (${pair})`,
      );
    }
  }
  return problems;
}

const attribute = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

/** The rules one page must keep about its language; `hubUrl` without its closing slash. */
export function languageProblems(
  page: string,
  html: string,
  hubUrl: string,
  vietnameseOnly: readonly string[] = vietnameseOnlyPages,
): string[] {
  const problems: string[] = [];
  const lang = languageOfPath(page);
  const other = otherLanguage(lang);
  const pair = pairOf(page, vietnameseOnly);

  const htmlLang = /<html\b[^>]*\slang="([^"]*)"/.exec(html)?.[1];
  if (htmlLang !== lang) problems.push(`${page}: <html lang="${htmlLang ?? ''}">, not "${lang}"`);

  const metas = (property: string) =>
    [...html.matchAll(/<meta\b[^>]*>/g)]
      .map(([tag]) => tag)
      .filter((tag) => attribute(tag, 'property') === property)
      .map((tag) => attribute(tag, 'content') ?? '');
  const locales = metas('og:locale');
  if (locales.length !== 1 || locales[0] !== ogLocales[lang]) {
    problems.push(`${page}: og:locale is "${locales.join(', ')}", not "${ogLocales[lang]}"`);
  }
  const alternates = metas('og:locale:alternate');
  const wanted = pair === undefined ? [] : [ogLocales[other]];
  if (alternates.join(', ') !== wanted.join(', ')) {
    problems.push(
      `${page}: og:locale:alternate is "${alternates.join(', ')}", not "${wanted.join(', ')}"${pair === undefined ? ' (the page has no pair)' : ''}`,
    );
  }

  const canonical = [...html.matchAll(/<link\b[^>]*>/g)]
    .map(([tag]) => tag)
    .filter((tag) => attribute(tag, 'rel') === 'canonical')
    .map((tag) => attribute(tag, 'href'));
  if (canonical.length !== 1 || canonical[0] !== `${hubUrl}${page}`) {
    problems.push(`${page}: the canonical link is "${canonical.join(', ')}", not "${hubUrl}${page}"`);
  }

  const blocks = [
    ...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
  ].flatMap(([, body = '']) => {
    try {
      return [JSON.parse(body) as Record<string, unknown>];
    } catch {
      return []; // check-build reports a block that is not JSON.
    }
  });
  if (blocks.length === 0) problems.push(`${page}: no JSON-LD`);
  for (const block of blocks) {
    if (block['@type'] === 'Organization') continue;
    if (block.inLanguage !== lang) {
      problems.push(
        `${page}: JSON-LD ${String(block['@type'])} has inLanguage "${String(block.inLanguage ?? '')}", not "${lang}"`,
      );
    }
  }

  let switchFound = pair === undefined;
  for (const [tag] of html.matchAll(/<a\b[^>]*>/g)) {
    const href = attribute(tag, 'href') ?? '';
    if (!href.startsWith('/')) continue;
    const [path = '', query = ''] = href.replace(/&amp;/g, '&').split('#')[0]?.split('?') ?? [];
    const namespace = matchHubPath(path);
    if (namespace?.component === 'public' && namespace.indexed) {
      const target = languageOfPath(path);
      const hreflang = attribute(tag, 'hreflang');
      if (target !== lang && hreflang !== target) {
        problems.push(`${page}: a link to ${path}, a page in another language, without hreflang="${target}"`);
      }
      if (path === pair && hreflang === other) switchFound = true;
    }
    if (namespace?.component === 'app' && namespace.served === 'page') {
      if (new URLSearchParams(query).get(APP_LANGUAGE_QUERY) !== lang) {
        problems.push(`${page}: a link into the app, ${href}, without ?${APP_LANGUAGE_QUERY}=${lang}`);
      }
    }
  }
  if (!switchFound)
    problems.push(`${page}: no link to its pair ${pair} with hreflang="${other}" (the switch)`);
  return problems;
}
