// The words of the home page, / and /en/ (ADR 0046, 0047): the catalog first, then playing together, installing, the
// questions, the story and the promise. The owner reviews them in the pull request: change them here, not in the page.
import type { Lang } from '../i18n.ts';

const vi = {
  title: 'Tò He — game nhỏ, mở ra là chơi',
  description:
    'Game nhỏ, mở ra là chơi: không quảng cáo, không cần tài khoản. Giữ tiến độ khi bạn muốn, rủ bạn vào cùng bàn bằng một link.',
  /** The one line under the name: what Tò He is, in five seconds (ADR 0047). */
  line: 'Game nhỏ cho cả nhà · Không quảng cáo · Không cần tài khoản · Chơi ngay',
  /** Only on a device that has played here (src/scripts/returning.js): to the app, at the top of the page. */
  continue: 'Chơi tiếp →',
  play: 'Chơi ngay — không cần tài khoản',
  installHint: 'Cài lên màn hình chính',
  games: {
    heading: 'Chơi gì hôm nay?',
    all: 'Xem tất cả trò chơi →',
  },
  friends: {
    heading: 'Chơi cùng bạn bè',
    text: 'Mở phòng chơi, gửi link qua Zalo hay Messenger là bạn vào cùng bàn — mỗi người một điện thoại.',
    games: 'Chơi cùng được:',
  },
  install: {
    heading: 'Như một ứng dụng trên điện thoại',
    text: 'Thêm Tò He vào màn hình chính để mở nhanh và chạy toàn màn hình. Android, iPhone hay máy tính đều được.',
    /** Said only once every game's facts say it plays offline (games/<id>/page/facts.json, ADR 0047). */
    offline: 'Chơi được cả khi mất mạng.',
    link: 'Xem cách cài →',
  },
  story: {
    heading: 'Vì sao lại là "Tò He"?',
    text: 'Tò he là món đồ chơi nặn bằng bột màu của trẻ em Việt: nhỏ xinh, nhiều màu và được nặn rất nhanh. Mỗi trò chơi ở đây cũng vậy — một con tò he nhỏ, nặn nhanh từ cùng một "bột nền" kỹ thuật chung.',
  },
  questions: {
    heading: 'Còn thắc mắc?',
    text: 'Miễn phí không, dữ liệu để đâu, bé chơi có ổn không — câu trả lời ngắn ở trang Hỏi đáp.',
    link: 'Đọc Hỏi đáp →',
  },
  promise: {
    heading: 'Lời hứa của Tò He',
    text: 'Không quảng cáo, không theo dõi, không mua bán, không xu — không bao giờ.',
    link: 'Đọc lời hứa →',
  },
  organization: {
    description: 'Tò He là một góc chơi nhỏ gồm những trò chơi đơn giản trên trình duyệt, không quảng cáo.',
  },
  /** The day these words were last revised; the page shows the latest of it and its games' (YYYY-MM-DD). */
  updated: '2026-10-22',
};

const en: typeof vi = {
  title: 'Tò He — small games, open and play',
  description:
    'Small games you open and play: no ads, no account needed. Keep your progress when you want to, and bring friends to your table with one link.',
  line: 'Small games for the whole family · No ads · No account needed · Play now',
  continue: 'Continue →',
  play: 'Play now — no account needed',
  installHint: 'Add it to your home screen',
  games: {
    heading: 'What to play today?',
    all: 'See all games →',
  },
  friends: {
    heading: 'Play with friends',
    text: 'Open a table, send the link over Zalo or Messenger, and your friends sit down with you — each on their own phone.',
    games: 'Games to play together:',
  },
  install: {
    heading: 'Like an app on your phone',
    text: 'Add Tò He to your home screen to open it quickly and play full screen. Android, iPhone or a computer all work.',
    offline: 'It plays offline too.',
    link: 'See how to install →',
  },
  story: {
    heading: 'Why "Tò He"?',
    text: 'Tò he are little figures Vietnamese children play with, shaped from coloured rice dough: small, bright and made in moments. Every game here is the same — a small tò he, shaped quickly from one shared technical "dough".',
  },
  questions: {
    heading: 'Questions?',
    text: 'Is it free, where is my data, is it fine for children — short answers on the FAQ page.',
    link: 'Read the FAQ →',
  },
  promise: {
    heading: 'Our promise',
    text: 'No ads, no tracking, nothing to buy, no coins — ever.',
    link: 'Read the promise →',
  },
  organization: {
    description: 'Tò He is a small corner of simple browser games, with no ads.',
  },
  updated: '2026-10-22',
};

export const home: Record<Lang, typeof vi> = { vi, en };
