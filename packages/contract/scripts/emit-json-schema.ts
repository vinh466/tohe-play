// Emits JSON Schema files from the Zod source of truth, for games that are not written in TypeScript.
// Output is committed; CI fails if it drifts from src/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { AssetCredits, AssetsLock } from '../src/assets.ts';
import { Catalog, GameManifest } from '../src/manifest.ts';
import { GameMessage, HostMessage } from '../src/protocol.ts';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'schema');
mkdirSync(outDir, { recursive: true });

const schemas = {
  'game-manifest.schema.json': z.toJSONSchema(GameManifest, { io: 'input' }),
  'catalog.schema.json': z.toJSONSchema(Catalog),
  'game-message.schema.json': z.toJSONSchema(GameMessage, { io: 'input' }),
  'host-message.schema.json': z.toJSONSchema(HostMessage),
  'assets-lock.schema.json': z.toJSONSchema(AssetsLock),
  'asset-credits.schema.json': z.toJSONSchema(AssetCredits),
};

for (const [file, schema] of Object.entries(schemas)) {
  writeFileSync(join(outDir, file), `${JSON.stringify(schema, null, 2)}\n`);
}
console.log(`wrote ${Object.keys(schemas).length} schemas to ${outDir}`);
