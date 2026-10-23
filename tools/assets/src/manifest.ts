// A pack version's manifest in the registry, `packs/<id>/<version>.json`: what the Studio writes on approval and never
// changes after (ADR 0051). docs/guides/use-assets-in-a-game.md#the-manifest documents it.
import { LockedAssetFile, PackId, SemVer } from '@tohe/contract';
import { z } from 'zod';

export const MANIFEST_VERSION = 1;

const Pixels = z.number().int().positive();

/**
 * One file of a pack: what the lock pins (asset id, kind, sha256, extension, bytes, licence, attribution) and what the
 * game's code may need to load it. Fields not listed are dropped, so the Studio can add some without breaking a build.
 */
export const PackFile = z.object({
  ...LockedAssetFile.shape,
  width: Pixels.optional().describe("A picture's width in pixels"),
  height: Pixels.optional().describe("A picture's height in pixels"),
  frames: z
    .object({ width: Pixels, height: Pixels, count: Pixels })
    .optional()
    .describe("A sprite sheet's frame size and how many frames it holds"),
});
export type PackFile = z.infer<typeof PackFile>;

export const PackManifest = z
  .object({
    manifestVersion: z.literal(MANIFEST_VERSION),
    id: PackId,
    version: SemVer,
    files: z.array(PackFile),
  })
  .superRefine((manifest, context) => {
    const ids = new Set<string>();
    manifest.files.forEach((file, index) => {
      if (ids.has(file.id))
        context.addIssue({ code: 'custom', path: ['files', index, 'id'], message: 'repeated id' });
      ids.add(file.id);
    });
  });
export type PackManifest = z.infer<typeof PackManifest>;
