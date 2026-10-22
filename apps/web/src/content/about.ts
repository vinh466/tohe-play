// The words of /about/ and /en/about/. The owner reviews them in the pull request (who writes "chúng tôi", and the
// contact, are theirs to settle).
import type { Lang } from '../i18n.ts';
import { site } from './site.ts';

const vi = {
  title: 'Giới thiệu — Tò He là gì, ai làm ra nó',
  description:
    'Tò He là một góc chơi nhỏ gồm những trò chơi đơn giản trên trình duyệt, không quảng cáo, không theo dõi. Một dự án gia đình, mở cho ai muốn chơi.',
  heading: 'Giới thiệu',
  sections: [
    {
      heading: 'Tò He là gì',
      paragraphs: [
        'Tò He là một góc chơi nhỏ: vài trò chơi đơn giản chạy ngay trong trình duyệt điện thoại hay máy tính, mở ra là chơi, một ván vài phút.',
        'Tên gọi lấy từ tò he, món đồ chơi nặn bằng bột màu của trẻ em Việt: nhỏ, nhiều màu và nặn rất nhanh. Mỗi trò chơi ở đây là một con tò he như thế.',
      ],
    },
    {
      heading: 'Vì sao không quảng cáo',
      paragraphs: [
        'Các cổng game nhỏ thường đầy quảng cáo và những lần bị cắt ngang. Tò He muốn làm điều ngược lại: một nơi yên tĩnh để chơi.',
        'Vì vậy Tò He không có quảng cáo, không bán gì trong game, không có công cụ theo dõi của bên thứ ba, và không có trò chuyện tự do. Nền tảng chỉ đếm tổng số, không theo dõi từng người.',
      ],
    },
    {
      heading: 'Ai làm ra Tò He',
      paragraphs: [
        'Tò He là một dự án gia đình: một người làm và vận hành, ban đầu cho chính gia đình mình, nay mở cho bất kỳ ai được chia sẻ link. Nó cũng là nơi để học cách xây một nền tảng bền, nên mã nguồn công khai trên GitHub.',
      ],
    },
    {
      heading: 'Liên hệ',
      paragraphs: [
        'Góp ý, báo lỗi, hỏi về dữ liệu của bạn hay muốn làm một trò chơi cho Tò He: viết cho chúng tôi.',
      ],
    },
  ],
  contact: { label: 'Email', email: site.email },
  links: {
    games: 'Xem các trò chơi',
    faq: 'Đọc Hỏi đáp',
    dev: 'Tài liệu cho người làm game',
  },
};

const en: typeof vi = {
  title: 'About — what Tò He is and who makes it',
  description:
    'Tò He is a small corner of simple browser games, with no ads and no tracking. A family project, open to anyone who wants to play.',
  heading: 'About',
  sections: [
    {
      heading: 'What Tò He is',
      paragraphs: [
        'Tò He is a small corner for play: a few simple games that run right in the browser of a phone or a computer — open and play, a round in a few minutes.',
        'The name comes from tò he, the coloured rice-dough figures Vietnamese children play with: small, bright and shaped very quickly. Every game here is one such tò he.',
      ],
    },
    {
      heading: 'Why no ads',
      paragraphs: [
        'Small game sites are usually full of ads and interruptions. Tò He sets out to do the opposite: a quiet place to play.',
        'So Tò He has no ads, sells nothing in its games, has no third-party trackers and no free chat. The platform counts totals only and follows no one.',
      ],
    },
    {
      heading: 'Who makes Tò He',
      paragraphs: [
        'Tò He is a family project: one person builds and runs it, first for their own family, now open to anyone a link is shared with. It is also a place to learn how to build a platform that lasts, so its source code is public on GitHub.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [
        'Feedback, a bug, a question about your data, or a game you would like to make for Tò He: write to us.',
      ],
    },
  ],
  contact: { label: 'Email', email: site.email },
  links: {
    games: 'See the games',
    faq: 'Read the FAQ',
    dev: 'Docs for game makers',
  },
};

export const about: Record<Lang, typeof vi> = { vi, en };
