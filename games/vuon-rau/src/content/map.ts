// The farm's one map (SPEC.md, "World"): 16 × 12 tiles of 16 px, drawn with the pack farm-tiny. Content, not an asset:
// where each picture of the pack goes, which tiles nobody walks through, the twelve plots in their order, the stall,
// Cô Ba and where the farmer starts. The grass is a fill of the style's green (the pack has no plain grass tile).
// The pack has no fence either, so the field is open: three beds of four plots, with a path in front of each.

export const MAP_COLS = 16;
export const MAP_ROWS = 12;
export const TILE = 16;
/** The style's grass (tiny-farm-16): the fill under everything. */
export const GRASS = '#84c669';

export interface Cell {
  x: number;
  y: number;
}

/**
 * The game draws with one picture of the pack, its tileset `tilemap/tilemap-packed` (12 × 11 tiles of 16 px): one file
 * to load and one texture to draw from. Frame n of it is the pack's tile n (`tiles/tile-000n`).
 */
export const TILESET = 'tilemap/tilemap-packed';
export const TILESET_COLUMNS = 12;
export const TILESET_FRAMES = 132;

/** A picture of the pack at a cell. */
export interface Placed extends Cell {
  /** Frames of the tileset: one, or several drawn one over the other. */
  tiles: readonly number[];
  /** Nobody walks through it. */
  solid: boolean;
}

const at = (x: number, y: number, tiles: number[], solid = true): Placed => ({ x, y, tiles, solid });

/** The barn, three tiles wide: its roof's peak, the roof, the gable with the hay door, and the wall with the door. */
function barn(left: number, top: number): Placed[] {
  const rows = [
    [[], [82], []],
    [[93], [94], [95]],
    [[105], [106], [107]],
    [[117], [118], [119]],
    [
      [114, 129],
      [91, 130],
      [116, 131],
    ],
    [[102], [127], [104]],
  ];
  return rows.flatMap((row, dy) =>
    row.flatMap((tiles, dx) => (tiles.length > 0 ? [at(left + dx, top + dy, tiles)] : [])),
  );
}

// The pack's soil comes in strips: across, 60 starts one, 61 goes on, 62 ends it and 63 is a patch on its own; down,
// 12, 24, 36 and 0. Each has a darker copy twelve tiles before it (48–51, 0–1…): wet soil.

/** A path of soil across `length` cells, from (x, y): rounded at both ends. */
function pathAcross(x: number, y: number, length: number): Placed[] {
  return Array.from({ length }, (_, i) => at(x + i, y, [i === 0 ? 60 : i === length - 1 ? 62 : 61], false));
}

/** A path of soil down `length` cells, from (x, y). */
function pathDown(x: number, y: number, length: number): Placed[] {
  return Array.from({ length }, (_, i) => at(x, y + i, [i === 0 ? 12 : i === length - 1 ? 36 : 24], false));
}

/**
 * The soil under a plot: a patch on its own, or a piece of a bed joined to the soil of the plot beside it, on the
 * left, the right or both; dark when watered.
 */
export function soilTile(left: boolean, right: boolean, wet: boolean): number {
  const light = left && right ? 61 : left ? 62 : right ? 60 : 63;
  return wet ? light - 12 : light;
}

/** A plot of grass shows weeds: the field is there before it is dug — the pack has no fence to show it. */
export const WEEDS = 80;

/** The farmer and Cô Ba (the pack's two people), and a hen. */
export const FARMER = 109;
export const KEEPER = 108;
export const HEN = 122;

/** Ground pictures, under everything else. */
export const ground: readonly Placed[] = [...pathDown(2, 6, 5), ...pathAcross(3, 10, 9)];

/** Everything standing on the ground. */
export const objects: readonly Placed[] = [
  ...barn(1, 0),
  // Trees and bushes along the edges.
  at(5, 0, [15]),
  at(6, 0, [3]),
  at(10, 0, [27]),
  at(14, 0, [15]),
  at(15, 1, [15]),
  at(15, 3, [39]),
  at(0, 7, [15]),
  at(0, 9, [3]),
  at(15, 7, [27]),
  at(15, 10, [15]),
  at(0, 11, [39]),
  // The barn's yard: a water trough, the hay, a barrel and the hens.
  at(11, 2, [110]),
  at(12, 2, [111]),
  at(4, 1, [85]),
  at(4, 3, [96]),
  at(5, 2, [122], false),
  at(13, 4, [122], false),
  // Sunflowers and stones.
  at(1, 7, [83], false),
  at(3, 8, [83], false),
  at(1, 9, [83], false),
  at(8, 1, [77], false),
  at(15, 5, [89]),
];

/** The twelve plots, in the order of the save: three beds of four, left to right, top to bottom. */
export const plots: readonly Cell[] = [4, 6, 8].flatMap((y) => [6, 7, 8, 9].map((x) => ({ x, y })));

/** The plots beside a plot in its bed, left and right (null at the bed's ends): their soil joins its own. */
export function besideInBed(index: number): { left: number | null; right: number | null } {
  return { left: index % 4 === 0 ? null : index - 1, right: index % 4 === 3 ? null : index + 1 };
}

/** The seed stall: its crates (one per crop, in the order of crops.ts), at the end of the path. */
export const stall: readonly Cell[] = [
  { x: 11, y: 8 },
  { x: 12, y: 8 },
  { x: 13, y: 8 },
];

/** Cô Ba stands behind the stall. */
export const keeper: Cell = { x: 12, y: 7 };

/** Where the farmer stands when a farm starts. */
export const farmerStart: Cell = { x: 4, y: 6 };
