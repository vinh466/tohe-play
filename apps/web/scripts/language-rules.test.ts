// Each of the build's language rules fails on a page broken on purpose, and none fails on a page that keeps them.
import { describe, expect, it } from 'vitest';
import { languageProblems, pairProblems } from './language-rules.ts';

const hub = 'https://toheplay.io.vn';

interface Page {
  lang: string;
  locale?: string;
  alternate?: string;
  canonical: string;
  jsonLd: unknown[];
  links: string[];
}

/** A page as the build writes it, with what each test changes. */
const html = ({ lang, locale, alternate, canonical, jsonLd, links }: Page) =>
  [
    `<!DOCTYPE html><html lang="${lang}"><head>`,
    `<link rel="canonical" href="${canonical}">`,
    locale === undefined ? '' : `<meta property="og:locale" content="${locale}">`,
    alternate === undefined ? '' : `<meta property="og:locale:alternate" content="${alternate}">`,
    ...jsonLd.map((data) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`),
    '</head><body>',
    ...links,
    '</body></html>',
  ].join('');

const vietnameseFaq: Page = {
  lang: 'vi',
  locale: 'vi_VN',
  alternate: 'en_US',
  canonical: `${hub}/faq/`,
  jsonLd: [{ '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: 'vi' }],
  links: [
    '<a href="/faq/" hreflang="vi">VI</a>',
    '<a href="/en/faq/" hreflang="en">EN</a>',
    '<a href="/games/">Trò chơi</a>',
    '<a href="/terms/">Điều khoản</a>',
    '<a href="/play?lang=vi">Chơi</a>',
  ],
};

const englishFaq: Page = {
  lang: 'en',
  locale: 'en_US',
  alternate: 'vi_VN',
  canonical: `${hub}/en/faq/`,
  jsonLd: [
    { '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: 'en' },
    { '@context': 'https://schema.org', '@type': 'Organization' },
  ],
  links: [
    '<a href="/faq/" hreflang="vi">VI</a>',
    '<a href="/en/faq/" hreflang="en">EN</a>',
    '<a href="/en/games/">Games</a>',
    '<a href="/terms/" hreflang="vi">Terms (in Vietnamese)</a>',
    '<a href="/play/tien-len?lang=en">Play</a>',
    '<a href="https://docs.toheplay.io.vn/">Developer docs</a>',
  ],
};

const vietnameseTerms: Page = {
  lang: 'vi',
  locale: 'vi_VN',
  canonical: `${hub}/terms/`,
  jsonLd: [{ '@context': 'https://schema.org', '@type': 'WebPage', inLanguage: 'vi' }],
  links: ['<a href="/terms/" hreflang="vi">VI</a>', '<a href="/en/" hreflang="en">EN</a>'],
};

const check = (path: string, page: Page) => languageProblems(path, html(page), hub, ['/terms/']);

describe('a page’s language', () => {
  it('passes a page that keeps every rule, in either language, and a Vietnamese-only page', () => {
    expect(check('/faq/', vietnameseFaq)).toEqual([]);
    expect(check('/en/faq/', englishFaq)).toEqual([]);
    expect(check('/terms/', vietnameseTerms)).toEqual([]);
  });

  it('fails when <html lang> is not the language of the path', () => {
    expect(check('/en/faq/', { ...englishFaq, lang: 'vi' })).toEqual([
      '/en/faq/: <html lang="vi">, not "en"',
    ]);
    expect(check('/faq/', { ...vietnameseFaq, lang: 'en' })).toEqual(['/faq/: <html lang="en">, not "vi"']);
  });

  it('fails when og:locale is missing or another language’s', () => {
    expect(check('/en/faq/', { ...englishFaq, locale: 'vi_VN' })).toEqual([
      '/en/faq/: og:locale is "vi_VN", not "en_US"',
    ]);
    expect(check('/faq/', { ...vietnameseFaq, locale: undefined })).toEqual([
      '/faq/: og:locale is "", not "vi_VN"',
    ]);
  });

  it('fails when og:locale:alternate does not name the pair’s language, or names one a Vietnamese-only page lacks', () => {
    expect(check('/faq/', { ...vietnameseFaq, alternate: undefined })).toEqual([
      '/faq/: og:locale:alternate is "", not "en_US"',
    ]);
    expect(check('/en/faq/', { ...englishFaq, alternate: 'en_US' })).toEqual([
      '/en/faq/: og:locale:alternate is "en_US", not "vi_VN"',
    ]);
    expect(check('/terms/', { ...vietnameseTerms, alternate: 'en_US' })).toEqual([
      '/terms/: og:locale:alternate is "en_US", not "" (the page has no pair)',
    ]);
  });

  it('fails when the canonical link is not the page itself', () => {
    expect(check('/en/faq/', { ...englishFaq, canonical: `${hub}/faq/` })).toEqual([
      `/en/faq/: the canonical link is "${hub}/faq/", not "${hub}/en/faq/"`,
    ]);
  });

  it('fails without JSON-LD, or with JSON-LD in another language', () => {
    expect(check('/faq/', { ...vietnameseFaq, jsonLd: [] })).toEqual(['/faq/: no JSON-LD']);
    expect(
      check('/en/faq/', {
        ...englishFaq,
        jsonLd: [{ '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: 'vi' }],
      }),
    ).toEqual(['/en/faq/: JSON-LD FAQPage has inLanguage "vi", not "en"']);
    expect(
      check('/faq/', {
        ...vietnameseFaq,
        jsonLd: [{ '@context': 'https://schema.org', '@type': 'WebPage' }],
      }),
    ).toEqual(['/faq/: JSON-LD WebPage has inLanguage "", not "vi"']);
  });

  it('fails when a link leads to the other language without saying so', () => {
    expect(
      check('/en/faq/', {
        ...englishFaq,
        links: [...englishFaq.links, '<a href="/games/">Games</a>'],
      }),
    ).toEqual(['/en/faq/: a link to /games/, a page in another language, without hreflang="vi"']);
    expect(
      check('/en/faq/', {
        ...englishFaq,
        links: englishFaq.links.map((link) => link.replace('/terms/" hreflang="vi"', '/terms/"')),
      }),
    ).toEqual(['/en/faq/: a link to /terms/, a page in another language, without hreflang="vi"']);
  });

  it('fails when the switch does not lead to the page’s pair', () => {
    expect(
      check('/faq/', {
        ...vietnameseFaq,
        links: vietnameseFaq.links.map((link) => link.replace('/en/faq/', '/en/')),
      }),
    ).toEqual(['/faq/: no link to its pair /en/faq/ with hreflang="en" (the switch)']);
  });

  it('fails when an English page leads into the app without ?lang=en', () => {
    expect(
      check('/en/faq/', {
        ...englishFaq,
        links: [...englishFaq.links, '<a href="/play">Play</a>', '<a href="/play/hello?lang=vi">Play</a>'],
      }),
    ).toEqual([
      '/en/faq/: a link into the app, /play, without ?lang=en',
      '/en/faq/: a link into the app, /play/hello?lang=vi, without ?lang=en',
    ]);
  });

  it('fails when a Vietnamese page leads into the app without ?lang=vi (a Vietnamese page on an English phone)', () => {
    expect(
      check('/faq/', {
        ...vietnameseFaq,
        links: [...vietnameseFaq.links, '<a href="/play">Chơi</a>', '<a href="/play/hello?lang=en">Chơi</a>'],
      }),
    ).toEqual([
      '/faq/: a link into the app, /play, without ?lang=vi',
      '/faq/: a link into the app, /play/hello?lang=en, without ?lang=vi',
    ]);
    expect(
      check('/terms/', { ...vietnameseTerms, links: [...vietnameseTerms.links, '<a href="/play">Chơi</a>'] }),
    ).toEqual(['/terms/: a link into the app, /play, without ?lang=vi']);
  });
});

describe('the language pairs of the sitemap', () => {
  const sitemap = ['/', '/faq/', '/terms/', '/en/', '/en/faq/'];

  it('passes when every page has its pair but the declared Vietnamese-only ones', () => {
    expect(pairProblems(sitemap, ['/terms/'])).toEqual([]);
  });

  it('fails for a page without its pair', () => {
    expect(
      pairProblems(
        sitemap.filter((path) => path !== '/en/faq/'),
        ['/terms/'],
      ),
    ).toEqual(['/faq/ has no English page (/en/faq/)']);
    expect(pairProblems([...sitemap, '/en/about/'], ['/terms/'])).toEqual([
      '/en/about/ has no Vietnamese page (/about/)',
    ]);
  });

  it('allows exactly the declared list: no undeclared page alone, no declared page that is gone or paired', () => {
    expect(pairProblems(sitemap, [])).toEqual(['/terms/ has no English page (/en/terms/)']);
    expect(pairProblems(sitemap, ['/terms/', '/privacy/'])).toEqual([
      '/privacy/ is declared Vietnamese-only and is no Vietnamese page of the sitemap',
    ]);
    expect(pairProblems([...sitemap, '/en/terms/'], ['/terms/'])).toEqual([
      '/terms/ is declared Vietnamese-only and has an English page',
    ]);
  });
});
