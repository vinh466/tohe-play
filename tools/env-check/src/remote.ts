// What CI published for a commit on main (ADR 0021, ADR 0041): the CI run, the images and the chart on GHCR.
import { type Fetcher, getJson } from './http.ts';

export const REPOSITORY = 'vinh466/tohe-play';
export const IMAGES = ['api', 'hub', 'games', 'docs'] as const;
export const CHART = 'vinh466/charts/tohe';

export interface WorkflowRun {
  name: string;
  status: string;
  conclusion: string | null;
  html_url?: string;
  created_at?: string;
}

/** Did the CI workflow succeed for the commit? The newest run named CI decides. Returns a reason when it did not. */
export function ciProblem(runs: WorkflowRun[]): string | null {
  const ci = runs
    .filter((run) => run.name === 'CI')
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    .at(-1);
  if (ci === undefined) return 'no CI run for this commit on main (not pushed, or CI has not started)';
  if (ci.status !== 'completed') return `CI is ${ci.status}${ci.html_url ? ` (${ci.html_url})` : ''}`;
  if (ci.conclusion !== 'success')
    return `CI concluded ${ci.conclusion}${ci.html_url ? ` (${ci.html_url})` : ''}`;
  return null;
}

/** The chart version CI publishes for a commit: `<Chart.yaml version>-g<7-char sha>`. */
export function chartTag(chartYaml: string, commit: string): string {
  const version = /^version:\s*["']?([^\s"']+)["']?\s*$/m.exec(chartYaml)?.[1];
  if (version === undefined) throw new Error('deploy/helm/tohe/Chart.yaml has no version');
  return `${version}-g${commit.slice(0, 7)}`;
}

/** The CI workflow's runs for a push of the commit to main. `token` (GITHUB_TOKEN or GH_TOKEN) is optional: the repository is public. */
export async function ciRuns(http: Fetcher, commit: string, token?: string): Promise<WorkflowRun[]> {
  const url = `https://api.github.com/repos/${REPOSITORY}/actions/runs?head_sha=${commit}&branch=main&event=push`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'tohe-env-check',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const { status, json } = await getJson<{ workflow_runs?: WorkflowRun[] }>(http, url, headers);
  if (status !== 200) throw new Error(`the GitHub API answered ${status}`);
  return json.workflow_runs ?? [];
}

const MANIFEST_TYPES = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.docker.distribution.manifest.v2+json',
].join(', ');

/** Does `ghcr.io/<name>:<tag>` exist? Anonymous: the packages are public. */
export async function ghcrHas(http: Fetcher, name: string, tag: string): Promise<boolean> {
  const { json } = await getJson<{ token?: string }>(
    http,
    `https://ghcr.io/token?scope=repository:${name}:pull`,
  );
  if (!json.token) throw new Error(`ghcr.io gave no pull token for ${name}`);
  const result = await http(`https://ghcr.io/v2/${name}/manifests/${tag}`, {
    method: 'HEAD',
    headers: { Authorization: `Bearer ${json.token}`, Accept: MANIFEST_TYPES },
  });
  if (result.status === 200) return true;
  if (result.status === 404) return false;
  throw new Error(`ghcr.io answered ${result.status} for ${name}:${tag}`);
}
