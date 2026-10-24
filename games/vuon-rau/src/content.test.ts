import { checkSchema } from '@tohe/game-kit';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crops } from './content/crops.ts';
import { lineFor, lines } from './content/lines.ts';
import { ground, objects } from './content/map.ts';
import { dayPart } from './light.ts';

const assetId = z.string().regex(/^tiles\/tile-\d{4}$/);
const words = z.object({ vi: z.string().min(1), en: z.string().min(1) });

const Crop = z.object({
  id: z.string(),
  name: words,
  seedPrice: z.number().int().positive(),
  sellPrice: z.number().int().positive(),
  stages: z.number().int().min(1),
  ripeMinutes: z.number().positive(),
  art: z.object({ stages: z.array(assetId), produce: assetId, seed: assetId, crate: assetId }),
});

const Line = z.object({
  id: z.string(),
  when: z.object({
    time: z.enum(['morning', 'day', 'evening', 'night']).optional(),
    basket: z.boolean().optional(),
    noSeeds: z.boolean().optional(),
    firstSteps: z.boolean().optional(),
    harvested: z.boolean().optional(),
  }),
  vi: z.string().min(1).max(80),
  en: z.string().min(1).max(80),
});

describe('content', () => {
  it('crops and lines follow their schema', () => {
    expect(checkSchema(crops, Crop)).toEqual([]);
    expect(checkSchema(lines, Line)).toEqual([]);
  });

  it('every crop has a picture per stage and sells for more than its seed', () => {
    for (const crop of crops.items) {
      expect(crop.art.stages, crop.id).toHaveLength(crop.stages);
      expect(crop.sellPrice, crop.id).toBeGreaterThan(crop.seedPrice);
    }
  });

  it('the map names only tiles of the pack', () => {
    for (const placed of [...ground, ...objects]) {
      for (const id of placed.tiles) expect(assetId.safeParse(id).success, id).toBe(true);
    }
  });
});

describe('day and night', () => {
  it('splits the day by the local hour', () => {
    expect([0, 4.9, 5, 8.9, 9, 16.9, 17, 19.4, 19.5, 23, 24, -1].map(dayPart)).toEqual([
      'night',
      'night',
      'morning',
      'morning',
      'day',
      'day',
      'evening',
      'evening',
      'night',
      'night',
      'night',
      'night',
    ]);
  });
});

describe('Cô Ba', () => {
  const quiet = { time: 'day', basket: false, noSeeds: false, harvested: false } as const;

  it('first points at what to do: something to sell, then seeds to buy', () => {
    expect(lineFor({ ...quiet, basket: true, noSeeds: true }, 0).id).toBe('basket');
    expect(lineFor({ ...quiet, noSeeds: true }, 3).id).toBe('no-seeds');
  });

  it('otherwise takes turns among the lines that fit the time and the farm', () => {
    const said = [0, 1, 2, 3].map((n) => lineFor(quiet, n).id);
    expect(said).toEqual(['day', 'start', 'day', 'start']);
    expect(lineFor({ ...quiet, time: 'night', harvested: true }, 1).id).toBe('proud');
  });
});
