import { describe, expect, it } from 'vitest';
import {
  beats,
  type Combo,
  classify,
  combosIn,
  comboValue,
  isChop,
  leftoverValue,
  sortHand,
  split,
} from './cards.ts';
import { c, cs } from './testing.ts';

const combo = (text: string) => classify(cs(text)) as Combo;
const plain = { pairsBeatTwoPair: false };

describe('cards', () => {
  it('orders ranks 3 … A, 2 and suits ♠ ♣ ♦ ♥', () => {
    expect(c('3♠')).toBe(0);
    expect(c('2♥')).toBe(51);
    expect(c('A♥')).toBeLessThan(c('2♠'));
    expect(c('7♠')).toBeLessThan(c('7♣'));
    expect(c('7♦')).toBeLessThan(c('7♥'));
  });
});

describe('classify', () => {
  it.each([
    ['7♦', 'single', 1],
    ['9♠ 9♥', 'pair', 1],
    ['Q♣ Q♦ Q♥', 'triple', 1],
    ['J♠ J♣ J♦ J♥', 'quad', 1],
    ['5♠ 6♦ 7♣', 'straight', 3],
    ['10♠ J♦ Q♣ K♥ A♠', 'straight', 5],
    ['4♠ 4♥ 5♣ 5♦ 6♠ 6♥', 'pairs', 3],
    ['3♠ 3♣ 4♠ 4♣ 5♠ 5♣ 6♠ 6♣', 'pairs', 4],
  ])('%s is a %s', (text, kind, ranks) => {
    expect(combo(text)).toMatchObject({ kind, ranks, top: Math.max(...cs(text)) });
  });

  it.each([
    ['nothing', ''],
    ['two ranks', '4♠ 5♠'],
    ['a straight through 2', 'K♠ A♠ 2♠'],
    ['a gap', '5♠ 6♠ 8♠'],
    ['pairs through 2', 'K♠ K♥ A♠ A♥ 2♠ 2♥'],
    ['two pairs only', '4♠ 4♥ 5♣ 5♦'],
    ['a triple in a double straight', '4♠ 4♥ 4♦ 5♣ 5♦ 6♠ 6♥'],
  ])('%s is no combination', (_, text) => {
    expect(classify(cs(text))).toBeNull();
  });

  it('refuses repeated cards and cards outside the deck', () => {
    expect(classify([5, 5])).toBeNull();
    expect(classify([52])).toBeNull();
    expect(classify([-1])).toBeNull();
  });
});

