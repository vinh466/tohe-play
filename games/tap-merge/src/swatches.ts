// Blocks in small, coloured like the board's: preset samples (⚙️ Cài đặt and the in-game panel), the goal and the
// largest block on the game-over card. No Phaser here: the menu stage uses it too.
import { formatValue, type Theme } from '@tohe/game-kit';
import type { Exponent } from './logic.ts';
import { blockStyle, type PaletteId } from './palette.ts';

export const cssColor = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/** Blocks 2 … 2^count of a preset. */
export function samples(id: PaletteId, theme: Theme, count = 8): HTMLElement {
  const row = document.createElement('span');
  row.className = 'samples';
  row.setAttribute('aria-hidden', 'true');
  for (let exp = 1; exp <= count; exp++) {
    const style = blockStyle(exp, theme, id);
    const block = document.createElement('span');
    block.className = 'sample';
    block.textContent = formatValue(2 ** exp);
    block.style.backgroundColor = cssColor(style.fill);
    block.style.color = style.text;
    block.style.boxShadow = `inset 0 -0.2rem 0 ${cssColor(style.edge)}`;
    row.append(block);
  }
  return row;
}

/** One block in small: the goal, and the largest block on the game-over card. */
export function miniBlock(exp: Exponent, theme: Theme, palette: PaletteId): HTMLElement {
  const style = blockStyle(exp, theme, palette);
  const block = document.createElement('span');
  block.className = 'mini';
  block.textContent = formatValue(2 ** exp);
  block.style.backgroundColor = cssColor(style.fill);
  block.style.color = style.text;
  block.style.boxShadow =
    style.outline === undefined
      ? `inset 0 -0.15rem 0 ${cssColor(style.edge)}`
      : `inset 0 0 0 2px ${cssColor(style.outline)}, inset 0 -0.15rem 0 ${cssColor(style.edge)}`;
  return block;
}
