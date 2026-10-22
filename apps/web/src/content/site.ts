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
  tagline: 'Game nhỏ, mở ra là chơi',
  imageAlt: 'Tò He — game nhỏ, mở ra là chơi',
  home: 'trang chủ',
  skip: 'Bỏ qua phần đầu trang',
  navLabel: 'Các trang chính',
  themeLabel: 'Giao diện',
  /** The paths are the Vietnamese ones; an English page's are the same under /en/. */
  nav: [
    { label: 'Trò chơi', path: '/games/' },
    { label: 'Hướng dẫn', path: '/guides/' },
    { label: 'Hỏi đáp', path: '/faq/' },
    { label: 'Giới thiệu', path: '/about/' },
  ],
  themes: [
    { choice: 'system', icon: '🌗', label: 'Theo máy' },
    { choice: 'light', icon: '☀️', label: 'Sáng' },
    { choice: 'dark', icon: '🌙', label: 'Tối' },
  ],
  /** The VI | EN switch in the header. */
  switch: { label: 'Ngôn ngữ' },
  footer: {
    line: 'Tò He · dự án gia đình, không quảng cáo',
    terms: 'Điều khoản',
    privacy: 'Quyền riêng tư',
    docs: 'Tài liệu kỹ thuật (tiếng Anh)',
    github: 'GitHub',
  },
};

export type SiteWords = typeof vi;

const en: SiteWords = {
  tagline: 'Small games, open and play',
  imageAlt: 'Tò He — small games, open and play',
  home: 'home',
  skip: 'Skip to the content',
  navLabel: 'Main pages',
  themeLabel: 'Appearance',
  nav: [
    { label: 'Games', path: '/games/' },
    { label: 'Guides', path: '/guides/' },
    { label: 'FAQ', path: '/faq/' },
    { label: 'About', path: '/about/' },
  ],
  themes: [
    { choice: 'system', icon: '🌗', label: 'Follow the device' },
    { choice: 'light', icon: '☀️', label: 'Light' },
    { choice: 'dark', icon: '🌙', label: 'Dark' },
  ],
  switch: { label: 'Language' },
  footer: {
    line: 'Tò He · a family project, no ads',
    // The terms and the privacy notice have no English text yet (ADR 0047): the links say so.
    terms: 'Terms (in Vietnamese)',
    privacy: 'Privacy (in Vietnamese)',
    docs: 'Developer docs',
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
export const noEnglishPage = 'English home page — this page is in Vietnamese only';
