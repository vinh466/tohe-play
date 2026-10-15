// The rules module (ADR 0016): what the platform calls to referee a table of this game. The game uses it directly
// against bots on the phone; online, the API runs the same code from this build.
import { decide, isLevel, type Level } from './bots.ts';
import {
  type Action,
  act,
  type Carry,
  chopsNow,
  type GameEvent,
  type HandResult,
  type Options,
  type State,
  setup,
  timeoutAction,
  type View,
  view,
} from './rules.ts';

export type Status =
  | { over: false; turn: number[]; chop: number[] }
  | { over: true; result: HandResult; carry: Carry };

export const rules = {
  setup(ctx: { seats: number; seed: number; options?: unknown; carry?: Carry | null }): State {
    return setup(ctx);
  },
  view(state: State, seat: number | null): View {
    return view(state, seat);
  },
  act(state: State, seat: number, action: Action) {
    return act(state, seat, action);
  },
  status(state: State): Status {
    if (state.over && state.result) {
      // The winner leads the next hand; after an instant win, first-hand rules apply again (SPEC.md).
      const leader = state.instant ? null : (state.result.ranking[0] ?? null);
      return { over: true, result: state.result, carry: { leader } };
    }
    return { over: false, turn: [state.turn], chop: chopsNow(state) };
  },
  timeout(state: State, seat: number): Action {
    return timeoutAction(state, seat);
  },
  bot(state: State, seat: number, level: string, seed: number): Action | null {
    return decide(view(state, seat), isLevel(level) ? level : 'normal', seed);
  },
};

export type { Action, Carry, GameEvent, HandResult, Level, Options, State, View };
