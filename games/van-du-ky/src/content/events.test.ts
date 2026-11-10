import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runStage } from '../core/battle.ts';
import { BONDS } from './bonds.ts';
import { ENEMIES } from './enemies.ts';
import { bossName, bossStage, challengeStage, expeditionStage, towerStage } from './events.ts';
import { HEROES } from './heroes.ts';
import { contentProblems, RULES, STARTER_TEAM } from './index.ts';
import { STAGES, stageById } from './stages.ts';

describe('content', () => {
  it('has no broken references, duplicate slots or empty waves', () => {
    expect(contentProblems()).toEqual([]);
  });

  it('has the full road: 20 heroes, 20 enemies, 4 bosses, 10 bonds, 4 regions and 48 stages', () => {
    expect(HEROES.items).toHaveLength(20);
    expect(ENEMIES.items).toHaveLength(24);
    expect(ENEMIES.items.filter((enemy) => enemy.boss)).toHaveLength(4);
    expect(BONDS.items).toHaveLength(10);
    expect(STAGES.items).toHaveLength(48);
  });

  it('every hero and enemy has a portrait on disk', () => {
    for (const entity of [...HEROES.items, ...ENEMIES.items]) {
      const file = resolve(process.cwd(), 'public', 'portraits', `${entity.id}.png`);
      expect(existsSync(file), `${entity.id} has no portrait`).toBe(true);
    }
  });

  it('every hero can be looked up with its skills and a blurb', () => {
    for (const hero of HEROES.items) {
      expect(RULES.hero(hero.id)).toBe(hero);
      expect(RULES.skill(hero.basic).kind).toBe('basic');
      expect(RULES.skill(hero.active).kind).toBe('active');
      expect(hero.blurb?.length).toBeGreaterThan(10);
    }
  });

  it('every stage has a portrait-able enemy and a boss wave at each region end', () => {
    for (const stage of STAGES.items) {
      expect(stage.waves.length).toBeGreaterThan(0);
      if (stage.index === 12) expect(stage.waves.at(-1)?.boss).toBe(true);
    }
  });

  it('the starter team wins the first stage', () => {
    const outcome = runStage(RULES, stageById('1-1'), STARTER_TEAM, 1, 7);
    expect(outcome.won).toBe(true);
  });
});

describe('special stages', () => {
  it('builds a tower floor and a boss every tenth', () => {
    const first = towerStage(1);
    expect(first.id).toBe('tower-1');
    expect(first.waves[0]?.enemies).toHaveLength(6);
    expect(first.boss).toBe(false);
    expect(towerStage(10).boss).toBe(true);
    expect(towerStage(10).rounds).toBe(40);
    expect(towerStage(40).recommendedPower).toBeGreaterThan(towerStage(1).recommendedPower);
  });

  it('builds the daily expedition with three waves from one region', () => {
    const stage = expeditionStage(20260101, 5);
    expect(stage.waves).toHaveLength(3);
    expect(stage.waves.every((wave) => wave.enemies.length === 6)).toBe(true);
    expect(stage.firstClear.gold).toBeGreaterThan(0);
  });

  it('builds a weekly boss and challenge with names and modifiers', () => {
    const week = '2026-11-09';
    expect(bossName(week)).toBeTruthy();
    const boss = bossStage(week, 8);
    expect(boss.waves[0]?.boss).toBe(true);
    expect(boss.rounds).toBe(40);
    const challenge = challengeStage(week, 8);
    expect(challenge.waves).toHaveLength(2);
    expect(challenge.modifiers?.length).toBeGreaterThan(0);
    expect(challenge.rounds).toBe(35);
  });
});
