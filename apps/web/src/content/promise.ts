// The words of /promise/ and /en/promise/ (ADR 0047): what Tò He never does: no ads, no tracking, nothing to buy, no
// coins. Each line must stay true of the code: the privacy notice (/privacy/) is the authority on data, and device
// telemetry (docs/architecture/telemetry.md) is technical, first-party and can be switched off. The owner reviews the
// words in the pull request.
import type { Lang } from '../i18n.ts';

const vi = {
  title: 'Lời hứa của Tò He — không quảng cáo, không theo dõi',
  description:
    'Tò He hứa không bao giờ có quảng cáo, không theo dõi ai, không bán gì trong game và không có xu hay tiền ảo.',
  heading: 'Lời hứa của Tò He',
  lead: 'Tò He là nơi chơi yên tĩnh cho cả nhà. Bốn điều Tò He không bao giờ làm:',
  items: [
    {
      title: 'Không quảng cáo',
      text: 'Không quảng cáo nào chen vào giữa ván, trước ván hay sau ván.',
    },
    {
      title: 'Không theo dõi',
      text: 'Không có công cụ theo dõi hay quảng cáo của bên khác. Tò He chỉ ghi một ít số liệu kỹ thuật về máy và game (lỗi, độ mượt), không gắn với tên ai, và tắt được.',
    },
    {
      title: 'Không mua bán',
      text: 'Trong game không có gì để mua: không gói, không vật phẩm, không mở khoá bằng tiền.',
    },
    {
      title: 'Không xu, không tiền ảo',
      text: 'Không có xu, kim cương hay tiền ảo nào. Điểm chỉ để vui.',
    },
  ],
  more: 'Tò He lưu những gì và vì sao:',
  privacy: 'Chính sách quyền riêng tư',
  updated: '2026-10-23',
};

const en: typeof vi = {
  title: 'Our promise: no ads, no tracking | Tò He',
  description:
    'Tò He promises never to show ads, never to track you, never to sell anything in its games, and never to have coins or virtual money.',
  heading: 'Our promise',
  lead: 'Tò He is a quiet place for the whole family to play. Four things it never does:',
  items: [
    {
      title: 'No ads',
      text: 'No ad ever comes between you and a game: not during a round, not before it, not after it.',
    },
    {
      title: 'No tracking',
      text: 'No tracking or advertising tools from anyone else. Tò He keeps only a few technical numbers about the device and the game (errors, smoothness), not tied to anyone’s name, and you can turn them off.',
    },
    {
      title: 'Nothing to buy',
      text: 'There is nothing to buy in the games: no packs, no items, nothing unlocked for money.',
    },
    {
      title: 'No coins',
      text: 'No coins, gems or virtual money of any kind. Scores are just for fun.',
    },
  ],
  more: 'What Tò He keeps and why:',
  privacy: 'the privacy notice (in Vietnamese)',
  updated: '2026-10-23',
};

export const promise: Record<Lang, typeof vi> = { vi, en };
