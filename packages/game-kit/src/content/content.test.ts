import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  type Catalog,
  checkReferences,
  checkSchema,
  defineCatalog,
  type IdOf,
  type SchemaValidator,
} from './index.ts';

const seeds = defineCatalog('seed', [
  { id: 'rice-seed', texture: 'seed.rice' },
  { id: 'corn-seed', texture: 'seed.corn' },
] as const);

const crops = defineCatalog('crop', [
  { id: 'rice', seed: 'rice-seed', days: 3, drops: ['straw'] },
  { id: 'corn', seed: 'corn-seed', days: 5, drops: [] },
] as const);

describe('defineCatalog', () => {
  it('keeps the kind, the items in order and their ids', () => {
    expect(crops.kind).toBe('crop');
    expect(crops.items.map((c) => c.id)).toEqual(['rice', 'corn']);
    expect(crops.ids).toEqual(['rice', 'corn']);
  });

  it('finds an item by id and says whether an id is there', () => {
    expect(crops.get('corn').days).toBe(5);
    expect(crops.has('rice')).toBe(true);
    expect(crops.has('wheat')).toBe(false);
  });

  it('throws naming the kind and the id when get is asked for an id it does not have', () => {
    expect(() => crops.get('wheat' as IdOf<typeof crops>)).toThrow(/crop.*"wheat"/);
  });

  it('is frozen, and so are its lists', () => {
    expect(Object.isFrozen(crops)).toBe(true);
    expect(Object.isFrozen(crops.items)).toBe(true);
    expect(Object.isFrozen(crops.ids)).toBe(true);
  });

  it('does not change when the array it was made from changes', () => {
    const source = [{ id: 'a' }, { id: 'b' }];
    const catalog = defineCatalog('letter', source);
    source.push({ id: 'c' });
    expect(catalog.ids).toEqual(['a', 'b']);
  });

  it('throws at once on a duplicate id, naming the kind and the id', () => {
    expect(() => defineCatalog('level', [{ id: 'one' }, { id: 'two' }, { id: 'one' }])).toThrow(
      'defineCatalog(level): duplicate id "one"',
    );
  });

  it('throws at once on an empty or missing id, naming the kind', () => {
    expect(() => defineCatalog('level', [{ id: '' }])).toThrow('defineCatalog(level)');
    expect(() => defineCatalog('level', [{} as { id: string }])).toThrow('defineCatalog(level)');
  });

  it('throws on an empty kind', () => {
    expect(() => defineCatalog('', [{ id: 'a' }])).toThrow(/kind/);
  });

  it('accepts an empty list', () => {
    const empty = defineCatalog('quest', []);
    expect(empty.items).toEqual([]);
    expect(empty.has('any')).toBe(false);
  });

  it('types its ids as the union of their literals', () => {
    expectTypeOf(crops.kind).toEqualTypeOf<'crop'>();
    expectTypeOf<IdOf<typeof crops>>().toEqualTypeOf<'rice' | 'corn'>();
    expectTypeOf(crops.ids).toEqualTypeOf<readonly ('rice' | 'corn')[]>();
    expectTypeOf(crops.get('rice').days).toEqualTypeOf<3>();
    expectTypeOf(crops).toExtend<Catalog>();
    // @ts-expect-error an id the catalog does not have
    expect(() => crops.get('wheat')).toThrow();
  });

  it('narrows a string with has', () => {
    const id: string = 'rice';
    if (crops.has(id)) expectTypeOf(id).toEqualTypeOf<'rice' | 'corn'>();
  });
});

describe('checkReferences', () => {
  it('is empty when every reference resolves', () => {
    expect(checkReferences([{ from: crops, field: 'seed', to: seeds, ids: (crop) => [crop.seed] }])).toEqual(
      [],
    );
  });

  it('reports each missing id with the kind, the item and the field', () => {
    const straws = defineCatalog('item', [{ id: 'hay' }]);
    expect(
      checkReferences([
        { from: crops, field: 'seed', to: seeds, ids: (crop) => [crop.seed] },
        { from: crops, field: 'drops', to: straws, ids: (crop) => crop.drops },
      ]),
    ).toEqual([{ kind: 'crop', id: 'rice', field: 'drops', missing: 'straw' }]);
  });

  it('handles optional fields through the ids function', () => {
    const levels = defineCatalog('level', [
      { id: 'l1', next: 'l2' },
      { id: 'l2', next: 'l9' },
      { id: 'l3' },
    ] as const);
    expect(
      checkReferences([
        { from: levels, field: 'next', to: levels, ids: (level) => ('next' in level ? [level.next] : []) },
      ]),
    ).toEqual([{ kind: 'level', id: 'l2', field: 'next', missing: 'l9' }]);
  });

  it('types the item each rule hands to its ids function', () => {
    checkReferences([
      {
        from: crops,
        field: 'seed',
        to: seeds,
        ids: (crop) => {
          expectTypeOf(crop.seed).toEqualTypeOf<'rice-seed' | 'corn-seed'>();
          return [crop.seed];
        },
      },
      {
        from: seeds,
        field: 'texture',
        to: seeds,
        ids: (seed) => {
          expectTypeOf(seed.texture).toEqualTypeOf<'seed.rice' | 'seed.corn'>();
          return [];
        },
      },
    ]);
  });
});

// A validator of Zod's shape, without Zod: `days` must be a positive whole number.
const PositiveDays: SchemaValidator = {
  safeParse(value) {
    const days = (value as { days?: unknown }).days;
    if (typeof days === 'number' && Number.isInteger(days) && days > 0) return { success: true };
    return {
      success: false,
      error: { issues: [{ path: ['days'], message: 'must be a positive whole number' }] },
    };
  },
};

describe('checkSchema', () => {
  it('is empty when every item passes', () => {
    expect(checkSchema(crops, PositiveDays)).toEqual([]);
  });

  it('reports each item the validator refuses, with the path and the message of each issue', () => {
    const bad = defineCatalog('crop', [
      { id: 'ok', days: 2 },
      { id: 'zero', days: 0 },
    ]);
    expect(checkSchema(bad, PositiveDays)).toEqual([
      { kind: 'crop', id: 'zero', message: 'days: must be a positive whole number' },
    ]);
  });

  it('falls back to the message of an Error, then to the text of anything else', () => {
    const one = defineCatalog('thing', [{ id: 'x' }]);
    const throwing: SchemaValidator = { safeParse: () => ({ success: false, error: new Error('broken') }) };
    const plain: SchemaValidator = { safeParse: () => ({ success: false, error: 'nope' }) };
    expect(checkSchema(one, throwing)).toEqual([{ kind: 'thing', id: 'x', message: 'broken' }]);
    expect(checkSchema(one, plain)).toEqual([{ kind: 'thing', id: 'x', message: 'nope' }]);
  });
});
