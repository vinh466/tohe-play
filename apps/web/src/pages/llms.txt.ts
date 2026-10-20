// /llms.txt: the public pages as a list for AI readers (llmstxt.org). Cheap and no promise that anyone reads it
// (plans/product-surface R-02). Written from the same content as the pages, so it never lists a page that is not there.
import type { APIRoute } from 'astro';
import { about } from '../content/about.ts';
import { faq } from '../content/faq.ts';
import { loadGames } from '../content/games.ts';
import { home } from '../content/home.ts';
import { guides, install } from '../content/install.ts';
import { absolute, docsUrl, site } from '../content/site.ts';

export const GET: APIRoute = () => {
  const link = (name: string, path: string, text: string) => `- [${name}](${absolute(path)}): ${text}`;
  const lines = [
    `# ${site.name}`,
    '',
    `> ${home.description}`,
    '',
    'Tiếng Việt. Không quảng cáo, không theo dõi; chơi không cần tài khoản.',
    '',
    '## Trang chính',
    link(site.name, '/', home.lead),
    link(guides.heading, '/guides/', guides.lead),
    link(install.heading, '/guides/install/', install.description),
    link(faq.heading, '/faq/', faq.description),
    link(about.heading, '/about/', about.description),
    '',
    '## Trò chơi',
    link('Tất cả trò chơi', '/games/', 'Danh sách các trò chơi.'),
    ...loadGames().map((game) => link(game.name, `/games/${game.id}/`, game.metaDescription)),
    '',
    '## Pháp lý',
    link('Điều khoản sử dụng', '/terms/', 'Điều khoản sử dụng Tò He.'),
    link('Chính sách quyền riêng tư', '/privacy/', 'Tò He lưu những gì, ai thấy gì, quyền của bạn.'),
    '',
    '## Tài liệu kỹ thuật (tiếng Anh)',
    `- [Tò He docs](${docsUrl}/): architecture, the Game Contract and how to add a game.`,
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
