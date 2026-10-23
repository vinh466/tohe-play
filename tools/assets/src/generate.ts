// What the tool writes, as pure functions of their input: the lock from game.json's assets and the manifests it pins,
// src/assets.gen.ts from the lock and those manifests, and the credits from the lock. Sorted, so the same input gives
// the same bytes and a drift check can compare them.
import { posix } from 'node:path';
import {
  type AssetCredits,
  AssetKind,
  AssetsLock,
  type GameAssets,
  type LockedAssetFile,
  type LockedAssetPack,
  STUDIO_DIR,
  studioFileName,
} from '@tohe/contract';
import type { PackFile, PackManifest } from './manifest.ts';
import { AssetsError } from './options.ts';

/** A manifest as the registry served it: parsed, and the sha256 of its bytes. */
export interface PinnedManifest {
  sha256: string;
  manifest: PackManifest;
}

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const sortedKeys = <T>(record: Record<string, T>) => Object.keys(record).sort();

/** The files of a pack that `include` selects (all without it); a glob that selects nothing is an error. */
export function selectFiles(packId: string, manifest: PackManifest, include: readonly string[] | undefined) {
  if (!include) return [...manifest.files].sort(byId);
  const unmatched = include.filter(
    (glob) => !manifest.files.some((file) => posix.matchesGlob(file.id, glob)),
  );
  if (unmatched.length > 0)
    throw new AssetsError(
      `${packId}@${manifest.version}: include ${unmatched.map((glob) => `"${glob}"`).join(', ')} matches no asset of the pack`,
    );
  return manifest.files.filter((file) => include.some((glob) => posix.matchesGlob(file.id, glob))).sort(byId);
}

const lockedFile = (file: PackFile): LockedAssetFile => ({
  id: file.id,
  kind: file.kind,
  sha256: file.sha256,
  ext: file.ext,
  bytes: file.bytes,
  licence: file.licence,
  ...(file.attribution === undefined ? {} : { attribution: file.attribution }),
});

/** The lock for `assets`, from the manifest of every pack it declares. */
export function buildLock(assets: GameAssets, manifests: ReadonlyMap<string, PinnedManifest>): AssetsLock {
  const packs: Record<string, LockedAssetPack> = {};
  for (const id of sortedKeys(assets)) {
    const ref = assets[id];
    const pinned = manifests.get(id);
    if (!ref || !pinned) throw new AssetsError(`${id}: no manifest`);
    packs[id] = {
      version: ref.version,
      manifest: pinned.sha256,
      files: selectFiles(id, pinned.manifest, ref.include).map(lockedFile),
    };
  }
  return AssetsLock.parse({ lockVersion: 1, packs });
}

/** The lock with its keys in a fixed order: the packs by id, each file's fields as the contract lists them. */
function canonicalLock(lock: AssetsLock): AssetsLock {
  const packs: Record<string, LockedAssetPack> = {};
  for (const id of sortedKeys(lock.packs)) {
    const pack = lock.packs[id] as LockedAssetPack;
    packs[id] = {
      version: pack.version,
      manifest: pack.manifest,
      files: [...pack.files].sort(byId).map(lockedFile),
    };
  }
  return { lockVersion: lock.lockVersion, packs };
}

/** `assets.lock.json`'s text. */
export const serializeLock = (lock: AssetsLock) => `${JSON.stringify(canonicalLock(lock), null, 2)}\n`;

/** `studio/credits.json`: every pack with its licences and, grouped by text, every attribution of its files. */
export function creditsFromLock(lock: AssetsLock): AssetCredits {
  return {
    packs: sortedKeys(lock.packs).map((id) => {
      const pack = lock.packs[id] as LockedAssetPack;
      const files = [...pack.files].sort(byId);
      const attributions = new Map<string, string[]>();
      for (const file of files) {
        if (file.attribution === undefined) continue;
        attributions.set(file.attribution, [...(attributions.get(file.attribution) ?? []), file.id]);
      }
      return {
        id,
        version: pack.version,
        licences: [...new Set(files.map((file) => file.licence))].sort(),
        attributions: [...attributions].map(([text, assets]) => ({ assets, text })),
      };
    }),
  };
}

export const serializeCredits = (credits: AssetCredits) => `${JSON.stringify(credits, null, 2)}\n`;

/** A pack id as a property of `assets`: `farm-crops` → `farmCrops`. */
export const camelCase = (packId: string) =>
  packId.replace(/-+([a-z0-9])/g, (_, next: string) => next.toUpperCase());

const quote = (text: string) => `'${text.replace(/[\\']/g, '\\$&')}'`;

/** `src/assets.gen.ts`: per pack, per asset id, what the game's code needs to load the file from the build. */
export function renderAssetsModule(lock: AssetsLock, manifests: ReadonlyMap<string, PinnedManifest>): string {
  const names = new Map<string, string>();
  const lines: string[] = [];
  for (const id of sortedKeys(lock.packs)) {
    const pack = lock.packs[id] as LockedAssetPack;
    const pinned = manifests.get(id);
    if (!pinned || pinned.sha256 !== pack.manifest)
      throw new AssetsError(
        `${id}@${pack.version}: the manifest the lock pins (${pack.manifest}) is not at hand`,
      );
    const name = camelCase(id);
    const clash = names.get(name);
    if (clash) throw new AssetsError(`packs ${clash} and ${id} have the same name in assets.gen.ts: ${name}`);
    names.set(name, id);
    const metadata = new Map(pinned.manifest.files.map((file) => [file.id, file]));
    if (pack.files.length === 0) {
      lines.push(`  ${name}: {},`);
      continue;
    }
    lines.push(`  ${name}: {`);
    for (const file of [...pack.files].sort(byId)) {
      const meta = metadata.get(file.id);
      if (!meta) throw new AssetsError(`${id}/${file.id}: in the lock, not in the manifest ${pack.manifest}`);
      lines.push(`    ${quote(file.id)}: {`);
      lines.push(`      key: ${quote(`${id}/${file.id}`)},`);
      lines.push(`      url: ${quote(`./${STUDIO_DIR}/${studioFileName(file)}`)},`);
      lines.push(`      kind: ${quote(file.kind)},`);
      if (meta.width !== undefined) lines.push(`      width: ${meta.width},`);
      if (meta.height !== undefined) lines.push(`      height: ${meta.height},`);
      if (meta.frames !== undefined)
        lines.push(
          `      frames: { width: ${meta.frames.width}, height: ${meta.frames.height}, count: ${meta.frames.count} },`,
        );
      lines.push('    },');
    }
    lines.push('  },');
  }
  return `${HEADER}
export const assets = {
${lines.join('\n')}
} as const satisfies Readonly<Record<string, Readonly<Record<string, StudioAsset>>>>;
`;
}

const HEADER = `// Generated by \`pnpm assets:resolve\` (@tohe/assets) from assets.lock.json and the pack manifests it pins.
// Do not edit: change game.json's assets and resolve again (ADR 0053, docs/guides/use-assets-in-a-game.md).
// Every url is relative to the build: the files are in ${STUDIO_DIR}/, named by their sha256.

export type StudioAssetKind = ${AssetKind.options.map(quote).join(' | ')};

export interface StudioAsset {
  /** \`<pack>/<asset id>\`: unique in the game, for a loader's cache. */
  readonly key: string;
  /** \`./${STUDIO_DIR}/<sha256>.<ext>\`, relative to the build. */
  readonly url: string;
  readonly kind: StudioAssetKind;
  readonly width?: number;
  readonly height?: number;
  readonly frames?: { readonly width: number; readonly height: number; readonly count: number };
}
`;
