// Colours of the game. Blocks are warm and soft for small numbers, saturated and cool as they grow, so a glance at
// the board shows how far a game has come; every number keeps at least 4.5:1 contrast on its block (palette.test.ts)
// and the blocks are the same in both themes. The board around them follows the hub's light/dark theme (ADR 0013).
import type { Theme } from '@tohe/game-kit';

export interface BlockStyle {
  fill: number;
  /** Darker edge drawn under the block for a bit of depth. */
  edge: number;
  text: string;
  /** Light ring for blocks that would vanish into a dark board. */
  outline?: number;
}

const STYLES: BlockStyle[] = [
  { fill: 0xfef3c7, edge: 0xf5d98a, text: '#92400e' }, // 2
  { fill: 0xfde68a, edge: 0xf2c94c, text: '#92400e' }, // 4
  { fill: 0xfdba74, edge: 0xf59e5b, text: '#7c2d12' }, // 8
  { fill: 0xfb923c, edge: 0xe8772a, text: '#431407' }, // 16
  { fill: 0xf97316, edge: 0xdc5f0d, text: '#431407' }, // 32
  { fill: 0xdc2626, edge: 0xb91c1c, text: '#ffffff' }, // 64
  { fill: 0xdb2777, edge: 0xbe185d, text: '#ffffff' }, // 128
  { fill: 0x9333ea, edge: 0x7e22ce, text: '#ffffff' }, // 256
  { fill: 0x4f46e5, edge: 0x4338ca, text: '#ffffff' }, // 512
  { fill: 0x2563eb, edge: 0x1d4ed8, text: '#ffffff' }, // 1024
  { fill: 0x06b6d4, edge: 0x0891b2, text: '#083344' }, // 2048
  { fill: 0x14b8a6, edge: 0x0d9488, text: '#042f2e' }, // 4K
  { fill: 0x22c55e, edge: 0x16a34a, text: '#052e16' }, // 8K
  { fill: 0x84cc16, edge: 0x65a30d, text: '#1a2e05' }, // 16K
  { fill: 0xeab308, edge: 0xca8a04, text: '#422006' }, // 32K
];

const CHAMPION: BlockStyle = { fill: 0x1e293b, edge: 0x0f172a, text: '#fde68a' };

/** Every block style, for checks; index 0 is the block `2`, the last one is used for all larger blocks. */
export const ALL_BLOCK_STYLES: readonly BlockStyle[] = [...STYLES, CHAMPION];

export function blockStyle(exp: number, theme: Theme = 'light'): BlockStyle {
  const style = STYLES[exp - 1];
  if (style) return style;
  return theme === 'dark' ? { ...CHAMPION, outline: 0xfde68a } : CHAMPION;
}

/** Everything around the blocks, per theme. */
export interface BoardStyle {
  /** Behind the board (the canvas background). */
  background: string;
  board: number;
  /** Empty cells. */
  cell: number;
  /** Aimed column: white at this opacity. */
  highlight: number;
  /** Game over: the board fades towards this colour. */
  dimmer: number;
  dimmerAlpha: number;
  /** "+128" score text and its outline. */
  scoreText: string;
  scoreStroke: string;
  /** "Combo ×n!" text, and from combo 4 on. */
  combo: string;
  bigCombo: string;
}

export const BOARD: Record<Theme, BoardStyle> = {
  light: {
    background: '#fff7ed',
    board: 0xffedd5,
    cell: 0xfde7c9,
    highlight: 0.45,
    dimmer: 0xfff7ed,
    dimmerAlpha: 0.45,
    scoreText: '#7c2d12',
    scoreStroke: '#ffffff',
    combo: '#c2410c',
    bigCombo: '#be185d',
  },
  // Warm charcoal like the hub: the board sits a step above the page, empty cells a step above the board.
  dark: {
    background: '#17110e',
    board: 0x241a15,
    cell: 0x31241d,
    highlight: 0.07,
    dimmer: 0x17110e,
    dimmerAlpha: 0.55,
    scoreText: '#fdecdc',
    scoreStroke: '#17110e',
    combo: '#fb923c',
    bigCombo: '#f472b6',
  },
};
