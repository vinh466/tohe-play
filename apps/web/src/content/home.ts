// The words of the home page, / and /en/ (ADR 0055, which amends 0046 and 0047): an introduction in sections — a hero
// with two buttons, what Tò He is, how it works, playing together, for children and parents, installing, the questions
// parents ask — and a closing call. No list of games: /games/ and the app hold it. A device that has played here is
// greeted in the hero instead (src/scripts/greeting.js). The owner reviews the words in the pull request: change them
// here, not in the page (docs/conventions/voice-and-look.md).
import type { Lang } from '../i18n.ts';
import type { IconName } from './icons.ts';

interface Point {
  icon: IconName;
  title: string;
  text: string;
}

const vi = {
  title: 'Tò He — mấy trò chơi nhỏ cho cả nhà',
  description:
    'Mấy trò chơi nhỏ cho cả nhà. Mở là chơi, không quảng cáo, không cần tài khoản. Muốn thì giữ tiến độ, hoặc gửi link rủ cả nhà vào chơi cùng.',
  /** The one line under the name: what Tò He is, in five seconds (ADR 0047). */
  line: 'Mấy trò chơi nhỏ cho cả nhà. Mở là chơi, không quảng cáo.',
  start: {
    play: 'Chơi ngay',
    account: 'Tôi đã có tài khoản',
  },
  /**
   * The greeting of a device that has played here (ADR 0055): `{name}` and `{game}` are filled in on the device, from
   * what the app keeps there; without them, the plain words.
   */
  greet: {
    hello: 'Chào lại, {name}!',
    helloPlain: 'Chào lại!',
    play: 'Chơi tiếp {game}',
    playPlain: 'Chơi tiếp',
    enter: 'Vào Tò He',
    notYou: 'Không phải {name}?',
  },
  what: {
    heading: 'Tò He có gì',
    points: [
      {
        icon: 'play',
        title: 'Mở là chơi',
        text: 'Không cần cài, chưa cần tài khoản. Điện thoại, máy tính bảng hay máy tính đều chơi được.',
      },
      {
        icon: 'users-three',
        title: 'Cả nhà chơi cùng',
        text: 'Gửi một link qua Zalo là ông bà, bố mẹ và các con vào chung một bàn.',
      },
      {
        icon: 'shield-check',
        title: 'Không quảng cáo',
        text: 'Không quảng cáo, không mua gì trong game, không theo dõi ai.',
      },
    ] satisfies Point[],
  },
  how: {
    heading: 'Chơi thế nào',
    steps: [
      'Chọn một trò chơi.',
      'Chơi luôn trên máy này, hoặc đăng nhập để giữ tiến độ trên mọi máy.',
      'Gửi link rủ cả nhà vào chơi cùng.',
    ],
  },
  together: {
    heading: 'Chơi cùng cả nhà',
    text: 'Mở một bàn Tiến Lên rồi gửi link qua Zalo. Mỗi người chơi trên máy của mình; ghế còn trống thì có máy chơi thay.',
    /** The game with tables it names, from its manifest: `{game}`. */
    try: 'Thử {game}',
    /** The one card to the list of games: `{count}` games. */
    games: 'Xem {count} trò chơi',
  },
  family: {
    heading: 'Cho bé và bố mẹ',
    points: [
      {
        icon: 'smiley',
        title: 'Mỗi bé một hồ sơ',
        text: 'Một tài khoản cho cả nhà, mỗi bé một hồ sơ với tên và hình con vật bé thích.',
      },
      {
        icon: 'lock-simple',
        title: 'Bố mẹ giữ mã PIN',
        text: 'Đổi sang hồ sơ người lớn, hay mở một link ra ngoài Tò He, đều hỏi bố mẹ trước.',
      },
    ] satisfies Point[],
    promise: 'Đọc lời hứa của Tò He',
  },
  install: {
    heading: 'Cài như một app',
    text: 'Thêm Tò He vào màn hình chính để mở bằng một chạm.',
    android: 'Android: mở bằng Chrome, chọn "Cài đặt ứng dụng".',
    iphone: 'iPhone: mở bằng Safari, chạm nút Chia sẻ rồi chọn "Thêm vào Màn hình chính".',
    guide: 'Xem cách cài từng bước',
  },
  questions: {
    heading: 'Bố mẹ hay hỏi',
    all: 'Xem tất cả câu hỏi',
  },
  closing: {
    heading: 'Sẵn sàng chơi?',
  },
  organization: {
    description: 'Tò He là mấy trò chơi nhỏ chơi ngay trên trình duyệt, không quảng cáo.',
  },
  /** The day these words were last revised; the page shows the latest of it and its games' (YYYY-MM-DD). */
  updated: '2026-10-25',
};

const en: typeof vi = {
  title: 'Tò He — small games for the whole family',
  description:
    'Small games for the whole family. Open and play, no ads, no account needed. Keep your progress if you like, or send a link and play together.',
  line: 'Small games for the whole family. Open and play, no ads.',
  start: {
    play: 'Play now',
    account: 'I have an account',
  },
  greet: {
    hello: 'Welcome back, {name}!',
    helloPlain: 'Welcome back!',
    play: 'Continue {game}',
    playPlain: 'Continue',
    enter: 'Open Tò He',
    notYou: 'Not {name}?',
  },
  what: {
    heading: 'What Tò He is',
    points: [
      {
        icon: 'play',
        title: 'Open and play',
        text: 'Nothing to install, no account needed yet. It plays on a phone, a tablet or a computer.',
      },
      {
        icon: 'users-three',
        title: 'The whole family together',
        text: 'Send one link over Zalo and grandparents, parents and children sit at the same table.',
      },
      {
        icon: 'shield-check',
        title: 'No ads',
        text: 'No ads, nothing to buy in a game, and nobody tracked.',
      },
    ],
  },
  how: {
    heading: 'How it works',
    steps: [
      'Pick a game.',
      'Play right here, or sign in to keep your progress on every device.',
      'Send a link to bring the family to the table.',
    ],
  },
  together: {
    heading: 'Playing together',
    text: 'Open a Tiến Lên table and send the link over Zalo. Everyone plays on their own phone; an empty seat gets a computer player.',
    try: 'Try {game}',
    games: 'See all {count} games',
  },
  family: {
    heading: 'For children and parents',
    points: [
      {
        icon: 'smiley',
        title: 'A profile for each child',
        text: 'One account for the family, and a profile for each child, with a name and the animal they like.',
      },
      {
        icon: 'lock-simple',
        title: 'Parents keep the PIN',
        text: 'Moving to a grown-up’s profile, or opening a link that leaves Tò He, asks a parent first.',
      },
    ],
    promise: 'Read the Tò He promise',
  },
  install: {
    heading: 'Install it like an app',
    text: 'Add Tò He to your home screen and open it with one tap.',
    android: 'Android: open it in Chrome and choose "Install app".',
    iphone: 'iPhone: open it in Safari, tap Share, then choose "Add to Home Screen".',
    guide: 'See how, step by step',
  },
  questions: {
    heading: 'Parents often ask',
    all: 'See all questions',
  },
  closing: {
    heading: 'Ready to play?',
  },
  organization: {
    description: 'Tò He is a handful of small games that play right in the browser, with no ads.',
  },
  updated: '2026-10-25',
};

export const home: Record<Lang, typeof vi> = { vi, en };

/** The questions the home page answers in place, by id (src/content/faq.ts): the ones a parent asks first. */
export const homeQuestionIds = ['mien-phi', 'tre-em', 'du-lieu'] as const;
