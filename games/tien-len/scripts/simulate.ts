// Bots against bots, many hands (SPEC.md, "Bots"): average points per level and how long a decision takes.
//   pnpm --filter @tohe/game-tien-len simulate -- [hands] [levels, e.g. hard,normal,normal,normal] [hard budget]
import { decide, HARD_BUDGET, type Level } from '../src/bots.ts';
import { rules } from '../src/module.ts';
import { act, type State } from '../src/rules.ts';

const hands = Number(process.argv[2] ?? 200);
const levels = (process.argv[3] ?? 'normal,easy,easy,easy').split(',') as Level[];
const seats = levels.length;
const budget = Number(process.argv[4] ?? HARD_BUDGET);

const points = levels.map(() => 0);
const firsts = levels.map(() => 0);
const time: Record<string, { ms: number; n: number }> = {};
let carry: { leader: number | null } | null = null;
let seed = 1;
let moves = 0;

for (let h = 0; h < hands; h++) {
  let state: State = rules.setup({ seats, seed: seed++, carry });
  while (!state.over) {
    const status = rules.status(state);
    if (status.over) break;
    // Out-of-turn chops first, as the game and the API do.
    let acted = false;
    for (const seat of status.chop) {
      const action = decide(rules.view(state, seat), levels[seat] as Level, seed++, budget);
      if (!action) continue;
      const result = act(state, seat, action);
      if (result.ok) {
        state = result.state;
        acted = true;
        break;
      }
    }
    if (acted) continue;
    const seat = state.turn;
    const level = levels[seat] as Level;
    const started = performance.now();
    const action = decide(rules.view(state, seat), level, seed++, budget) ?? { type: 'pass' as const };
    const entry = time[level] ?? { ms: 0, n: 0 };
    time[level] = entry;
    entry.ms += performance.now() - started;
    entry.n++;
    const result = act(state, seat, action);
    if (!result.ok) throw new Error(`${level} bot at seat ${seat}: ${result.error}`);
    state = result.state;
    moves++;
  }
  const status = rules.status(state);
  if (!status.over) continue;
  status.result.points.forEach((p, s) => {
    points[s] = (points[s] ?? 0) + p;
  });
  const winner = status.result.ranking[0] as number;
  firsts[winner] = (firsts[winner] ?? 0) + 1;
  carry = status.carry;
}

console.log(`${hands} hands, ${seats} players, ${(moves / hands).toFixed(1)} moves a hand`);
levels.forEach((level, s) => {
  const avg = ((points[s] ?? 0) / hands).toFixed(2);
  const first = (((firsts[s] ?? 0) / hands) * 100).toFixed(0);
  console.log(`seat ${s} ${level.padEnd(6)} ${avg.padStart(6)} points a hand, first ${first}%`);
});
for (const [level, { ms, n }] of Object.entries(time)) {
  console.log(`${level.padEnd(6)} ${(ms / n).toFixed(2)} ms a decision (${n})`);
}
