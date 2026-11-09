import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies.ts';
import { GEAR } from './gear.ts';
import { HEROES } from './heroes.ts';
import { contentProblems, RULES, STARTER_TEAM } from './index.ts';
import { SKILLS } from './skills.ts';
import { REGIONS, STAGES } from './stages.ts';

describe('content', () => {
  it('has no broken references, duplicate slots or empty waves', () => {
    expect(contentProblems()).toEqual([]);
  });

  it('has the first slice: 6 heroes, 6 enemies, 1 boss and 12 stages', () => {
    expect(HEROES.items).toHaveLength(6);
    expect(ENEMIES.items).toHaveLength(7);
    expect(STAGES.items).toHaveLength(12);
    expect(REGIONS.items).toHaveLength(1);
    expect(GEAR.items.length).toBeGreaterThanOrEqual(8);
    expect(SKILLS.items.length).toBeGreaterThanOrEqual(10);
  });

  it('every hero can be looked up with its skills and gear', () => {
    for (const hero of HEROES.items) {
      expect(RULES.hero(hero.id)).toBe(hero);
      expect(RULES.skill(hero.basic).kind).toBe('basic');
      expect(RULES.skill(hero.active).kind).toBe('active');
    }
    for (const gear of GEAR.items) expect(RULES.gear(gear.id)).toBe(gear);
  });

  it('the starter team is six heroes with a front/mid/back formation', () => {
    expect(STARTER_TEAM).toHaveLength(6);
    expect(new Set(STARTER_TEAM.map((hero) => `${hero.row}:${hero.column}`)).size).toBe(6);
    expect(STARTER_TEAM.filter((hero) => hero.row === 0)).toHaveLength(2);
    expect(STARTER_TEAM.filter((hero) => hero.row === 2)).toHaveLength(2);
  });

  it('the region has a rising recommended power and a boss at the end', () => {
    const powers = STAGES.items.map((stage) => stage.recommendedPower);
    expect(powers).toEqual([...powers].sort((a, b) => a - b));
    expect(STAGES.get('1-12').boss).toBe(true);
  });
});
