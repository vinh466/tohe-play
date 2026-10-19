// Running git and docker, behind a small function so tests never start a process. Never throws on a non-zero exit.
import { execFile } from 'node:child_process';

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type Run = (command: string, args: string[], options?: { cwd?: string }) => Promise<RunResult>;

export const realRun: Run = (command, args, options = {}) =>
  new Promise((resolve) => {
    execFile(
      command,
      args,
      { cwd: options.cwd, maxBuffer: 64 * 1024 * 1024, timeout: 120_000 },
      (error, stdout, stderr) => {
        const code = error === null ? 0 : typeof error.code === 'number' ? error.code : 127;
        resolve({
          code,
          stdout,
          stderr: error !== null && code === 127 ? `${stderr}${error.message}` : stderr,
        });
      },
    );
  });

/** The `git` calls the checks make. */
export class Git {
  readonly #run: Run;

  constructor(run: Run = realRun) {
    this.#run = run;
  }

  async #out(args: string[]): Promise<string> {
    const result = await this.#run('git', args);
    if (result.code !== 0)
      throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim() || `exit ${result.code}`}`);
    return result.stdout.trim();
  }

  /** The full commit a ref (branch, tag, short or full sha) points at; throws if there is no such commit. */
  async resolveCommit(ref: string): Promise<string> {
    return this.#out(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).catch(() => {
      throw new Error(`no commit for '${ref}' in this repository (git fetch origin --tags?)`);
    });
  }

  async tags(pattern: string): Promise<string[]> {
    const out = await this.#out(['tag', '--list', pattern]);
    return out === '' ? [] : out.split('\n');
  }

  async tagsPointingAt(commit: string, pattern: string): Promise<string[]> {
    const out = await this.#out(['tag', '--points-at', commit, '--list', pattern]);
    return out === '' ? [] : out.split('\n');
  }

  /** Is `commit` reachable from `origin/main`? False if it is not; throws if `origin/main` does not exist. */
  async isOnOriginMain(commit: string): Promise<boolean> {
    await this.#out(['rev-parse', '--verify', '--quiet', 'origin/main']).catch(() => {
      throw new Error('no origin/main in this repository (git fetch origin --tags first)');
    });
    const result = await this.#run('git', ['merge-base', '--is-ancestor', commit, 'origin/main']);
    return result.code === 0;
  }

  /** The text of a file at a commit. */
  async fileAt(commit: string, path: string): Promise<string> {
    return this.#out(['show', `${commit}:${path}`]);
  }

  /** The paths in a directory at a commit. */
  async listDir(commit: string, directory: string): Promise<string[]> {
    const out = await this.#out(['ls-tree', '--name-only', commit, `${directory.replace(/\/?$/, '/')}`]);
    return out === '' ? [] : out.split('\n');
  }
}
