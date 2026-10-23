// What every public page shares: the hub's and the docs host's URLs, the navigation, the language switch and the
// footer, in both languages (ADR 0047). The words of each page are in the file beside this one that carries its name
// (home.ts, games.ts, install.ts, faq.ts, about.ts); each holds a Vietnamese text and an English one of the same shape.
import type { Lang } from '../i18n.ts';

/**
 * Where this page is, and where the developer docs are, are decided where the image runs, not where it was built
 * (ADR 0021): the image's build writes placeholders and the hub's Caddy fills in TOHE_HUB_URL and TOHE_DOCS_URL.
 */
export const hubUrl = (process.env.TOHE_HUB_URL ?? 'http://localhost:4720').replace(/\/$/, '');
export const docsUrl = (process.env.TOHE_DOCS_URL ?? 'http://localhost:4710').replace(/\/$/, '');

/** An absolute URL on the hub's host, for canonical links, Open Graph, JSON-LD and llms.txt. */
export const absolute = (path: string): string => `${hubUrl}${path}`;

export const site = {
  name: 'Tò He',
  email: 'hello@toheplay.io.vn',
  github: 'https://github.com/vinh466/tohe-play',
  /** The picture every link preview shows: 1200×630, made by `pnpm --filter @tohe/web generate:og`. */
  ogImage: { path: '/og.png', width: 1200, height: 630 },
};

const vi = {
  /** Under the name in a game's link-preview picture (generate:og): the same line as the home page's. */
  tagline: 'Mấy trò chơi nhỏ cho cả nhà',
  imageAlt: 'Tò He: mấy trò chơi nhỏ cho cả nhà',
  home: 'trang chủ',
  /** The header's button into the app: for a newcomer, and for a device that has opened a game (returning.js). */
  play: 'Chơi ngay',
  continue: 'Chơi tiếp',
  skip: 'Bỏ qua phần đầu trang',
  navLabel: 'Các trang chính',
  themeLabel: 'Giao diện',
  /** Three items: a fourth wrapped onto a line of its own on a 360 px phone; About is in the footer. The paths are the Vietnamese ones; an English page's are the same under /en/. */
  nav: [
    { label: 'Trò chơi', path: '/games/' },
    { label: 'Hướng dẫn', path: '/guides/' },
    { label: 'Hỏi đáp', path: '/faq/' },
  ],
  /** The light/dark buttons in the footer: a drawn icon (src/layouts/ThemeIcon.astro) and the word. */
  themes: [
    { choice: 'light', label: 'Sáng' },
    { choice: 'dark', label: 'Tối' },
    { choice: 'system', label: 'Theo máy' },
  ],
  /** The VI | EN switch in the header. */
  switch: { label: 'Ngôn ngữ' },
  footer: {
    line: 'Tò He là dự án của một gia đình, không quảng cáo.',
    about: 'Giới thiệu',
    promise: 'Lời hứa của Tò He',
    install: 'Cài ra màn hình chính',
    terms: 'Điều khoản',
    privacy: 'Quyền riêng tư',
    docs: 'Làm game? Tài liệu (tiếng Anh)',
    github: 'GitHub',
  },
};

export type SiteWords = typeof vi;

const en: SiteWords = {
  tagline: 'Small games for the whole family',
  imageAlt: 'Tò He: small games for the whole family',
  home: 'home',
  play: 'Play now',
  continue: 'Continue',
  skip: 'Skip to the content',
  navLabel: 'Main pages',
  themeLabel: 'Appearance',
  nav: [
    { label: 'Games', path: '/games/' },
    { label: 'Guides', path: '/guides/' },
    { label: 'FAQ', path: '/faq/' },
  ],
  themes: [
    { choice: 'light', label: 'Light' },
    { choice: 'dark', label: 'Dark' },
    { choice: 'system', label: 'Auto' },
  ],
  switch: { label: 'Language' },
  footer: {
    line: 'Tò He is a family project, with no ads.',
    about: 'About',
    promise: 'Our promise',
    install: 'Add to your home screen',
    // The terms and the privacy notice have no English text yet (ADR 0047): the links say so.
    terms: 'Terms (in Vietnamese)',
    privacy: 'Privacy (in Vietnamese)',
    docs: 'Making games? Developer docs',
    github: 'GitHub',
  },
};

export const siteWords: Record<Lang, SiteWords> = { vi, en };

/** The names in the VI | EN switch: short on the button, in full for screen readers, each in its own language. */
export const languageNames: Record<Lang, { short: string; full: string }> = {
  vi: { short: 'VI', full: 'Tiếng Việt' },
  en: { short: 'EN', full: 'English' },
};

/** The suggestion a Vietnamese page shows a reader whose browser is not in Vietnamese: in English, for them. */
export const suggestion = {
  text: 'View in English →',
  stay: 'Stay in Vietnamese',
};

/**
 * The EN button's name on a page with no English text yet (the Vietnamese-only terms and privacy notice): it leads to
 * the English home page and says why. In English, like the button.
 */
export const noEnglishPage = 'English home page. This page is in Vietnamese only.';

/** The word before the day a page's words were last revised (src/views/UpdatedOn.astro). */
export const updatedWord: Record<Lang, string> = { vi: 'Cập nhật', en: 'Updated' };

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** A day written YYYY-MM-DD, as a reader of `lang` writes it: 22/10/2026, 22 October 2026. */
export function formatDay(day: string, lang: Lang): string {
  const [year = '', month = '', date = ''] = day.split('-');
  return lang === 'vi' ? `${date}/${month}/${year}` : `${Number(date)} ${months[Number(month) - 1]} ${year}`;
}
