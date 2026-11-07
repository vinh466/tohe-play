// The machine scene: draws the state and turns logic events into animations. It never decides rules — stage.ts
// calls logic.fire() and hands the events here. Layout is in CSS pixels (the kit zooms the camera by DPR).
// Colours come from palette.ts for the current light/dark theme and the player's block colours; setTheme() and
// setPalette() redraw everything.
// The machine frame, rack and every block (with its number) are textures drawn once per value, theme, colours and
// size (the kit's drawTexture): a frame then costs one quad per block instead of rebuilding rounded rectangles and
// text. The pressure gauge and the safety line are graphics, so their state changes without a texture.
import { formatValue, haptics, prefersReducedMotion, type Sfx, type Theme } from '@tohe/game-kit';
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
import { handTexture } from './hand.ts';
import {
  blocks,
  blockValue,
  type Cell,
  COLS,
  type Exponent,
  type GameEvent,
  indexOf,
  landingRow,
  PRESSURE_MAX,
  pressureMax,
  ROWS,
  type State,
} from './logic.ts';
import { BOARD, blockStyle, type PaletteId } from './palette.ts';
import type { Strings } from './strings.ts';

interface Layout {
  width: number;
  height: number;
  cell: number;
  gap: number;
  /** The machine's top-left corner in scene coordinates. */
  machineX: number;
  machineY: number;
  machineW: number;
  machineH: number;
  boardX: number;
  boardY: number;
  boardBottom: number;
  /** The safety line's centre y. */
  safetyY: number;
  /** The current block's centre y in the loader. */
  loaderY: number;
  /** The next block's centre y on the feeder. */
  feederY: number;
  /** The top chute's centre, where a shipped block leaves. */
  chuteX: number;
  chuteY: number;
}

export interface BoardCallbacks {
  /** The player chose a column (tap, drag-release or keyboard), also while a shot still animates. */
  onFire(col: number): void;
  /** Running score while a shot resolves, so the HUD can count up merge by merge. */
  onScore(score: number): void;
}

type Block = Phaser.GameObjects.Container & { exp: Exponent };

/** Blocks up to this value (2^11 = 2048) are drawn ahead, so a merge never waits for a new texture. */
const PREDRAWN = 11;
/** How much of a cell the feeder block takes. */
const FEEDER_SCALE = 0.55;

export class BoardScene extends Phaser.Scene {
  private layoutInfo!: Layout;
  private machine!: Phaser.GameObjects.Image;
  private board!: Phaser.GameObjects.Image;
  /** Textures drawn for the current and earlier layouts; the ones no longer shown are removed. */
  private drawn = new Set<string>();
  private highlight!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Graphics;
  private aim!: Phaser.GameObjects.Graphics;
  private preview!: Phaser.GameObjects.Graphics;
  private gauge!: Phaser.GameObjects.Graphics;
  private safety!: Phaser.GameObjects.Graphics;
  private pressureLabel!: Phaser.GameObjects.Text;
  private feederLabel!: Phaser.GameObjects.Text;
  private dimmer!: Phaser.GameObjects.Rectangle;
  private hint: Phaser.GameObjects.Image | null = null;
  private hintOn = false;
  private cells = new Map<number, Block>();
  private current: Block | null = null;
  private feeder: Block | null = null;
  private state: State | null = null;
  private hoverCol: number | null = null;
  private busy = false;
  private pressure = 0;
  /** The gauge's max for the mode and parts in play: 8, or more with Bình áp (logic.pressureMax). */
  private maxPressure = PRESSURE_MAX;
  private ready: () => void = () => {};
  readonly whenReady = new Promise<void>((resolve) => {
    this.ready = resolve;
  });

  constructor(
    private readonly sfx: Sfx,
    private readonly text: Strings,
    private readonly callbacks: BoardCallbacks,
    private theme: Theme,
    private palette: PaletteId,
  ) {
    super('board');
  }

  private get colors() {
    return BOARD[this.theme];
  }

