// Balance report for the whole road: plays every stage with a plausible company/star curve and prints the result.
// Run with `pnpm --filter @tohe/game-van-du-ky sim`. It is a report, not a gate yet; the gate is the test below.

import { RULES, STARTER_TEAM } from '../content/index.ts';
import { REGION_PLANS, STAGES } from '../content/stages.ts';
import { runStage } from '../core/battle.ts';
import { heroPower } from '../core/stats.ts';

interface Row {
  stage: string;
  region: string;
  power: number;
  recommended: number;
  company: number;
  star: number;
  won: boolean;
  waves: number;
  hpLeft: number;
}

/** A rough growth curve over the 48 stages: the company reaches 20 and ★5 at the end of the road. */
function growth(index: number): { company: number; star: number } {
  return {
    company: 1 + Math.round((index * 19) / (STAGES.items.length - 1)),
    star: 1 + Math.min(4, Math.floor(index / 8)),
  };
}

const rows: Row[] = [];
for (const [index, stage] of STAGES.items.entries()) {
  const { company, star } = growth(index);
  const team = STARTER_TEAM.map((hero) => ({ ...hero, star }));
  const power = team.reduce(
    (sum, hero) =>
      sum + heroPower(RULES.hero(hero.heroId), { companyLevel: company, star, bond: true }, hero.row),
    0,
  );
  const outcome = runStage(RULES, stage, team, company, 2026 + index);
  const hpLeft =
    outcome.heroes.reduce((sum, hero) => sum + hero.hp, 0) /
    Math.max(
      1,
      outcome.heroes.reduce((sum, hero) => sum + hero.maxHp, 0),
    );
  rows.push({
    stage: stage.id,
    region: REGION_PLANS.find((plan) => plan.id === stage.region)?.name ?? stage.region,
    power,
    recommended: stage.recommendedPower,
    company,
    star,
    won: outcome.won,
    waves: outcome.waves,
    hpLeft: Math.round(hpLeft * 100),
  });
}

console.table(rows);

const lost = rows.filter((row) => !row.won);
if (lost.length > 0) {
  console.error(
    `balance: ${lost.length} stage(s) not winnable with the curve: ${lost.map((row) => row.stage).join(', ')}`,
  );
  process.exitCode = 1;
}
const trivial = rows.filter((row) => row.won && row.hpLeft >= 99 && row.waves >= 2);
if (trivial.length > STAGES.items.length / 3) {
  console.error(
    `balance: ${trivial.length}/${rows.length} stages end near full HP; the curve is too generous`,
  );
  process.exitCode = 1;
}
