import { describe, expect, it } from 'vitest';
import {
  ACCEPTED_ASSET_LICENCES,
  AssetCredits,
  AssetsLock,
  creditsCoverLock,
  GameManifest,
  licenceNeedsAttribution,
  lockMatchesAssets,
  type StudioEntry,
  studioFileName,
  studioMatchesLock,
} from './index.ts';

const base = { id: 'farm', name: 'Farm', version: '1.0.0', protocol: 1 };
const hash = (digit: string) => digit.repeat(64);

const lock: AssetsLock = AssetsLock.parse({
  lockVersion: 1,
  packs: {
    'farm-crops': {
      version: '1.0.0',
      manifest: hash('a'),
      files: [
        { id: 'crops/carrot', kind: 'image', sha256: hash('1'), ext: 'png', bytes: 120, licence: 'CC0-1.0' },
        {
          id: 'crops/wheat',
          kind: 'spritesheet',
          sha256: hash('2'),
          ext: 'png',
          bytes: 340,
          licence: 'CC-BY-4.0',
          attribution: 'Wheat by Lan, CC-BY 4.0',
        },
      ],
    },
    'farm-tiles': {
      version: '2.1.0',
      manifest: hash('b'),
      files: [
        {
          id: 'ground/grass',
          kind: 'tileset',
          sha256: hash('3'),
          ext: 'webp',
          bytes: 900,
          licence: 'LicenseRef-Tohe-Internal',
        },
      ],
    },
  },
});

const credits: AssetCredits = AssetCredits.parse({
  packs: [
    {
      id: 'farm-crops',
      version: '1.0.0',
      licences: ['CC0-1.0', 'CC-BY-4.0'],
      attributions: [{ assets: ['crops/wheat'], text: 'Wheat by Lan, CC-BY 4.0' }],
    },
    { id: 'farm-tiles', version: '2.1.0', licences: ['LicenseRef-Tohe-Internal'], attributions: [] },
  ],
});

const assets = {
  'farm-crops': { version: '1.0.0', delivery: 'bundle' as const },
  'farm-tiles': { version: '2.1.0', delivery: 'bundle' as const, include: ['ground/*'] },
};

describe('GameManifest.assets (ADR 0053)', () => {
  it('accepts packs pinned to an exact version, delivered in the bundle', () => {
    expect(GameManifest.parse({ ...base, assets }).assets).toEqual(assets);
    // Without it, a manifest means what it meant before.
    expect(GameManifest.parse(base)).not.toHaveProperty('assets');
  });

  const pack = { version: '1.0.0', delivery: 'bundle' };
  it.each([
    ['a version range', { 'farm-crops': { ...pack, version: '^1.0.0' } }],
    ['a partial version', { 'farm-crops': { ...pack, version: '1.0' } }],
    ['a delivery that does not exist yet', { 'farm-crops': { ...pack, delivery: 'on-demand' } }],
    ['no delivery', { 'farm-crops': { version: '1.0.0' } }],
    ['an unknown field', { 'farm-crops': { ...pack, cdn: 'https://example.com' } }],
    ['an uppercase pack id', { 'Farm-Crops': pack }],
    ['a pack id too short', { ab: pack }],
    ['an empty include', { 'farm-crops': { ...pack, include: [] } }],
    ['an empty glob', { 'farm-crops': { ...pack, include: [''] } }],
    ['a glob over 100 characters', { 'farm-crops': { ...pack, include: ['x'.repeat(101)] } }],
    ['over 50 globs', { 'farm-crops': { ...pack, include: Array.from({ length: 51 }, (_, i) => `g${i}`) } }],
    ['over 20 packs', Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`pack-${i}`, pack]))],
  ])('rejects %s', (_label, packs) => {
    expect(GameManifest.safeParse({ ...base, assets: packs }).success).toBe(false);
  });

  it('accepts 20 packs and 50 globs', () => {
    const many = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`pack-${i}`, pack]));
    expect(GameManifest.safeParse({ ...base, assets: many }).success).toBe(true);
    const globs = { 'farm-crops': { ...pack, include: Array.from({ length: 50 }, (_, i) => `g${i}/*`) } };
    expect(GameManifest.safeParse({ ...base, assets: globs }).success).toBe(true);
  });
});

