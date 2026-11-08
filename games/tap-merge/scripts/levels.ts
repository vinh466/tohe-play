// Generates the Journey levels from real runs (SPEC.md, "Hành Trình"; plan D-07/E-03).
//
//   pnpm --filter @tohe/game-tap-merge levels
//
// It plays real games with the real rules, freezes states one or two doublings below each target, then plays each
// frozen level with a child-like bot to calibrate the par. No level is hand-built; the checked-in
// `src/content/levels.data.ts` is the result. A level the bot cannot finish is rejected.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  cellAt,
  type Exponent,
  group,
  hasMove,
  newGame,
  random,
  type State,
  shuffle,
  tap,
} from '../src/logic.ts';

interface Candidate {
  grid: Exponent[];
  rng: number;
  top: Exponent;
  seed: number;
  /** The tap in the original run; a later one is closer to the target. */
  at: number;
}

interface Plan {
  chapter: number;
  index: number;
  target: Exponent;
}

/** 3 chapters × 8 levels; the last of each is the chapter gate. */
const PLAN: readonly Plan[] = [
  ...[8, 9, 10, 10, 11, 11, 12, 13].map((target, index) => ({ chapter: 1, index: index + 1, target })),
  ...[11, 12, 12, 13, 13, 14, 14, 15].map((target, index) => ({ chapter: 2, index: index + 1, target })),
  ...[12, 13, 14, 14, 15, 15, 15, 15].map((target, index) => ({ chapter: 3, index: index + 1, target })),
];

const INTROS: readonly { vi: string; en: string }[] = [
  {
    vi: 'Một hạt mầm nhỏ. Chạm hai khối giống nhau để lớn lên.',
    en: 'A tiny seed. Tap two equal blocks to grow.',
  },
  { vi: 'Mỗi lần gom, một chiếc lá mới.', en: 'Every gather grows another leaf.' },
  { vi: '1K rồi! Khu vườn bắt đầu có nắng.', en: '1K! The garden catches the sun.' },
  { vi: 'Thử gom cả một hàng xem sao.', en: 'Try gathering a whole row.' },
  { vi: '2K — một cành lớn đã mọc.', en: '2K — a big branch has grown.' },
  { vi: 'Vẫn là 2K, nhưng ít nước hơn: một cành khéo.', en: 'Still 2K, but in fewer taps: a clever branch.' },
  { vi: '4K — bông hoa đầu tiên.', en: '4K — the first flower.' },
  { vi: '8K — cánh cổng của chặng Mầm.', en: '8K — the gate of the Sprout chapter.' },
  { vi: 'Chặng Chồi: những khối lớn hơn, những bước dài hơn.', en: 'Shoot: bigger blocks, longer steps.' },
  { vi: 'Một bàn đã có sẵn 1K; hãy làm ra 2K.', en: 'The board already holds a 1K; make a 2K.' },
  { vi: '2K trong tầm tay. Gom thật khéo.', en: '2K is within reach. Gather well.' },
  { vi: '4K — giữ nhịp, đừng vội.', en: '4K — keep the rhythm, no rush.' },
  { vi: 'Từ 2K lên 8K: một chặng lớn.', en: 'From 2K to 8K: a big step.' },
  { vi: '8K rồi! Cánh đồng đang mở ra.', en: '8K! The field opens.' },
  { vi: '16K — một ngọn núi nhỏ.', en: '16K — a small mountain.' },
  { vi: '32K — chạm tới mây.', en: '32K — touch the clouds.' },
  { vi: 'Chặng Lá: những con số đã lớn.', en: 'Leaf: the numbers are grown.' },
  { vi: '4K trên bàn; mục tiêu là 8K.', en: 'A 4K is on the board; the goal is 8K.' },
  { vi: '8K lên 16K: một bước dài.', en: '8K to 16K: a long step.' },
  { vi: '16K — hồ nước phản chiếu.', en: '16K — the lake reflects.' },
  { vi: '32K — một cánh rừng.', en: '32K — a forest.' },
  { vi: '32K — một bước dài, thật khéo.', en: '32K — a long step, well gathered.' },
  {
    vi: 'Vẫn 32K, nhưng ít nước hơn: một cánh rừng gọn.',
    en: 'Still 32K, but in fewer taps: a tidy forest.',
  },
  { vi: '32K — bầu trời rộng mở.', en: '32K — the sky opens.' },
  { vi: 'Cánh cổng của chặng Lá: 32K, thật đẹp.', en: 'The gate of Leaf: 32K, beautifully made.' },
];

