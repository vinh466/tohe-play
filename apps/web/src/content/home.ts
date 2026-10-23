// The words of the home page, / and /en/ (ADR 0046, 0047): one line under the name, the games as the main action, one
// strip for playing together, three questions parents ask, and the day it was revised. Installing, the story and the
// promise are linked from the footer and the About page, not repeated here (docs/conventions/voice-and-look.md).
// The owner reviews the words in the pull request: change them here, not in the page.
import type { Lang } from '../i18n.ts';

const vi = {
  title: 'Tò He — mấy trò chơi nhỏ cho cả nhà',
  description:
    'Mấy trò chơi nhỏ cho cả nhà. Mở là chơi, không quảng cáo, không cần tài khoản. Muốn thì giữ tiến độ, hoặc gửi link rủ cả nhà vào chơi cùng.',
  /** The one line under the name: what Tò He is, in five seconds (ADR 0047). */
  line: 'Mấy trò chơi nhỏ cho cả nhà. Mở là chơi, không quảng cáo.',
  /** Only on a device that has played here (src/scripts/returning.js): to the app, at the top of the page. */
  continue: 'Chơi tiếp',
  games: {
    heading: 'Chơi gì hôm nay?',
    all: 'Xem tất cả trò chơi',
  },
  friends: {
    heading: 'Chơi cùng',
    text: 'Mở bàn, gửi link qua Zalo là cả nhà vào chơi, mỗi người một máy.',
    tryWith: 'Thử với',
  },
  questions: {
    heading: 'Bố mẹ hay hỏi',
    all: 'Xem tất cả câu hỏi',
  },
  organization: {
    description: 'Tò He là mấy trò chơi nhỏ chơi ngay trên trình duyệt, không quảng cáo.',
  },
  /** The day these words were last revised; the page shows the latest of it and its games' (YYYY-MM-DD). */
  updated: '2026-10-23',
};

const en: typeof vi = {
  title: 'Tò He — small games for the whole family',
  description:
    'Small games for the whole family. Open and play, no ads, no account needed. Keep your progress if you like, or send a link and play together.',
  line: 'Small games for the whole family. Open and play, no ads.',
  continue: 'Continue',
  games: {
    heading: 'What to play today?',
    all: 'See all games',
  },
  friends: {
    heading: 'Play together',
    text: 'Open a table and send the link over Zalo. The whole family can join, each on their own phone.',
    tryWith: 'Try it with',
  },
  questions: {
    heading: 'Parents often ask',
    all: 'See all questions',
  },
  organization: {
    description: 'Tò He is a handful of small games that play right in the browser, with no ads.',
  },
  updated: '2026-10-23',
};

export const home: Record<Lang, typeof vi> = { vi, en };

/** The questions the home page links to, by id (src/content/faq.ts): the three a parent asks first. */
export const homeQuestionIds = ['mien-phi', 'tre-em', 'du-lieu'] as const;
