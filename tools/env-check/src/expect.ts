// Which commit an environment is expected to run: the one `--expect` names, or else the newest tag of its prefix.
import type { Git } from './proc.ts';
import { newestTag, type Prefix } from './tags.ts';

export interface Expected {
  commit: string;
  /** Where it came from, for the output: `--expect main`, or `tag prod-2026-10-21.1`. */
  from: string;
}

/** The expected commit, or null when no ref was given and no tag of the prefix exists. Throws if a ref names no commit. */
export async function expectedCommit(
  git: Git,
  expect: string | undefined,
  prefix: Prefix,
): Promise<Expected | null> {
  if (expect !== undefined) return { commit: await git.resolveCommit(expect), from: `--expect ${expect}` };
  const tag = newestTag(await git.tags(`${prefix}-*`), prefix);
  if (tag === null) return null;
  return { commit: await git.resolveCommit(tag), from: `tag ${tag}` };
}
