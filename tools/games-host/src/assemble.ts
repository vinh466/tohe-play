// Collects games/*/dist into .out/games/<id>/<version>/ and writes .out/games/catalog.json.
// Every games/* package must be a devDependency of this package, so Turborepo builds it first.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Catalog, type CatalogEntry, GameManifest } from '@tohe/contract';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const gamesDir = join(repoRoot, 'games');
const outDir = resolve(process.env.TOHE_GAMES_OUT ?? join(repoRoot, '.out/games'));
const ownPackage = JSON.parse(readFileSync(join(here, '../package.json'), 'utf8')) as {
  devDependencies: Record<string, string>;
};

const problems: string[] = [];
const entries: CatalogEntry[] = [];
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const folder of readdirSync(gamesDir, { withFileTypes: true })) {
  if (!folder.isDirectory()) continue;
  const gameRoot = join(gamesDir, folder.name);
  const pkg = JSON.parse(readFileSync(join(gameRoot, 'package.json'), 'utf8')) as { name: string };
  if (!(pkg.name in ownPackage.devDependencies)) {
    problems.push(
      `${pkg.name} is not a devDependency of @tohe/games-host (add "${pkg.name}": "workspace:*")`,
    );
    continue;
  }
  const dist = join(gameRoot, 'dist');
  const manifestFile = join(dist, 'game.json');
  if (!existsSync(manifestFile)) {
    problems.push(`${pkg.name}: ${manifestFile} missing — build the game first`);
    continue;
  }
  const parsed = GameManifest.safeParse(JSON.parse(readFileSync(manifestFile, 'utf8')));
  if (!parsed.success) {
    problems.push(`${pkg.name}: invalid game.json\n${parsed.error.message}`);
    continue;
  }
  const manifest = parsed.data;
  if (folder.name !== manifest.id)
    problems.push(`games/${folder.name}: folder name must equal id "${manifest.id}"`);
  const path = `${manifest.id}/${manifest.version}/`;
  cpSync(dist, join(outDir, path), { recursive: true, filter: (source) => !source.endsWith('.map') });
  entries.push({ manifest, path, sizeKb: Math.ceil(dirSize(join(outDir, path)) / 1024) });
}

if (problems.length > 0) {
  console.error(`games-host: ${problems.length} problem(s)\n- ${problems.join('\n- ')}`);
  process.exit(1);
}

const catalog: Catalog = {
  generatedAt: new Date().toISOString(),
  games: entries.sort((a, b) => a.manifest.id.localeCompare(b.manifest.id)),
};
writeFileSync(join(outDir, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`games-host: ${entries.length} game(s) -> ${outDir}`);
for (const entry of entries) console.log(`  ${entry.path}  ${entry.sizeKb} KB`);

function dirSize(dir: string): number {
  return readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => {
    const path = join(dir, entry.name);
    return total + (entry.isDirectory() ? dirSize(path) : statSync(path).size);
  }, 0);
}
