// The farm scene: draws the farm and animates what happens on it. It never decides rules — stage.ts calls logic.ts and
// hands the events here. The world (16 × 12 tiles of 16 px) sits in one container scaled by a whole number of device
// pixels per art pixel, so the pixel art stays crisp; the kit's camera is left as it is, in CSS pixels. Every picture is
// a frame of one texture, the pack's tileset, so a frame of the farm is one batch. Bubbles, floating text and particles
// are drawn over the world in CSS pixels, so their text stays sharp at any zoom.
import { haptics, type Sfx } from '@tohe/game-kit';
import {
  type AssetPack,
  burst,
  confetti,
  crispText,
  delay,
  dprOf,
  fitWorld,
  floatText,
  loadPack,
  popIn,
  pulse,
  type Rect,
  squash,
  tweenAsync,
} from '@tohe/game-kit/phaser';
import Phaser from 'phaser';
import { type CropId, crops } from './content/crops.ts';
import {
  besideInBed,
  type Cell,
  FARMER,
  farmerStart,
  GRASS,
  ground,
  HEN,
  KEEPER,
  keeper,
  MAP_COLS,
  MAP_ROWS,
  objects,
  plots,
  soilTile,
  stall,
  TILE,
  TILESET,
  TILESET_COLUMNS,
  TILESET_FRAMES,
  WEEDS,
} from './content/map.ts';
import { type DayPart, TINTS } from './light.ts';
import { type GameEvent, type State, shownStage } from './logic.ts';

/** A point of the world in tiles, with fractions: targets.ts decides what it reaches. */
export interface WorldPoint {
  x: number;
  y: number;
}

export interface FarmCallbacks {
  onTap(point: WorldPoint): void;
  /** A long press. */
  onHold(point: WorldPoint): void;
}

export const WORLD: Rect = { x: 0, y: 0, width: MAP_COLS * TILE, height: MAP_ROWS * TILE };
/** The grass, also the colour around the world when the screen is wider or taller than it. */
export const GRASS_COLOUR = GRASS;

const HOLD_MS = 450;
/** A finger that moves further than this between down and up is not a tap. CSS pixels. */
const SLOP = 12;
const STEP_MS = 140;
const SOIL_DUST = 0xcf8254;
const WATER = 0x99d8f8;
/** The pack's hoe: it bobs over the first plot to show where to start. */
const HOE = 88;

const centre = (cell: Cell) => ({ x: cell.x * TILE + TILE / 2, y: cell.y * TILE + TILE / 2 });

export class FarmScene extends Phaser.Scene {
  private key = '';
  private world!: Phaser.GameObjects.Container;
  private soil: Phaser.GameObjects.Image[] = [];
  private plants: Phaser.GameObjects.Image[] = [];
  private ripe: Phaser.GameObjects.Image[] = [];
  private farmer!: Phaser.GameObjects.Image;
  private keeperImage!: Phaser.GameObjects.Image;
  private tint!: Phaser.GameObjects.Rectangle;
  private hint: Phaser.GameObjects.Image | null = null;
  private bubble: Phaser.GameObjects.Container | null = null;
  private zoom = 1;
  private state: State | null = null;
  /** Where the farmer stands; walk() moves him a cell at a time. */
  at: Cell = { ...farmerStart };
  /** Each walk gets a number; a newer one stops the one before. */
  private walking = 0;
  private ready: () => void = () => {};
  readonly whenReady = new Promise<void>((resolve) => {
    this.ready = resolve;
  });

  constructor(
    private readonly pack: AssetPack,
    private readonly sfx: Sfx,
    private readonly callbacks: FarmCallbacks,
  ) {
    super('farm');
  }

  async create() {
    await loadPack(this, this.pack);
    const tileset = this.pack[TILESET];
    if (!tileset) throw new Error(`the pack has no ${TILESET}`);
    this.key = tileset.key;
    const texture = this.textures.get(this.key);
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    for (let n = 0; n < TILESET_FRAMES; n++) {
      texture.add(n, 0, (n % TILESET_COLUMNS) * TILE, Math.floor(n / TILESET_COLUMNS) * TILE, TILE, TILE);
    }
    this.build();
    this.listen();
    this.ready();
  }

  // ---------------------------------------------------------------------------------------------------- building

  private image(frame: number, cell: Cell) {
    const { x, y } = centre(cell);
    const image = this.add.image(x, y, this.key, frame);
    this.world.add(image);
    return image;
  }

