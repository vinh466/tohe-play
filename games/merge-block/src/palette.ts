// Block colours by exponent: warm and soft for small numbers, saturated and cool as they grow, so a glance at the
// board shows how far a game has come. Text colour keeps contrast on every fill.

export interface BlockStyle {
  fill: number;
  /** Darker edge drawn under the block for a bit of depth. */
  edge: number;
  text: string;
}

const STYLES: BlockStyle[] = [
  { fill: 0xfef3c7, edge: 0xf5d98a, text: '#92400e' }, // 2
  { fill: 0xfde68a, edge: 0xf2c94c, text: '#92400e' }, // 4
  { fill: 0xfdba74, edge: 0xf59e5b, text: '#7c2d12' }, // 8
  { fill: 0xfb923c, edge: 0xe8772a, text: '#ffffff' }, // 16
  { fill: 0xf97316, edge: 0xdc5f0d, text: '#ffffff' }, // 32
  { fill: 0xef4444, edge: 0xc93030, text: '#ffffff' }, // 64
  { fill: 0xec4899, edge: 0xc9327c, text: '#ffffff' }, // 128
  { fill: 0xa855f7, edge: 0x8b3fd9, text: '#ffffff' }, // 256
  { fill: 0x6366f1, edge: 0x4b4fd4, text: '#ffffff' }, // 512
  { fill: 0x3b82f6, edge: 0x2867d4, text: '#ffffff' }, // 1024
  { fill: 0x06b6d4, edge: 0x0893ad, text: '#ffffff' }, // 2048
  { fill: 0x14b8a6, edge: 0x0e968a, text: '#ffffff' }, // 4K
  { fill: 0x22c55e, edge: 0x16a34a, text: '#ffffff' }, // 8K
  { fill: 0x84cc16, edge: 0x65a30d, text: '#ffffff' }, // 16K
  { fill: 0xeab308, edge: 0xca8a04, text: '#ffffff' }, // 32K
];

const CHAMPION: BlockStyle = { fill: 0x1e293b, edge: 0x0f172a, text: '#fde68a' };

export function blockStyle(exp: number): BlockStyle {
  return STYLES[exp - 1] ?? CHAMPION;
}
