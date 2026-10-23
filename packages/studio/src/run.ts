// The commands of tohe-studio. `run` answers the exit code: 0 ok, 1 a check failed or the server refused, 2 usage or
// configuration.
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { type ParseArgsOptionsConfig, parseArgs } from 'node:util';
import { GameId, PackId, SemVer } from '@tohe/contract';
import { studioClient } from './api.ts';
import { drawWith } from './draw.ts';
import { formatProblem, type Problem, Refused, UsageError } from './errors.ts';
import { importSource } from './import.ts';
import { packPath, readPack, writePack } from './pack.ts';
import { parseColour, preparePack } from './prepare.ts';
import { checkDraft, getStyle, listStyles, submitDraft, syncDraft, versionStatus } from './remote.ts';
import { type Io, readSettings, redactingIo, type Settings, TOKEN_ENV } from './settings.ts';
import { KNOWN_SOURCES, knownSource } from './sources.ts';

export const USAGE = `tohe-studio — make asset packs for the Tò He Studio (docs/guides/make-assets.md)

  style list [--json]                      the styles: palette, tile size, view
  style show <id> [--json]                 one style, with its palette and samples
  pack init <dir> --id <pack> --style <style> --version <semver> [--description <text>]
  import --list                            the known sources
  import <source> <dir> [--include <glob>]... [--from <zip or URL>]
  draw <script> <dir>                      run a drawing script; each picture it saves becomes an asset
  prepare <dir> [--palette] [--binary-alpha] [--trim]
  check <dir> [--dry-run]                  send the draft and its files, then the server's checks, nothing submitted
  submit <dir>                             the same, then submit it for review
  status <pack>@<version> [--json]         where a version is; why, when it was rejected

Environment: TOHE_STUDIO_URL (the Studio's host: https://studio.toheplay.io.vn, or http://localhost:4722 in development;
until the Studio has a host of its own, /api/studio answers on the hub's, http://localhost:4720 in development) and
TOHE_STUDIO_TOKEN (an agent token, tohe_at_…).
Exit codes: 0 ok, 1 a check failed or the server refused, 2 usage or configuration.`;

export interface RunContext {
  env: NodeJS.ProcessEnv;
  io: Io;
  /** Where relative paths start. */
  cwd: string;
  fetch?: typeof fetch;
}

type Parsed = { values: Record<string, string | boolean | string[] | undefined>; positionals: string[] };

function parse(args: string[], options: ParseArgsOptionsConfig = {}): Parsed {
  try {
    return parseArgs({ args, options, allowPositionals: true, strict: true }) as Parsed;
  } catch (error) {
    throw new UsageError((error as Error).message);
  }
}

function positionals(parsed: Parsed, names: string[]): string[] {
  if (parsed.positionals.length !== names.length)
    throw new UsageError(`expected ${names.map((name) => `<${name}>`).join(' ') || 'no argument'}`);
  return parsed.positionals;
}

function reportProblems(io: Io, problems: Problem[], what: string): number {
  for (const problem of problems) io.err(`  ${formatProblem(problem)}`);
  io.err(`${what}: ${problems.length} problem(s)`);
  return 1;
}

const string = (value: unknown) => (typeof value === 'string' ? value : undefined);