describe('licences', () => {
  it('asks for credit for every accepted licence but CC0 and Tò He’s own', () => {
    const needs = ACCEPTED_ASSET_LICENCES.filter(licenceNeedsAttribution);
    expect(needs).toEqual([
      'CC-BY-4.0',
      'CC-BY-SA-4.0',
      'OFL-1.1',
      'MIT',
      'BSD-2-Clause',
      'BSD-3-Clause',
      'Apache-2.0',
    ]);
  });
});

describe('AssetsLock and AssetCredits', () => {
  const file = { id: 'a', kind: 'image', sha256: hash('1'), ext: 'png', bytes: 1, licence: 'CC0-1.0' };
  const lockOf = (files: unknown[], extra: object = {}) => ({
    lockVersion: 1,
    packs: { 'farm-crops': { version: '1.0.0', manifest: hash('a'), files, ...extra } },
  });

  it.each([
    ['another lock version', { ...lockOf([file]), lockVersion: 2 }],
    ['a hash in upper case', lockOf([{ ...file, sha256: 'A'.repeat(64) }])],
    ['a short hash', lockOf([{ ...file, sha256: 'a'.repeat(63) }])],
    ['an extension with a dot', lockOf([{ ...file, ext: '.png' }])],
    ['an unknown kind', lockOf([{ ...file, kind: 'video' }])],
    ['an asset id with a capital', lockOf([{ ...file, id: 'Crops/carrot' }])],
    ['an asset id ending in a slash', lockOf([{ ...file, id: 'crops/' }])],
    ['negative bytes', lockOf([{ ...file, bytes: -1 }])],
    ['a repeated asset id', lockOf([file, { ...file, sha256: hash('2') }])],
    ['an unknown field', lockOf([file], { url: 'https://example.com' })],
    ['a manifest that is not a hash', lockOf([file], { manifest: 'latest' })],
  ])('the lock rejects %s', (_label, input) => {
    expect(AssetsLock.safeParse(input).success).toBe(false);
  });

  it('credits reject an attribution naming no asset, or with no text', () => {
    const pack = { id: 'farm-crops', version: '1.0.0', licences: ['CC-BY-4.0'] };
    expect(
      AssetCredits.safeParse({ packs: [{ ...pack, attributions: [{ assets: [], text: 'x' }] }] }).success,
    ).toBe(false);
    expect(
      AssetCredits.safeParse({ packs: [{ ...pack, attributions: [{ assets: ['a'], text: '' }] }] }).success,
    ).toBe(false);
  });
});

describe('check 1: the lock matches assets', () => {
  it('passes when the packs and versions are the same', () => {
    expect(lockMatchesAssets(assets, lock)).toEqual([]);
  });

  it('names a pack declared and not locked, locked and not declared, or locked at another version', () => {
    const { 'farm-tiles': _tiles, ...crops } = assets;
    expect(lockMatchesAssets(crops, lock)).toEqual(['farm-tiles@2.1.0: in the lock, not declared']);
    expect(
      lockMatchesAssets({ ...assets, 'farm-animals': { version: '1.0.0', delivery: 'bundle' } }, lock),
    ).toEqual(['farm-animals@1.0.0: declared, not in the lock']);
    expect(
      lockMatchesAssets({ ...assets, 'farm-crops': { version: '1.0.1', delivery: 'bundle' } }, lock),
    ).toEqual(['farm-crops: declared 1.0.1, locked 1.0.0']);
  });
});

