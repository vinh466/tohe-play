// The words of the home page, / and /en/ (ADR 0056): a shelf — a hero game, the games open now, a greeting for a
// device that has played, a quick row, a table band and every game. The story of what Tò He is lives in About, the
// parents' page in /family/, and the install guide and questions in /guides/ and /faq/. The owner reviews these words
// in the pull request: change them here, not in the page (docs/conventions/voice-and-look.md).
import type { Lang } from '../i18n.ts';

const vi = {
  title: 'Tò He — sạp game nhỏ',
  description:
    'Sạp game nhỏ: mở là chơi, không quảng cáo, không cần tài khoản. Chơi một mình hoặc rủ bạn qua một link.',
  /** The one line under the name, for a link preview and a reader who wants the short version. */
  line: 'Sạp game nhỏ. Chơi một ván. Rồi tính.',
  start: {
    play: 'Chơi ngay',
    account: 'Đăng nhập',
  },
  /** The greeting of a device that has played here (ADR 0055): `{name}` and `{game}` are filled in on the device. */
  greet: {
    hello: 'Chào lại, {name}!',
    helloPlain: 'Chào lại!',
    play: 'Chơi tiếp {game}',
    playPlain: 'Chơi tiếp',
    enter: 'Vào Tò He',
    notYou: 'Không phải {name}?',
  },
  hero: {
    eyebrow: 'Sạp hôm nay',
    sticker: 'Hôm nay',
    play: 'Chơi ngay',
    together: 'Rủ bạn',
  },
  open: {
    heading: 'Đang mở',
    more: 'Xem cả sạp',
  },
  trust: ['Không quảng cáo', 'Không cần tài khoản', 'Lưu trên máy này'],
  continue: {
    heading: 'Chơi tiếp',
  },
  quick: {
    heading: 'Chơi nhanh',
    all: 'Xem tất cả',
  },
  together: {
    eyebrow: 'Chơi cùng',
    heading: 'Rủ bạn qua một link.',
    text: 'Mở bàn, gửi link. Mỗi người một máy. Không cần tài khoản.',
    create: 'Tạo bàn',
    code: 'Nhập mã',
  },
  all: {
    heading: 'Tất cả trò chơi',
    play: 'Chơi',
  },
  organization: {
    description: 'Tò He là một sạp game nhỏ chơi ngay trên trình duyệt, không quảng cáo.',
  },
  /** The day these words were last revised (YYYY-MM-DD). */
  updated: '2026-10-31',
};

const en: typeof vi = {
  title: 'Tò He — a small game shelf',
  description:
    'A small game shelf: open and play, no ads, no account needed. Play alone or bring a friend with one link.',
  line: 'A small game shelf. Play one round. Then decide.',
  start: {
    play: 'Play now',
    account: 'Sign in',
  },
  greet: {
    hello: 'Welcome back, {name}!',
    helloPlain: 'Welcome back!',
    play: 'Continue {game}',
    playPlain: 'Continue',
    enter: 'Open Tò He',
    notYou: 'Not {name}?',
  },
  hero: {
    eyebrow: 'Today’s shelf',
    sticker: 'Today',
    play: 'Play now',
    together: 'Bring a friend',
  },
  open: {
    heading: 'Open now',
    more: 'See the whole shelf',
  },
  trust: ['No ads', 'No account needed', 'Saved on this device'],
  continue: {
    heading: 'Continue',
  },
  quick: {
    heading: 'Quick to play',
    all: 'See all',
  },
  together: {
    eyebrow: 'Play together',
    heading: 'Bring a friend with one link.',
    text: 'Open a table, send the link. One device each. No account needed.',
    create: 'Open a table',
    code: 'Enter a code',
  },
  all: {
    heading: 'All games',
    play: 'Play',
  },
  organization: {
    description: 'Tò He is a small shelf of games that play right in the browser, with no ads.',
  },
  updated: '2026-10-31',
};

export const home: Record<Lang, typeof vi> = { vi, en };