const CAP = 7000;
const BOT_RUNS = 12;
const TAPS_CAP = 450;
const MAX_PAR = 450;
const SEEDS = 64;

/** Play a frozen level until the target; null when the bot gets stuck first. */
function playLevel(start: State, target: Exponent, botSeed: number): number | null {
  let state = start;
  let taps = 0;
  let randomState = botSeed >>> 0;
  while (state.top < target && !state.over && taps < TAPS_CAP) {
    if (!hasMove(state.grid)) {
      if (state.shuffles <= 0) return null;
      const rescued = shuffle(state);
      if (!rescued.ok) return null;
      state = rescued.state;
      continue;
    }
    const options = state.grid
      .map((_, index) => ({ index, size: group(state.grid, cellAt(index)).length }))
      .filter((option) => option.size > 0);
    const [roll, after] = random(randomState);
    randomState = after;
    const pick = options[Math.floor(roll * options.length)];
    if (!pick) return null;
    const played = tap(state, cellAt(pick.index));
    if (!played.ok) return null;
    state = played.state;
    taps++;
  }
  return state.top >= target ? taps : null;
}

/** A frozen level state: score and moves reset, the board and PRNG kept. */
function freeze(candidate: Candidate, levelId: string): State {
  return {
    version: 1,
    grid: [...candidate.grid],
    score: 0,
    best: 0,
    moves: 0,
    shuffles: 3,
    shufflesUsed: 0,
    top: candidate.top,
    over: false,
    rng: candidate.rng,
    mode: 'journey',
    level: levelId,
    moveLimit: null,
  };
}

const round5 = (value: number): number => Math.max(15, Math.round(value / 5) * 5);
const pct = (values: number[], p: number): number =>
  values[Math.min(values.length - 1, Math.floor(p * values.length))] ?? 0;

function calibrate(level: State, target: Exponent): { three: number; two: number; taps: number[] } | null {
  const taps: number[] = [];
  for (let bot = 0; bot < BOT_RUNS; bot++) {
    const result = playLevel({ ...level, grid: [...level.grid] }, target, 17_000 + bot * 7919);
    if (result === null) return null;
    taps.push(result);
  }
  taps.sort((a, b) => a - b);
  const three = round5(pct(taps, 0.5));
  const two = Math.max(three + 10, round5(pct(taps, 0.75)));
  if (two > MAX_PAR) return null;
  return { three, two, taps };
}

/** All candidate snapshots one or two doublings below each target, from real runs. Every 30 taps adds one. */
function collectCandidates(): Map<Exponent, Candidate[]> {
  const wanted = new Set(PLAN.flatMap((level) => [level.target - 1, level.target - 2]));
  const found = new Map<Exponent, Candidate[]>();
  for (let game = 0; game < SEEDS; game++) {
    const seed = 1000 + game * 7;
    let state = newGame(seed);
    let taps = 0;
    let randomState = (seed * 7919 + 13) >>> 0;
    const lastAt = new Map<Exponent, number>();
    while (!state.over && taps < CAP && state.top < 18) {
      if (!hasMove(state.grid)) {
        const rescued = shuffle(state);
        if (!rescued.ok) break;
        state = rescued.state;
        continue;
      }
      const options = state.grid
        .map((_, index) => ({ index, size: group(state.grid, cellAt(index)).length }))
        .filter((option) => option.size > 0);
      const [roll, after] = random(randomState);
      randomState = after;
      const pick = options[Math.floor(roll * options.length)];
      if (!pick) break;
      const played = tap(state, cellAt(pick.index));
      if (!played.ok) break;
      state = played.state;
      taps++;
      if (!wanted.has(state.top) || state.over || !hasMove(state.grid)) continue;
      const top = Math.max(...state.grid);
      if (top !== state.top) continue;
      const previous = lastAt.get(top) ?? -Infinity;
      if (taps - previous < 30) continue;
      lastAt.set(top, taps);
      const list = found.get(top) ?? [];
      if (list.length < 96) list.push({ grid: [...state.grid], rng: state.rng, top, seed, at: taps });
      found.set(top, list);
    }
  }
  return found;
}

