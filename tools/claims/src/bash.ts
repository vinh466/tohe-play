// The Bash commands a worker never runs (docs/guides/working-with-agents.md, "Never"). The rules match command text,
// so they stop the usual form of a command, not every way to write it: they prevent accidents, they are no boundary.
interface Rule {
  pattern: RegExp;
  reason: string;
}

const RULES: Rule[] = [
  {
    pattern:
      /\bgit\b(?:\s+-[cC]\s+\S+)*\s+(?:commit|push|pull|merge|rebase|reset|tag|stash|checkout|switch|worktree|cherry-pick|revert|am)\b/,
    reason: 'a worker does not change commits, branches, tags or the stash: the master commits',
  },
  {
    pattern: /\bgh\s+(?:pr|release|repo|workflow|run|issue|secret|variable)\b/,
    reason: 'a worker does not act on GitHub: the master opens pull requests',
  },
  {
    pattern: /\bgh\s+api\b.*\s(?:-X|--method|-f|-F|--field|--raw-field|--input)\b/,
    reason: 'a worker does not write through the GitHub API',
  },
  {
    pattern: /\b(?:kubectl|helm|ssh|scp|rsync)\b/,
    reason: 'a worker never touches a cluster or another machine',
  },
  {
    pattern: /(?:^|[;&|(]\s*|\b(?:sh|bash|exec)\s+)(?:\.\/)?deploy\/uat\//,
    reason: "only the master deploys, on the owner's word",
  },
  {
    pattern: /\b(?:curl|wget|http|nc|ping|psql)\b[^;&|]*(?:10\.100\.0\.2|toheplay\.io\.vn)/,
    reason: 'a worker never touches UAT (10.100.0.2) or production (toheplay.io.vn)',
  },
  {
    pattern:
      /\bdocker\s+(?:volume\s+(?:rm|prune)|system\s+prune|compose\b[^;&|]*\bdown\b[^;&|]*\s(?:-v|--volumes)\b)/,
    reason: 'a worker does not delete volumes',
  },
];

/** Why a worker may not run a command, or undefined when it may. */
export function blockedCommand(command: string): string | undefined {
  return RULES.find((rule) => rule.pattern.test(command))?.reason;
}
