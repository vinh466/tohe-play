import { describe, expect, it } from 'vitest';
import { BONDS } from './bonds.ts';
import { ENEMIES } from './enemies.ts';
import { GEAR } from './gear.ts';
import { HEROES } from './heroes.ts';
import { contentProblems, RULES, STARTER_TEAM } from './index.ts';
import { SKILLS } from './skills.ts';
import { DEPLOY_SLOTS, REGIONS, STAGES } from './stages.ts';

describe('content', () => {
  it('has no broken references, duplicate slots or empty waves', () => {
    expect(contentProblems()).toEqual([]);
  });

  it('has the full road: 20 heroes, 20 enemies, 4 bosses, 4 regions and 48 stages', () => {
    expect(HEROES.items).toHaveLength(20);
    expect(ENEMIES.items).toHaveLength(24);
    expect(ENEMIES.items.filter((enemy) => enemy.boss)).toHaveLength(4);
    expect(BONDS.items).toHaveLength(10);
    expect(REGIONS.items).toHaveLength(4);
    expect(STAGES.items).toHaveLength(48);
    expect(GEAR.items.length).toBeGreaterThanOrEqual(8);
    expect(SKILLS.items.length).toBeGreaterThanOrEqual(10);
  });

  it('every hero can be looked up with its skills and gear', () => {
    for (const hero of HEROES.items) {
      expect(RULES.hero(hero.id)).toBe(hero);
      expect(RULES.skill(hero.basic).kind).toBe('basic');
      expect(RULES.skill(hero.active).kind).toBe('active');
      expect(hero.blurb?.length).toBeGreaterThan(10);
    }
    for (const gear of GEAR.items) expect(RULES.gear(gear.id)).toBe(gear);
  });

  it('every enemy has a blurb and a portrait-sized identity', () => {
    for (const enemy of ENEMIES.items) expect(enemy.blurb?.length).toBeGreaterThan(10);
  });

  it('the deploy slots are six unique cells, two per rank', () => {
    expect(DEPLOY_SLOTS).toHaveLength(6);
    expect(new Set(DEPLOY_SLOTS.map((slot) => `${slot.row}:${slot.column}`)).size).toBe(6);
    expect(DEPLOY_SLOTS.filter((slot) => slot.row === 0)).toHaveLength(2);
    expect(DEPLOY_SLOTS.filter((slot) => slot.row === 1)).toHaveLength(2);
    expect(DEPLOY_SLOTS.filter((slot) => slot.row === 2)).toHaveLength(2);
  });

  it('the starter team is six heroes with a front/mid/back formation', () => {
    expect(STARTER_TEAM).toHaveLength(6);
    expect(new Set(STARTER_TEAM.map((hero) => `${hero.row}:${hero.column}`)).size).toBe(6);
    expect(STARTER_TEAM.filter((hero) => hero.row === 0)).toHaveLength(2);
    expect(STARTER_TEAM.filter((hero) => hero.row === 2)).toHaveLength(2);
  });

  it('the road has a rising recommended power, a boss at every region end and 12 stages per region', () => {
    const powers = STAGES.items.map((stage) => stage.recommendedPower);
    expect(powers).toEqual([...powers].sort((a, b) => a - b));
    for (const region of REGIONS.items) {
      const stages = STAGES.items.filter((stage) => stage.region === region.id);
      expect(stages).toHaveLength(12);
      expect(stages[11]?.boss).toBe(true);
      expect(stages[11]?.waves.at(-1)?.boss).toBe(true);
    }
    expect(new Set(STAGES.items.map((stage) => stage.id)).size).toBe(48);
  });
});
