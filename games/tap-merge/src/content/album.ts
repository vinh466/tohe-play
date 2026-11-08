// Sổ Tay Khối and the badges (SPEC.md, "Sổ Tay Khối"). Both are recognition, never a gate: no currency, no power,
// no expiring card. A card unlocks the first time its block is seen in any mode; a badge when its feat is done.
import type { IconName } from '@tohe/game-kit';
import { stampedInMonth } from '../date.ts';
import type { Exponent } from '../logic.ts';

export interface AlbumCard {
  readonly exp: Exponent;
  readonly vi: string;
  readonly en: string;
  readonly factVi: string;
  readonly factEn: string;
}

/** 2 … 1M, the growth story the whole game already tells. */
export const ALBUM_CARDS: readonly AlbumCard[] = [
  { exp: 1, vi: 'Hạt mầm', en: 'Seed', factVi: '2 × 2 = 4', factEn: '2 × 2 = 4' },
  { exp: 2, vi: 'Chồi non', en: 'Sprout', factVi: '4 là 2²', factEn: '4 is 2²' },
  { exp: 3, vi: 'Lá nhỏ', en: 'Little leaf', factVi: '8 = 2 × 2 × 2', factEn: '8 = 2 × 2 × 2' },
  { exp: 4, vi: 'Lá xanh', en: 'Green leaf', factVi: '16 = 4 × 4', factEn: '16 = 4 × 4' },
  { exp: 5, vi: 'Nụ hoa', en: 'Bud', factVi: '32 = 16 × 2', factEn: '32 = 16 × 2' },
  { exp: 6, vi: 'Hoa đầu tiên', en: 'First flower', factVi: '64 = 8 × 8', factEn: '64 = 8 × 8' },
  { exp: 7, vi: 'Quả xanh', en: 'Green fruit', factVi: '128 = 64 × 2', factEn: '128 = 64 × 2' },
  { exp: 8, vi: 'Quả chín', en: 'Ripe fruit', factVi: '256 = 16 × 16', factEn: '256 = 16 × 16' },
  { exp: 9, vi: 'Đèn lồng', en: 'Lantern', factVi: '512 = 2⁹', factEn: '512 = 2⁹' },
  { exp: 10, vi: 'Ngôi sao nhỏ', en: 'Little star', factVi: '1K = 1.024', factEn: '1K = 1,024' },
  { exp: 11, vi: 'Mặt trăng', en: 'Moon', factVi: '2K = 2.048', factEn: '2K = 2,048' },
  { exp: 12, vi: 'Mặt trời', en: 'Sun', factVi: '4K = 4.096', factEn: '4K = 4,096' },
  { exp: 13, vi: 'Đám mây', en: 'Cloud', factVi: '8K = 8.192', factEn: '8K = 8,192' },
  { exp: 14, vi: 'Ngọn núi', en: 'Mountain', factVi: '16K = 16.384', factEn: '16K = 16,384' },
  { exp: 15, vi: 'Hồ nước', en: 'Lake', factVi: '32K = 32.768', factEn: '32K = 32,768' },
  { exp: 16, vi: 'Cánh đồng', en: 'Field', factVi: '64K = 65.536', factEn: '64K = 65,536' },
  { exp: 17, vi: 'Rừng xanh', en: 'Forest', factVi: '128K = 131.072', factEn: '128K = 131,072' },
  { exp: 18, vi: 'Biển lớn', en: 'Sea', factVi: '256K = 262.144', factEn: '256K = 262,144' },
  { exp: 19, vi: 'Bầu trời', en: 'Sky', factVi: '512K = 524.288', factEn: '512K = 524,288' },
  { exp: 20, vi: 'Vũ trụ', en: 'Universe', factVi: '1M = 1.048.576', factEn: '1M = 1,048,576' },
];

export const ALBUM_BY_EXP: ReadonlyMap<Exponent, AlbumCard> = new Map(
  ALBUM_CARDS.map((card) => [card.exp, card]),
);

export type BadgeGroup = 'taps' | 'classic' | 'journey' | 'daily' | 'album';

export interface Badge {
  readonly id: string;
  readonly group: BadgeGroup;
  readonly icon: IconName;
  readonly vi: { title: string; body: string };
  readonly en: { title: string; body: string };
  check(ctx: BadgeContext): boolean;
}

export interface BadgeContext {
  /** Classic best score. */
  readonly best: number;
  readonly classicRuns: number;
  readonly maxAbsorbed: number;
  readonly noShuffleLevels: number;
  /** Stars on each completed Journey level, by id. */
  readonly journey: Readonly<Record<string, number>>;
  /** Stamped daily dates. */
  readonly dailyDates: Readonly<Record<string, number>>;
  /** The values seen in Sổ Tay Khối. */
  readonly album: ReadonlySet<Exponent>;
  /** The current local month, `YYYYMM`. */
  readonly month: string;
}

