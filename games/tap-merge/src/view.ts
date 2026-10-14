// The board scene: draws the state and turns logic events into animations. It never decides rules — main.ts
// calls logic.tap() / shuffle() and hands the events here. Layout is in CSS pixels (the kit zooms the camera by DPR).
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
  pulse,
  roundedRect,
  shake,
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
  type Move,
  matches,
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
}

export interface BoardCallbacks {
  /** The player tapped a block (pressed and let go on it, or Enter on the aimed block). */
  onTap(cell: Cell): void;
  /** Running score while a move resolves, so the HUD can count up. */
  onScore(score: number): void;
  /** A new largest block was made; `earned` when it brought a 🔀. */
  onTop(shuffles: number, earned: boolean): void;
}

type Block = Phaser.GameObjects.Container & { exp: Exponent };

/** Blocks up to this value (2^11 = 2048) are drawn ahead, so a merge never waits for a new texture. */
const PREDRAWN = 11;
/** "Gom n!" from this many absorbed blocks on. */
const BIG_MERGE = 4;

export class BoardScene extends Phaser.Scene {
  private layoutInfo!: Layout;
  private board!: Phaser.GameObjects.Image;
  /** Textures drawn for the current and earlier layouts; the ones no longer shown are removed. */
  private drawn = new Set<string>();
  private press!: Phaser.GameObjects.Graphics;
  private dimmer!: Phaser.GameObjects.Rectangle;
  private hint: Phaser.GameObjects.Text | null = null;
  private hintCell: Cell | null = null;
  private cells = new Map<number, Block>();
  private state: State | null = null;
  /** The block under the finger (or the keyboard's aim) and the blocks lifted with it. */
  private pressed: Cell | null = null;
  private lifted: Block[] = [];
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
    this.press = this.add.graphics().setDepth(15);
    this.dimmer = this.add.rectangle(0, 0, 10, 10, this.colors.dimmer, 0).setOrigin(0).setDepth(30);