describe('beats', () => {
  it('needs the same kind, size and a higher top card', () => {
    expect(beats(combo('8♣'), combo('8♠'), plain)).toBe(true);
    expect(beats(combo('8♠'), combo('8♣'), plain)).toBe(false);
    expect(beats(combo('9♠ 9♣'), combo('8♦ 8♥'), plain)).toBe(true);
    expect(beats(combo('9♠ 9♣'), combo('8♦'), plain)).toBe(false);
    expect(beats(combo('4♠ 5♠ 6♠ 7♥'), combo('3♠ 4♣ 5♦ 6♦'), plain)).toBe(true);
    expect(beats(combo('4♠ 5♠ 6♠ 7♥'), combo('3♠ 4♣ 5♦'), plain)).toBe(false);
    expect(beats(combo('4♠'), null, plain)).toBe(true);
  });

  it('lets bombs chop 2s and smaller bombs (SPEC.md, "A hand" step 6)', () => {
    const threePairs = combo('4♠ 4♥ 5♣ 5♦ 6♠ 6♥');
    const quad = combo('9♠ 9♣ 9♦ 9♥');
    const fourPairs = combo('3♠ 3♣ 4♣ 4♦ 5♠ 5♥ 6♣ 6♦');
    const two = combo('2♥');
    const twoPair = combo('2♠ 2♦');
    expect([threePairs, quad, fourPairs].map((bomb) => beats(bomb, two, plain))).toEqual([true, true, true]);
    expect([threePairs, quad, fourPairs].map((bomb) => beats(bomb, twoPair, plain))).toEqual([
      false,
      true,
      true,
    ]);
    expect(beats(threePairs, twoPair, { pairsBeatTwoPair: true })).toBe(true);
    expect(beats(quad, threePairs, plain)).toBe(true);
    expect(beats(threePairs, quad, plain)).toBe(false);
    expect(beats(fourPairs, quad, plain)).toBe(true);
    expect(beats(quad, fourPairs, plain)).toBe(false);
    expect(beats(combo('10♠ 10♣ 10♦ 10♥'), quad, plain)).toBe(true);
    expect(beats(combo('7♠ 7♣ 8♠ 8♣ 9♠ 9♣'), threePairs, plain)).toBe(true);
    expect(beats(quad, combo('A♥'), plain)).toBe(false);
    expect(beats(quad, combo('2♠ 2♦ 2♥'), plain)).toBe(false);
  });

  it('counts a bomb on 2s or on a bomb as a chop, worth what it beat', () => {
    expect(isChop(combo('9♠ 9♣ 9♦ 9♥'), combo('2♥'))).toBe(true);
    expect(isChop(combo('9♠ 9♣ 9♦ 9♥'), combo('4♠ 4♥ 5♣ 5♦ 6♠ 6♥'))).toBe(true);
    expect(isChop(combo('9♠ 9♣ 9♦ 9♥'), null)).toBe(false);
    expect(comboValue(combo('2♠'))).toBe(1);
    expect(comboValue(combo('2♥'))).toBe(2);
    expect(comboValue(combo('2♣ 2♦'))).toBe(3);
    expect(comboValue(combo('4♠ 4♥ 5♣ 5♦ 6♠ 6♥'))).toBe(2);
    expect(comboValue(combo('9♠ 9♣ 9♦ 9♥'))).toBe(3);
    expect(comboValue(combo('3♠ 3♣ 4♣ 4♦ 5♠ 5♥ 6♣ 6♦'))).toBe(4);
  });
});

describe('a hand', () => {
  it('lists every kind of combination it holds', () => {
    const kinds = new Set(combosIn(cs('3♠ 3♥ 4♠ 4♦ 5♣ 5♥ 6♠ 9♠ 9♣ 9♦ 9♥ 2♥ K♦')).map((x) => x.kind));
    expect(kinds).toEqual(new Set(['single', 'pair', 'triple', 'quad', 'straight', 'pairs']));
  });

  it('offers every top card of a straight, so it can beat any straight it is able to', () => {
    const straights = combosIn(cs('5♠ 6♠ 7♠ 7♥')).filter((x) => x.kind === 'straight');
    expect(straights.map((x) => x.top)).toEqual([c('7♠'), c('7♥')]);
  });

  it('splits into bombs, long straights, then sets', () => {
    const parts = split(cs('3♠ 4♣ 5♦ 6♥ 7♠ 9♠ 9♣ 9♦ 9♥ Q♠ Q♥ 2♦ K♣'));
    expect(parts.map((x) => x.kind).sort()).toEqual(['pair', 'quad', 'single', 'single', 'straight']);
  });

  it('counts what is left over: 2s one by one, and bombs', () => {
    expect(leftoverValue(cs('2♠ 2♥ 5♦'))).toBe(3);
    expect(leftoverValue(cs('9♠ 9♣ 9♦ 9♥ 4♠'))).toBe(3);
    expect(leftoverValue(cs('4♠ 4♥ 5♣ 5♦ 6♠ 6♥ 2♣'))).toBe(3);
    expect(leftoverValue(cs('3♠ 4♣ 5♦'))).toBe(0);
  });

  it('sorts by rank or by combinations, keeping every card', () => {
    const hand = cs('2♦ 9♠ 3♠ 4♣ 5♦ 9♣ K♣');
    expect(sortHand(hand, 'rank')).toEqual([...hand].sort((a, b) => a - b));
    const grouped = sortHand(hand, 'combos');
    expect([...grouped].sort((a, b) => a - b)).toEqual([...hand].sort((a, b) => a - b));
    expect(grouped.slice(0, 3)).toEqual(cs('3♠ 4♣ 5♦'));
    expect(grouped[grouped.length - 1]).toBe(c('2♦'));
  });
});
