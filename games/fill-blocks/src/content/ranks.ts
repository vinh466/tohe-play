// The mastery ladder: a personal best moves the player up; nothing decays. The names are Tò He's paper/ink words.
export interface Rank {
  readonly id: string;
  /** The best score that reaches this rank. */
  readonly at: number;
  readonly vi: string;
  readonly en: string;
}

export const RANKS: readonly Rank[] = [
  { id: 'seed', at: 0, vi: 'Mầm', en: 'Sprout' },
  { id: 'paper', at: 100, vi: 'Giấy', en: 'Paper' },
  { id: 'pen', at: 250, vi: 'Bút', en: 'Pen' },
  { id: 'ink', at: 500, vi: 'Mực', en: 'Ink' },
  { id: 'gac', at: 1000, vi: 'Gấc', en: 'Gac' },
  { id: 'turmeric', at: 1750, vi: 'Nghệ', en: 'Turmeric' },
  { id: 'leaf', at: 2750, vi: 'Lá', en: 'Leaf' },
  { id: 'lamp', at: 4000, vi: 'Đèn', en: 'Lamp' },
  { id: 'moon', at: 6000, vi: 'Trăng', en: 'Moon' },
  { id: 'artisan', at: 9000, vi: 'Nghệ nhân', en: 'Artisan' },
];

export interface RankAt {
  readonly rank: Rank;
  readonly index: number;
  /** The next rank, or null at the top. */
  readonly next: Rank | null;
}

export function rankOf(score: number): RankAt {
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (score >= (RANKS[i] as Rank).at) index = i;
  }
  return { rank: RANKS[index] as Rank, index, next: RANKS[index + 1] ?? null };
}

export const rankName = (score: number, locale: string): string => {
  const { rank } = rankOf(score);
  return locale.startsWith('vi') ? rank.vi : rank.en;
};