    // Finger down shows what a tap would merge; letting go on the same block plays it.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.aim(this.cellAt(p.worldX, p.worldY)));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown && this.pressed) this.aim(this.cellAt(p.worldX, p.worldY));
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const cell = this.cellAt(p.worldX, p.worldY);
      const pressed = this.pressed;
      this.aim(null);
      if (cell && pressed && indexOf(cell) === indexOf(pressed)) this.callbacks.onTap(cell);
    });
    this.input.on('gameout', () => this.aim(null));

    const dpr = dprOf(this);
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
    const cell = Math.floor(Math.min((width - 24) / COLS, (height - 24) / ROWS));
    const boardX = Math.round((width - cell * COLS) / 2);
    // Slightly lower than centre: thumbs live at the bottom, and new blocks slide in from above.
    const boardY = Math.max(12, Math.round((height - cell * ROWS) * 0.6));
    this.layoutInfo = { width, height, cell, gap, boardX, boardY };

    this.board.setTexture(this.boardTexture()).setPosition(boardX - 8, boardY - 8);
    for (let exp = 1; exp <= PREDRAWN; exp++) this.blockTexture(exp, cell);
    this.dimmer.setSize(width, height);
    for (const [index, block] of this.cells) {
      const { x, y } = this.cellCenter({ col: index % COLS, row: Math.floor(index / COLS) });
      block.setPosition(x, y);
      this.paint(block, block.exp, cell);
    }
    const aimed = this.pressed;
    this.pressed = null;
    this.aim(aimed);
    this.showHint(this.hintCell);
    // Blocks still finishing an animation may show an old texture for a moment; remove them afterwards.
    this.time.delayedCall(1000, () => this.removeUnusedTextures());
  }

  private boardTexture(): string {
    const { cell, gap } = this.layoutInfo;
    const width = cell * COLS + 16;
    const height = cell * ROWS + 16;
    const key = `tap-merge:board:${this.theme}:${cell}:${gap}`;
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
    const key = `tap-merge:block:${this.theme}:${inner}:${exp}`;
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
    const current = `tap-merge:block:${this.theme}:${cell - gap}:`;
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

  private cellAt(x: number, y: number): Cell | null {
    const { boardX, boardY, cell } = this.layoutInfo;
    const col = Math.floor((x - boardX) / cell);
    const row = ROWS - 1 - Math.floor((y - boardY) / cell);
    return col >= 0 && col < COLS && row >= 0 && row < ROWS ? { col, row } : null;
  }

  // ------------------------------------------------------------------ blocks

  private makeBlock(exp: Exponent, x: number, y: number): Block {
    const block = this.add.container(x, y) as Block;
    block.add(crispImage(this, 0, 0, '__DEFAULT'));
    block.setDepth(10);
    this.paint(block, exp, this.layoutInfo.cell);
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
    this.aim(null);
    for (const block of this.cells.values()) block.destroy();
    this.cells.clear();
    for (const { cell, exp } of blocks(state.grid)) {
      const { x, y } = this.cellCenter(cell);
      this.cells.set(indexOf(cell), this.makeBlock(exp, x, y));
    }
    this.dimmer.setFillStyle(this.colors.dimmer, 0);
    this.busy = false;
  }

  /** A pointing hand over a block that merges, until the first tap. */
  showHint(cell: Cell | null) {
    this.hint?.destroy();
    this.hint = null;
    this.hintCell = cell;
    if (!cell || !this.layoutInfo) return;
    const { x, y } = this.cellCenter(cell);
    const size = this.layoutInfo.cell;
    this.hint = crispText(this, x + size * 0.2, y + size * 0.35, '👆', {
      fontSize: `${Math.round(size * 0.6)}px`,
    })
      .setOrigin(0.5, 0)
      .setDepth(25);
    this.tweens.add({
      targets: this.hint,
      y: '+=12',
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // ------------------------------------------------------------------ input feedback

  /** Highlight a block and the neighbours a tap would absorb (finger down, or the keyboard's aim). */
  aim(cell: Cell | null) {
    if (this.busy || !this.state || this.state.over) cell = null;
    if (cell && this.pressed && indexOf(cell) === indexOf(this.pressed)) return;
    this.release(false);
    this.pressed = cell;
    if (!cell || !this.state) return;
    const group = [cell, ...matches(this.state.grid, cell)];
    const { cell: size, gap } = this.layoutInfo;
    this.press.lineStyle(Math.max(3, size * 0.05), this.colors.press, 0.9);
    for (const at of group) {
      const { x, y } = this.cellTopLeft(at);
      this.press.strokeRoundedRect(
        x + gap / 2 - 2,
        y + gap / 2 - 2,
        size - gap + 4,
        size - gap + 4,
        size * 0.22,
      );
      const block = this.cells.get(indexOf(at));
      if (!block) continue;
      this.lifted.push(block);
      // Blocks that would merge lift; a lone block sinks a little.
      this.tweens.add({ targets: block, scale: group.length > 1 ? 1.08 : 0.94, duration: 70 });
    }
  }

  get aimed(): Cell | null {
    return this.pressed;
  }

  /** Keyboard: move the aim one cell. */
  nudge(dc: number, dr: number) {
    const from = this.pressed ?? { col: 2, row: 3 };
    this.aim({
      col: Math.max(0, Math.min(COLS - 1, from.col + dc)),
      row: Math.max(0, Math.min(ROWS - 1, from.row + dr)),
    });
  }

  /** Drop the highlight; `now` skips the settle animation (a move is about to animate these blocks). */
  private release(now: boolean) {
    this.press.clear();
    for (const block of this.lifted) {
      this.tweens.killTweensOf(block);
      if (now) block.setScale(1);
      else this.tweens.add({ targets: block, scale: 1, duration: 70 });
    }
    this.lifted = [];
    this.pressed = null;
  }

  /** A block without an equal neighbour refuses the tap. */
  reject(cell: Cell) {
    this.sfx.play('error');
    haptics.play('error');
    const block = this.cells.get(indexOf(cell));
    if (!block) return;
    this.tweens.add({
      targets: block,
      angle: { from: -8, to: 8 },
      duration: 60,
      yoyo: true,
      repeat: 2,
      onComplete: () => block.setAngle(0),
    });
  }

  // ------------------------------------------------------------------ animation of a move

  async play(events: GameEvent[], state: State, previousScore: number) {
    this.busy = true;
    this.release(true);
    this.showHint(null);
    let score = previousScore;
    let falling: Promise<void> = Promise.resolve();

    for (const event of events) {
      switch (event.type) {
        case 'merge':
          await this.animateMerge(event);
          score += event.gained;
          this.callbacks.onScore(score);
          break;
        case 'fall':
          // Old blocks fall while the new ones slide in.
          falling = this.animateFall(event.moves);
          break;
        case 'fill':
          await Promise.all([falling, this.animateFill(event.blocks)]);
          break;
        case 'top':
          this.announceTop(event.exp, event.earned);
          this.callbacks.onTop(event.shuffles, event.earned);
          break;
        case 'shuffle':
          await this.animateShuffle(event.moves);
          break;
        case 'stuck':
          this.sfx.play('error');
          break;
        case 'over':
          await this.animateOver(event.record);
          break;
      }
    }
    this.state = state;
    this.busy = false;
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
    const size = this.layoutInfo.cell;
    burst(this, x, y, style.fill, 8 + Math.min(merge.from.length * 3, 16));
    floatText(this, x, y - size * 0.45, `+${formatValue(merge.gained)}`, {
      color: this.colors.scoreText,
      stroke: this.colors.scoreStroke,
      size: Math.round(size * 0.32),
    });
    this.sfx.play('merge', merge.exp);
    haptics.play('bump');
    if (merge.from.length >= BIG_MERGE) {
      const gathered = merge.from.length + 1;
      this.banner(this.text.gathered(gathered), gathered >= 6 ? this.colors.bigCombo : this.colors.combo);
      this.sfx.play('combo', gathered);
      haptics.play('success');
    }
    if (merge.exp >= 11) shake(this, 'medium');
    else if (merge.exp >= 9) shake(this, 'small');
    // The pulse plays on while the board falls (it changes the scale, the fall changes y).
    void pulse(this, target, 1.22).then(() => target.setDepth(10));
  }

  private animateFall(moves: Move[]): Promise<void> {
    const moving = moves.map((m) => ({
      block: this.cells.get(indexOf(m.from)),
      to: m.to,
      rows: m.from.row - m.to.row,
    }));
    for (const m of moves) this.cells.delete(indexOf(m.from));
    for (const { block, to } of moving) if (block) this.cells.set(indexOf(to), block);
    return Promise.all(
      moving.map(({ block, to, rows }) =>
        block
          ? tweenAsync(this, {
              targets: block,
              y: this.cellCenter(to).y,
              duration: 120 + rows * 45,
              ease: 'Bounce.easeOut',
            })
          : Promise.resolve(),
      ),
    ).then(() => {});
  }

  private animateFill(fresh: { at: Cell; exp: Exponent; drop: number }[]): Promise<void> {
    const size = this.layoutInfo.cell;
    return Promise.all(
      fresh.map(({ at, exp, drop }) => {
        const { x, y } = this.cellCenter(at);
        const block = this.makeBlock(exp, x, y - drop * size).setAlpha(0);
        this.cells.set(indexOf(at), block);
        this.tweens.add({ targets: block, alpha: 1, duration: 120 });
        return tweenAsync(this, { targets: block, y, duration: 140 + drop * 50, ease: 'Quad.easeIn' });
      }),
    ).then(() => {});
  }

  private animateShuffle(moves: Move[]): Promise<void> {
    const next = new Map(this.cells);
    for (const m of moves) {
      const block = this.cells.get(indexOf(m.from));
      if (block) next.set(indexOf(m.to), block);
    }
    this.cells = next;
    this.sfx.play('pop');
    haptics.play('success');
    return Promise.all(
      moves.map((m) => {
        const block = next.get(indexOf(m.to));
        const { x, y } = this.cellCenter(m.to);
        return block
          ? tweenAsync(this, { targets: block, x, y, duration: 380, ease: 'Cubic.easeInOut' })
          : Promise.resolve();
      }),
    ).then(() => {});
  }

  /** A new largest block: a banner from 64 on, and always when it brought a 🔀. */
  private announceTop(exp: Exponent, earned: boolean) {
    if (exp < 6 && !earned) return;
    const lines = [this.text.newTop(formatValue(2 ** exp)), ...(earned ? [this.text.earned] : [])];
    this.banner(lines.join('\n'), this.colors.combo);
    this.sfx.play('combo', Math.min(exp, 10));
  }

  private banner(message: string, color: string) {
    const { width, boardY, cell } = this.layoutInfo;
    floatText(this, width / 2, boardY + cell * 1.4, message, {
      color,
      stroke: this.colors.scoreStroke,
      size: Math.round(cell * 0.4),
      rise: cell * 0.9,
    });
  }

  private async animateOver(record: boolean) {
    this.dimmer.setFillStyle(this.colors.dimmer, 0);
    await tweenAsync(this, { targets: this.dimmer, fillAlpha: this.colors.dimmerAlpha, duration: 400 });
    for (const block of this.cells.values()) {
      this.tweens.add({ targets: block, angle: { from: -4, to: 4 }, duration: 140, yoyo: true, repeat: 1 });
    }
    if (record) {
      confetti(this, this.layoutInfo.width);
      this.sfx.play('fanfare');
      haptics.play('success');
    }
    await delay(this, 450);
  }
}
