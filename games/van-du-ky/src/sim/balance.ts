// Balance report for the first slice: plays every stage with a plausible company/star curve and prints the result.
// Run with `pnpm --filter @tohe/game-van-du-ky sim`. It is a report, not a gate yet; the gate is the test below.

import { RULES, STARTER_TEAM } from '../content/index.ts';
import { STAGES } from '../content/stages.ts';
import { runStage } from '../core/battle.ts';
import { heroPower } from '../core/stats.ts';

interface Row {
  stage: string;
  power: number;
  company: number;
  star: number;
  won: boolean;
  waves: number;
  hpLeft: number;
}

/** A rough growth curve: the player levels the company and stars as the road goes on. */
function growth(index: number): { company: number; star: number } {
  return {
    company: Math.min(20, 1 + Math.floor(index * 1.1)),
    star: index < 4 ? 1 : index < 8 ? 2 : 3,
  };
}

const rows: Row[] = [];
for (const stage of STAGES.items) {
  const { company, star } = growth(stage.index);
  const team = STARTER_TEAM.map((hero) => ({ ...hero, star }));
  const power = team.reduce(
    (sum, hero) => sum + heroPower(RULES.hero(hero.heroId), { companyLevel: company, star }, hero.row),
    0,
  );
  const outcome = runStage(RULES, stage, team, company, 2026 + stage.index);
  const hpLeft =
    outcome.heroes.reduce((sum, hero) => sum + hero.hp, 0) /
    Math.max(
      1,
      outcome.heroes.reduce((sum, hero) => sum + hero.maxHp, 0),
    );
  rows.push({
    stage: stage.id,
    power,
    company,
    star,
    won: outcome.won,
    waves: outcome.waves,
    hpLeft: Math.round(hpLeft * 100),
  });
}

console.table(rows);

const first = rows[0];
if (!first?.won) {
  console.error('balance: the first stage is not winnable with the starter team');
  process.exitCode = 1;
}
const last = rows.at(-1);
if (last && last.won && last.company <= 2) {
  console.error('balance: the last stage is trivial at company 2');
  process.exitCode = 1;
}
