import { describe, expect, it } from 'vitest';
import {
  chooseRiftBlessings,
  chooseRiftRelics,
  createRiftRun,
  RIFT_NODES,
  riftModifiers,
  riftNodeReward,
  riftStage,
} from './rift.ts';

describe('rift', () => {
  it('is six stops: four battles, an event, an elite and a boss', () => {
    expect(RIFT_NODES).toHaveLength(6);
    expect(RIFT_NODES.filter((node) => node.kind === 'battle')).toHaveLength(3);
    expect(RIFT_NODES.filter((node) => node.kind === 'event')).toHaveLength(1);
    expect(RIFT_NODES.filter((node) => node.kind === 'elite')).toHaveLength(1);
    expect(RIFT_NODES.filter((node) => node.kind === 'boss')).toHaveLength(1);
    const run = createRiftRun(1234);
    expect(run.relic).toBeNull();
    expect(run.blessings).toEqual([]);
    expect(riftModifiers(run)).toEqual([]);
  });

  it('offers three unique relics and three fresh blessings', () => {
    const relics = chooseRiftRelics(99);
    expect(relics).toHaveLength(3);
    expect(new Set(relics.map((relic) => relic.id)).size).toBe(3);
    const run = createRiftRun(99);
    run.relic = relics[0]!;
    const first = chooseRiftBlessings(run);
    expect(first).toHaveLength(3);
    expect(new Set(first.map((blessing) => blessing.id)).size).toBe(3);
    run.blessings.push(first[0]!);
    const second = chooseRiftBlessings(run);
    expect(second.some((blessing) => blessing.id === first[0]!.id)).toBe(false);
    expect(riftModifiers(run)).toHaveLength(2);
  });

  it('generates a legal stage per stop with a boss at the end', () => {
    const run = createRiftRun(7);
    for (let index = 0; index < run.nodes.length; index++) {
      const stage = riftStage(run, index, 1);
      expect(stage.waves).toHaveLength(1);
      const slots = stage.waves[0]!.enemies.map((enemy) => `${enemy.row}:${enemy.column}`);
      expect(new Set(slots).size).toBe(slots.length);
      expect(stage.waves[0]!.enemies.length).toBeGreaterThan(0);
      expect(stage.loot.gold).toBe(0);
      expect(stage.firstClear.gold).toBe(0);
      expect(stage.boss === true).toBe(run.nodes[index]!.kind === 'boss');
      if (run.nodes[index]!.kind === 'boss') expect(stage.waves[0]!.enemies.length).toBe(3);
    }
  });

  it('pays every stop and a boss bonus', () => {
    expect(riftNodeReward(0).gold).toBeLessThan(riftNodeReward(3).gold);
    expect(riftNodeReward(5, true).shards).toBeGreaterThan(0);
    expect(riftNodeReward(1).shards).toBe(0);
  });
});
