// The eight piece colours, in five presets. The shape is the identity; the palette is the mood. `fresh` is the
// default: bright and juicy on the paper board, with an ink edge on every block. `contrast` is the Okabe–Ito set for
// colour-vision deficiencies. The colours are inline CSS variables on the play stage, so a preset also works on the
// settings screen (outside the stage) and on the lifted drag piece.
export const PALETTE_IDS = ['fresh', 'paper', 'candy', 'neon', 'contrast'] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];
export const DEFAULT_PALETTE: PaletteId = 'fresh';

export const PALETTE_COLOURS: Record<
  PaletteId,
  readonly [string, string, string, string, string, string, string, string]
> = {
  fresh: ['#ff5a5f', '#ffb703', '#38b000', '#2196f3', '#9c27b0', '#00bfa5', '#ff7a00', '#2d3142'],
  paper: ['#c2413a', '#d9a227', '#4f7a3a', '#2f5f8f', '#7d3f6a', '#2f7d78', '#c56a2b', '#3d3a36'],
  candy: ['#ff7096', '#ffc300', '#7bd389', '#4cc9f0', '#b388eb', '#ff9770', '#64d8cb', '#6c757d'],
  neon: ['#ff006e', '#ffbe0b', '#8ac926', '#00b4d8', '#8338ec', '#06d6a0', '#fb5607', '#3a0ca3'],
  contrast: ['#e69f00', '#56b4e9', '#009e73', '#0072b2', '#d55e00', '#cc79a7', '#f0e442', '#222222'],
};

export const isPalette = (value: unknown): value is PaletteId =>
  typeof value === 'string' && (PALETTE_IDS as readonly string[]).includes(value);