  create() {
    this.machine = crispImage(this, 0, 0, '__DEFAULT').setOrigin(0).setDepth(0);
    this.board = crispImage(this, 0, 0, '__DEFAULT').setOrigin(0).setDepth(1);
    this.highlight = this.add.graphics().setDepth(2);
    this.ghost = this.add.graphics().setDepth(3);
    this.aim = this.add.graphics().setDepth(3);
    this.preview = this.add.graphics().setDepth(12);
    this.gauge = this.add.graphics().setDepth(6);
    this.safety = this.add.graphics().setDepth(6);
    this.pressureLabel = crispText(this, 0, 0, this.text.pressure, {
      fontSize: '13px',
      fontStyle: '700',
      color: this.colors.scoreText,
    }).setOrigin(0, 0.5);
    this.pressureLabel.setDepth(7);
    this.feederLabel = crispText(this, 0, 0, this.text.next, {
      fontSize: '13px',
      fontStyle: '700',
      color: this.colors.scoreText,
    }).setOrigin(0.5);
    this.feederLabel.setDepth(19);
    this.dimmer = this.add.rectangle(0, 0, 10, 10, this.colors.dimmer, 0).setOrigin(0).setDepth(30);

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.hover(this.columnAt(p.worldX, p.worldY)));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.hover(this.columnAt(p.worldX, p.worldY)));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      // Also while busy: stage.ts remembers a shot made during a move and fires it right after.
      const col = this.columnAt(p.worldX, p.worldY);
      if (col !== null) this.callbacks.onFire(col);
    });
    this.input.on('gameout', () => this.hover(null));

    const dpr = (this.registry.get('dpr') as number | undefined) ?? 1;
    this.relayout(this.scale.width / dpr, this.scale.height / dpr);
    this.ready();
  }

  // ------------------------------------------------------------------ layout

  /** The hub switched light/dark: redraw the machine, the rack and every block in the new colours. */
  setTheme(theme: Theme) {
    this.theme = theme;
    if (!this.layoutInfo) return;
    this.relayout(this.layoutInfo.width, this.layoutInfo.height);
    this.dimmer.setFillStyle(this.colors.dimmer, this.state?.over ? this.colors.dimmerAlpha : 0);
  }

  /** The player picked other block colours: redraw every block. */
  setPalette(palette: PaletteId) {
    this.palette = palette;
    if (this.layoutInfo) this.relayout(this.layoutInfo.width, this.layoutInfo.height);
  }

  relayout(width: number, height: number) {
    if (!this.board) return;
    const gap = Math.max(4, Math.round(Math.min(width, height) * 0.012));
    const cell = Math.floor(Math.min((width - 24) / (COLS + 0.6), (height - 24) / (ROWS + 2.9)));
    const boardW = cell * COLS;
    const boardX = Math.round((width - boardW) / 2);
    const total = cell * (ROWS + 2.9);
    const top = Math.max(8, Math.round((height - total) / 2));
    const machineW = boardW + cell * 0.6;
    const machineX = Math.round(boardX - cell * 0.3);
    const machineY = top;
    const boardY = top + cell * 0.6;
    const boardBottom = boardY + cell * ROWS;
    const safetyY = boardBottom + cell * 0.12;
    const loaderY = boardBottom + cell * 0.78;
    const feederY = loaderY + cell * 0.98;
    const machineH = total + 8;
    this.layoutInfo = {
      width,
      height,
      cell,
      gap,
      machineX,
      machineY,
      machineW,
      machineH,
      boardX,
      boardY,
      boardBottom,
      safetyY,
      loaderY,
      feederY,
      chuteX: machineX + machineW - cell * 0.85,
      chuteY: machineY + cell * 0.3,
    };

    this.machine.setTexture(this.machineTexture()).setPosition(machineX, machineY);
    this.board.setTexture(this.boardTexture()).setPosition(boardX - 8, boardY - 8);
    for (let exp = 1; exp <= PREDRAWN; exp++) this.blockTexture(exp, cell);
    this.dimmer.setSize(width, height);
    this.pressureLabel
      .setPosition(machineX + cell * 0.2, machineY + cell * 0.16)
      .setFontSize(Math.max(10, Math.round(cell * 0.17)))
      .setColor(this.colors.scoreText);
    this.feederLabel
      .setPosition(boardX + boardW / 2, feederY + cell * 0.58)
      .setFontSize(Math.max(10, Math.round(cell * 0.16)))
      .setColor(this.colors.scoreText);

    for (const [index, block] of this.cells) {
      const cellPos = this.cellCenter({ col: index % COLS, row: Math.floor(index / COLS) });
      block.setPosition(cellPos.x, cellPos.y);
      this.paint(block, block.exp, cell);
    }
    if (this.current) {
      this.current.setPosition(this.columnX(this.hoverCol ?? 2), loaderY);
      this.paint(this.current, this.current.exp, cell);
    }
    if (this.feeder) {
      this.feeder.setPosition(boardX + boardW / 2, feederY);
      this.paint(this.feeder, this.feeder.exp, cell * FEEDER_SCALE);
    }
    this.drawGauge();
    this.drawSafety();
    this.drawGuides();
    // The hand follows the layout and the theme's colours.
    if (this.hintOn) this.showHint(true);
    // Blocks still finishing an animation may show an old texture for a moment; remove them afterwards.
    this.time.delayedCall(1000, () => this.removeUnusedTextures());
  }

  private boardTexture(): string {
    const { cell, gap, boardX, boardY } = this.layoutInfo;
    const width = cell * COLS + 16;
    const height = cell * ROWS + 16;
    const key = `merge-block:board:${this.theme}:${cell}:${gap}:${boardX}:${boardY}`;
    this.drawn.add(key);
    return drawTexture(this, key, width, height, (ctx) => {
      ctx.fillStyle = cssHex(this.colors.board);
      ctx.beginPath();
      roundedRect(ctx, 0, 0, width, height, 22);
      ctx.fill();
      // The ceiling rail: the blocks hang from it, and the chute is above the top row.
      ctx.fillStyle = cssHex(this.colors.rail);
      ctx.beginPath();
      roundedRect(ctx, 8, 3, width - 16, Math.max(3, cell * 0.1), 3);
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

  /** The machine around the rack: beam, chute, posts and the loader bay with its rail and feeder shelf. */
  private machineTexture(): string {
    const { cell, machineW, machineH, boardBottom, machineY, loaderY, feederY } = this.layoutInfo;
    const key = `merge-block:machine:${this.theme}:${cell}:${machineW}:${machineH}`;
    this.drawn.add(key);
    return drawTexture(this, key, machineW, machineH, (ctx) => {
      const frame = cssHex(this.colors.frame);
      const edge = cssHex(this.colors.frameEdge);
      const fill = (color: string, x: number, y: number, w: number, h: number, r: number) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        roundedRect(ctx, x, y, w, h, r);
        ctx.fill();
      };
      // The top beam.
      fill(frame, 0, 0, machineW, cell * 0.6, cell * 0.12);
      ctx.fillStyle = edge;
      ctx.beginPath();
      roundedRect(ctx, 0, cell * 0.48, machineW, cell * 0.12, cell * 0.05);
      ctx.fill();
      // The chute: a dark hatch on the beam's right; a shipped block rises into it.
      const chuteW = cell * 1.0;
      const chuteX = machineW - cell * 1.35;
      fill(edge, chuteX - 2, cell * 0.06, chuteW + 4, cell * 0.48, cell * 0.1);
      fill(cssHex(this.colors.chute), chuteX, cell * 0.09, chuteW, cell * 0.4, cell * 0.08);
      // Rivets along the beam, a small machine mark.
      ctx.fillStyle = edge;
      for (let x = cell * 0.2; x < machineW - cell * 0.3; x += cell * 0.55) {
        ctx.beginPath();
        ctx.arc(x, cell * 0.13, Math.max(1, cell * 0.025), 0, Math.PI * 2);
        ctx.fill();
      }
      // The posts.
      fill(frame, 0, cell * 0.55, cell * 0.22, cell * (ROWS + 0.5), cell * 0.08);
      fill(frame, machineW - cell * 0.22, cell * 0.55, cell * 0.22, cell * (ROWS + 0.5), cell * 0.08);
      ctx.fillStyle = edge;
      ctx.fillRect(cell * 0.2, cell * 0.7, Math.max(2, cell * 0.02), cell * (ROWS + 0.2));
      ctx.fillRect(machineW - cell * 0.22, cell * 0.7, Math.max(2, cell * 0.02), cell * (ROWS + 0.2));
      // The loader bay, its rail and the feeder shelf.
      const bayTop = boardBottom - machineY + cell * 0.15;
      fill(frame, cell * 0.08, bayTop, machineW - cell * 0.16, machineH - bayTop - 2, cell * 0.14);
      ctx.fillStyle = edge;
      const railY = loaderY - machineY;
      ctx.beginPath();
      roundedRect(ctx, cell * 0.2, railY + cell * 0.42, machineW - cell * 0.4, Math.max(3, cell * 0.06), 3);
      ctx.fill();
      const shelfY = feederY - machineY;
      ctx.beginPath();
      roundedRect(ctx, cell * 1.7, shelfY + cell * 0.32, machineW - cell * 3.4, Math.max(3, cell * 0.06), 3);
      ctx.fill();
      // A little plate on the beam, left of the chute.
      fill(edge, cell * 2.55, cell * 0.16, cell * 0.8, cell * 0.28, cell * 0.06);
      fill(cssHex(this.colors.rail), cell * 2.62, cell * 0.21, cell * 0.66, cell * 0.18, cell * 0.04);
    });
  }

  /** A block with its number, the whole block the size of its cell slot: `originY` puts its centre on the cell's. */
  private blockTexture(exp: Exponent, size: number): { key: string; originY: number } {
    const inner = size - this.layoutInfo.gap;
    const r = inner * 0.2;
    const line = Math.max(2, inner * 0.04);
    const pad = Math.ceil(line / 2) + 1;
    const height = inner + pad * 2;
    const inset = inner * 0.03;
    const face = inner - inset * 2;
    const key = `merge-block:block:${this.theme}:${this.palette}:${inner}:${exp}`;
    this.drawn.add(key);
    drawTexture(this, key, inner + pad * 2, height, (ctx) => {
      const style = blockStyle(exp, this.theme, this.palette);
      const fill = (color: string, x: number, y: number, w: number, h: number, radius: number) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        roundedRect(ctx, pad + x, pad + y, w, h, radius);
        ctx.fill();
      };
      // The dark edge is the block's border, inside the cell slot, so blocks never spill into the gap.
      fill(cssHex(style.edge), 0, 0, inner, inner, r);
      fill(cssHex(style.fill), inset, inset, face, face, r * 0.94);
      if (style.outline !== undefined) {
        ctx.lineWidth = line;
        ctx.strokeStyle = cssHex(style.outline);
        ctx.beginPath();
        roundedRect(ctx, pad + inset, pad + inset, face, face, r * 0.94);
        ctx.stroke();
      }
      fill(
        'rgba(255, 255, 255, 0.22)',
        inset + face * 0.1,
        inset + face * 0.07,
        face * 0.8,
        face * 0.18,
        r * 0.6,
      );
      // The digits' own box is centred (not the font's) on the top face.
      const value = formatValue(blockValue(exp));
      const fontSize = Math.round(inner * (value.length <= 2 ? 0.46 : value.length === 3 ? 0.38 : 0.31));
      ctx.font = `900 ${fontSize}px system-ui, sans-serif`;
      ctx.fillStyle = style.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const box = ctx.measureText(value);
      const middle = pad + inner / 2;
      ctx.fillText(
        value,
        pad + inner / 2,
        middle + (box.actualBoundingBoxAscent - box.actualBoundingBoxDescent) / 2,
      );
    });
    return { key, originY: (pad + inner / 2) / height };
  }

  private removeUnusedTextures() {
    const shown = new Set<string>([this.board.texture.key, this.machine.texture.key]);
    for (const object of this.children.list) {
      if (object instanceof Phaser.GameObjects.Container) {
        const image = object.list[0];
        if (image instanceof Phaser.GameObjects.Image) shown.add(image.texture.key);
      }
    }
    const { cell, gap } = this.layoutInfo;
    const current = `merge-block:block:${this.theme}:${this.palette}:${cell - gap}:`;
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

  private columnAt(x: number, _y: number): number | null {
    const { boardX, cell } = this.layoutInfo;
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
    if (state.over) {
      this.current?.destroy();
      this.current = null;
      this.feeder?.destroy();
      this.feeder = null;
      this.feederLabel.setVisible(false);
    } else {
      this.feederLabel.setVisible(true);
      this.showCurrent(state.current);
      this.showFeeder(state.next, false);
    }
    this.pressure = state.pressure;
    this.maxPressure = pressureMax(state);
    this.drawGauge();
    this.drawSafety();
    this.dimmer.setFillStyle(this.colors.dimmer, 0);
    this.busy = false;
    this.drawGuides();
  }

  /** The block the player fires, in the loader's breech. The next one waits on the feeder below it. */
  private showCurrent(current: Exponent) {
    const { cell, loaderY } = this.layoutInfo;
    this.current?.destroy();
    this.current = this.makeBlock(current, cell, this.columnX(this.hoverCol ?? 2), loaderY).setDepth(20);
  }

  private showFeeder(next: Exponent, animate: boolean) {
    const { cell, boardX, feederY } = this.layoutInfo;
    this.feeder?.destroy();
    this.feederLabel.setVisible(true);
    this.feeder = this.makeBlock(next, cell * FEEDER_SCALE, boardX + (cell * COLS) / 2, feederY).setDepth(19);
    if (animate) void popIn(this, this.feeder, 160);
  }

  /** A pointing hand and a pulsing aim line at the loader, until the first shot. */
  showHint(on: boolean) {
    if (this.hint) this.tweens.killTweensOf(this.hint);
    this.hint?.destroy();
    this.hint = null;
    this.tweens.killTweensOf([this.aim, this.ghost]);
    this.aim.setAlpha(1);
    this.ghost.setAlpha(1);
    this.hintOn = on;
    if (!on || !this.layoutInfo) return;
    if (this.hoverCol === null) this.hoverCol = 2;
    this.drawGuides();
    const key = handTexture(this, this.colors.scoreText, this.colors.scoreStroke, () =>
      this.showHint(this.hintOn),
    );
    if (!key) return;
    const { cell, loaderY } = this.layoutInfo;
    const size = Math.round(cell * 0.6);
    this.hint = this.add
      .image(this.columnX(2) + cell * 0.85, loaderY + cell * 0.2, key)
      .setDisplaySize(size, size)
      .setOrigin(0.5)
      .setDepth(25);
    if (prefersReducedMotion()) return;
    this.tweens.add({
      targets: this.hint,
      y: '+=14',
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: [this.aim, this.ghost],
      alpha: { from: 1, to: 0.35 },
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // ------------------------------------------------------------------ input feedback

  /** Watching a run (ADR 0032): taps do nothing; the replay aims and fires with hover() and play(). */
  watch() {
    this.input.enabled = false;
  }

  hover(col: number | null) {
    if (this.state?.over) col = null;
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

  /** Keyboard: move the loader one column left or right. */
  nudge(step: -1 | 1) {
    this.hover(Math.max(0, Math.min(COLS - 1, (this.hoverCol ?? 2) + step)));
  }

  get aimedColumn() {
    return this.hoverCol ?? 2;
  }

  private drawGuides(active = true) {
    this.highlight.clear();
    this.ghost.clear();
    this.aim.clear();
    this.preview.clear();
    if (!this.state || !this.layoutInfo || this.hoverCol === null || !active || this.busy || this.state.over)
      return;
    const { cell, boardY, boardBottom, loaderY, gap } = this.layoutInfo;
    const x = this.layoutInfo.boardX + this.hoverCol * cell;
    this.highlight
      .fillStyle(0xffffff, this.colors.highlight)
      .fillRoundedRect(x + 2, boardY - 4, cell - 4, boardBottom - boardY + 8, 16);
    const row = landingRow(this.state.grid, this.hoverCol);
    if (row === null) {
      // The column is blocked: a red bar across it says the loader will clunk.
      this.aim
        .lineStyle(4, this.colors.danger, 0.9)
        .lineBetween(x + cell * 0.2, boardY + cell * 0.4, x + cell * 0.8, boardY + cell * 1.2);
      return;
    }
    const { y: ghostY } = this.cellCenter({ col: this.hoverCol, row });
    const style = blockStyle(this.state.current, this.theme, this.palette);
    // The ghost is the block's own slot: the same size and centre the block will land at.
    const ghostX = x + gap / 2;
    const ghostTop = ghostY - cell / 2 + gap / 2;
    this.ghost
      .lineStyle(3, style.edge, 0.9)
      .strokeRoundedRect(ghostX, ghostTop, cell - gap, cell - gap, cell * 0.18);
    this.ghost
      .fillStyle(style.fill, 0.35)
      .fillRoundedRect(ghostX, ghostTop, cell - gap, cell - gap, cell * 0.18);
    // The aim line: dots from the loader's block to the ghost.
    this.aim.fillStyle(style.edge, 0.7);
    const from = this.current?.y ?? loaderY;
    for (let y = from - cell * 0.55; y > ghostY + cell * 0.4; y -= Math.max(7, cell * 0.12)) {
      this.aim.fillCircle(this.columnX(this.hoverCol), y, Math.max(1.5, cell * 0.025));
    }
    // A merge the shot would make: ring every equal neighbour, so a child sees the match before firing.
    for (let col = 0; col < COLS; col++) {
      for (let r = 0; r < ROWS; r++) {
        if (this.state.grid[indexOf({ col, row: r })] !== this.state.current) continue;
        const dx = Math.abs(col - this.hoverCol);
        const dy = Math.abs(r - row);
        if (dx + dy !== 1) continue;
        const { x: nx, y: ny } = this.cellCenter({ col, row: r });
        this.preview.lineStyle(3, style.edge, 0.85).strokeCircle(nx, ny, cell * 0.4);
      }
    }
  }

  /** A blocked column refuses the block: the loader and the column jolt, no shot is spent. */
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
    if (this.current) {
      this.tweens.add({
        targets: this.current,
        x: this.current.x + 5,
        duration: 45,
        yoyo: true,
        repeat: 2,
        ease: 'Sine.easeInOut',
      });
    }
  }

  // ------------------------------------------------------------------ the machine's gauges

  private setPressure(value: number) {
    const next = Math.max(0, Math.min(this.maxPressure, value));
    const was = this.pressure;
    this.pressure = next;
    this.drawGauge();
    if (next === this.maxPressure && was < this.maxPressure) {
      this.tweens.add({
        targets: this.gauge,
        alpha: { from: 1, to: 0.45 },
        duration: 110,
        yoyo: true,
        repeat: 2,
      });
      this.sfx.play('click');
      haptics.play('tap');
    }
  }

  private drawGauge() {
    if (!this.layoutInfo) return;
    const { cell, machineX, machineY } = this.layoutInfo;
    const y = machineY + cell * 0.4;
    const start = machineX + cell * 0.2;
    const step = cell * 0.18;
    const radius = Math.max(2.5, cell * 0.06);
    this.gauge.clear();
    for (let i = 0; i < this.maxPressure; i++) {
      const x = start + i * step;
      if (i < this.pressure) this.gauge.fillStyle(this.colors.gaugeFull, 1).fillCircle(x, y, radius);
      else
        this.gauge.lineStyle(Math.max(1, cell * 0.018), this.colors.gauge, 0.65).strokeCircle(x, y, radius);
    }
    // A small arrow at the right end, so the lamps read as a gauge rather than a row of dots.
    this.gauge.fillStyle(this.colors.gaugeFull, 0.7);
    this.gauge.fillTriangle(
      start + this.maxPressure * step + cell * 0.05,
      y - cell * 0.06,
      start + this.maxPressure * step + cell * 0.05,
      y + cell * 0.06,
      start + this.maxPressure * step + cell * 0.14,
      y,
    );
    this.pressureLabel.setText(this.text.pressure);
  }

  private drawSafety() {
    if (!this.layoutInfo) return;
    const { cell, boardX, boardBottom, safetyY } = this.layoutInfo;
    const width = cell * COLS;
    const height = Math.max(4, cell * 0.12);
    let lowest = ROWS;
    if (this.state) {
      for (const { cell: at } of blocks(this.state.grid)) lowest = Math.min(lowest, at.row);
    }
    const danger = lowest === 0;
    const warn = lowest === 1;
    this.safety.clear();
    // The striped bar: a pattern, not only a colour.
    this.safety.fillStyle(this.colors.safety, 0.95);
    this.safety.fillRoundedRect(boardX, safetyY - height / 2, width, height, height / 2);
    this.safety.fillStyle(this.colors.safetyStripe, 0.85);
    for (let x = boardX - height; x < boardX + width; x += height * 1.6) {
      this.safety.fillTriangle(
        x,
        safetyY + height / 2,
        x + height * 0.7,
        safetyY - height / 2,
        x + height * 1.4,
        safetyY + height / 2,
      );
    }
    // The lamp at the right; its state is also a shape (a warning triangle), never colour alone.
    const lampX = boardX + width - height * 0.2;
    const lampColor = danger ? this.colors.danger : warn ? this.colors.warn : this.colors.lampOff;
    this.safety.fillStyle(lampColor, 1).fillCircle(lampX, safetyY, height * 1.25);
    if (danger || warn) {
      this.safety.fillStyle(this.colors.dimmer, 0.9);
      const r = height * 0.55;
      this.safety.fillTriangle(
        lampX - r,
        safetyY + r * 0.7,
        lampX + r,
        safetyY + r * 0.7,
        lampX,
        safetyY - r,
      );
    }
    // A faint line under the bottom row, so the rack's edge reads.
    this.safety.fillStyle(this.colors.rail, 0.4);
    this.safety.fillRect(boardX, boardBottom + cell * 0.02, width, Math.max(1, cell * 0.02));
  }

  // ------------------------------------------------------------------ animation of a shot

  async play(events: GameEvent[], state: State, previousScore: number) {
    this.busy = true;
    this.drawGuides(false);
    this.showHint(false);
    let score = previousScore;

    for (let i = 0; i < events.length; i++) {
      const event = events[i] as GameEvent;
      switch (event.type) {
        case 'land':
          // Aim stays on the column just played (also for a tap remembered during the previous shot).
          this.hoverCol = event.at.col;
          await this.animateLand(event.at, event.exp);
          break;
        case 'merge': {
          // Merges of the same source and chain step run together; the next step waits for them.
          const group: Extract<GameEvent, { type: 'merge' }>[] = [event];
          while (true) {
            const following = events[i + 1];
            if (
              following?.type !== 'merge' ||
              following.combo !== event.combo ||
              following.source !== event.source
            )
              break;
            group.push(events[++i] as typeof event);
          }
          await Promise.all(group.map((merge) => this.animateMerge(merge)));
          for (const merge of group) score += merge.gained;
          this.callbacks.onScore(score);
          if (event.source === 'shot' && event.combo >= 2) this.announceCombo(event.combo);
          if (event.source === 'pulse' && event.combo >= 2) this.announcePulse(event.combo);
          break;
        }
        case 'pressure':
          this.setPressure(event.value);
          break;
        case 'pulse':
          await this.animatePulse(event.slides);
          break;
        case 'fall':
          await this.animateFall(event.moves);
          break;
        case 'ship':
          await this.animateShip(event.at, event.gained);
          score += event.gained;
          this.callbacks.onScore(score);
          break;
        case 'order':
          if (event.complete) {
            floatText(
              this,
              this.layoutInfo.width / 2,
              this.layoutInfo.boardY + this.layoutInfo.cell * 0.6,
              this.text.orders.complete(formatValue(blockValue(event.exp))),
              {
                color: this.colors.bigCombo,
                stroke: this.colors.scoreStroke,
                size: Math.round(this.layoutInfo.cell * 0.24),
                rise: this.layoutInfo.cell * 0.5,
              },
            );
            this.sfx.play('levelUp');
            haptics.play('success');
          }
          break;
        case 'next':
          this.showCurrent(event.current);
          this.showFeeder(event.next, true);
          break;
        case 'over':
          this.state = state;
          this.drawSafety();
          await this.animateOver(event.record);
          break;
      }
    }
    this.state = state;
    this.busy = false;
    this.setPressure(state.pressure);
    this.drawSafety();
    this.drawGuides();
  }

  private async animateLand(at: Cell, exp: Exponent) {
    const current = this.current;
    this.current = null;
    const { x, y } = this.cellCenter(at);
    const block =
      current ?? this.makeBlock(exp, this.layoutInfo.cell, this.columnX(at.col), this.layoutInfo.loaderY);
    block.setDepth(10);
    block.setScale(1);
    block.setAlpha(1);
    if (prefersReducedMotion()) {
      block.setPosition(x, y);
    } else {
      burst(this, this.columnX(at.col), this.layoutInfo.loaderY, this.colors.frameEdge, 6, 90);
      this.tweens.add({ targets: block, x, duration: 70, ease: 'Quad.easeOut' });
      await tweenAsync(this, {
        targets: block,
        y,
        duration: 100 + (at.row + 1) * 22,
        ease: 'Quad.easeIn',
      });
    }
    this.cells.set(indexOf(at), block);
    this.sfx.play('drop');
    haptics.play('tap');
    if (!prefersReducedMotion()) await squash(this, block, 0.12);
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
    const style = blockStyle(merge.exp, this.theme, this.palette);
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

  private announcePulse(combo: number) {
    const { width, boardY, cell } = this.layoutInfo;
    floatText(this, width / 2, boardY + cell * 1.4, this.text.pulse(combo), {
      color: this.colors.combo,
      stroke: this.colors.scoreStroke,
      size: Math.round(cell * (0.42 + Math.min(combo, 5) * 0.05)),
      rise: cell * 0.9,
    });
    this.sfx.play('combo', combo + 3);
    haptics.play('success');
  }

  private async animatePulse(slides: { from: Cell; to: Cell; exp: Exponent }[]) {
    if (prefersReducedMotion()) {
      this.cameras.main.flash(120, 255, 245, 230);
    } else {
      shake(this, 'medium');
      burst(
        this,
        this.layoutInfo.width / 2,
        this.layoutInfo.machineY + this.layoutInfo.cell * 0.35,
        this.colors.frameEdge,
        8,
        70,
      );
    }
    this.sfx.play('drop');
    haptics.play('success');
    this.setPressure(0);
    this.announcePulse(1);
    if (slides.length === 0) {
      await delay(this, 180);
      return;
    }
    const moving = slides.map((slide) => ({
      block: this.cells.get(indexOf(slide.from)),
      to: slide.to,
      row: slide.from.row,
    }));
    for (const slide of slides) this.cells.delete(indexOf(slide.from));
    for (const move of moving) if (move.block) this.cells.set(indexOf(move.to), move.block);
    await Promise.all(
      moving.map(async (move) => {
        if (!move.block) return;
        const { x, y } = this.cellCenter(move.to);
        this.tweens.add({
          targets: move.block,
          x,
          duration: 160,
          ease: 'Quad.easeOut',
          delay: (ROWS - 1 - move.row) * 8,
        });
        await tweenAsync(this, {
          targets: move.block,
          y,
          duration: 160,
          ease: 'Quad.easeOut',
          delay: (ROWS - 1 - move.row) * 8,
        });
      }),
    );
  }

  private async animateFall(moves: { from: Cell; to: Cell }[]) {
    const moving = moves.map((m) => ({
      block: this.cells.get(indexOf(m.from)),
      to: m.to,
      rows: m.to.row - m.from.row,
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

  private async animateShip(at: Cell, gained: number) {
    const block = this.cells.get(indexOf(at));
    this.cells.delete(indexOf(at));
    const { x, y } = this.cellCenter(at);
    const { cell, chuteX, chuteY } = this.layoutInfo;
    burst(this, x, y, 0xfde68a, 16);
    floatText(this, x, y - cell * 0.3, `+${formatValue(gained)}`, {
      color: this.colors.scoreText,
      stroke: this.colors.scoreStroke,
      size: Math.round(cell * 0.32),
    });
    this.sfx.play('levelUp');
    haptics.play('success');
    if (block) {
      block.setDepth(25);
      await tweenAsync(this, {
        targets: block,
        x: chuteX,
        y: chuteY,
        scale: 0.5,
        alpha: 0.2,
        duration: 380,
        ease: 'Quad.easeIn',
      });
      block.destroy();
    }
    floatText(this, this.layoutInfo.width / 2, chuteY + cell * 0.55, this.text.ship, {
      color: this.colors.bigCombo,
      stroke: this.colors.scoreStroke,
      size: Math.round(cell * 0.26),
      rise: cell * 0.5,
    });
  }

  private async animateOver(record: boolean) {
    this.dimmer.setFillStyle(this.colors.dimmer, 0);
    await tweenAsync(this, { targets: this.dimmer, fillAlpha: this.colors.dimmerAlpha, duration: 400 });
    for (const block of this.cells.values()) {
      this.tweens.add({ targets: block, angle: { from: -4, to: 4 }, duration: 140, yoyo: true, repeat: 1 });
    }
    this.current?.destroy();
    this.current = null;
    this.feeder?.destroy();
    this.feeder = null;
    this.feederLabel.setVisible(false);
    if (record) {
      confetti(this, this.layoutInfo.width);
      this.sfx.play('fanfare');
      haptics.play('success');
    }
    await delay(this, 450);
  }
}
