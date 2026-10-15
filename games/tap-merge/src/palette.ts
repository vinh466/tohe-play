// Colours of the game. The board follows the hub's light/dark theme (ADR 0013); the blocks come in five presets the
// player picks from (SPEC.md, "Block colours"), the same in both themes. The default, Hoàng hôn, is Ghép Khối's, so
// the two games look like a family. Every number keeps at least 4.5:1 contrast on its block, and in the presets made
// to tell numbers apart two numbers in a row are clearly different colours (palette.test.ts). From 64K on, the
// preset's colours come round again with a gold ring (`blockStyle`).
import type { Theme } from '@tohe/game-kit';

export interface BlockStyle {
  fill: number;
  /** Darker edge drawn under the block for a bit of depth. */
  edge: number;
  text: string;
  /** The gold ring of the blocks from 64K on. */
  outline?: number;
}

export type PaletteId = 'sunset' | 'bold' | 'pastel' | 'neon' | 'colorblind';
/** In the order the picker shows them. */
export const PALETTE_IDS: readonly PaletteId[] = ['sunset', 'bold', 'pastel', 'neon', 'colorblind'];
export const DEFAULT_PALETTE: PaletteId = 'sunset';
export const isPalette = (value: unknown): value is PaletteId => PALETTE_IDS.includes(value as PaletteId);

/** Blocks from [fill, text] pairs, with an edge 18% darker than the fill. */
function styles(rows: [fill: number, text: string][]): BlockStyle[] {
  const darker = (color: number) =>
    [16, 8, 0].reduce((edge, shift) => edge | (Math.round(((color >> shift) & 0xff) * 0.82) << shift), 0);
  return rows.map(([fill, text]) => ({ fill, edge: darker(fill), text }));
}

