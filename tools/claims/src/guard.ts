// The PreToolUse hook of every worker: an edit stays inside the claims of the worktree it lands in, and Bash does not
// run what a worker may not. Edits made through Bash (sed, cp, a generator) are caught later, by `pnpm claims check`.
import { isAbsolute, relative } from 'node:path';
import { blockedCommand } from './bash.ts';
import { CLAIMS_FILE, type ClaimsFile, covers } from './claims.ts';

/** The fields of Claude Code's hook input that the guard reads. */
export interface HookInput {
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

export type Decision = { allow: true } | { allow: false; reason: string };

/** The file system as the guard sees it, so tests need no git repository. */
export interface Workspace {
  /** The root of the git worktree that holds a path, or undefined outside every worktree. */
  worktreeOf(path: string): string | undefined;
  /** A worktree's claims, or undefined when the master has not opened it for a worker. */
  claimsOf(worktree: string): ClaimsFile | undefined;
}

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const ALLOW: Decision = { allow: true };
const deny = (reason: string): Decision => ({ allow: false, reason });
const STOP = 'Stop and report it to the master.';

export function decide(input: HookInput, workspace: Workspace): Decision {
  const tool = input.tool_name ?? '';
  const args = input.tool_input ?? {};
  if (tool === 'Bash') {
    const reason = blockedCommand(typeof args.command === 'string' ? args.command : '');
    return reason === undefined ? ALLOW : deny(`Blocked: ${reason}. ${STOP}`);
  }
  if (!EDIT_TOOLS.has(tool)) return ALLOW;

  const path = args.file_path ?? args.notebook_path;
  if (typeof path !== 'string' || !isAbsolute(path))
    return deny(`Blocked: ${tool} without an absolute path. ${STOP}`);
  const worktree = workspace.worktreeOf(path);
  if (worktree === undefined)
    return deny(
      `Blocked: ${path} is outside every git worktree. Work only in the worktree the packet names.`,
    );
  const claims = workspace.claimsOf(worktree);
  if (claims === undefined)
    return deny(
      `Blocked: ${worktree} has no ${CLAIMS_FILE}, so the master did not open it for a worker. Work only in the worktree the packet names.`,
    );
  const file = relative(worktree, path);
  if (file === CLAIMS_FILE) return deny(`Blocked: ${CLAIMS_FILE} is the master's. ${STOP}`);
  if (claims.claims.some((claim) => covers(claim, file))) return ALLOW;
  return deny(
    `Blocked: ${file} is outside this worktree's claims (${claims.claims.join(', ')}). ${STOP} The master decides whether to widen the claims.`,
  );
}
