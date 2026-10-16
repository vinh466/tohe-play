// Checks a game's rules module (ADR 0016) the way the API will use it: loaded on its own, pure and deterministic,
// refereeing tables of every size it declares, with its own bots, to the end of the hand. The API runs the same
// file in Jint; anything that needs a browser or randomness of its own fails here first.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import type { RoomsManifest } from '@tohe/contract';

/** What the platform calls; see docs/architecture/rooms.md. */
export interface RulesModule {
  setup(ctx: { seats: number; seed: number; options?: unknown; carry?: unknown }): unknown;
  view(state: unknown, seat: number | null): unknown;
  act(
    state: unknown,
    seat: number,
    action: unknown,
  ): { ok: true; state: unknown; events: unknown[] } | { ok: false; error: string };
  status(
    state: unknown,
  ): { over: false; turn: number[]; chop?: number[] } | { over: true; result: unknown; carry?: unknown };
  timeout(state: unknown, seat: number): unknown;
  bot(state: unknown, seat: number, level: string, seed: number): unknown;
}

export interface RulesCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

/** A view and an action larger than this is a sign something is wrong; the hub relays them on every change. */
export const MAX_VIEW_BYTES = 64 * 1024;
export const MAX_RULES_KB = 256;

export async function loadRules(dist: string, rooms: RoomsManifest): Promise<RulesModule> {
  const file = join(dist, rooms.rules);
  const module = (await import(pathToFileURL(file).href)) as { rules?: RulesModule };
  if (!module.rules) throw new Error(`${rooms.rules} does not export \`rules\``);
  return module.rules;
}

/** Runs `fn` with Math.random and Date.now replaced by functions that throw: a rules module must not use them. */
export function pure<T>(fn: () => T): T {
  const random = Math.random;
  const now = Date.now;
  Math.random = () => {
    throw new Error('Math.random is not allowed in a rules module: keep the PRNG in the state');
  };
  Date.now = () => {
    throw new Error('Date.now is not allowed in a rules module');
  };
  try {
    return fn();
  } finally {
    Math.random = random;
    Date.now = now;
  }
}

/** The room options a table is created with: the declared defaults. */
export function defaultOptions(rooms: RoomsManifest): Record<string, unknown> {
  return Object.fromEntries(rooms.options.map((option) => [option.id, option.default]));
}

interface Table {
  actions: [number, unknown][];
  final: unknown;
  hands: number;
}

/** Plays hands to the end with the module's bots (or its timeout action), checking every step. */
function playTable(
  rules: RulesModule,
  rooms: RoomsManifest,
  seats: number,
  seed: number,
  hands: number,
): Table {
  const options = defaultOptions(rooms);
  const actions: [number, unknown][] = [];
  let carry: unknown = null;
  let state: unknown = null;
  for (let hand = 0; hand < hands; hand++) {
    state = pure(() => rules.setup({ seats, seed: seed + hand, options, carry }));
    roundTrip(state, 'state after setup');
    for (let step = 0; ; step++) {
      if (step > 3000) throw new Error(`hand ${hand} at ${seats} seats did not end in 3000 actions`);
      const status = pure(() => rules.status(state));
      if (status.over) {
        carry = status.carry ?? null;
        break;
      }
      const [turn] = status.turn;
      if (turn === undefined) throw new Error('status() names no seat to play');
      // Mostly the easiest bot (fast), and every level now and then.
      const level =
        step % 10 === 0 ? rooms.bots[(step / 10) % Math.max(1, rooms.bots.length)] : rooms.bots[0];
      const action = pure(() =>
        level
          ? (rules.bot(state, turn, level, seed + step) ?? rules.timeout(state, turn))
          : rules.timeout(state, turn),
      );
      roundTrip(action, 'action');
      const result = pure(() => rules.act(state, turn, action));
      if (!result.ok) throw new Error(`a bot's own action was refused at seat ${turn}: ${result.error}`);
      state = result.state;
      roundTrip(state, 'state');
      actions.push([turn, action]);
      for (let seat = -1; seat < seats; seat++) {
        const view = pure(() => rules.view(state, seat < 0 ? null : seat));
        const bytes = JSON.stringify(view).length;
        if (bytes > MAX_VIEW_BYTES) throw new Error(`a view is ${bytes} bytes (at most ${MAX_VIEW_BYTES})`);
      }
    }
  }
  return { actions, final: state, hands };
}

