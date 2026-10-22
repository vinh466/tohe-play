// The words of the home page, / and /en/. The owner reviews them in the pull request: change them here, not in the page.
import type { Lang } from '../i18n.ts';

const vi = {
  title: 'Tò He — game nhỏ, mở ra là chơi',
  description:
    'Game nhỏ, mở ra là chơi: không quảng cáo, không cần tài khoản. Giữ tiến độ khi bạn muốn, rủ bạn vào cùng bàn bằng một link.',
  lead: 'Những trò chơi nhỏ, nhanh, gọn. Mở link là chơi trên điện thoại hay máy tính — không quảng cáo, không phải đăng ký.',
  play: 'Chơi ngay — không cần tài khoản',
  installHint: 'Cài lên màn hình chính',
  features: [
    {
      icon: '📱',
      title: 'Mở là chơi',
      text: 'Bấm vào link là vào chơi ngay trên trình duyệt. Không phải tải về, không phải đăng ký trước.',
    },
    {
      icon: '🚫',
      title: 'Không quảng cáo',
      text: 'Chơi liền mạch, không bị cắt ngang. Không bán gì trong game, không theo dõi bạn.',
    },
    {
      icon: '🔗',
      title: 'Rủ bạn bằng một link',
      text: 'Mở phòng chơi, gửi link qua Zalo hay Messenger là bạn vào cùng bàn.',
    },
    {
      icon: '💾',
      title: 'Giữ tiến độ khi bạn muốn',
      text: 'Chơi trước, đăng nhập sau: tạo tài khoản khi bạn muốn giữ điểm, chơi trên máy khác hay lên bảng xếp hạng.',
    },
  ],
  games: {
    heading: 'Chơi gì hôm nay?',
    all: 'Xem tất cả trò chơi →',
  },
  install: {
    heading: 'Như một ứng dụng trên điện thoại',
    text: 'Thêm Tò He vào màn hình chính để mở nhanh, chạy toàn màn hình và chơi được cả khi mất mạng. Android, iPhone hay máy tính đều được.',
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
  dev: {
    heading: 'Dành cho người làm game',
    text: 'Mỗi trò chơi là một gói độc lập, giao tiếp với nền tảng qua một hợp đồng nhỏ và ổn định. Tài liệu kỹ thuật (tiếng Anh) mô tả kiến trúc, hợp đồng và cách tạo game mới — cho cả người lẫn AI.',
    link: 'Đọc tài liệu →',
  },
  organization: {
    description: 'Tò He là một góc chơi nhỏ gồm những trò chơi đơn giản trên trình duyệt, không quảng cáo.',
  },
};

const en: typeof vi = {
  title: 'Tò He — small games, open and play',
  description:
    'Small games you open and play: no ads, no account needed. Keep your progress when you want to, and bring friends to your table with one link.',
  lead: 'Small, quick, tidy games. Open the link and play on a phone or a computer — no ads, no sign-up.',
  play: 'Play now — no account needed',
  installHint: 'Add it to your home screen',
  features: [
    {
      icon: '📱',
      title: 'Open and play',
      text: 'Tap the link and you are playing, right in the browser. Nothing to download, nothing to sign up for first.',
    },
    {
      icon: '🚫',
      title: 'No ads',
      text: 'Play without interruptions. Nothing is sold in the games, and nobody tracks you.',
    },
    {
      icon: '🔗',
      title: 'Invite with one link',
      text: 'Open a table, send the link over Zalo or Messenger, and your friends sit down with you.',
    },
    {
      icon: '💾',
      title: 'Keep your progress when you want',
      text: 'Play first, sign in later: create an account when you want to keep your scores, play on another device or get on the leaderboard.',
    },
  ],
  games: {
    heading: 'What to play today?',
    all: 'See all games →',
  },
  install: {
    heading: 'Like an app on your phone',
    text: 'Add Tò He to your home screen to open it quickly, play full screen and keep playing offline. Android, iPhone or a computer all work.',
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
  dev: {
    heading: 'For game makers',
    text: 'Every game is a package of its own that talks to the platform through a small, stable contract. The developer docs describe the architecture, the contract and how to make a new game — for people and AI alike.',
    link: 'Read the docs →',
  },
  organization: {
    description: 'Tò He is a small corner of simple browser games, with no ads.',
  },
};

export const home: Record<Lang, typeof vi> = { vi, en };
