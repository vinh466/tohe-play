// The board scene: draws the state and turns logic events into animations. It never decides rules — main.ts
// calls logic.drop() and hands the events here. Layout is in CSS pixels (the kit zooms the camera by DPR).
// Colours come from palette.ts for the current light/dark theme; setTheme() redraws everything.
// The board and every block (with its number) are textures drawn once per value, theme and size (the kit's
// drawTexture): a frame then costs one quad per block instead of rebuilding rounded rectangles and text.
import { formatValue, haptics, type Sfx, type Theme } from '@tohe/game-kit';
import {
  burst,
  confetti,
  crispImage,
  crispText,
  cssHex,
  delay,
  dprOf,
  drawTexture,
  floatText,
  popIn,
  pulse,
  roundedRect,
  shake,
  squash,
  tweenAsync,
} from '@tohe/game-kit/phaser';
import Phaser from 'phaser';
import {
  blocks,
  type Cell,
  COLS,
  type Exponent,
  type GameEvent,
  indexOf,
  landingRow,
  ROWS,
  type State,
} from './logic.ts';
import { BOARD, blockStyle } from './palette.ts';
import type { Strings } from './strings.ts';

interface Layout {
  width: number;
  height: number;
  cell: number;
  gap: number;
  boardX: number;
  boardY: number;
  previewY: number;
}

export interface BoardCallbacks {
  /** The player chose a column (tap, drag-release or keyboard), also while a move still animates. */
  onDrop(col: number): void;
  /** Running score while a move resolves, so the HUD can count up merge by merge. */
  onScore(score: number): void;
  /** The block after the current one, for the HUD (null once the game is over). */
  onUpcoming(next: Exponent | null, animate: boolean): void;
}

type Block = Phaser.GameObjects.Container & { exp: Exponent };

/** Blocks up to this value (2^11 = 2048) are drawn ahead, so a merge never waits for a new texture. */
const PREDRAWN = 11;

export class BoardScene extends Phaser.Scene {
  private layoutInfo!: Layout;
  private board!: Phaser.GameObjects.Image;
  /** Textures drawn for the current and earlier layouts; the ones no longer shown are removed. */
  private drawn = new Set<string>();
  private highlight!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Graphics;
  private dimmer!: Phaser.GameObjects.Rectangle;
  private hint: Phaser.GameObjects.Text | null = null;
  private cells = new Map<number, Block>();
  private current: Block | null = null;
  private state: State | null = null;
  private hoverCol: number | null = null;
  private busy = false;
  private ready: () => void = () => {};
  readonly whenReady = new Promise<void>((resolve) => {
    this.ready = resolve;
  });

  constructor(
    private readonly sfx: Sfx,
    private readonly text: Strings,
    private readonly callbacks: BoardCallbacks,
    private theme: Theme,
  ) {
    super('board');
  }

  private get colors() {
    return BOARD[this.theme];
  }