const completedIn = (journey: Readonly<Record<string, number>>, prefix: string): number =>
  Object.entries(journey).filter(([id, stars]) => id.startsWith(prefix) && stars > 0).length;

const threeStars = (journey: Readonly<Record<string, number>>): number =>
  Object.values(journey).filter((stars) => stars === 3).length;

export const BADGES: readonly Badge[] = [
  {
    id: 'tap-9',
    group: 'taps',
    icon: 'target',
    vi: { title: 'Tay to', body: 'Gom 9 khối trong một lần chạm.' },
    en: { title: 'Big hand', body: 'Gather 9 blocks in one tap.' },
    check: (ctx) => ctx.maxAbsorbed >= 9,
  },
  {
    id: 'tap-20',
    group: 'taps',
    icon: 'star',
    vi: { title: 'Gom cả vườn', body: 'Gom 20 khối trong một lần chạm.' },
    en: { title: 'Whole garden', body: 'Gather 20 blocks in one tap.' },
    check: (ctx) => ctx.maxAbsorbed >= 20,
  },
  {
    id: 'classic-10',
    group: 'classic',
    icon: 'cards',
    vi: { title: 'Bền bỉ', body: 'Chơi 10 ván Vô Tận.' },
    en: { title: 'Steady', body: 'Play 10 Endless runs.' },
    check: (ctx) => ctx.classicRuns >= 10,
  },
  {
    id: 'classic-1m',
    group: 'classic',
    icon: 'trophy',
    vi: { title: 'Kỷ lục gia', body: 'Đạt 1M điểm trong Vô Tận.' },
    en: { title: 'Record keeper', body: 'Score 1M in Endless.' },
    check: (ctx) => ctx.best >= 1_000_000,
  },
  {
    id: 'chapter-1',
    group: 'journey',
    icon: 'target',
    vi: { title: 'Người mở đường', body: 'Hoàn thành 6 màn đầu của Hành Trình.' },
    en: { title: 'Pathfinder', body: 'Finish the first 6 Journey levels.' },
    check: (ctx) => completedIn(ctx.journey, 'c1-') >= 6,
  },
  {
    id: 'three-stars-5',
    group: 'journey',
    icon: 'star',
    vi: { title: 'Ba sao', body: 'Đạt 3 sao ở 5 màn.' },
    en: { title: 'Three stars', body: 'Earn 3 stars on 5 levels.' },
    check: (ctx) => threeStars(ctx.journey) >= 5,
  },
  {
    id: 'no-shuffle',
    group: 'journey',
    icon: 'shuffle',
    vi: { title: 'Không cần xáo', body: 'Hoàn thành một màn không dùng Xáo trộn.' },
    en: { title: 'No shuffle', body: 'Finish a level without using a shuffle.' },
    check: (ctx) => ctx.noShuffleLevels >= 1,
  },
  {
    id: 'daily-7',
    group: 'daily',
    icon: 'timer',
    vi: { title: 'Đều đặn', body: 'Chơi 7 ngày Mỗi Ngày.' },
    en: { title: 'Regular', body: 'Play 7 Daily days.' },
    check: (ctx) => Object.keys(ctx.dailyDates).length >= 7,
  },
  {
    id: 'daily-month-20',
    group: 'daily',
    icon: 'trophy',
    vi: { title: 'Tháng tròn', body: 'Chơi 20 ngày trong một tháng.' },
    en: { title: 'Full month', body: 'Play 20 Daily days in one month.' },
    check: (ctx) => stampedInMonth(ctx.dailyDates, ctx.month) >= 20,
  },
  {
    id: 'album-10',
    group: 'album',
    icon: 'cards',
    vi: { title: 'Sưu tầm', body: 'Mở 10 thẻ trong Sổ Tay Khối.' },
    en: { title: 'Collector', body: 'Unlock 10 cards in the notebook.' },
    check: (ctx) => ctx.album.size >= 10,
  },
  {
    id: 'album-20',
    group: 'album',
    icon: 'trophy',
    vi: { title: 'Vườn nở', body: 'Mở đủ 20 thẻ.' },
    en: { title: 'Garden in bloom', body: 'Unlock all 20 cards.' },
    check: (ctx) => ctx.album.size >= 20,
  },
];

export const BADGE_BY_ID: ReadonlyMap<string, Badge> = new Map(BADGES.map((badge) => [badge.id, badge]));

/** The badges a context now earns. The caller adds them to the save; an earned badge is never taken away. */
export const earnedBadges = (ctx: BadgeContext): string[] =>
  BADGES.filter((badge) => badge.check(ctx)).map((badge) => badge.id);
