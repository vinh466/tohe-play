// The board scene: draws the state and turns logic events into animations. It never decides rules — main.ts
// calls logic.drop() and hands the events here. Layout is in CSS pixels (the kit zooms the camera by DPR).
import { formatValue, haptics, type Sfx } from '@tohe/game-kit';
import {
  burst,
  confetti,
  crispText,
  delay,
  floatText,
  popIn,
  pulse,
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
import { blockStyle } from './palette.ts';
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
  /** The player chose a column (tap, drag-release or keyboard). */
  onDrop(col: number): void;
  /** Running score while a move resolves, so the HUD can count up merge by merge. */
  onScore(score: number): void;
}

type Block = Phaser.GameObjects.Container & { exp: Exponent };

export class BoardScene extends Phaser.Scene {
  private layoutInfo!: Layout;
  private board!: Phaser.GameObjects.Graphics;
  private highlight!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Graphics;
  private dimmer!: Phaser.GameObjects.Rectangle;
  private hint: Phaser.GameObjects.Text | null = null;
  private cells = new Map<number, Block>();
  private current: Block | null = null;
  private next: Block | null = null;
  private nextLabel!: Phaser.GameObjects.Text;
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
  ) {
    super('board');
  }

  create() {
    this.board = this.add.graphics().setDepth(0);
    this.highlight = this.add.graphics().setDepth(1);
    this.ghost = this.add.graphics().setDepth(2);
    this.dimmer = this.add.rectangle(0, 0, 10, 10, 0xfff7ed, 0).setOrigin(0).setDepth(30);
    this.nextLabel = crispText(this, 0, 0, this.text.next, {
      fontSize: '13px',
      fontStyle: '700',
      color: '#9a3412',
    }).setOrigin(0.5);

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.hover(this.columnAt(p.worldX, p.worldY)));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.hover(this.columnAt(p.worldX, p.worldY)));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const col = this.columnAt(p.worldX, p.worldY);
      if (col !== null && !this.busy) this.callbacks.onDrop(col);
    });
    this.input.on('gameout', () => this.hover(null));

    const dpr = (this.registry.get('dpr') as number | undefined) ?? 1;
    this.relayout(this.scale.width / dpr, this.scale.height / dpr);
    this.ready();
  }

  // ------------------------------------------------------------------ layout

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

    this.board.clear();
    this.board
      .fillStyle(0xffedd5, 1)
      .fillRoundedRect(boardX - 8, boardY - 8, boardW + 16, cell * ROWS + 16, 22);
    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row < ROWS; row++) {
        const { x, y } = this.cellTopLeft({ col, row });
        this.board
          .fillStyle(0xfde7c9, 1)
          .fillRoundedRect(x + gap / 2, y + gap / 2, cell - gap, cell - gap, cell * 0.16);
      }
    }
    this.dimmer.setSize(width, height);
    this.nextLabel.setPosition(boardX + boardW - cell * 0.32, previewY - cell * 0.5);

    for (const [index, block] of this.cells) {
      const cellPos = this.cellCenter({ col: index % COLS, row: Math.floor(index / COLS) });
      block.setPosition(cellPos.x, cellPos.y);
      this.paint(block, block.exp, cell);
    }
    if (this.current) {
      this.current.setPosition(this.columnX(this.hoverCol ?? 2), previewY);
      this.paint(this.current, this.current.exp, cell);
    }
    if (this.next) {
      this.next.setPosition(boardX + boardW - cell * 0.32, previewY + cell * 0.05);
      this.paint(this.next, this.next.exp, cell * 0.5);
    }
    this.drawGuides();
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
    block.add([this.add.graphics(), crispText(this, 0, 0, '', { fontStyle: '900' }).setOrigin(0.5)]);
    block.setDepth(10);
    this.paint(block, exp, size);
    return block;
  }

  private paint(block: Block, exp: Exponent, size: number) {
    block.exp = exp;
    const [shape, label] = block.list as [Phaser.GameObjects.Graphics, Phaser.GameObjects.Text];
    const style = blockStyle(exp);
    const inner = size - this.layoutInfo.gap;
    const r = inner * 0.2;
    shape.clear();
    shape.fillStyle(style.edge, 1).fillRoundedRect(-inner / 2, -inner / 2 + inner * 0.06, inner, inner, r);
    shape.fillStyle(style.fill, 1).fillRoundedRect(-inner / 2, -inner / 2, inner, inner * 0.94, r);
    shape
      .fillStyle(0xffffff, 0.22)
      .fillRoundedRect(
        -inner / 2 + inner * 0.1,
        -inner / 2 + inner * 0.07,
        inner * 0.8,
        inner * 0.18,
        r * 0.6,
      );
    const value = formatValue(2 ** exp);
    const fontSize = Math.round(inner * (value.length <= 2 ? 0.46 : value.length === 3 ? 0.38 : 0.31));
    label
      .setText(value)
      .setColor(style.text)
      .setFontSize(fontSize)
      .setY(-inner * 0.02);
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
    this.showUpcoming(state.current, state.next, false);
    this.next?.setVisible(true);
    this.nextLabel.setVisible(true);
    this.dimmer.setFillStyle(0xfff7ed, 0);
    this.busy = false;
    this.drawGuides();
  }

  private showUpcoming(current: Exponent, next: Exponent, animate: boolean) {
    const { cell, previewY, boardX } = this.layoutInfo;
    this.current?.destroy();
    this.current = this.makeBlock(current, cell, this.columnX(this.hoverCol ?? 2), previewY).setDepth(20);
    if (!this.next)
      this.next = this.makeBlock(
        next,
        cell * 0.5,
        boardX + cell * COLS - cell * 0.32,
        previewY + cell * 0.05,
      );
    this.paint(this.next, next, cell * 0.5);
    if (animate) {
      void popIn(this, this.current, 180);
      void pulse(this, this.next, 1.15);
    }
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
      .fillStyle(0xffffff, 0.45)
      .fillRoundedRect(x + 2, boardY - 4, cell - 4, cell * ROWS + 8, 16);
    const row = landingRow(this.state.grid, this.hoverCol);
    if (row === null) return;
    const { y } = this.cellTopLeft({ col: this.hoverCol, row });
    const style = blockStyle(this.state.current);
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
          this.showUpcoming(event.current, event.next, true);
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
    const style = blockStyle(merge.exp);
    burst(this, x, y, style.fill, 10 + Math.min(merge.exp, 12));
    floatText(this, x, y - this.layoutInfo.cell * 0.45, `+${formatValue(merge.gained)}`, {
      color: '#7c2d12',
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
      color: combo >= 4 ? '#be185d' : '#c2410c',
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
    await tweenAsync(this, { targets: this.dimmer, fillAlpha: 0.45, duration: 400 });
    for (const block of this.cells.values()) {
      this.tweens.add({ targets: block, angle: { from: -4, to: 4 }, duration: 140, yoyo: true, repeat: 1 });
    }
    this.current?.destroy();
    this.current = null;
    this.next?.setVisible(false);
    this.nextLabel.setVisible(false);
    if (record) {
      confetti(this, this.layoutInfo.width);
      this.sfx.play('fanfare');
      haptics.play('success');
    }
    await delay(this, 450);
  }
}
