// What every public page shares: the hub's and the docs host's URLs, the navigation and the footer. The words of each
// page are in the file beside this one that carries its name (home.ts, games.ts, install.ts, faq.ts, about.ts).

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
  tagline: 'Game nhỏ, mở ra là chơi',
  email: 'hello@toheplay.io.vn',
  github: 'https://github.com/vinh466/tohe-play',
  /** The picture every link preview shows: 1200×630, made by `pnpm --filter @tohe/web generate:og`. */
  ogImage: { path: '/og.png', width: 1200, height: 630, alt: 'Tò He — game nhỏ, mở ra là chơi' },
  skip: 'Bỏ qua phần đầu trang',
  navLabel: 'Các trang chính',
  themeLabel: 'Giao diện',
  nav: [
    { label: 'Trò chơi', href: '/games/' },
    { label: 'Hướng dẫn', href: '/guides/' },
    { label: 'Hỏi đáp', href: '/faq/' },
    { label: 'Giới thiệu', href: '/about/' },
  ],
  themes: [
    { choice: 'system', icon: '🌗', label: 'Theo máy' },
    { choice: 'light', icon: '☀️', label: 'Sáng' },
    { choice: 'dark', icon: '🌙', label: 'Tối' },
  ],
  footer: {
    line: 'Tò He · dự án gia đình, không quảng cáo',
    terms: 'Điều khoản',
    privacy: 'Quyền riêng tư',
    docs: 'Tài liệu kỹ thuật (tiếng Anh)',
    github: 'GitHub',
  },
};