export async function run(argv: string[], context: RunContext): Promise<number> {
  // The token never reaches the output, whatever a line was made of.
  let settings: Settings | null = null;
  const io = redactingIo(context.io, () => [settings?.token ?? '', context.env[TOKEN_ENV]?.trim() ?? '']);
  const connect = () => {
    settings ??= readSettings(context.env);
    return { settings, client: studioClient(settings, context.fetch) };
  };
  const dir = (path: string) => resolve(context.cwd, path);
  const [command, ...args] = argv;
  try {
    switch (command) {
      case 'style': {
        const [sub, ...rest] = args;
        const parsed = parse(rest, { json: { type: 'boolean' } });
        const { client } = connect();
        if (sub === 'list') {
          positionals(parsed, []);
          const styles = await listStyles(client);
          if (parsed.values.json) io.out(JSON.stringify(styles, null, 2));
          else if (styles.length === 0) io.out('no style yet');
          else
            for (const style of styles)
              io.out(
                `${style.id}  ${style.name} — ${style.status}, ${style.view}, ${style.tileSize ? `tile ${style.tileSize}px` : 'no tile'}, ${style.palette ? `${style.palette.length} colours` : 'no palette'}`,
              );
          return 0;
        }
        if (sub === 'show') {
          const [id] = positionals(parsed, ['id']) as [string];
          const style = await getStyle(client, id);
          if (parsed.values.json) {
            io.out(JSON.stringify(style, null, 2));
            return 0;
          }
          io.out(`${style.id}  ${style.name} (${style.status})`);
          io.out(`  view: ${style.view}`);
          io.out(`  tile: ${style.tileSize ? `${style.tileSize}px` : 'none'}`);
          io.out(`  palette: ${style.palette ? style.palette.join(' ') : 'none (a painted style)'}`);
          if (style.outline) io.out(`  outline: ${style.outline}`);
          for (const sample of style.samples)
            io.out(
              `  sample: ${sample.sha256}.${sample.ext} (${sample.bytes} bytes${sample.uploaded ? '' : ', not uploaded'})`,
            );
          return 0;
        }
        throw new UsageError('style list | style show <id>');
      }

      case 'pack': {
        const [sub, ...rest] = args;
        if (sub !== 'init')
          throw new UsageError('pack init <dir> --id <pack> --style <style> --version <semver>');
        const parsed = parse(rest, {
          id: { type: 'string' },
          style: { type: 'string' },
          version: { type: 'string' },
          description: { type: 'string' },
        });
        const [target] = positionals(parsed, ['dir']) as [string];
        const id = string(parsed.values.id);
        const style = string(parsed.values.style);
        const version = string(parsed.values.version);
        if (!id || !PackId.safeParse(id).success)
          throw new UsageError('--id: a pack id is a-z, digits and -, 3 to 40 characters');
        if (!style || !GameId.safeParse(style).success)
          throw new UsageError('--style: a style id, see style list');
        if (!version || !SemVer.safeParse(version).success)
          throw new UsageError('--version: semver, e.g. 1.0.0');
        const folder = dir(target);
        if (existsSync(packPath(folder))) throw new UsageError(`${packPath(folder)} already exists`);
        mkdirSync(folder, { recursive: true });
        writePack(folder, {
          id,
          version,
          style,
          description: string(parsed.values.description) ?? '',
          assets: [],
        });
        io.out(`started ${id}@${version} in ${folder}`);
        return 0;
      }

      case 'import': {
        const parsed = parse(args, {
          include: { type: 'string', multiple: true },
          from: { type: 'string' },
          list: { type: 'boolean' },
        });
        if (parsed.values.list) {
          for (const source of KNOWN_SOURCES)
            io.out(`${source.name}  ${source.title} by ${source.author}, ${source.licence} — ${source.page}`);
          return 0;
        }
        const [name, target] = positionals(parsed, ['source', 'dir']) as [string, string];
        const source = knownSource(name);
        if (!source)
          throw new UsageError(
            `${name} is not a known source: ${KNOWN_SOURCES.map((known) => known.name).join(', ')}`,
          );
        const from = string(parsed.values.from);
        const added = await importSource(
          dir(target),
          source,
          {
            include: parsed.values.include as string[] | undefined,
            from: from && !/^https?:\/\//.test(from) ? dir(from) : from,
            fetch: context.fetch,
          },
          io,
        );
        io.out(
          `imported ${added.length} asset(s) from ${source.title} (${source.licence}, ${source.author})`,
        );
        return 0;
      }

      case 'draw': {
        const [script, target] = positionals(parse(args), ['script', 'dir']) as [string, string];
        const saved = await drawWith(dir(target), dir(script));
        io.out(`drew ${saved.length} asset(s): ${saved.join(', ')}`);
        return 0;
      }

      case 'prepare': {
        const parsed = parse(args, {
          palette: { type: 'boolean' },
          'binary-alpha': { type: 'boolean' },
          trim: { type: 'boolean' },
        });
        const [target] = positionals(parsed, ['dir']) as [string];
        const folder = dir(target);
        let palette: [number, number, number][] | undefined;
        if (parsed.values.palette) {
          const pack = readPack(folder);
          const style = await getStyle(connect().client, pack.style);
          if (!style.palette || style.palette.length === 0)
            throw new UsageError(
              `the style ${style.id} has no palette (a painted style): prepare it without --palette`,
            );
          palette = style.palette.map((colour) => [...parseColour(colour)] as [number, number, number]);
        }
        const report = await preparePack(folder, {
          palette,
          binaryAlpha: parsed.values['binary-alpha'] === true,
          trim: parsed.values.trim === true,
        });
        let changed = 0;
        for (const asset of report) {
          if (asset.changes.length === 0) continue;
          changed++;
          io.out(`${asset.id}: ${asset.changes.join('; ')}`);
        }
        io.out(`prepared ${report.length} picture(s), ${changed} changed`);
        return 0;
      }

      case 'check':
      case 'submit': {
        // `check` is always a dry run; `--dry-run` says so, as docs/architecture/asset-studio.md writes it.
        const parsed = parse(args, command === 'check' ? { 'dry-run': { type: 'boolean' } } : {});
        const [target] = positionals(parsed, ['dir']) as [string];
        const folder = dir(target);
        const { settings: current, client } = connect();
        const outcome = await syncDraft(client, current.url, folder);
        const name = `${outcome.pack.id}@${outcome.pack.version}`;
        if (!outcome.version) return reportProblems(io, outcome.problems, `${name} refused`);
        io.out(`${name}: draft ${outcome.version.id} on ${current.url}`);
        io.out(`  ${outcome.version.assets.length} asset(s); ${outcome.uploaded} file(s) uploaded now`);
        for (const file of outcome.stripped)
          io.out(
            `  asset ${file.assetId}: the server stripped its metadata (now ${file.sha256.slice(0, 12)}…); tohe-studio prepare writes it without, so the hashes match`,
          );
        if (command === 'check') {
          // The dry run: every check of a submission on the files uploaded so far, nothing more saved.
          const report = await checkDraft(client, outcome.version);
          const problems = [...outcome.problems, ...report.problems];
          if (problems.length > 0 || !report.ok)
            return reportProblems(io, problems, `${name} failed its checks`);
          io.out(`${name}: the server's checks pass; tohe-studio submit sends it for review`);
          return 0;
        }
        if (outcome.problems.length > 0)
          return reportProblems(io, outcome.problems, `${name} failed its checks`);
        const submitted = await submitDraft(client, outcome.version);
        if (!submitted.version) return reportProblems(io, submitted.problems, `${name} was not submitted`);
        io.out(`${name} submitted for review. A person reviews every pack before a game may use it.`);
        io.out(`  tohe-studio status ${name} shows the outcome and, when rejected, why.`);
        return 0;
      }

      case 'status': {
        const parsed = parse(args, { json: { type: 'boolean' } });
        const [ref] = positionals(parsed, ['pack@version']) as [string];
        const at = ref.lastIndexOf('@');
        const packId = ref.slice(0, at);
        const version = ref.slice(at + 1);
        if (at <= 0 || !PackId.safeParse(packId).success || !SemVer.safeParse(version).success)
          throw new UsageError(`${ref} is not <pack>@<version>, e.g. farm-crops@1.0.0`);
        const found = await versionStatus(connect().client, packId, version);
        if (parsed.values.json) io.out(JSON.stringify(found, null, 2));
        if (found.length === 0) throw new Refused(`${ref}: the pack has no such version`);
        if (parsed.values.json) return 0;
        for (const entry of found) {
          const when = entry.reviewedAt ?? entry.submittedAt;
          io.out(`${ref}: ${entry.status}${when ? ` (${when})` : ''} — ${entry.id}`);
          if (entry.reason) io.out(`  reason: ${entry.reason}`);
        }
        return 0;
      }

      case undefined:
      case 'help':
      case '--help':
      case '-h':
        io.out(USAGE);
        return command === undefined ? 2 : 0;

      default:
        throw new UsageError(`${command} is not a command`);
    }
  } catch (error) {
    if (error instanceof UsageError) {
      io.err(`tohe-studio: ${error.message}`);
      if (!(command === 'check' || command === 'submit' || command === 'status'))
        io.err('run tohe-studio help for usage');
      return 2;
    }
    if (error instanceof Refused) {
      io.err(`tohe-studio: ${error.message}`);
      return 1;
    }
    io.err(`tohe-studio: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    return 1;
  }
}