describe('check 2: studio/ matches the lock', () => {
  const entries: StudioEntry[] = Object.values(lock.packs).flatMap((pack) =>
    pack.files.map((file) => ({ name: studioFileName(file), sha256: file.sha256 })),
  );

  it('passes when every file is there by its hash, and nothing else', () => {
    expect(studioMatchesLock(lock, entries)).toEqual([]);
  });

  it('names a file missing from studio/', () => {
    expect(studioMatchesLock(lock, entries.slice(1))).toEqual([
      `farm-crops/crops/carrot: studio/${hash('1')}.png is missing`,
    ]);
  });

  it('names a file the lock does not hold', () => {
    expect(studioMatchesLock(lock, [...entries, { name: `${hash('9')}.png`, sha256: hash('9') }])).toEqual([
      `studio/${hash('9')}.png: not in the lock`,
    ]);
  });

  it('names a file whose content is not what its name says', () => {
    const [first, ...rest] = entries;
    const changed = [{ name: first?.name ?? '', sha256: hash('f') }, ...rest];
    expect(studioMatchesLock(lock, changed)).toEqual([
      `studio/${hash('1')}.png: its content hashes to ${hash('f')}`,
      `farm-crops/crops/carrot: studio/${hash('1')}.png is missing`,
    ]);
  });

  it('names a file with the right hash and another extension, a file not named by hash, and a folder', () => {
    const [first, ...rest] = entries;
    expect(
      studioMatchesLock(lock, [
        { name: `${hash('1')}.webp`, sha256: hash('1') },
        ...rest,
        { name: 'carrot.png', sha256: hash('4') },
        { name: 'atlas', sha256: null },
      ]),
    ).toEqual([
      `studio/${hash('1')}.webp: not in the lock`,
      'studio/carrot.png: not a file named <sha256>.<ext>',
      'studio/atlas: not a file named <sha256>.<ext>',
      `farm-crops/crops/carrot: studio/${first?.name} is missing`,
    ]);
  });
});

describe('check 3: licences accepted, credits cover the lock', () => {
  const withFile = (change: object) =>
    AssetsLock.parse({
      ...lock,
      packs: {
        ...lock.packs,
        'farm-crops': {
          ...lock.packs['farm-crops'],
          files: [{ ...lock.packs['farm-crops']?.files[1], ...change }],
        },
      },
    });

  it('passes when every licence is accepted and every attribution is credited', () => {
    expect(creditsCoverLock(lock, credits)).toEqual([]);
  });

  it('names a licence the Studio does not accept', () => {
    const problems = creditsCoverLock(withFile({ licence: 'CC-BY-NC-4.0' }), credits);
    expect(problems).toContain('farm-crops/crops/wheat: CC-BY-NC-4.0 is not an accepted licence');
  });

  it('names a file whose licence asks for credit and has no attribution', () => {
    const { attribution: _attribution, ...wheat } = lock.packs['farm-crops']?.files[1] ?? {};
    const bare = AssetsLock.parse({
      ...lock,
      packs: { ...lock.packs, 'farm-crops': { ...lock.packs['farm-crops'], files: [wheat] } },
    });
    expect(creditsCoverLock(bare, credits)).toEqual([
      'farm-crops/crops/wheat: CC-BY-4.0 needs an attribution',
    ]);
  });

  it('names an attribution the credits do not hold', () => {
    expect(creditsCoverLock(withFile({ attribution: 'Wheat by Minh, CC-BY 4.0' }), credits)).toEqual([
      'farm-crops/crops/wheat: its attribution is not in studio/credits.json',
    ]);
    const unnamed = AssetCredits.parse({
      packs: credits.packs.map((pack) => ({
        ...pack,
        attributions: pack.attributions.map((a) => ({ ...a, assets: ['crops/carrot'] })),
      })),
    });
    expect(creditsCoverLock(lock, unnamed)).toEqual([
      'farm-crops/crops/wheat: its attribution is not in studio/credits.json',
    ]);
  });

  it('names a pack or a licence missing from the credits, and a pack the lock does not hold', () => {
    const [crops, tiles] = credits.packs;
    expect(creditsCoverLock(lock, { packs: tiles ? [tiles] : [] })).toEqual([
      'farm-crops@1.0.0: not in studio/credits.json',
    ]);
    expect(
      creditsCoverLock(lock, {
        packs: [...(crops ? [{ ...crops, licences: ['CC0-1.0'] }] : []), ...(tiles ? [tiles] : [])],
      }),
    ).toEqual(["farm-crops/crops/wheat: CC-BY-4.0 is not among the pack's licences in studio/credits.json"]);
    expect(
      creditsCoverLock(lock, {
        packs: [...credits.packs, { id: 'farm-animals', version: '1.0.0', licences: [], attributions: [] }],
      }),
    ).toEqual(['farm-animals@1.0.0: in studio/credits.json, not in the lock']);
  });
});
