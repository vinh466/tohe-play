// Where the farmer may walk and how he gets there (SPEC.md, "World"): A* on the map's grid, four directions, over grass
// and paths — never through a plot, the stall, Cô Ba or anything solid. He stops beside what he works on. Pure.
import { type Cell, keeper, MAP_COLS, MAP_ROWS, objects, plots, stall } from './content/map.ts';

const key = ({ x, y }: Cell) => y * MAP_COLS + x;

/** The cells nobody walks through. */
const blocked: ReadonlySet<number> = new Set([
  ...objects.filter((placed) => placed.solid).map(key),
  ...plots.map(key),
  ...stall.map(key),
  key(keeper),
]);

export const inMap = ({ x, y }: Cell) => x >= 0 && y >= 0 && x < MAP_COLS && y < MAP_ROWS;

export const walkable = (cell: Cell) => inMap(cell) && !blocked.has(key(cell));

// Below first: he faces up at what he works on, the way the pack draws him.
const STEPS: readonly Cell[] = [
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

const around = (cell: Cell) => STEPS.map((step) => ({ x: cell.x + step.x, y: cell.y + step.y }));

/** Where the farmer stands to work on a cell: the walkable cells beside it, below first. */
export const standCells = (target: Cell): Cell[] => around(target).filter(walkable);

/**
 * The shortest walk from `from` to the nearest of `goals`, as the cells stepped on (the start left out, the goal last):
 * empty when he is there already, null when none can be reached. Ties go the same way every time.
 */
export function route(from: Cell, goals: readonly Cell[]): Cell[] | null {
  const targets = new Set(goals.filter(walkable).map(key));
  if (targets.size === 0) return null;
  if (targets.has(key(from))) return [];
  const goalList = [...targets].map((k) => ({ x: k % MAP_COLS, y: Math.floor(k / MAP_COLS) }));
  const guess = (cell: Cell) =>
    Math.min(...goalList.map((goal) => Math.abs(goal.x - cell.x) + Math.abs(goal.y - cell.y)));
  const cameFrom = new Map<number, number>();
  const cost = new Map<number, number>([[key(from), 0]]);
  // A small open list, kept sorted by estimate then by order of arrival: the map is 192 cells.
  const open: { cell: Cell; f: number; order: number }[] = [{ cell: from, f: guess(from), order: 0 }];
  let order = 1;
  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f || a.order - b.order);
    const { cell } = open.shift() as { cell: Cell };
    if (targets.has(key(cell))) {
      const walk: Cell[] = [];
      for (
        let at: number | undefined = key(cell);
        at !== undefined && at !== key(from);
        at = cameFrom.get(at)
      ) {
        walk.unshift({ x: at % MAP_COLS, y: Math.floor(at / MAP_COLS) });
      }
      return walk;
    }
    const here = cost.get(key(cell)) as number;
    for (const next of around(cell)) {
      if (!walkable(next)) continue;
      const through = here + 1;
      if (through >= (cost.get(key(next)) ?? Number.POSITIVE_INFINITY)) continue;
      cost.set(key(next), through);
      cameFrom.set(key(next), key(cell));
      open.push({ cell: next, f: through + guess(next), order: order++ });
    }
  }
  return null;
}
