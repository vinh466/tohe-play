// The two ways a command fails, and how each ends the process.

/** The command was used wrongly or the tool is not set up (a variable unset, no pack.json): exit code 2. */
export class UsageError extends Error {
  override name = 'UsageError';
}

/** A check failed, locally or on the server, or the server refused the request: exit code 1. */
export class Refused extends Error {
  override name = 'Refused';
}

/** One problem with a pack: a code, what is wrong and, when it is about one, the asset — the server's shape. */
export interface Problem {
  code: string;
  message: string;
  assetId?: string | null;
}

/** `asset crops/carrot: licence_not_accepted — …`, or the code and message alone. */
export const formatProblem = (problem: Problem) =>
  `${problem.assetId ? `asset ${problem.assetId}: ` : ''}${problem.code} — ${problem.message}`;
