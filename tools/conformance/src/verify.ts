// Checks a ranked game's verify module (ADR 0030) the way the API will use it: loaded on its own, pure and
// deterministic, playing runs with its own bot and replaying them to the same score. The API runs the same file in Jint;
// anything that needs a browser or randomness of its own fails here first.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import type { RankedManifest } from '@tohe/contract';
import { pure, type RulesCheck } from './rules.ts';

/** A run as the API replays it: the seed it dealt, and the moves the game handed in. */
export interface RankedRunInput {
  seed: number;
  moves: unknown[];
}

/** What the API calls; see docs/contracts/game-contract-v1.md. */
export interface VerifyModule {
  replay(run: RankedRunInput): { score: number; over: boolean } | { error: string };
  bot(run: RankedRunInput): unknown;
}

export const MAX_VERIFY_KB = 256;

/** Conformance plays this many moves at most per run, whatever `maxMoves` allows: enough to reach a game's end. */
const MOVES_PER_RUN = 5000;

export async function loadVerify(dist: string, ranked: RankedManifest): Promise<VerifyModule> {
  const module = (await import(pathToFileURL(join(dist, ranked.verify)).href)) as { verify?: VerifyModule };
  if (!module.verify) throw new Error(`${ranked.verify} does not export \`verify\``);
  return module.verify;
}

/** Plays a run with the module's own bot from a seed, to its end or the move limit. */
export function playRanked(verify: VerifyModule, seed: number, most: number): unknown[] {
  const moves: unknown[] = [];
  while (moves.length < most) {
    const move = pure(() => verify.bot({ seed, moves }));
    if (move === null || move === undefined) break;
    moves.push(move);
  }
  return moves;
}

/** The replay of a run: its score, or why the module refused it. */
export function replayRanked(verify: VerifyModule, run: RankedRunInput): { score: number; over: boolean } {
  const result = pure(() => verify.replay(run));
  if ('error' in result) throw new Error(`replay refused the run: ${result.error}`);
  if (!Number.isFinite(result.score)) throw new Error(`replay scored ${String(result.score)}`);
  return result;
}

export async function checkVerify(dist: string, ranked: RankedManifest): Promise<RulesCheck[]> {
  const checks: RulesCheck[] = [];
  const file = join(dist, ranked.verify);
  if (!existsSync(file)) return [{ name: 'verify module exists', ok: false, detail: ranked.verify }];
  const kb = Math.ceil(statSync(file).size / 1024);
  checks.push({ name: 'verify module exists', ok: true, detail: `${ranked.verify}, ${kb} KB` });
  checks.push({
    name: 'verify module is small',
    ok: kb <= MAX_VERIFY_KB,
    detail: `${kb} KB of ${MAX_VERIFY_KB} KB`,
  });
  if (
    /\b(?:document|window|localStorage|fetch|XMLHttpRequest|WebSocket)\b/.test(readFileSync(file, 'utf8'))
  ) {
    checks.push({
      name: 'verify module stays off browser APIs',
      ok: false,
      detail: 'it mentions document, window, storage or network APIs',
    });
  }
  let verify: VerifyModule;
  try {
    verify = await loadVerify(dist, ranked);
    const missing = ['replay', 'bot'].filter(
      (name) => typeof (verify as unknown as Record<string, unknown>)[name] !== 'function',
    );
    checks.push({
      name: 'verify module has replay and bot',
      ok: missing.length === 0,
      detail: missing.join(', '),
    });
    if (missing.length > 0) return checks;
  } catch (error) {
    checks.push({ name: 'verify module loads on its own', ok: false, detail: String(error) });
    return checks;
  }
  try {
    const most = Math.min(ranked.maxMoves, MOVES_PER_RUN);
    let total = 0;
    const started = performance.now();
    const details: string[] = [];
    for (const seed of [1, 7, 20261018]) {
      const moves = playRanked(verify, seed, most);
      total += moves.length;
      if (!isDeepStrictEqual(JSON.parse(JSON.stringify(moves)), moves)) {
        throw new Error('the moves do not survive JSON (undefined, Maps, class instances…)');
      }
      const first = replayRanked(verify, { seed, moves });
      const again = replayRanked(verify, { seed, moves: JSON.parse(JSON.stringify(moves)) });
      if (!isDeepStrictEqual(first, again)) {
        throw new Error(
          `seed ${seed}: replaying twice gave ${JSON.stringify(first)} then ${JSON.stringify(again)}`,
        );
      }
      details.push(`seed ${seed}: ${moves.length} moves → ${first.score}${first.over ? '' : ' (not over)'}`);
    }
    const perMove = (performance.now() - started) / Math.max(1, total);
    checks.push({
      name: 'verify module plays runs with its bot and replays them to the same score',
      ok: true,
      detail: `${details.join('; ')}; ${perMove.toFixed(3)} ms a move`,
    });
  } catch (error) {
    checks.push({
      name: 'verify module plays runs with its bot and replays them to the same score',
      ok: false,
      detail: String(error),
    });
  }
  return checks;
}