/** The server stores states and relays actions as JSON: they must come back the same. */
function roundTrip(value: unknown, what: string) {
  if (!isDeepStrictEqual(JSON.parse(JSON.stringify(value ?? null)), value ?? null)) {
    throw new Error(`the ${what} does not survive JSON (undefined fields, Maps, class instances…)`);
  }
}

export async function checkRules(dist: string, rooms: RoomsManifest): Promise<RulesCheck[]> {
  const checks: RulesCheck[] = [];
  const file = join(dist, rooms.rules);
  if (!existsSync(file)) return [{ name: 'rules module exists', ok: false, detail: rooms.rules }];
  const kb = Math.ceil(statSync(file).size / 1024);
  checks.push({ name: 'rules module exists', ok: true, detail: `${rooms.rules}, ${kb} KB` });
  checks.push({
    name: 'rules module is small',
    ok: kb <= MAX_RULES_KB,
    detail: `${kb} KB of ${MAX_RULES_KB} KB`,
  });
  if (
    /\b(?:document|window|localStorage|fetch|XMLHttpRequest|WebSocket)\b/.test(readFileSync(file, 'utf8'))
  ) {
    checks.push({
      name: 'rules module stays off browser APIs',
      ok: false,
      detail: 'it mentions document, window, storage or network APIs',
    });
  }
  let rules: RulesModule;
  try {
    rules = await loadRules(dist, rooms);
    const missing = ['setup', 'view', 'act', 'status', 'timeout', 'bot'].filter(
      (name) => typeof (rules as unknown as Record<string, unknown>)[name] !== 'function',
    );
    checks.push({
      name: 'rules module has the platform functions',
      ok: missing.length === 0,
      detail: missing.join(', '),
    });
    if (missing.length > 0) return checks;
  } catch (error) {
    checks.push({ name: 'rules module loads on its own', ok: false, detail: String(error) });
    return checks;
  }
  try {
    let actions = 0;
    const started = performance.now();
    for (let seats = rooms.seats.min; seats <= rooms.seats.max; seats++) {
      for (const seed of [1, 7, 20261016]) actions += playTable(rules, rooms, seats, seed, 3).actions.length;
    }
    const perAction = (performance.now() - started) / Math.max(1, actions);
    checks.push({
      name: 'rules module referees bot tables to the end',
      ok: true,
      detail: `${actions} actions at ${rooms.seats.min}–${rooms.seats.max} seats, ${perAction.toFixed(2)} ms an action with bots`,
    });
  } catch (error) {
    checks.push({ name: 'rules module referees bot tables to the end', ok: false, detail: String(error) });
    return checks;
  }
  try {
    const seats = rooms.seats.max;
    const first = playTable(rules, rooms, seats, 99, 2);
    // Replays the recorded actions from the same seeds: the state must come out the same.
    let replay: unknown = null;
    let carry: unknown = null;
    let index = 0;
    const options = defaultOptions(rooms);
    for (let hand = 0; hand < first.hands; hand++) {
      replay = pure(() => rules.setup({ seats, seed: 99 + hand, options, carry }));
      for (;;) {
        const status = pure(() => rules.status(replay));
        if (status.over) {
          carry = status.carry ?? null;
          break;
        }
        const [seat, action] = first.actions[index++] ?? [];
        const result = pure(() => rules.act(replay, seat as number, action));
        if (!result.ok) throw new Error(`replay refused action ${index}: ${result.error}`);
        replay = result.state;
      }
    }
    checks.push({ name: 'rules module is deterministic', ok: isDeepStrictEqual(replay, first.final) });
  } catch (error) {
    checks.push({ name: 'rules module is deterministic', ok: false, detail: String(error) });
  }
  return checks;
}
