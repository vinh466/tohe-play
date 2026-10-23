// The git and file-system side of claims: worktrees, their claims files, and what each has changed.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CLAIMS_FILE, type ClaimsFile } from './claims.ts';
import type { Workspace } from './guard.ts';

export const git = (cwd: string, args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const succeeds = (cwd: string, args: string[]): boolean =>
  spawnSync('git', args, { cwd, stdio: 'ignore' }).status === 0;

/** Lines of git output, without the claims file: a branch made before `.gitignore` names it still shows it. */
const paths = (text: string): string[] =>
  text === ''
    ? []
    : text.split('\n').filter((line) => line !== CLAIMS_FILE && !line.endsWith(` ${CLAIMS_FILE}`));

/** The root of the worktree that holds a path: the nearest directory up with a `.git` entry. The path need not exist. */
export function worktreeOf(path: string): string | undefined {
  let dir = dirname(path);
  for (;;) {
    if (existsSync(join(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

export function readClaims(worktree: string): ClaimsFile | undefined {
  const file = join(worktree, CLAIMS_FILE);
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as ClaimsFile) : undefined;
}

export const realWorkspace: Workspace = { worktreeOf, claimsOf: readClaims };

/** Every worktree of the repository that holds `cwd`, the main checkout included. */
export const worktrees = (cwd: string): string[] =>
  git(cwd, ['worktree', 'list', '--porcelain'])
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.slice('worktree '.length));

/** The files a worktree has changed since its base: committed, staged, unstaged and new. */
export function changedFiles(worktree: string, base: string): string[] {
  const tracked = paths(git(worktree, ['diff', '--name-only', base]));
  const untracked = paths(git(worktree, ['ls-files', '--others', '--exclude-standard']));
  return [...new Set([...tracked, ...untracked])].sort();
}

/** The files `origin/main` has changed since a commit. */
export const mainChangedSince = (worktree: string, base: string): string[] =>
  paths(git(worktree, ['diff', '--name-only', base, 'origin/main']));

/** A worktree's work is merged when it has moved past its base, is clean, and `origin/main` holds its commit. */
export function isMerged(worktree: string, claims: ClaimsFile): boolean {
  const head = git(worktree, ['rev-parse', 'HEAD']);
  if (head === claims.base) return false;
  if (paths(git(worktree, ['status', '--porcelain'])).length > 0) return false;
  return succeeds(worktree, ['merge-base', '--is-ancestor', head, 'origin/main']);
}