// Hoàng hôn: warm and soft for small numbers, saturated and cool as they grow.
const SUNSET: BlockStyle[] = [
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

// Tương phản mạnh: two numbers in a row never share a hue; the second round takes other shades.
const BOLD = styles([
  [0xdc2626, '#ffffff'], // 2 red
  [0x2563eb, '#ffffff'], // 4 blue
  [0xfacc15, '#422006'], // 8 yellow
  [0x15803d, '#ffffff'], // 16 green
  [0x9333ea, '#ffffff'], // 32 purple
  [0xf97316, '#431407'], // 64 orange
  [0xdb2777, '#ffffff'], // 128 pink
  [0x2dd4bf, '#042f2e'], // 256 teal
  [0x1e3a8a, '#ffffff'], // 512 navy
  [0xa3e635, '#1a2e05'], // 1024 lime
  [0x9f1239, '#ffffff'], // 2048 crimson
  [0x38bdf8, '#082f49'], // 4K sky
  [0x92400e, '#ffffff'], // 8K brown
  [0xe879f9, '#4a044e'], // 16K orchid
  [0x047857, '#ffffff'], // 32K emerald
]);

// Kẹo pastel: light, soft colours, a different hue for each number, dark text.
const PASTEL = styles([
  [0xfbcfe8, '#831843'], // 2 pink
  [0xa7f3d0, '#064e3b'], // 4 mint
  [0xfef08a, '#713f12'], // 8 lemon
  [0xc4b5fd, '#3b0764'], // 16 lavender
  [0xbae6fd, '#0c4a6e'], // 32 sky
  [0xfed7aa, '#7c2d12'], // 64 peach
  [0xd9f99d, '#365314'], // 128 lime
  [0xfda4af, '#881337'], // 256 rose
  [0x99f6e4, '#134e4a'], // 512 aqua
  [0xc7d2fe, '#312e81'], // 1024 periwinkle
  [0xfcd34d, '#78350f'], // 2048 apricot
  [0xf5d0fe, '#701a75'], // 4K orchid
  [0x67e8f9, '#164e63'], // 8K cyan
  [0x86efac, '#14532d'], // 16K green
  [0xd8b4fe, '#581c87'], // 32K purple
]);

// Neon: bright, saturated colours with dark text.
const NEON = styles([
  [0xff4fd8, '#3b0030'], // 2 pink
  [0x22d3ee, '#083344'], // 4 cyan
  [0xd9f945, '#1a2e05'], // 8 lime
  [0xc084fc, '#2e1065'], // 16 violet
  [0xfb923c, '#431407'], // 32 orange
  [0x4ade80, '#052e16'], // 64 green
  [0xf43f5e, '#1f0610'], // 128 red
  [0x38bdf8, '#082f49'], // 256 sky
  [0xfacc15, '#422006'], // 512 yellow
  [0xf472b6, '#500724'], // 1024 rose
  [0x2dd4bf, '#042f2e'], // 2048 teal
  [0x818cf8, '#1e1b4b'], // 4K indigo
  [0xa3e635, '#1a2e05'], // 8K lime
  [0xe879f9, '#4a044e'], // 16K fuchsia
  [0xfde047, '#422006'], // 32K yellow
]);

// Dễ phân biệt: the Okabe–Ito palette, told apart with red–green colour blindness; from 512 on, its hues darker.
const COLORBLIND = styles([
  [0xe69f00, '#1f1300'], // 2 orange
  [0x56b4e9, '#04263a'], // 4 sky blue
  [0x009e73, '#00140e'], // 8 bluish green
  [0xf0e442, '#2e2a00'], // 16 yellow
  [0x0072b2, '#ffffff'], // 32 blue
  [0xd55e00, '#1a0b00'], // 64 vermillion
  [0xcc79a7, '#2a0a1c'], // 128 reddish purple
  [0x3d3d3d, '#ffffff'], // 256 black, softened
  [0x8a5d00, '#ffffff'], // 512 dark orange
  [0x1f6f9e, '#ffffff'], // 1024 dark sky blue
  [0x006048, '#ffffff'], // 2048 dark bluish green
  [0xa69b1c, '#1c1a00'], // 4K dark yellow
  [0x003d61, '#ffffff'], // 8K dark blue
  [0x8f3f00, '#ffffff'], // 16K dark vermillion
  [0x8c4673, '#ffffff'], // 32K dark reddish purple
]);

/** Each preset's blocks, 2 to 32K; index 0 is the block `2`. */
export const PALETTES: Record<PaletteId, readonly BlockStyle[]> = {
  sunset: SUNSET,
  bold: BOLD,
  pastel: PASTEL,
  neon: NEON,
  colorblind: COLORBLIND,
};

/** The ring of the blocks from 64K on: deep gold on the cream board, light gold on the dark one. */
export const GOLD: Record<Theme, number> = { light: 0xb45309, dark: 0xfcd34d };

const rings = new Map<string, BlockStyle>();

/**
 * A block's colours. From 64K on, the preset's colours come round again (64K like 2, 128K like 4, …) with a gold
 * ring: the rising floor has retired those small numbers long before (2s at 4K, 4s at 16K, …), and in the rare
 * game where one is still there, the ring and the number tell them apart.
 */
export function blockStyle(
  exp: number,
  theme: Theme = 'light',
  palette: PaletteId = DEFAULT_PALETTE,
): BlockStyle {
  const preset = PALETTES[palette];
  const style = preset[(exp - 1) % preset.length] as BlockStyle;
  if (exp <= preset.length) return style;
  const key = `${palette}:${theme}:${exp}`;
  let ringed = rings.get(key);
  if (!ringed) {
    ringed = { ...style, outline: GOLD[theme] };
    rings.set(key, ringed);
  }
  return ringed;
}

/** Everything around the blocks, per theme. */
export interface BoardStyle {
  /** Behind the board (the canvas background). */
  background: string;
  board: number;
  /** Empty cells. */
  cell: number;
  /** Ring around the pressed block and the neighbours it would absorb. */
  press: number;
  /** Game over: the board fades towards this colour. */
  dimmer: number;
  dimmerAlpha: number;
  /** "+128" score text and its outline. */
  scoreText: string;
  scoreStroke: string;
  /** "Gom n!" text, and for the biggest groups (10 blocks and more). */
  combo: string;
  bigCombo: string;
}

export const BOARD: Record<Theme, BoardStyle> = {
  light: {
    background: '#fff7ed',
    board: 0xffedd5,
    cell: 0xfde7c9,
    press: 0x9a3412,
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
    press: 0xfdecdc,
    dimmer: 0x17110e,
    dimmerAlpha: 0.55,
    scoreText: '#fdecdc',
    scoreStroke: '#17110e',
    combo: '#fb923c',
    bigCombo: '#f472b6',
  },
};