  private build() {
    this.world = this.add.container(0, 0);
    const grass = this.add.rectangle(
      0,
      0,
      WORLD.width,
      WORLD.height,
      Phaser.Display.Color.HexStringToColor(GRASS).color,
    );
    grass.setOrigin(0, 0);
    this.world.add(grass);
    for (const placed of ground) for (const frame of placed.tiles) this.image(frame, placed);
    plots.forEach((cell) => {
      this.soil.push(this.image(0, cell).setVisible(false));
    });
    plots.forEach((cell) => {
      this.plants.push(this.image(0, cell).setVisible(false));
    });
    for (const placed of objects) {
      for (const frame of placed.tiles) {
        const image = this.image(frame, placed);
        // The hens peck now and then.
        if (frame === HEN) {
          this.tweens.add({
            targets: image,
            y: image.y - 1,
            duration: 180,
            yoyo: true,
            repeat: -1,
            repeatDelay: 1800 + placed.x * 230,
          });
        }
      }
    }
    // The stall: a crate of each crop's harvest, in the order of crops.ts.
    stall.forEach((cell, index) => {
      const crop = crops.items[index];
      if (crop) this.image(crop.art.crate, cell);
    });
    plots.forEach((cell) => {
      // A ripe crop shows its harvest, small, over the top right corner.
      const { x, y } = centre(cell);
      const mark = this.add
        .image(x + 5, y - 6, this.key, 0)
        .setScale(0.6)
        .setVisible(false);
      this.world.add(mark);
      this.ripe.push(mark);
      this.tweens.add({
        targets: mark,
        y: y - 8,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
    this.keeperImage = this.image(KEEPER, keeper);
    this.farmer = this.image(FARMER, this.at);
    // Day and night over the whole screen, the grass around the world too; under bubbles and floating text.
    this.tint = this.add.rectangle(0, 0, 1, 1, 0xffffff, 0).setOrigin(0, 0).setDepth(30);
  }

  // ---------------------------------------------------------------------------------------------------- layout

  /** Fits the world in `view` (CSS pixels), centred, at a whole number of device pixels per art pixel. */
  relayout(view: Rect) {
    if (!this.world) return;
    const dpr = dprOf(this);
    const fit = fitWorld(WORLD, view, 'contain');
    this.zoom = Math.max(1, Math.floor(fit.zoom * dpr)) / dpr;
    const width = WORLD.width * this.zoom;
    const height = WORLD.height * this.zoom;
    const snap = (value: number) => Math.round(value * dpr) / dpr;
    this.world.setScale(this.zoom);
    this.world.setPosition(
      snap(view.x + (view.width - width) / 2),
      snap(view.y + (view.height - height) / 2),
    );
    this.tint.setSize(this.scale.width / dpr, this.scale.height / dpr);
    this.bubble?.destroy();
    this.bubble = null;
  }

  /** Where a world point shows, in CSS pixels. */
  private onScreen(point: { x: number; y: number }) {
    return { x: this.world.x + point.x * this.zoom, y: this.world.y + point.y * this.zoom };
  }

  private pointAt(x: number, y: number): WorldPoint {
    return { x: (x - this.world.x) / this.zoom / TILE, y: (y - this.world.y) / this.zoom / TILE };
  }

  // ---------------------------------------------------------------------------------------------------- input

  private listen() {
    let down: { x: number; y: number; held: boolean } | null = null;
    let timer: Phaser.Time.TimerEvent | null = null;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      down = { x: pointer.worldX, y: pointer.worldY, held: false };
      timer?.remove();
      timer = this.time.delayedCall(HOLD_MS, () => {
        if (!down) return;
        down.held = true;
        this.callbacks.onHold(this.pointAt(down.x, down.y));
      });
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (down && Math.hypot(pointer.worldX - down.x, pointer.worldY - down.y) > SLOP) {
        timer?.remove();
        down = null;
      }
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      timer?.remove();
      const was = down;
      down = null;
      if (!was || was.held) return;
      this.callbacks.onTap(this.pointAt(pointer.worldX, pointer.worldY));
    });
  }

  // ---------------------------------------------------------------------------------------------------- drawing

  /** Draws the whole farm as it is, with no animation. */
  setFarm(state: State) {
    this.state = state;
    for (let index = 0; index < state.plots.length; index++) this.drawPlot(index);
  }

  private drawPlot(index: number) {
    const state = this.state;
    const plot = state?.plots[index];
    const soil = this.soil[index];
    const plant = this.plants[index];
    const ripe = this.ripe[index];
    if (!state || !plot || !soil || !plant || !ripe) return;
    const dug = (other: number | null) => other !== null && state.plots[other]?.s !== 'grass';
    if (plot.s === 'grass') {
      soil.setVisible(false);
    } else {
      const { left, right } = besideInBed(index);
      const wet = plot.s === 'ripe' || (plot.s === 'growing' && plot.wateredAt !== null);
      soil.setFrame(soilTile(dug(left), dug(right), wet)).setVisible(true);
    }
    const stage = shownStage(plot);
    if (stage === null || (plot.s !== 'growing' && plot.s !== 'ripe')) {
      // Weeds on a plot of grass: the field shows where to dig.
      plant.setFrame(WEEDS).setVisible(plot.s === 'grass');
      ripe.setVisible(false);
      return;
    }
    const art = crops.get(plot.crop).art;
    plant.setFrame(art.stages[stage] ?? art.stages[0]).setVisible(true);
    ripe.setFrame(art.produce).setVisible(plot.s === 'ripe');
  }

  /** A plot and the plots beside it in its bed, whose soil joins its own. */
  private redrawAround(index: number) {
    const { left, right } = besideInBed(index);
    for (const each of [left, index, right]) if (each !== null) this.drawPlot(each);
  }

  setLight(part: DayPart) {
    const { colour, alpha } = TINTS[part];
    this.tint?.setFillStyle(colour, alpha);
  }

  // ---------------------------------------------------------------------------------------------------- the farmer

  /**
   * Walks the farmer along `path` (cells, the start left out), a cell at a time, hopping and turning as he goes.
   * Resolves true when he got there, false when a newer walk stopped this one.
   */
  async walk(path: readonly Cell[]): Promise<boolean> {
    const id = ++this.walking;
    for (const cell of path) {
      if (id !== this.walking) return false;
      if (cell.x !== this.at.x) this.farmer.setFlipX(cell.x < this.at.x);
      const from = centre(this.at);
      const to = centre(cell);
      await tweenAsync(this, {
        targets: { t: 0 },
        t: 1,
        duration: STEP_MS,
        onUpdate: (tween: Phaser.Tweens.Tween) => {
          const t = tween.progress;
          this.farmer.setPosition(
            from.x + (to.x - from.x) * t,
            from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * 2,
          );
        },
      });
      if (id !== this.walking) return false;
      this.at = { ...cell };
      this.farmer.setPosition(to.x, to.y);
    }
    return id === this.walking;
  }

  /** Stops a walk under way where the farmer stands. */
  stopWalking() {
    this.walking++;
  }

  /** Turns the farmer towards a cell beside him, to work on it. */
  face(cell: Cell) {
    if (cell.x !== this.at.x) this.farmer.setFlipX(cell.x < this.at.x);
    squash(this, this.farmer, 0.12);
  }

  // ---------------------------------------------------------------------------------------------------- what happens

  /** Animates the events of one action and leaves the farm drawn as `state`. */
  async play(events: readonly GameEvent[], state: State) {
    this.state = state;
    for (const event of events) {
      switch (event.type) {
        case 'tilled': {
          this.redrawAround(event.plot);
          const soil = this.soil[event.plot];
          if (soil) squash(this, soil, 0.2);
          this.puff(event.plot, SOIL_DUST);
          this.sfx.play('drop');
          haptics.play('tap');
          break;
        }
        case 'planted': {
          this.drawPlot(event.plot);
          const plant = this.plants[event.plot];
          if (plant) void popIn(this, plant, 260);
          this.sfx.play('pop');
          haptics.play('tap');
          break;
        }
        case 'watered': {
          this.redrawAround(event.plot);
          this.puff(event.plot, WATER);
          this.sfx.play('click');
          haptics.play('tap');
          break;
        }
        case 'grew':
        case 'ripened': {
          this.drawPlot(event.plot);
          const plant = this.plants[event.plot];
          if (plant) pulse(this, plant, 1.25);
          if (event.type === 'ripened') this.sfx.play('levelUp');
          break;
        }
        case 'harvested': {
          await this.harvest(event.plot, event.crop, event.first);
          break;
        }
        case 'sold':
        case 'bought':
          // The stall's sheet and the panel show these (stage.ts).
          break;
      }
    }
    // Whatever an event did not redraw, as it is now.
    this.setFarm(state);
  }

  private puff(plot: number, colour: number) {
    const cell = plots[plot];
    if (!cell) return;
    const { x, y } = this.onScreen(centre(cell));
    burst(this, x, y, colour, 10, 70 * Math.max(1, this.zoom / 3));
  }

  private async harvest(plot: number, crop: CropId, first: boolean) {
    const cell = plots[plot];
    const plant = this.plants[plot];
    if (!cell || !plant) return;
    const art = crops.get(crop).art;
    const picked = this.image(art.produce, cell);
    plant.setVisible(false);
    this.ripe[plot]?.setVisible(false);
    this.sfx.play(first ? 'fanfare' : 'combo');
    haptics.play(first ? 'celebrate' : 'success');
    const { x, y } = this.onScreen(centre(cell));
    floatText(this, x, y - 10 * this.zoom, '+1', { size: Math.round(10 + 3 * this.zoom) });
    await tweenAsync(this, {
      targets: picked,
      y: picked.y - 10,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.easeOut',
    });
    picked.destroy();
    this.redrawAround(plot);
    if (first) confetti(this, this.scale.width / dprOf(this), 50);
  }

  /** Coins earned at the stall, floating up from it. */
  coinsAt(cell: Cell, text: string) {
    const { x, y } = this.onScreen(centre(cell));
    floatText(this, x, y - 8 * this.zoom, text, { size: Math.round(10 + 3 * this.zoom), color: '#9a5b00' });
  }

  /** A refused tap: the farmer shakes his head. */
  refuse() {
    this.sfx.play('error');
    haptics.play('error');
    void tweenAsync(this, {
      targets: this.farmer,
      angle: { from: -8, to: 8 },
      duration: 70,
      yoyo: true,
      repeat: 2,
    }).then(() => this.farmer.setAngle(0));
  }

  // ---------------------------------------------------------------------------------------------------- bubbles

  /** A short line over a cell (Cô Ba's words, what a plot needs), for a few seconds or until the next one. */
  say(cell: Cell, text: string) {
    this.bubble?.destroy();
    const anchor = this.onScreen({ x: centre(cell).x, y: cell.y * TILE });
    const maxWidth = Math.min(260, this.scale.width / dprOf(this) - 24);
    const label = crispText(this, 0, 0, text, {
      fontSize: '15px',
      fontStyle: '600',
      color: '#3f2631',
      align: 'center',
      wordWrap: { width: maxWidth - 24 },
    }).setOrigin(0.5, 1);
    const width = Math.min(maxWidth, label.width + 24);
    const height = label.height + 16;
    const card = this.add.graphics();
    card.fillStyle(0xffffff, 0.96);
    card.lineStyle(2, 0x3f2631, 1);
    card.fillRoundedRect(-width / 2, -height - 8, width, height, 10);
    card.strokeRoundedRect(-width / 2, -height - 8, width, height, 10);
    card.fillTriangle(-7, -9, 7, -9, 0, 0);
    card.lineBetween(-7, -8, 0, 0);
    card.lineBetween(7, -8, 0, 0);
    label.setPosition(0, -16);
    const screenWidth = this.scale.width / dprOf(this);
    const x = Math.min(Math.max(anchor.x, width / 2 + 8), screenWidth - width / 2 - 8);
    const y = Math.max(anchor.y, height + 16);
    const bubble = this.add.container(x, y, [card, label]).setDepth(60);
    this.bubble = bubble;
    void popIn(this, bubble, 180);
    this.time.delayedCall(3200, () => {
      if (this.bubble !== bubble) return;
      void tweenAsync(this, { targets: bubble, alpha: 0, duration: 250 }).then(() => {
        if (this.bubble === bubble) this.bubble = null;
        bubble.destroy();
      });
    });
  }

  /** Cô Ba's cell, for her lines. */
  get keeperCell(): Cell {
    return keeper;
  }

  /** Cô Ba hops when tapped. */
  greet() {
    squash(this, this.keeperImage, 0.16);
  }

  // ---------------------------------------------------------------------------------------------------- hints

  /** The first time: the hoe bobs over the first plot. */
  showHint(plot: number | null) {
    this.hint?.destroy();
    this.hint = null;
    const cell = plot === null ? null : plots[plot];
    if (!cell) return;
    const { x, y } = centre(cell);
    const hoe = this.add.image(x, y - 12, this.key, HOE);
    this.world.add(hoe);
    this.hint = hoe;
    this.tweens.add({
      targets: hoe,
      y: y - 15,
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Lets the event loop breathe between two steps of a sequence. */
  pause(ms: number) {
    return delay(this, ms);
  }
}
