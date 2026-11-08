import type { IconName } from '@tohe/game-kit';
import type { State } from '../logic.ts';

// 15 in-game stamps. They are recognition, never a gate: a player who ignores them loses nothing.
export type AchievementGroup = 'first' | 'clears' | 'combos' | 'journey' | 'days';

export interface AchievementContext {
  readonly state: State | null;
  readonly best: number;
  readonly totalLines: number;
  readonly totalPerfects: number;
  /** Stars on each level, by id. */
  readonly journey: Readonly<Record<string, number>>;
  /** Dates with a daily stamp. */
  readonly dailyDates: readonly string[];
}

export interface Achievement {
  readonly id: string;
  readonly group: AchievementGroup;
  readonly icon: IconName;
  readonly vi: { title: string; body: string };
  readonly en: { title: string; body: string };
  check(ctx: AchievementContext): boolean;
}

const chapterOne = ['g1-1', 'g1-2', 'g1-3', 'g1-4', 'g1-5', 'g1-6'] as const;
const allLevels = Array.from({ length: 18 }, (_, i) => `g${Math.floor(i / 6) + 1}-${(i % 6) + 1}`);

const lines = (ctx: AchievementContext) => ctx.totalLines;

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'first-line',
    group: 'first',
    icon: 'lightbulb',
    vi: { title: 'Nét đầu tiên', body: 'Lấp đầy một hàng hoặc một cột.' },
    en: { title: 'First line', body: 'Fill a row or a column.' },
    check: (ctx) => lines(ctx) >= 1,
  },
  {
    id: 'clear-2',
    group: 'clears',
    icon: 'target',
    vi: { title: 'Hai nét', body: 'Xoá 2 hàng/cột trong một lần đặt.' },
    en: { title: 'Two lines', body: 'Clear 2 rows/columns in one placement.' },
    check: (ctx) => (ctx.state?.maxClear ?? 0) >= 2,
  },
  {
    id: 'clear-3',
    group: 'clears',
    icon: 'star',
    vi: { title: 'Ba nét', body: 'Xoá 3 hàng/cột trong một lần đặt.' },
    en: { title: 'Three lines', body: 'Clear 3 rows/columns in one placement.' },
    check: (ctx) => (ctx.state?.maxClear ?? 0) >= 3,
  },
  {
    id: 'clear-4',
    group: 'clears',
    icon: 'trophy',
    vi: { title: 'Bốn nét', body: 'Xoá 4 hàng/cột trong một lần đặt.' },
    en: { title: 'Four lines', body: 'Clear 4 rows/columns in one placement.' },
    check: (ctx) => (ctx.state?.maxClear ?? 0) >= 4,
  },
  {
    id: 'combo-3',
    group: 'combos',
    icon: 'cards',
    vi: { title: 'Combo ×3', body: 'Đạt combo ×3.' },
    en: { title: 'Combo ×3', body: 'Reach a ×3 combo.' },
    check: (ctx) => (ctx.state?.maxCombo ?? 0) >= 3,
  },
  {
    id: 'combo-8',
    group: 'combos',
    icon: 'shuffle',
    vi: { title: 'Combo ×8', body: 'Đạt combo ×8.' },
    en: { title: 'Combo ×8', body: 'Reach a ×8 combo.' },
    check: (ctx) => (ctx.state?.maxCombo ?? 0) >= 8,
  },
  {
    id: 'perfect-1',
    group: 'clears',
    icon: 'star',
    vi: { title: 'Bàn tay trắng', body: 'Xoá sạch bàn cờ.' },
    en: { title: 'Clean board', body: 'Clear the whole board.' },
    check: (ctx) => ctx.totalPerfects >= 1,
  },
  {
    id: 'score-1000',
    group: 'first',
    icon: 'target',
    vi: { title: 'Một nghìn', body: 'Đạt 1.000 điểm trong Chơi tự do.' },
    en: { title: 'One thousand', body: 'Score 1,000 in Endless.' },
    check: (ctx) => ctx.best >= 1000,
  },
  {
    id: 'score-5000',
    group: 'combos',
    icon: 'trophy',
    vi: { title: 'Năm nghìn', body: 'Đạt 5.000 điểm trong Chơi tự do.' },
    en: { title: 'Five thousand', body: 'Score 5,000 in Endless.' },
    check: (ctx) => ctx.best >= 5000,
  },
  {
    id: 'lines-100',
    group: 'clears',
    icon: 'cards',
    vi: { title: 'Trăm nét', body: 'Xoá 100 hàng/cột.' },
    en: { title: 'A hundred lines', body: 'Clear 100 rows/columns.' },
    check: (ctx) => lines(ctx) >= 100,
  },
  {
    id: 'lines-500',
    group: 'clears',
    icon: 'trophy',
    vi: { title: 'Năm trăm nét', body: 'Xoá 500 hàng/cột.' },
    en: { title: 'Five hundred lines', body: 'Clear 500 rows/columns.' },
    check: (ctx) => lines(ctx) >= 500,
  },
  {
    id: 'chapter-1',
    group: 'journey',
    icon: 'check',
    vi: { title: 'Hết chương Giấy', body: 'Hoàn thành cả 6 level chương Giấy.' },
    en: { title: 'Paper finished', body: 'Complete all 6 levels of the Paper chapter.' },
    check: (ctx) => chapterOne.every((id) => (ctx.journey[id] ?? 0) >= 1),
  },
  {
    id: 'chapter-1-stars',
    group: 'journey',
    icon: 'star',
    vi: { title: 'Mười tám sao', body: 'Đạt 18 sao ở chương Giấy.' },
    en: { title: 'Eighteen stars', body: 'Earn 18 stars in the Paper chapter.' },
    check: (ctx) => chapterOne.reduce((sum, id) => sum + (ctx.journey[id] ?? 0), 0) >= 18,
  },
  {
    id: 'journey-18',
    group: 'journey',
    icon: 'trophy',
    vi: { title: 'Hết hành trình', body: 'Hoàn thành cả 18 level.' },
    en: { title: 'Journey complete', body: 'Complete all 18 levels.' },
    check: (ctx) => allLevels.every((id) => (ctx.journey[id] ?? 0) >= 1),
  },
  {
    id: 'seven-days',
    group: 'days',
    icon: 'timer',
    vi: { title: 'Bảy ngày', body: 'Đóng dấu daily 7 ngày khác nhau.' },
    en: { title: 'Seven days', body: 'Stamp the daily on 7 different days.' },
    check: (ctx) => new Set(ctx.dailyDates).size >= 7,
  },
];

/** The ids of the achievements a context satisfies. */
export const earned = (ctx: AchievementContext): string[] =>
  ACHIEVEMENTS.filter((achievement) => achievement.check(ctx)).map((achievement) => achievement.id);
