import { describe, expect, it } from 'vitest';
import { RULES, STARTER_TEAM } from '../content/index.ts';
import { stageById } from '../content/stages.ts';
import { basicAttack, cast, createBattle, runBattle, runStage, step, turnOrder } from './battle.ts';
import type { HeroLoadout } from './types.ts';

const stage = stageById('1-1');

function battle(seed = 7, heroes: readonly HeroLoadout[] = STARTER_TEAM, autoCast = true) {
  return createBattle(RULES, {
    seed,
    companyLevel: 1,
    heroes,
    enemies: stage.waves[0]!.enemies,
    autoCast,
  });
}

describe('battle setup', () => {
  it('builds six heroes and the wave enemies with a stable SPD order', () => {
    const state = battle();
    expect(state.units).toHaveLength(9);
    expect(state.order).toEqual(turnOrder(state.units));
    const speeds = state.order.map((id) => state.units.find((unit) => unit.id === id)!.base.spd);
    expect(speeds).toEqual([...speeds].sort((a, b) => b - a));
  });

  it('replays the same seed to the same result and events', () => {
    const a = battle(42);
    const b = battle(42);
    runBattle(a, RULES);
    runBattle(b, RULES);
    expect(a.result).toBe(b.result);
    expect(a.events).toEqual(b.events);
    expect(a.units.map((unit) => unit.hp)).toEqual(b.units.map((unit) => unit.hp));
  });

  it('can win the first stage with the starter team', () => {
    const state = battle(7);
    runBattle(state, RULES);
    expect(state.result).toBe('win');
  });
});

describe('manual turns', () => {
  it('waits for a hero and lets it cast an active when charged', () => {
    const state = battle(7, STARTER_TEAM, false);
    while (!state.pending && state.result === 'ongoing') step(state, RULES);
    expect(state.pending).not.toBeNull();
    const actor = state.units.find((unit) => unit.id === state.pending!.unitId)!;
    actor.charge = actor.activeCharge;
    const events = cast(state, RULES, actor.id, actor.active);
    expect(events.length).toBeGreaterThan(0);
    expect(actor.charge).toBe(0);
  });

  it('a basic attack charges the active', () => {
    const state = battle(7, STARTER_TEAM, false);
    while (!state.pending && state.result === 'ongoing') step(state, RULES);
    const actor = state.units.find((unit) => unit.id === state.pending!.unitId)!;
    const before = actor.charge;
    basicAttack(state, RULES, actor.id);
    expect(actor.charge).toBe(Math.min(actor.activeCharge, before + 1));
  });
});

describe('stage runner', () => {
  it('clears the first stage and carries the heroes', () => {
    const outcome = runStage(RULES, stage, STARTER_TEAM, 1, 7);
    expect(outcome.won).toBe(true);
    expect(outcome.waves).toBe(1);
    expect(outcome.heroes).toHaveLength(6);
    expect(outcome.heroes.every((hero) => hero.hp >= 0)).toBe(true);
  });
});