  create() {
    this.board = crispImage(this, 0, 0, '__DEFAULT').setOrigin(0).setDepth(0);
    this.highlight = this.add.graphics().setDepth(1);
    this.ghost = this.add.graphics().setDepth(2);
    this.dimmer = this.add.rectangle(0, 0, 10, 10, this.colors.dimmer, 0).setOrigin(0).setDepth(30);

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.hover(this.columnAt(p.worldX, p.worldY)));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.hover(this.columnAt(p.worldX, p.worldY)));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      // Also while busy: main.ts remembers a tap made during a move and plays it right after.
      const col = this.columnAt(p.worldX, p.worldY);
      if (col !== null) this.callbacks.onDrop(col);
    });
    this.input.on('gameout', () => this.hover(null));

    const dpr = (this.registry.get('dpr') as number | undefined) ?? 1;
    this.relayout(this.scale.width / dpr, this.scale.height / dpr);
    this.ready();
  }

  // ------------------------------------------------------------------ layout

  /** The hub switched light/dark: redraw the board and every block in the new colours. */
  setTheme(theme: Theme) {
    this.theme = theme;
    if (!this.layoutInfo) return;
    this.relayout(this.layoutInfo.width, this.layoutInfo.height);
    this.dimmer.setFillStyle(this.colors.dimmer, this.state?.over ? this.colors.dimmerAlpha : 0);
  }

  relayout(width: number, height: number) {
    if (!this.board) return;
    const gap = Math.max(4, Math.round(Math.min(width, height) * 0.012));
    const cell = Math.floor(Math.min((width - 24) / COLS, (height - 24) / (ROWS + 1.45)));
    const boardW = cell * COLS;
    const boardX = Math.round((width - boardW) / 2);
    // Preview row + board, centred vertically (slightly lower than centre: thumbs live at the bottom).
    const total = cell * (ROWS + 1.45);
    const top = Math.max(8, Math.round((height - total) * 0.6));
    const boardY = Math.round(top + cell * 1.45);
    const previewY = Math.round(boardY - cell * 0.78);
    this.layoutInfo = { width, height, cell, gap, boardX, boardY, previewY };

    this.board.setTexture(this.boardTexture()).setPosition(boardX - 8, boardY - 8);
    for (let exp = 1; exp <= PREDRAWN; exp++) this.blockTexture(exp, cell);
    this.dimmer.setSize(width, height);

    for (const [index, block] of this.cells) {
      const cellPos = this.cellCenter({ col: index % COLS, row: Math.floor(index / COLS) });
      block.setPosition(cellPos.x, cellPos.y);
      this.paint(block, block.exp, cell);
    }
    if (this.current) {
      this.current.setPosition(this.columnX(this.hoverCol ?? 2), previewY);
      this.paint(this.current, this.current.exp, cell);
    }
    this.drawGuides();
    // Blocks still finishing an animation may show an old texture for a moment; remove them afterwards.
    this.time.delayedCall(1000, () => this.removeUnusedTextures());
  }

  private boardTexture(): string {
    const { cell, gap } = this.layoutInfo;
    const width = cell * COLS + 16;
    const height = cell * ROWS + 16;
    const key = `merge-block:board:${this.theme}:${cell}:${gap}`;
    this.drawn.add(key);
    return drawTexture(this, key, width, height, (ctx) => {
      ctx.fillStyle = cssHex(this.colors.board);
      ctx.beginPath();
      roundedRect(ctx, 0, 0, width, height, 22);
      ctx.fill();
      ctx.fillStyle = cssHex(this.colors.cell);
      ctx.beginPath();
      for (let col = 0; col < COLS; col++) {
        for (let row = 0; row < ROWS; row++) {
          roundedRect(
            ctx,
            8 + col * cell + gap / 2,
            8 + row * cell + gap / 2,
            cell - gap,
            cell - gap,
            cell * 0.16,
          );
        }
      }
      ctx.fill();
    });
  }

  /** A block with its number, centred on the top face's square: `originY` puts that centre on the block's position. */
  private blockTexture(exp: Exponent, size: number): { key: string; originY: number } {
    const inner = size - this.layoutInfo.gap;
    const r = inner * 0.2;
    const line = Math.max(2, inner * 0.04);
    const pad = Math.ceil(line / 2) + 1;
    const height = inner * 1.06 + pad * 2;
    const key = `merge-block:block:${this.theme}:${inner}:${exp}`;
    this.drawn.add(key);
    drawTexture(this, key, inner + pad * 2, height, (ctx) => {
      const style = blockStyle(exp, this.theme);
      const fill = (color: string, x: number, y: number, w: number, h: number, radius: number) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        roundedRect(ctx, pad + x, pad + y, w, h, radius);
        ctx.fill();
      };
      fill(cssHex(style.edge), 0, inner * 0.06, inner, inner, r);
      fill(cssHex(style.fill), 0, 0, inner, inner * 0.94, r);
      if (style.outline !== undefined) {
        ctx.lineWidth = line;
        ctx.strokeStyle = cssHex(style.outline);
        ctx.beginPath();
        roundedRect(ctx, pad, pad, inner, inner, r);
        ctx.stroke();
      }
      fill('rgba(255, 255, 255, 0.22)', inner * 0.1, inner * 0.07, inner * 0.8, inner * 0.18, r * 0.6);
      // The digits' own box is centred (not the font's), a little above the middle like the top face.
      const value = formatValue(2 ** exp);
      const fontSize = Math.round(inner * (value.length <= 2 ? 0.46 : value.length === 3 ? 0.38 : 0.31));
      ctx.font = `900 ${fontSize}px system-ui, sans-serif`;
      ctx.fillStyle = style.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const box = ctx.measureText(value);
      const middle = pad + inner / 2 - inner * 0.03;
      ctx.fillText(
        value,
        pad + inner / 2,
        middle + (box.actualBoundingBoxAscent - box.actualBoundingBoxDescent) / 2,
      );
    });
    return { key, originY: (pad + inner / 2) / height };
  }

  private removeUnusedTextures() {
    const shown = new Set<string>([this.board.texture.key]);
    for (const object of this.children.list) {
      if (object instanceof Phaser.GameObjects.Container) {
        const image = object.list[0];
        if (image instanceof Phaser.GameObjects.Image) shown.add(image.texture.key);
      }
    }
    const { cell, gap } = this.layoutInfo;
    const current = `merge-block:block:${this.theme}:${cell - gap}:`;
    for (const key of this.drawn) {
      if (shown.has(key) || key.startsWith(current)) continue;
      this.textures.remove(key);
      this.drawn.delete(key);
    }
  }

  private cellTopLeft({ col, row }: Cell) {
    const { boardX, boardY, cell } = this.layoutInfo;
    return { x: boardX + col * cell, y: boardY + (ROWS - 1 - row) * cell };
  }

  private cellCenter(cell: Cell) {
    const { x, y } = this.cellTopLeft(cell);
    return { x: x + this.layoutInfo.cell / 2, y: y + this.layoutInfo.cell / 2 };
  }

  private columnX(col: number) {
    return this.layoutInfo.boardX + col * this.layoutInfo.cell + this.layoutInfo.cell / 2;
  }

  private columnAt(x: number, y: number): number | null {
    const { boardX, cell, previewY } = this.layoutInfo;
    if (y < previewY - cell) return null;
    const col = Math.floor((x - boardX) / cell);
    return col >= 0 && col < COLS ? col : null;
  }

  // ------------------------------------------------------------------ blocks

  private makeBlock(exp: Exponent, size: number, x: number, y: number): Block {
    const block = this.add.container(x, y) as Block;
    block.add(crispImage(this, 0, 0, '__DEFAULT'));
    block.setDepth(10);
    this.paint(block, exp, size);
    return block;
  }

  private paint(block: Block, exp: Exponent, size: number) {
    block.exp = exp;
    const image = block.list[0] as Phaser.GameObjects.Image;
    const { key, originY } = this.blockTexture(exp, size);
    image
      .setTexture(key)
      .setOrigin(0.5, originY)
      .setScale(1 / dprOf(this));
  }

  // ------------------------------------------------------------------ state

  /** Draw a whole state without animation (start, resume, new game). */
  setBoard(state: State) {
    this.state = state;
    for (const block of this.cells.values()) block.destroy();
    this.cells.clear();
    for (const { cell, exp } of blocks(state.grid)) {
      const { x, y } = this.cellCenter(cell);
      this.cells.set(indexOf(cell), this.makeBlock(exp, this.layoutInfo.cell, x, y));
    }
    this.showCurrent(state.current, false);
    this.callbacks.onUpcoming(state.over ? null : state.next, false);
    this.dimmer.setFillStyle(this.colors.dimmer, 0);
    this.busy = false;
    this.drawGuides();
  }

  /** The block the player drops, hovering over the aimed column. The next one is in the HUD, never covered. */
  private showCurrent(current: Exponent, animate: boolean) {
    const { cell, previewY } = this.layoutInfo;
    this.current?.destroy();
    this.current = this.makeBlock(current, cell, this.columnX(this.hoverCol ?? 2), previewY).setDepth(20);
    if (animate) void popIn(this, this.current, 180);
  }

  showHint(on: boolean) {
    this.hint?.destroy();
    this.hint = null;
    if (!on) return;
    const { cell, previewY } = this.layoutInfo;
    this.hint = crispText(this, this.columnX(2), previewY + cell * 0.95, '👆', {
      fontSize: `${Math.round(cell * 0.6)}px`,
    })
      .setOrigin(0.5)
      .setDepth(25);
    this.tweens.add({
      targets: this.hint,
      y: '+=14',
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // ------------------------------------------------------------------ input feedback

  hover(col: number | null) {
    if (this.busy || this.state?.over) col = null;
    if (col === this.hoverCol && col !== null) return;
    if (col !== null) this.hoverCol = col;
    if (this.current && this.hoverCol !== null) {
      this.tweens.add({
        targets: this.current,
        x: this.columnX(this.hoverCol),
        duration: 90,
        ease: 'Quad.easeOut',
      });
    }
    this.drawGuides(col !== null);
  }

  /** Keyboard: move the aim one column left or right. */
  nudge(step: -1 | 1) {
    this.hover(Math.max(0, Math.min(COLS - 1, (this.hoverCol ?? 2) + step)));
  }

  get aimedColumn() {
    return this.hoverCol ?? 2;
  }

  private drawGuides(active = true) {
    this.highlight.clear();
    this.ghost.clear();
    if (!this.state || !this.layoutInfo || this.hoverCol === null || !active || this.busy || this.state.over)
      return;
    const { cell, boardY, gap } = this.layoutInfo;
    const x = this.layoutInfo.boardX + this.hoverCol * cell;
    this.highlight
      .fillStyle(0xffffff, this.colors.highlight)
      .fillRoundedRect(x + 2, boardY - 4, cell - 4, cell * ROWS + 8, 16);
    const row = landingRow(this.state.grid, this.hoverCol);
    if (row === null) return;
    const { y } = this.cellTopLeft({ col: this.hoverCol, row });
    const style = blockStyle(this.state.current, this.theme);
    this.ghost
      .lineStyle(3, style.edge, 0.9)
      .strokeRoundedRect(x + gap, y + gap, cell - gap * 2, cell - gap * 2, cell * 0.18);
    this.ghost
      .fillStyle(style.fill, 0.35)
      .fillRoundedRect(x + gap, y + gap, cell - gap * 2, cell - gap * 2, cell * 0.18);
  }

  /** A full column refuses the block. */
  reject(col: number) {
    this.sfx.play('error');
    haptics.play('error');
    const column = [...this.cells.entries()].filter(([index]) => index % COLS === col).map(([, b]) => b);
    for (const block of column) {
      this.tweens.add({
        targets: block,
        x: block.x + 6,
        duration: 45,
        yoyo: true,
        repeat: 2,
        ease: 'Sine.easeInOut',
      });
    }
  }

  // ------------------------------------------------------------------ animation of a move

  async play(events: GameEvent[], state: State, previousScore: number) {
    this.busy = true;
    this.drawGuides(false);
    this.showHint(false);
    let score = previousScore;

    for (let i = 0; i < events.length; i++) {
      const event = events[i] as GameEvent;
      switch (event.type) {
        case 'land':
          // Aim stays on the column just played (also for a tap remembered during the previous move).
          this.hoverCol = event.at.col;
          await this.animateLand(event.at, event.exp);
          break;
        case 'merge': {
          // Merges of the same chain step run together; the next step waits for them.
          const group: Extract<GameEvent, { type: 'merge' }>[] = [event];
          while (events[i + 1]?.type === 'merge' && (events[i + 1] as typeof event).combo === event.combo) {
            group.push(events[++i] as typeof event);
          }
          await Promise.all(group.map((merge) => this.animateMerge(merge)));
          for (const merge of group) score += merge.gained;
          this.callbacks.onScore(score);
          if (event.combo >= 2) this.announceCombo(event.combo);
          break;
        }
        case 'fall':
          await this.animateFall(event.moves);
          break;
        case 'next':
          this.showCurrent(event.current, true);
          this.callbacks.onUpcoming(event.next, true);
          break;
        case 'over':
          await this.animateOver(event.record);
          break;
      }
    }
    this.state = state;
    this.busy = false;
    this.drawGuides();
  }

  private async animateLand(at: Cell, exp: Exponent) {
    const current = this.current;
    this.current = null;
    const { x, y } = this.cellCenter(at);
    const block = current ?? this.makeBlock(exp, this.layoutInfo.cell, x, this.layoutInfo.previewY);
    block.setDepth(10);
    this.tweens.add({ targets: block, x, duration: 70, ease: 'Quad.easeOut' });
    await tweenAsync(this, { targets: block, y, duration: 110 + (ROWS - at.row) * 28, ease: 'Quad.easeIn' });
    this.cells.set(indexOf(at), block);
    this.sfx.play('drop');
    haptics.play('tap');
    await squash(this, block, 0.12);
  }

  private async animateMerge(merge: Extract<GameEvent, { type: 'merge' }>) {
    const target = this.cells.get(indexOf(merge.into));
    const { x, y } = this.cellCenter(merge.into);
    await Promise.all(
      merge.from.map(async (cell) => {
        const block = this.cells.get(indexOf(cell));
        this.cells.delete(indexOf(cell));
        if (!block) return;
        block.setDepth(9);
        await tweenAsync(this, { targets: block, x, y, scale: 0.6, duration: 130, ease: 'Back.easeIn' });
        block.destroy();
      }),
    );
    if (!target) return;
    this.paint(target, merge.exp, this.layoutInfo.cell);
    target.setDepth(11);
    const style = blockStyle(merge.exp, this.theme);
    burst(this, x, y, style.fill, 10 + Math.min(merge.exp, 12));
    floatText(this, x, y - this.layoutInfo.cell * 0.45, `+${formatValue(merge.gained)}`, {
      color: this.colors.scoreText,
      stroke: this.colors.scoreStroke,
      size: Math.round(this.layoutInfo.cell * 0.32),
    });
    this.sfx.play('merge', merge.exp);
    haptics.play('bump');
    if (merge.exp >= 11) shake(this, 'medium');
    else if (merge.exp >= 9) shake(this, 'small');
    await pulse(this, target, 1.24);
    target.setDepth(10);
  }

  private announceCombo(combo: number) {
    const { width, boardY, cell } = this.layoutInfo;
    floatText(this, width / 2, boardY + cell * 1.2, this.text.combo(combo), {
      color: combo >= 4 ? this.colors.bigCombo : this.colors.combo,
      stroke: this.colors.scoreStroke,
      size: Math.round(cell * (0.42 + Math.min(combo, 5) * 0.05)),
      rise: cell * 0.9,
    });
    this.sfx.play('combo', combo + 4);
    haptics.play('success');
    if (combo >= 4) shake(this, 'small');
  }

  private async animateFall(moves: { from: Cell; to: Cell }[]) {
    const moving = moves.map((m) => ({
      block: this.cells.get(indexOf(m.from)),
      to: m.to,
      rows: m.from.row - m.to.row,
    }));
    for (const m of moves) this.cells.delete(indexOf(m.from));
    await Promise.all(
      moving.map(async ({ block, to, rows }) => {
        if (!block) return;
        this.cells.set(indexOf(to), block);
        await tweenAsync(this, {
          targets: block,
          y: this.cellCenter(to).y,
          duration: 120 + rows * 45,
          ease: 'Bounce.easeOut',
        });
      }),
    );
  }

  private async animateOver(record: boolean) {
    this.dimmer.setFillStyle(this.colors.dimmer, 0);
    await tweenAsync(this, { targets: this.dimmer, fillAlpha: this.colors.dimmerAlpha, duration: 400 });
    for (const block of this.cells.values()) {
      this.tweens.add({ targets: block, angle: { from: -4, to: 4 }, duration: 140, yoyo: true, repeat: 1 });
    }
    this.current?.destroy();
    this.current = null;
    this.callbacks.onUpcoming(null, true);
    if (record) {
      confetti(this, this.layoutInfo.width);
      this.sfx.play('fanfare');
      haptics.play('success');
    }
    await delay(this, 450);
  }
}