const desiredTaps = (chapter: number): number => (chapter === 1 ? 70 : chapter === 2 ? 120 : 160);
const candidates = collectCandidates();
const used = new Set<string>();
const levels: {
  id: string;
  chapter: number;
  index: number;
  start: Exponent[];
  rng: number;
  top: Exponent;
  target: Exponent;
  par: { three: number; two: number };
  shuffles: number;
  intro: { vi: string; en: string };
}[] = [];

for (const plan of PLAN) {
  const id = `c${plan.chapter}-${plan.index}`;
  const intro = (INTROS[(plan.chapter - 1) * 8 + (plan.index - 1)] ?? INTROS[0]) as {
    vi: string;
    en: string;
  };
  const options = [
    ...(candidates.get(plan.target - 2) ?? []),
    ...(candidates.get(plan.target - 1) ?? []),
  ].sort((a, b) => a.at - b.at);
  let best: { level: (typeof levels)[number]; score: number; taps: number[] } | null = null;
  let tried = 0;
  for (const candidate of options) {
    if (tried >= 24) break;
    const start = Math.max(...candidate.grid);
    if (start !== candidate.top || start >= plan.target || plan.target - start > 2) continue;
    if (!hasMove(candidate.grid)) continue;
    const key = candidate.grid.join(',');
    if (used.has(key)) continue;
    tried++;
    const frozen = freeze(candidate, id);
    const par = calibrate(frozen, plan.target);
    if (!par) continue;
    const score = Math.abs(par.three - desiredTaps(plan.chapter)) + (par.two > MAX_PAR ? 1000 : 0);
    const level = {
      id,
      chapter: plan.chapter,
      index: plan.index,
      start: candidate.grid,
      rng: candidate.rng,
      top: candidate.top,
      target: plan.target,
      par: { three: par.three, two: par.two },
      shuffles: 3,
      intro,
    };
    if (!best || score < best.score) best = { level, score, taps: par.taps };
  }
  if (!best) throw new Error(`No valid snapshot for ${id} (target 2^${plan.target})`);
  used.add(best.level.start.join(','));
  levels.push(best.level);
  console.log(
    `${id}: target ${2 ** plan.target}, start ${2 ** best.level.top}, ` +
      `taps 3★ ${best.level.par.three} / 2★ ${best.level.par.two} ` +
      `(raw ${best.taps[0]}–${best.taps[best.taps.length - 1]}, tried ${tried})`,
  );
}

const header = `// Generated by scripts/levels.ts from real runs; do not hand-edit. Re-run:
//   pnpm --filter @tohe/game-tap-merge levels
// Every start is a full board from a run one or two doublings below the target; the par comes from a child-like bot.
export const LEVELS_DATA = `;
const body = JSON.stringify(levels, null, 2).replace(/"start": \[\s*([\d,\s]+?)\s*\]/g, (_, nums: string) => {
  const values = nums.split(/[,\s]+/).filter(Boolean);
  return `"start": [${values.join(',')}]`;
});
const target = fileURLToPath(new URL('../src/content/levels.data.ts', import.meta.url));
writeFileSync(target, `${header}${body} as const;\n`);
console.log(`\n${levels.length} levels written to ${target}`);
