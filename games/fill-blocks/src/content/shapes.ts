// The 27 fixed shapes of Lấp Ô. A shape is a list of cells in its bounding box, top-left at [0, 0].
// No rotation: each orientation is its own shape. Eight colours are shared by shape families; the shape is the
// identity a player reads, the colour is secondary (SPEC.md, "Board and pieces").
export interface Shape {
  readonly id: string;
  readonly cells: readonly (readonly [number, number])[];
  /** 1 … 8, a colour index; the CSS palette maps it to a token. */
  readonly colour: number;
}

export const SHAPES: readonly Shape[] = [
  { id: 'single', cells: [[0, 0]], colour: 1 },
  {
    id: 'domino-h',
    cells: [
      [0, 0],
      [0, 1],
    ],
    colour: 2,
  },
  {
    id: 'domino-v',
    cells: [
      [0, 0],
      [1, 0],
    ],
    colour: 2,
  },
  {
    id: 'tri-h',
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
    ],
    colour: 3,
  },
  {
    id: 'tri-v',
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    colour: 3,
  },
  {
    id: 'square-2',
    cells: [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
    colour: 4,
  },
  {
    id: 'l3-a',
    cells: [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    colour: 4,
  },
  {
    id: 'l3-b',
    cells: [
      [0, 0],
      [0, 1],
      [1, 0],
    ],
    colour: 4,
  },
  {
    id: 'l3-c',
    cells: [
      [0, 0],
      [0, 1],
      [1, 1],
    ],
    colour: 4,
  },
  {
    id: 'l3-d',
    cells: [
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    colour: 4,
  },
  {
    id: 'line-4-h',
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ],
    colour: 5,
  },
  {
    id: 'line-4-v',
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ],
    colour: 5,
  },
  {
    id: 'line-5-h',
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ],
    colour: 6,
  },
  {
    id: 'line-5-v',
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
    ],
    colour: 6,
  },
  {
    id: 'square-3',
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    colour: 7,
  },
  {
    id: 'l4-a',
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
    ],
    colour: 6,
  },
  {
    id: 'l4-b',
    cells: [
      [0, 0],
      [0, 1],
      [1, 0],
      [2, 0],
    ],
    colour: 6,
  },
  {
    id: 'l4-c',
    cells: [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    colour: 6,
  },
  {
    id: 'l4-d',
    cells: [
      [0, 1],
      [1, 1],
      [2, 0],
      [2, 1],
    ],
    colour: 6,
  },
  {
    id: 't-a',
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 1],
    ],
    colour: 8,
  },
  {
    id: 't-b',
    cells: [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    colour: 8,
  },
  {
    id: 't-c',
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [1, 1],
    ],
    colour: 8,
  },
  {
    id: 't-d',
    cells: [
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 1],
    ],
    colour: 8,
  },
  {
    id: 's-a',
    cells: [
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
    ],
    colour: 8,
  },
  {
    id: 's-b',
    cells: [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
    colour: 8,
  },
  {
    id: 'z-a',
    cells: [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
    colour: 8,
  },
  {
    id: 'z-b',
    cells: [
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 0],
    ],
    colour: 8,
  },
];

const BY_ID = new Map(SHAPES.map((shape) => [shape.id, shape]));

export const shapeById = (id: string): Shape | undefined => BY_ID.get(id);

export const isShapeId = (id: unknown): id is string => typeof id === 'string' && BY_ID.has(id);

/** The shape's bounding-box height and width. */
export function bounds(shape: Shape): { rows: number; cols: number } {
  let rows = 0;
  let cols = 0;
  for (const [r, c] of shape.cells) {
    rows = Math.max(rows, r + 1);
    cols = Math.max(cols, c + 1);
  }
  return { rows, cols };
}

/** A large piece: five cells or the 3 × 3 square. */
export const isLarge = (shape: Shape): boolean => shape.cells.length >= 5;
