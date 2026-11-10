// Geometry of the 6×4 flat-top honeycomb: 24 cells, 12 per side, 4 lanes deep. Pure CSS pixels, no DOM:
// the board uses it to size the grid and cache cell centres for effects, and the test checks it fits every phone.

export const HEX_COLUMNS = 6;
export const HEX_ROWS = 4;
/** How much of a cell's width the next column overlaps; the outline stays seamless. */
export const HEX_OVERLAP = 0.25;
/** Height ÷ width of a flat-top cell. */
export const HEX_RATIO = 0.86;
const MAX_CELL_W = 80;
const MIN_CELL_W = 16;
const MARGIN = 6;

export interface HexCenter {
  readonly column: number;
  readonly row: number;
  readonly x: number;
  readonly y: number;
}

export interface HexLayout {
  readonly width: number;
  readonly height: number;
  readonly cellW: number;
  readonly cellH: number;
  /** Horizontal distance between column origins (cellW × (1 − overlap)). */
  readonly stepX: number;
  readonly gridW: number;
  readonly gridH: number;
  readonly left: number;
  readonly top: number;
  readonly centers: readonly HexCenter[];
}

/** Fit the honeycomb inside the board; every centre is in board pixels, top-left origin. */
export function hexLayout(width: number, height: number): HexLayout {
  const safeWidth = Number.isFinite(width) ? Math.max(0, width) : 0;
  const safeHeight = Number.isFinite(height) ? Math.max(0, height) : 0;
  const availableW = Math.max(1, safeWidth - MARGIN * 2);
  const availableH = Math.max(1, safeHeight - MARGIN * 2);
  const stepFactor = 1 + (HEX_COLUMNS - 1) * (1 - HEX_OVERLAP);
  const heightFactor = (HEX_ROWS + 0.5) * HEX_RATIO;
  const cellW = Math.max(
    MIN_CELL_W,
    Math.min(MAX_CELL_W, availableW / stepFactor, availableH / heightFactor),
  );
  const cellH = Math.max(MIN_CELL_W * HEX_RATIO, cellW * HEX_RATIO);
  const stepX = cellW * (1 - HEX_OVERLAP);
  const gridW = cellW + stepX * (HEX_COLUMNS - 1);
  const gridH = cellH * (HEX_ROWS + 0.5);
  const left = (safeWidth - gridW) / 2;
  const top = (safeHeight - gridH) / 2;

  const centers: HexCenter[] = [];
  for (let column = 0; column < HEX_COLUMNS; column++) {
    for (let row = 0; row < HEX_ROWS; row++) {
      centers.push({
        column,
        row,
        x: left + column * stepX + cellW / 2,
        y: top + row * cellH + (column % 2 === 1 ? cellH / 2 : 0) + cellH / 2,
      });
    }
  }
  return {
    width: safeWidth,
    height: safeHeight,
    cellW,
    cellH,
    stepX,
    gridW,
    gridH,
    left,
    top,
    centers,
  };
}

/** One centre by grid position. */
export function centerAt(layout: HexLayout, column: number, row: number): HexCenter {
  const index = column * HEX_ROWS + row;
  return (
    layout.centers[index] ?? {
      column,
      row,
      x: layout.left + (column + 0.5) * layout.cellW * (1 - HEX_OVERLAP),
      y: layout.top + (row + 0.5) * layout.cellH,
    }
  );
}
