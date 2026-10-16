// Sample blocks of a colour preset, drawn like the board's blocks: in ⚙️ Cài đặt and in the in-game panel.
import { formatValue, type Theme } from '@tohe/game-kit';
import { blockValue } from './logic.ts';
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
    block.textContent = formatValue(blockValue(exp));
    block.style.backgroundColor = cssColor(style.fill);
    block.style.color = style.text;
    block.style.boxShadow = `inset 0 -0.2rem 0 ${cssColor(style.edge)}`;
    row.append(block);
  }
  return row;
}
