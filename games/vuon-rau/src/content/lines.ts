// What Cô Ba says when tapped (SPEC.md, "The stall keeper"): one short line from those that fit the time of day and
// what the player has done. No quests. Vietnamese first; she speaks the way an aunt at a village stall would.
import { defineCatalog } from '@tohe/game-kit';
import type { DayPart } from '../light.ts';

/** When a line fits: every condition given must hold. */
export interface LineWhen {
  readonly time?: DayPart;
  /** The basket has something to sell. */
  readonly basket?: boolean;
  /** No seed of any crop left. */
  readonly noSeeds?: boolean;
  /** Nothing harvested yet on this farm. */
  readonly firstSteps?: boolean;
  /** At least one crop harvested. */
  readonly harvested?: boolean;
}

export const lines = defineCatalog('line', [
  {
    id: 'morning',
    when: { time: 'morning' },
    vi: 'Chào buổi sáng! Tưới rau sớm cho mát nhé.',
    en: 'Good morning! Water early while it is cool.',
  },
  {
    id: 'day',
    when: { time: 'day' },
    vi: 'Nắng đẹp ghê, rau lớn nhanh lắm đó.',
    en: 'What lovely sun. The vegetables grow fast today.',
  },
  {
    id: 'evening',
    when: { time: 'evening' },
    vi: 'Chiều rồi, thu hoạch xong thì ghé cô nha.',
    en: 'Evening already. Come by once you have harvested.',
  },
  {
    id: 'night',
    when: { time: 'night' },
    vi: 'Khuya rồi, rau cũng ngủ. Mai mình làm tiếp.',
    en: 'It is late, even the vegetables sleep. More tomorrow.',
  },
  {
    id: 'start',
    when: { firstSteps: true },
    vi: 'Cuốc đất, gieo hạt, tưới nước — rau sẽ tự lớn.',
    en: 'Dig, sow, water — the vegetables do the rest.',
  },
  {
    id: 'basket',
    when: { basket: true },
    vi: 'Giỏ có rau rồi kìa! Chạm vào quầy, cô mua hết cho.',
    en: 'Your basket has vegetables! Tap the stall and I will buy them all.',
  },
  {
    id: 'no-seeds',
    when: { noSeeds: true },
    vi: 'Hết hạt rồi hả? Quầy cô có bán đó.',
    en: 'Out of seeds? My stall has some.',
  },
  {
    id: 'proud',
    when: { harvested: true },
    vi: 'Rau con trồng ngon quá, cả xóm khen đó!',
    en: 'Your vegetables are so good, the whole village says so!',
  },
] as const satisfies readonly { id: string; when: LineWhen; vi: string; en: string }[]);

export type Line = (typeof lines.items)[number];

/** What decides which lines fit. */
export interface LineContext {
  time: DayPart;
  basket: boolean;
  noSeeds: boolean;
  harvested: boolean;
}

const fits = (when: LineWhen, context: LineContext) =>
  (when.time === undefined || when.time === context.time) &&
  (when.basket === undefined || when.basket === context.basket) &&
  (when.noSeeds === undefined || when.noSeeds === context.noSeeds) &&
  (when.firstSteps === undefined || when.firstSteps === !context.harvested) &&
  (when.harvested === undefined || when.harvested === context.harvested);

/**
 * The line Cô Ba says on the player's `nth` tap: what matters most first — something to sell, no seeds — then the others
 * that fit, in turn.
 */
export function lineFor(context: LineContext, nth: number): Line {
  if (context.basket) return lines.get('basket');
  if (context.noSeeds) return lines.get('no-seeds');
  const fitting = lines.items.filter((line) => fits(line.when, context));
  return fitting[Math.abs(Math.trunc(nth)) % fitting.length] ?? lines.get('day');
}
