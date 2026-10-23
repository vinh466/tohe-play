// The workers' PreToolUse guard against a fake workspace: no git, no files.
import { describe, expect, it } from 'vitest';
import type { ClaimsFile } from './claims.ts';
import { decide, type HookInput, type Workspace } from './guard.ts';

const ROOT = '/home/owner/tohe-play';
const WORKER = `${ROOT}/.claude/worktrees/feat-play`;

const claims: ClaimsFile = {
  branch: 'feat/play',
  base: '0e575e8',
  opened: '2026-10-23T00:00:00.000Z',
  claims: ['apps/hub/src/features/play/', 'docs/guides/play.md'],
};

const workspace: Workspace = {
  worktreeOf: (path) =>
    path.startsWith(`${WORKER}/`) ? WORKER : path.startsWith(`${ROOT}/`) ? ROOT : undefined,
  claimsOf: (worktree) => (worktree === WORKER ? claims : undefined),
};

const edit = (file_path: string, tool_name = 'Edit'): HookInput => ({ tool_name, tool_input: { file_path } });
const bash = (command: string): HookInput => ({ tool_name: 'Bash', tool_input: { command } });
const allowed = (input: HookInput): boolean => decide(input, workspace).allow;
const reason = (input: HookInput): string => {
  const decision = decide(input, workspace);
  return decision.allow ? '' : decision.reason;
};

describe('edits', () => {
  it('lets a worker edit and write inside its claims', () => {
    expect(allowed(edit(`${WORKER}/apps/hub/src/features/play/Board.tsx`))).toBe(true);
    expect(allowed(edit(`${WORKER}/docs/guides/play.md`, 'Write'))).toBe(true);
  });

  it('blocks a file outside the claims and names the claims', () => {
    expect(reason(edit(`${WORKER}/apps/hub/src/router.tsx`))).toContain(
      'apps/hub/src/router.tsx is outside this worktree',
    );
    expect(reason(edit(`${WORKER}/apps/hub/src/router.tsx`))).toContain('apps/hub/src/features/play/');
  });

  it('blocks the main checkout and anything outside a worktree', () => {
    expect(reason(edit(`${ROOT}/apps/hub/src/features/play/Board.tsx`))).toContain('has no .agent-claims');
    expect(reason(edit('/tmp/notes.md', 'Write'))).toContain('outside every git worktree');
  });

  it('keeps the claims file for the master', () => {
    expect(reason(edit(`${WORKER}/.agent-claims`, 'Write'))).toContain("is the master's");
  });

  it('blocks an edit without an absolute path', () => {
    expect(allowed(edit('apps/hub/src/features/play/Board.tsx'))).toBe(false);
  });

  it('checks notebooks by their path', () => {
    expect(allowed({ tool_name: 'NotebookEdit', tool_input: { notebook_path: `${WORKER}/x.ipynb` } })).toBe(
      false,
    );
  });

  it('leaves reading tools alone', () => {
    expect(allowed({ tool_name: 'Read', tool_input: { file_path: '/etc/hosts' } })).toBe(true);
    expect(allowed({ tool_name: 'Grep', tool_input: { pattern: 'x' } })).toBe(true);
  });
});

describe('bash', () => {
  it.each([
    'git commit -m "wip"',
    'git -C /home/owner/tohe-play push origin main',
    'git stash',
    'git checkout main',
    'cd apps/hub && git reset --hard',
    'gh pr create --fill',
    'gh api -X PATCH repos/vinh466/tohe-play/pulls/1',
    'kubectl get pods -n tohe',
    'helm upgrade tohe deploy/helm/tohe',
    'ssh 10.100.0.2',
    'bash deploy/uat/deploy.sh uat-2026-10-23.1',
    './deploy/uat/deploy.sh uat-2026-10-23.1',
    'curl -s https://toheplay.io.vn/api/health',
    'curl http://10.100.0.2:4810/',
    'docker compose down -v',
    'docker volume rm tohe_pgdata',
  ])('blocks %s', (command) => {
    expect(allowed(bash(command))).toBe(false);
  });

  it.each([
    'git status --porcelain',
    'git diff --stat',
    'git log --oneline -5',
    'git fetch origin',
    'pnpm install --frozen-lockfile && pnpm verify',
    'gh api repos/vinh466/tohe-play/pulls/125',
    'grep -rn "toheplay.io.vn" docs/',
    'cat deploy/uat/deploy.sh',
    'docker compose up -d postgres',
    'curl -s http://localhost:4720/api/health',
  ])('allows %s', (command) => {
    expect(allowed(bash(command))).toBe(true);
  });

  it('says why and tells the worker to report', () => {
    expect(reason(bash('git push'))).toMatch(
      /^Blocked: a worker does not change commits.*Stop and report it/,
    );
  });
});
