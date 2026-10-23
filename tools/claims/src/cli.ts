// pnpm claims: open a worktree for a worker with its claims, list them, check a worker's changes before the master
// commits them, close them. `guard` and `format` are the workers' hooks (docs/guides/working-with-agents.md).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CLAIMS_FILE, type ClaimsFile, normaliseClaim, outside, touchesBetween } from './claims.ts';
import {
  changedFiles,
  git,
  isMerged,
  mainChangedSince,
  readClaims,
  realWorkspace,
  worktreeOf,
  worktrees,
} from './git.ts';
import { type Decision, decide, type HookInput } from './guard.ts';

const USAGE = `pnpm claims open <worktree> <claim>...  claim paths for a worker; refuses claims that touch an open worktree's
pnpm claims status                      every worktree with claims
pnpm claims check <worktree>            before committing: changes outside the claims, in another open worktree,
                                        or on origin/main since the worktree started
pnpm claims close <worktree>            drop a worktree's claims
A claim is dir/ (everything under it), a/file.ts, a pattern with * ** ?, or @dev-stack. Run git fetch origin first.`;

class UsageError extends Error {}

interface Opened {
  worktree: string;
  claims: ClaimsFile;
  merged: boolean;
}

/** Every worktree with claims, but one. */
const opened = (cwd: string, except?: string): Opened[] =>
  worktrees(cwd)
    .filter((worktree) => worktree !== except)
    .flatMap((worktree) => {
      const claims = readClaims(worktree);
      return claims === undefined ? [] : [{ worktree, claims, merged: isMerged(worktree, claims) }];
    });

function rootOf(arg: string | undefined): string {
  if (arg === undefined) throw new UsageError('name the worktree');
  const worktree = resolve(arg);
  if (!existsSync(join(worktree, '.git'))) throw new Error(`${worktree} is not the root of a git worktree`);
  return worktree;
}

function open(args: string[]): number {
  const worktree = rootOf(args[0]);
  const wanted = args.slice(1).map(normaliseClaim);
  if (wanted.length === 0) throw new UsageError('name at least one claim');
  const before = readClaims(worktree);
  const claims = [...new Set([...(before?.claims ?? []), ...wanted])];
  let touching = false;
  for (const other of opened(worktree, worktree)) {
    if (other.merged) {
      console.log(`${other.worktree} is merged into origin/main, so its claims no longer count: close it.`);
      continue;
    }
    for (const touch of touchesBetween(claims, other.claims.claims)) {
      touching = true;
      const zone = touch.zone === undefined ? '' : `, both in ${touch.zone}`;
      console.log(
        `touches ${other.worktree} (${other.claims.branch}): ${touch.mine} and ${touch.theirs}${zone}`,
      );
    }
  }
  if (touching) {
    console.log(
      'Not opened. Run this work after that worktree closes, or split it so the claims do not touch.',
    );
    return 1;
  }
  const file: ClaimsFile = {
    branch: git(worktree, ['branch', '--show-current']),
    base: before?.base ?? git(worktree, ['rev-parse', 'HEAD']),
    opened: before?.opened ?? new Date().toISOString(),
    claims,
  };
  writeFileSync(join(worktree, CLAIMS_FILE), `${JSON.stringify(file, null, 2)}\n`);
  console.log(`opened ${worktree} (${file.branch}): ${claims.join(', ')}`);
  return 0;
}

function status(): number {
  const list = opened(process.cwd());
  if (list.length === 0) console.log('No worktree has claims.');
  for (const { worktree, claims, merged } of list)
    console.log(`${merged ? 'merged' : 'open'}  ${worktree}  ${claims.branch}  ${claims.claims.join(', ')}`);
  return 0;
}

function check(args: string[]): number {
  const worktree = rootOf(args[0]);
  const claims = readClaims(worktree);
  if (claims === undefined) throw new Error(`${worktree} has no ${CLAIMS_FILE}: open it first`);
  const changed = changedFiles(worktree, claims.base);
  const findings: string[] = outside(claims.claims, changed).map((file) => `outside the claims: ${file}`);
  for (const other of opened(worktree, worktree)) {
    if (other.merged) continue;
    const theirs = new Set(changedFiles(other.worktree, other.claims.base));
    for (const file of changed.filter((path) => theirs.has(path)))
      findings.push(`also changed in ${other.worktree} (${other.claims.branch}): ${file}`);
  }
  const moved = new Set(mainChangedSince(worktree, claims.base));
  for (const file of changed.filter((path) => moved.has(path)))
    findings.push(
      `changed on origin/main since this worktree started: ${file} (merge origin/main before committing)`,
    );
  for (const finding of findings) console.log(finding);
  console.log(
    findings.length === 0
      ? `${changed.length} changed files, all inside the claims, none changed elsewhere.`
      : `${findings.length} ${findings.length === 1 ? 'finding' : 'findings'}.`,
  );
  return findings.length === 0 ? 0 : 1;
}

function close(args: string[]): number {
  const worktree = rootOf(args[0]);
  rmSync(join(worktree, CLAIMS_FILE), { force: true });
  console.log(`closed ${worktree}`);
  return 0;
}

const readHookInput = (): HookInput => JSON.parse(readFileSync(0, 'utf8')) as HookInput;

/** PreToolUse: exit 2 blocks the call and shows the reason to the worker. A broken guard blocks too. */
function guard(): number {
  let decision: Decision;
  try {
    decision = decide(readHookInput(), realWorkspace);
  } catch (error) {
    decision = {
      allow: false,
      reason: `The claims guard failed (${String(error)}). Stop and report it to the master.`,
    };
  }
  if (decision.allow) return 0;
  process.stderr.write(`${decision.reason}\n`);
  return 2;
}

/** PostToolUse: format the file just edited with the worktree's Biome. Never blocks; `pnpm verify` is the check. */
function format(): number {
  try {
    const path = readHookInput().tool_input?.file_path;
    const worktree = typeof path === 'string' ? worktreeOf(path) : undefined;
    const biome = worktree === undefined ? undefined : join(worktree, 'node_modules', '.bin', 'biome');
    if (typeof path === 'string' && biome !== undefined && existsSync(biome))
      spawnSync(
        biome,
        ['format', '--write', '--no-errors-on-unmatched', '--files-ignore-unknown=true', path],
        {
          cwd: worktree,
          stdio: 'ignore',
        },
      );
  } catch {
    // Formatting is a convenience.
  }
  return 0;
}

const COMMANDS: Record<string, (args: string[]) => number> = { open, status, check, close, guard, format };

const [name, ...rest] = process.argv.slice(2);
const command = name === undefined ? undefined : COMMANDS[name];
try {
  if (command === undefined)
    throw new UsageError(name === undefined ? 'name a command' : `no command '${name}'`);
  process.exitCode = command(rest);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  if (error instanceof UsageError) console.error(USAGE);
  process.exitCode = 1;
}
