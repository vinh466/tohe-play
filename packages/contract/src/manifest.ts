import { z } from 'zod';

/** Current Game Contract protocol version. See docs/contracts/game-contract-v1.md. */
export const PROTOCOL_VERSION = 1;

export const GameId = z
  .string()
  .regex(/^[a-z][a-z0-9-]{1,38}[a-z0-9]$/, 'lowercase letters, digits and dashes; 3-40 chars');

export const SemVer = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'semantic version, e.g. 1.2.0');

export const Capability = z.enum(['save', 'scores']);
export type Capability = z.infer<typeof Capability>;

/** `game.json` — shipped next to every game build. */
export const GameManifest = z
  .object({
    id: GameId,
    name: z.string().min(1).max(40),
    version: SemVer,
    protocol: z.literal(PROTOCOL_VERSION),
    description: z.string().max(200).default(''),
    entry: z.string().default('index.html'),
    icon: z.string().optional().describe('Path relative to the game root, e.g. icon.svg'),
    orientation: z.enum(['portrait', 'landscape', 'any']).default('portrait'),
    capabilities: z.array(Capability).default([]),
    minAge: z.number().int().min(0).max(18).default(0),
    tags: z.array(z.string().max(20)).max(8).default([]),
    sizeBudgetKb: z.number().int().positive().max(50_000).default(3000),
  })
  .strict();
export type GameManifest = z.infer<typeof GameManifest>;
export type GameManifestInput = z.input<typeof GameManifest>;

/** `catalog.json` — produced by the games assembler at the root of the games origin. */
export const CatalogEntry = z
  .object({
    manifest: GameManifest,
    /** Path of the immutable build on the games origin, e.g. `hello/1.0.0/`. */
    path: z.string().regex(/^[a-z0-9-]+\/[^/]+\/$/),
    sizeKb: z.number().int().nonnegative(),
  })
  .strict();
export type CatalogEntry = z.infer<typeof CatalogEntry>;

export const Catalog = z
  .object({
    generatedAt: z.iso.datetime(),
    games: z.array(CatalogEntry),
  })
  .strict();
export type Catalog = z.infer<typeof Catalog>;
