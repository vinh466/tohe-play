// The next block in the HUD's centre: the one after the block in play, in the palette's colours. It sits in the HUD,
// so the current block can hover over any column without covering it. The play stage and the replay stage show it.
import { bump, formatValue, type Theme } from '@tohe/game-kit';
import { store, t } from './app.ts';
import { blockValue, type Exponent } from './logic.ts';
import { blockStyle } from './palette.ts';
import { cssColor } from './swatches.ts';

export interface NextBlock {
  /** Shows `exp`, or hides the box at game over. */
  show(exp: Exponent | null, animate: boolean): void;
  /** The theme or the block colours changed: paint the block shown again. */
  repaint(theme: Theme): void;
}

export function createNextBlock(center: HTMLElement, theme: Theme): NextBlock {
  const box = document.createElement('div');
  box.className = 'next';
  const label = document.createElement('span');
  label.className = 'tohe-stat-label';
  label.textContent = t.next;
  const block = document.createElement('span');
  block.className = 'mini-block';
  box.append(label, block);
  center.append(box);

  let shown: Exponent | null = null;
  const show = (exp: Exponent | null, animate: boolean) => {
    shown = exp;
    box.classList.toggle('is-hidden', exp === null);
    if (exp === null) return;
    const style = blockStyle(exp, theme, store.palette);
    const value = formatValue(blockValue(exp));
    block.textContent = value;
    block.classList.toggle('is-long', value.length > 2);
    block.style.setProperty('--fill', cssColor(style.fill));
    block.style.setProperty('--edge', cssColor(style.edge));
    block.style.setProperty('--text', style.text);
    if (animate) bump(block);
  };
  return {
    show,
    repaint(next) {
      theme = next;
      show(shown, false);
    },
  };
}
