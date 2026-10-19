// Is a commit fit to be tagged, and what is the tag's name? (ADR 0041). Read-only: git, the GitHub API, GHCR.
import type { Fetcher } from './http.ts';
import type { Git } from './proc.ts';
import { CHART, chartTag, ciProblem, ciRuns, ghcrHas, IMAGES, REPOSITORY } from './remote.ts';
import { assert, type Runner } from './runner.ts';
import { nextTagName, type Prefix } from './tags.ts';

export interface ReleaseOptions {
  ref: string;
  for: Prefix;
  now: Date;
  /** GITHUB_TOKEN or GH_TOKEN, optional. */
  token?: string;
}

export interface ReleaseDeps {
  http: Fetcher;
  git: Git;
}

export async function checkRelease(options: ReleaseOptions, deps: ReleaseDeps, r: Runner): Promise<void> {
  const { http, git } = deps;
  r.info(
    'local state',
    'git fetch origin --tags first: this tool reads origin/main and the tags as they are, and does not fetch',
  );

  r.section(`${options.ref} for ${options.for}`);
  let commit = '';
  const resolved = await r.check('the ref is a commit', async () => {
    commit = await git.resolveCommit(options.ref);
    return commit;
  });
  if (!resolved) return;

  await r.check('it is on origin/main', async () => {
    assert(
      await git.isOnOriginMain(commit),
      'not an ancestor of origin/main (fetch first, or merge the pull request)',
    );
  });

  await r.check('CI succeeded on main for it', async () => {
    const problem = ciProblem(await ciRuns(http, commit, options.token));
    assert(problem === null, problem ?? '');
  });

  for (const image of IMAGES) {
    const name = `${REPOSITORY}/${image}`;
    await r.check(`image ${image}:sha-${commit.slice(0, 7)}…`, async () => {
      assert(await ghcrHas(http, name, `sha-${commit}`), `ghcr.io/${name}:sha-${commit} does not exist`);
    });
  }
  await r.check('chart', async () => {
    const tag = chartTag(await git.fileAt(commit, 'deploy/helm/tohe/Chart.yaml'), commit);
    assert(await ghcrHas(http, CHART, tag), `ghcr.io/${CHART}:${tag} does not exist`);
    return `oci://ghcr.io/${CHART} ${tag}`;
  });

  if (options.for === 'prod') {
    await r.check('it carries a uat- tag', async () => {
      const tags = await git.tagsPointingAt(commit, 'uat-*');
      assert(tags.length > 0, 'no uat- tag on this commit: production runs only what ran on UAT');
      return tags.join(', ');
    });
  }

  const existing = await git.tags(`${options.for}-*`);
  const already = await git.tagsPointingAt(commit, `${options.for}-*`);
  if (already.length > 0) r.warn('already tagged', `this commit already has ${already.join(', ')}`);
  r.info('next tag', nextTagName(existing, options.for, options.now));
}
