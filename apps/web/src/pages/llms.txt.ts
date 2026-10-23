// /llms.txt: the public pages as a list for AI readers (llmstxt.org), in both languages in one file (ADR 0047). Cheap
// and no promise that anyone reads it (plans/product-surface R-02). Written from the same content as the pages, so it
// never lists a page that is not there.
import type { APIRoute } from 'astro';
import { about } from '../content/about.ts';
import { faq } from '../content/faq.ts';
import { loadGames } from '../content/games.ts';
import { home } from '../content/home.ts';
import { guides, install } from '../content/install.ts';
import { legal } from '../content/legal.ts';
import { promise } from '../content/promise.ts';
import { absolute, docsUrl, site } from '../content/site.ts';
import { type Lang, localPath } from '../i18n.ts';

const link = (name: string, path: string, text: string) => `- [${name}](${absolute(path)}): ${text}`;

/** The pages of one language: the main ones, then the games. */
const pages = (lang: Lang) => [
  link(site.name, localPath(lang, '/'), home[lang].line),
  link(guides[lang].heading, localPath(lang, '/guides/'), guides[lang].lead),
  link(install[lang].heading, localPath(lang, '/guides/install/'), install[lang].description),
  link(faq[lang].heading, localPath(lang, '/faq/'), faq[lang].description),
  link(about[lang].heading, localPath(lang, '/about/'), about[lang].description),
  link(promise[lang].heading, localPath(lang, '/promise/'), promise[lang].description),
];
const games = (lang: Lang) =>
  loadGames(lang).map((game) => link(game.name, localPath(lang, `/games/${game.id}/`), game.metaDescription));

export const GET: APIRoute = () => {
  const lines = [
    `# ${site.name}`,
    '',
    `> ${home.vi.description}`,
    '',
    'Tiếng Việt tại /, English at /en/. Không quảng cáo, không theo dõi; chơi không cần tài khoản. No ads, no tracking; no account needed to play.',
    '',
    '## Trang chính',
    ...pages('vi'),
    '',
    '## Trò chơi',
    link('Tất cả trò chơi', '/games/', 'Danh sách các trò chơi.'),
    ...games('vi'),
    '',
    '## Pháp lý (chỉ có tiếng Việt / in Vietnamese only)',
    link(legal.other.terms, '/terms/', 'Điều khoản sử dụng Tò He.'),
    link(legal.other.privacy, '/privacy/', 'Tò He lưu những gì, ai thấy gì, quyền của bạn.'),
    '',
    '## English',
    ...pages('en'),
    '',
    '## Games (English)',
    link('All games', '/en/games/', 'The list of games.'),
    ...games('en'),
    '',
    '## Tài liệu kỹ thuật / Developer docs (English)',
    `- [Tò He docs](${docsUrl}/): architecture, the Game Contract and how to add a game.`,
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
