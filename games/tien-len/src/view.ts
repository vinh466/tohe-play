// The table scene: draws one seat's view of a hand and turns the referee's events into animations. It never decides
// rules — main.ts calls the rules module and hands the views and events here. Layout is in CSS pixels (the kit zooms
// the camera by DPR). Card faces, backs, avatars and rings are textures drawn once per size, theme and deck (the
// kit's drawTexture), so a frame costs one quad per card.
import { haptics, type Sfx, type Theme } from '@tohe/game-kit';
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
  shake,
  tweenAsync,
} from '@tohe/game-kit/phaser';
import Phaser from 'phaser';
import { GUEST_AVATAR } from './avatars.ts';
import { CARD_RATIO, drawBack, drawFace } from './cardArt.ts';
import { type Card, rankOf, sortHand, TWO } from './cards.ts';
import { type Deck, TABLE } from './palette.ts';
import type { GameEvent, View } from './rules.ts';
import type { Strings } from './strings.ts';

export interface Player {
  name: string;
  avatar: string;
}

export interface TableCallbacks {
  /** A card of the player's hand was tapped. */
  onTap(card: Card): void;
  /** A finger slid along the hand: select (or unselect) these cards. */
  onSlide(cards: Card[], select: boolean): void;
}

type Side = 'bottom' | 'right' | 'top' | 'left';

interface Spot {
  x: number;
  y: number;
  side: Side;
}

interface Layout {
  width: number;
  height: number;
  cardW: number;
  cardH: number;
  step: number;
  handY: number;
  lift: number;
  tableX: number;
  tableY: number;
  tableW: number;
  avatar: number;
  /** By position relative to the player: 0 is the player, 1 the next seat (to the right), … */
  spots: Spot[];
}

interface SeatUi {
  container: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Image;
  pulse: Phaser.Tweens.Tween | null;
}

type HandCard = Phaser.GameObjects.Container & { card: Card };

const DEPTH = { felt: 0, seat: 5, table: 10, hand: 20, flying: 40, text: 50 } as const;

export class TableScene extends Phaser.Scene {
  private layoutInfo!: Layout;
  private felt!: Phaser.GameObjects.Image;
  private current: View | null = null;
  private players: Player[] = [];
  private sortBy: 'rank' | 'combos' = 'rank';
  private selected = new Set<Card>();
  private hinted = new Set<Card>();
  private hand = new Map<Card, HandCard>();
  private order: Card[] = [];
  private tableCards: Phaser.GameObjects.Image[] = [];
  private previous: Phaser.GameObjects.Image[] = [];
  /** Who played the cards on the table. */
  private tableLabel: Phaser.GameObjects.Text | null = null;
  private seatsUi: SeatUi[] = [];
  private drawn = new Set<string>();
  private press: { index: number; select: boolean; last: number; moved: boolean } | null = null;
  private ready: () => void = () => {};
  readonly whenReady = new Promise<void>((resolve) => {
    this.ready = resolve;
  });

  constructor(
    private readonly sfx: Sfx,
    private readonly text: Strings,
    private readonly callbacks: TableCallbacks,
    private theme: Theme,
    private deck: Deck,
  ) {
    super('table');
  }

  private get colors() {
    return TABLE[this.theme];
  }

  create() {
    this.felt = crispImage(this, 0, 0, '__DEFAULT').setOrigin(0).setDepth(DEPTH.felt);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const index = this.cardIndexAt(p.worldX, p.worldY);
      if (index < 0) return;
      const card = this.order[index] as Card;
      this.press = { index, select: !this.selected.has(card), last: index, moved: false };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const press = this.press;
      if (!press || !p.isDown) return;
      const index = this.cardIndexAt(p.worldX, p.worldY, true);
      if (index < 0 || index === press.last) return;
      press.last = index;
      press.moved = true;
      const [from, to] = press.index < index ? [press.index, index] : [index, press.index];
      this.callbacks.onSlide(this.order.slice(from, to + 1), press.select);
    });
    this.input.on('pointerup', () => {
      const press = this.press;
      this.press = null;
      if (press && !press.moved) this.callbacks.onTap(this.order[press.index] as Card);
    });
    const dpr = dprOf(this);
    this.relayout(this.scale.width / dpr, this.scale.height / dpr);
    this.ready();
  }

  // ------------------------------------------------------------------ settings

  setPlayers(players: Player[]) {
    this.players = players;
    if (this.current) this.render(this.current);
  }

  setTheme(theme: Theme) {
    this.theme = theme;
    if (this.layoutInfo) this.relayout(this.layoutInfo.width, this.layoutInfo.height);
  }

  setDeck(deck: Deck) {
    this.deck = deck;
    if (this.current) this.render(this.current);
  }

  setSort(by: 'rank' | 'combos') {
    this.sortBy = by;
    if (this.current) this.layoutHand(true);
  }

  setSelected(cards: Iterable<Card>) {
    this.selected = new Set(cards);
    this.layoutHand(true);
  }

  /** Cards the hint points at (practice mode and Gợi ý). */
  setHint(cards: Iterable<Card>) {
    this.hinted = new Set(cards);
    this.layoutHand(true);
  }

  // ------------------------------------------------------------------ layout

  relayout(width: number, height: number) {
    if (!this.felt) return;
    const cardW = Math.round(Math.max(44, Math.min(96, width / 6.4, height / 6.6)));
    const cardH = Math.round(cardW * CARD_RATIO);
    const step = Math.min(cardW * 0.64, (width - 16 - cardW) / 12);
    const handY = height - cardH / 2 - Math.max(8, height * 0.015);
    const avatar = Math.round(Math.max(38, Math.min(54, width / 8)));
    const topY = avatar / 2 + 10;
    const sideY = Math.round(height * (width > height ? 0.32 : 0.36));
    const handTop = handY - cardH / 2;
    const seats = this.current?.seats ?? 4;
    const right: Spot = { x: width - avatar / 2 - 10, y: sideY, side: 'right' };
    const left: Spot = { x: avatar / 2 + 10, y: sideY, side: 'left' };
    const top: Spot = { x: width / 2, y: topY, side: 'top' };
    // On its side the phone has room beside the hand, not above it.
    const wide = width > height * 1.25;
    const me: Spot = wide
      ? { x: avatar / 2 + 10, y: handY - 8, side: 'bottom' }
      : { x: avatar / 2 + 8, y: handTop - avatar / 2 - 26, side: 'bottom' };
    const spots = seats === 2 ? [me, top] : seats === 3 ? [me, right, left] : [me, right, top, left];
    this.layoutInfo = {
      width,
      height,
      cardW,
      cardH,
      step,
      handY,
      lift: Math.round(cardH * 0.2),
      tableX: width / 2,
      tableY: Math.round((topY + avatar + handTop - 30) / 2),
      tableW: Math.round(cardW * 0.92),
      avatar,
      spots,
    };
    this.felt.setTexture(this.feltTexture()).setScale(1 / dprOf(this));
    if (this.current) this.render(this.current);
    this.time.delayedCall(1000, () => this.removeUnusedTextures());
  }

  private feltTexture(): string {
    const { width, height } = this.layoutInfo;
    const key = `tien-len:felt:${this.theme}:${width}x${height}`;
    this.drawn.add(key);
    return drawTexture(this, key, width, height, (ctx) => {
      ctx.fillStyle = cssHex(this.colors.felt);
      ctx.fillRect(0, 0, width, height);
      const gradient = ctx.createRadialGradient(
        width / 2,
        height * 0.45,
        0,
        width / 2,
        height * 0.45,
        Math.max(width, height) * 0.6,
      );
      gradient.addColorStop(0, cssHex(this.colors.feltCentre));
      gradient.addColorStop(1, cssHex(this.colors.felt));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    });
  }

  private faceTexture(card: Card, w: number): string {
    const key = `tien-len:face:${this.theme}:${this.deck}:${w}:${card}`;
    this.drawn.add(key);
    return drawTexture(this, key, w, w * CARD_RATIO, (ctx) => drawFace(ctx, card, w, this.theme, this.deck));
  }

  private backTexture(w: number): string {
    const key = `tien-len:back:${this.theme}:${w}`;
    this.drawn.add(key);
    return drawTexture(this, key, w, w * CARD_RATIO, (ctx) => drawBack(ctx, w, this.theme));
  }

  /** The outline drawn around a selected or hinted card. */
  private outlineTexture(w: number, color: number): string {
    const h = Math.round(w * CARD_RATIO);
    const key = `tien-len:outline:${w}:${color}`;
    this.drawn.add(key);
    return drawTexture(this, key, w + 8, h + 8, (ctx) => {
      ctx.strokeStyle = cssHex(color);
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.roundRect?.(2, 2, w + 4, h + 4, w * 0.12);
      ctx.stroke();
    });
  }

  private avatarTexture(avatar: string, size: number): string {
    const key = `tien-len:avatar:${this.theme}:${size}:${avatar}`;
    this.drawn.add(key);
    return drawTexture(this, key, size, size, (ctx) => {
      ctx.fillStyle = cssHex(this.colors.chip);
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `${Math.round(size * 0.56)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = this.colors.label;
      ctx.fillText(avatar, size / 2, size / 2 + size * 0.04);
    });
  }

  private ringTexture(size: number): string {
    const key = `tien-len:ring:${size}:${this.colors.turn}`;
    this.drawn.add(key);
    return drawTexture(this, key, size + 10, size + 10, (ctx) => {
      ctx.strokeStyle = cssHex(this.colors.turn);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(size / 2 + 5, size / 2 + 5, size / 2 + 2, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  private removeUnusedTextures() {
    const shown = new Set<string>();
    const collect = (object: Phaser.GameObjects.GameObject) => {
      if (object instanceof Phaser.GameObjects.Image) shown.add(object.texture.key);
      if (object instanceof Phaser.GameObjects.Container) object.list.forEach(collect);
    };
    this.children.list.forEach(collect);
    for (const key of this.drawn) {
      if (shown.has(key) || key.includes(`:${this.layoutInfo.cardW}:`)) continue;
      this.textures.remove(key);
      this.drawn.delete(key);
    }
  }

  /** Where a seat sits on screen. */
  private spotOf(seat: number): Spot {
    const v = this.current;
    const me = v?.seat ?? 0;
    const seats = v?.seats ?? 4;
    return this.layoutInfo.spots[(seat - me + seats) % seats] as Spot;
  }

  // ------------------------------------------------------------------ drawing a view

  /** Draws a view without animation. */
  render(v: View) {
    const spotsChanged = this.current?.seats !== v.seats;
    this.current = v;
    if (spotsChanged) {
      this.relayout(this.layoutInfo.width, this.layoutInfo.height);
      return;
    }
    this.renderSeats(v);
    this.renderTable(v);
    this.renderHand(v);
  }

  private renderSeats(v: View) {
    for (const ui of this.seatsUi) {
      ui.pulse?.remove();
      ui.container.destroy();
    }
    this.seatsUi = [];
    const { avatar, cardW } = this.layoutInfo;
    for (let seat = 0; seat < v.seats; seat++) {
      const spot = this.spotOf(seat);
      const player = this.players[seat] ?? { name: '', avatar: GUEST_AVATAR };
      const container = this.add.container(spot.x, spot.y).setDepth(DEPTH.seat);
      const ring = crispImage(this, 0, 0, this.ringTexture(avatar)).setAlpha(0);
      container.add(ring);
      const face = crispImage(this, 0, 0, this.avatarTexture(player.avatar, avatar));
      container.add(face);
      const finished = v.finished.indexOf(seat);
      const cong = v.cong.includes(seat);
      if (finished >= 0 || cong) face.setAlpha(0.55);
      const name = crispText(this, 0, avatar / 2 + 3, player.name, {
        fontSize: '13px',
        fontStyle: '800',
        color: this.colors.label,
        align: 'center',
      }).setOrigin(0.5, 0);
      if (spot.side === 'left') name.setOrigin(0, 0).setX(-avatar / 2);
      if (spot.side === 'right') name.setOrigin(1, 0).setX(avatar / 2);
      container.add(name);
      // Opponents: a little fan of backs and how many cards they hold.
      const count = v.counts[seat] ?? 0;
      if (seat !== v.seat && count > 0 && !cong) {
        const backW = Math.round(cardW * 0.42);
        const bx = spot.side === 'right' ? -avatar / 2 - backW * 0.9 : avatar / 2 + backW * 0.9;
        const fan = Math.min(3, count);
        for (let i = 0; i < fan; i++) {
          const back = crispImage(this, bx + (i - 1) * 4, 2, this.backTexture(backW)).setAngle((i - 1) * 8);
          container.add(back);
        }
        const label = crispText(this, bx, 2, String(count), {
          fontSize: '15px',
          fontStyle: '900',
          color: '#ffffff',
        })
          .setOrigin(0.5)
          .setStroke('#000000', 3);
        container.add(label);
      }
      const badge =
        finished >= 0
          ? `${this.text.medals[finished] ?? ''}`
          : cong
            ? this.text.cong
            : v.passed[seat] && !v.over
              ? this.text.passed
              : '';
      if (badge) {
        const chip = crispText(this, 0, -avatar / 2 - 2, badge, {
          fontSize: '12px',
          fontStyle: '900',
          color: this.colors.chipText,
          backgroundColor: cssHex(this.colors.chip),
          padding: { x: 6, y: 2 },
        }).setOrigin(0.5, 1);
        container.add(chip);
      }
      const ui: SeatUi = { container, ring, pulse: null };
      if (!v.over && v.turn === seat) {
        ring.setAlpha(1);
        ui.pulse = this.tweens.add({
          targets: ring,
          alpha: 0.35,
          duration: 650,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
      this.seatsUi.push(ui);
    }
  }

  private tableSlots(count: number, w: number): number[] {
    const { tableX, width } = this.layoutInfo;
    const step = Math.min(w * 0.62, (width * 0.72 - w) / Math.max(1, count - 1));
    const total = w + step * (count - 1);
    return Array.from({ length: count }, (_, i) => tableX - total / 2 + w / 2 + i * step);
  }

  private renderTable(v: View) {
    for (const image of [...this.tableCards, ...this.previous]) image.destroy();
    this.tableCards = [];
    this.previous = [];
    if (!v.table) {
      this.labelTable(-1);
      return;
    }
    const { tableW, tableY } = this.layoutInfo;
    const slots = this.tableSlots(v.table.cards.length, tableW);
    this.tableCards = v.table.cards.map((card, i) =>
      crispImage(this, slots[i] as number, tableY, this.faceTexture(card, tableW)).setDepth(DEPTH.table + i),
    );
    this.labelTable(v.tableBy);
  }

  /** "🐻 Gấu Nâu" under the cards on the table; nothing for a clear table. */
  private labelTable(seat: number) {
    this.tableLabel?.destroy();
    this.tableLabel = null;
    const player = this.players[seat];
    if (seat < 0 || !player) return;
    const { tableX, tableY, tableW } = this.layoutInfo;
    this.tableLabel = crispText(
      this,
      tableX,
      tableY + (tableW * CARD_RATIO) / 2 + 6,
      `${player.avatar} ${player.name}`,
      {
        fontSize: '13px',
        fontStyle: '800',
        color: this.colors.labelSoft,
      },
    )
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.table);
  }

  private renderHand(v: View) {
    const keep = new Set(v.hand);
    for (const [card, image] of this.hand) {
      if (!keep.has(card)) {
        image.destroy();
        this.hand.delete(card);
      }
    }
    for (const card of v.hand) {
      const existing = this.hand.get(card);
      if (existing) {
        existing.destroy();
        this.hand.delete(card);
      }
      this.hand.set(card, this.makeHandCard(card));
    }
    for (const card of [...this.selected]) if (!keep.has(card)) this.selected.delete(card);
    for (const card of [...this.hinted]) if (!keep.has(card)) this.hinted.delete(card);
    this.layoutHand(false);
  }

  private makeHandCard(card: Card): HandCard {
    const { cardW } = this.layoutInfo;
    const container = this.add.container(0, 0) as HandCard;
    container.card = card;
    const outline = crispImage(this, 0, 0, this.outlineTexture(cardW, this.colors.selected)).setVisible(
      false,
    );
    container.add([outline, crispImage(this, 0, 0, this.faceTexture(card, cardW))]);
    return container;
  }

  private handPositions(count: number): number[] {
    const { width, cardW, step } = this.layoutInfo;
    const total = cardW + step * (count - 1);
    return Array.from({ length: count }, (_, i) => (width - total) / 2 + cardW / 2 + i * step);
  }

  /** Puts the hand's cards in order, lifting the selected ones. */
  private layoutHand(animate: boolean) {
    const v = this.current;
    if (!v) return;
    this.order = sortHand(v.hand, this.sortBy);
    const xs = this.handPositions(this.order.length);
    const { handY, lift, cardW } = this.layoutInfo;
    this.order.forEach((card, i) => {
      const image = this.hand.get(card);
      if (!image) return;
      const selected = this.selected.has(card);
      const hinted = this.hinted.has(card);
      const y = handY - (selected ? lift : hinted ? lift * 0.35 : 0);
      image.setDepth(DEPTH.hand + i);
      const outline = image.list[0] as Phaser.GameObjects.Image;
      outline.setVisible(selected || hinted);
      if (selected || hinted) {
        outline.setTexture(this.outlineTexture(cardW, selected ? this.colors.selected : this.colors.turn));
      }
      if (animate) {
        this.tweens.add({ targets: image, x: xs[i], y, duration: 120, ease: 'Quad.easeOut' });
      } else {
        image.setPosition(xs[i] as number, y);
      }
    });
  }

  /** The hand card under (x, y): the top one where cards overlap. With `loose`, anywhere along the hand's row. */
  private cardIndexAt(x: number, y: number, loose = false): number {
    if (!this.layoutInfo || this.order.length === 0) return -1;
    const { handY, cardH, cardW, lift } = this.layoutInfo;
    const topY = handY - cardH / 2 - lift - (loose ? 30 : 4);
    if (y < topY || y > handY + cardH / 2 + (loose ? 30 : 4)) return -1;
    const xs = this.handPositions(this.order.length);
    for (let i = xs.length - 1; i >= 0; i--) {
      const left = (xs[i] as number) - cardW / 2;
      if (x >= left && x <= left + cardW) return i;
    }
    if (!loose) return -1;
    return x < (xs[0] as number) ? 0 : xs.length - 1;
  }

  // ------------------------------------------------------------------ animations

  /**
   * The deal: backs fly to every seat. The player's land full size on the spots their cards will lie on, left to
   * right, and stay there until each turns over in place: nothing vanishes between the deal and the hand.
   */
  async deal(v: View) {
    this.selected.clear();
    this.hinted.clear();
    this.current = { ...v, hand: [], table: null };
    this.render({ ...v, hand: [], counts: v.counts.map(() => 0), table: null });
    this.current = v;
    const { tableX, tableY, cardW, handY } = this.layoutInfo;
    const backW = Math.round(cardW * 0.6);
    const flights: Promise<void>[] = [];
    const xs = this.handPositions(v.hand.length);
    // The backs on the player's spots, by spot, until they turn over.
    const landed: Phaser.GameObjects.Image[] = [];
    const rounds = Math.max(...v.counts);
    let n = 0;
    for (let round = 0; round < rounds; round++) {
      for (let k = 0; k < v.seats; k++) {
        const seat = ((v.seat ?? 0) + 1 + k) % v.seats;
        if (round >= (v.counts[seat] ?? 0)) continue;
        const mine = seat === v.seat;
        const target = mine ? { x: xs[round] ?? tableX, y: handY } : this.spotOf(seat);
        const back = crispImage(this, tableX, tableY, this.backTexture(mine ? cardW : backW)).setDepth(
          DEPTH.flying + n,
        );
        // Leaves the deck at the deck's size and grows into a card of the hand on the way.
        const scale = back.scaleX;
        if (mine) {
          back.setScale(scale * 0.6);
          landed[round] = back;
        }
        const wait = n * 16;
        n++;
        flights.push(
          delay(this, wait).then(async () => {
            if (n % 4 === 0) this.sfx.play('click');
            await tweenAsync(this, {
              targets: back,
              x: target.x,
              y: target.y,
              angle: { from: -20, to: 0 },
              ...(mine ? { scaleX: scale, scaleY: scale } : {}),
              duration: 200,
              ease: 'Cubic.easeOut',
            });
            if (mine) back.setDepth(DEPTH.hand + round);
            else back.destroy();
          }),
        );
      }
    }
    await Promise.all(flights);
    // The cards take the spots under their backs (in the hand's order), hidden edge-on until they turn over.
    this.render(v);
    const faces = this.order.map((card) => this.hand.get(card));
    for (const face of faces) if (face) face.scaleX = 0;
    await Promise.all(
      faces.map((face, i) =>
        delay(this, i * 22).then(async () => {
          const back = landed[i];
          if (back) {
            await tweenAsync(this, { targets: back, scaleX: 0, duration: 80, ease: 'Quad.easeIn' });
            back.destroy();
          }
          if (face) await tweenAsync(this, { targets: face, scaleX: 1, duration: 90, ease: 'Quad.easeOut' });
        }),
      ),
    );
    for (const back of landed) back?.destroy();
  }

  /** Animates the events of one action, then shows `after`. */
  async play(events: GameEvent[], after: View) {
    for (const event of events) {
      switch (event.type) {
        case 'play':
          await this.animatePlay(event, after);
          break;
        case 'pass':
          this.bubble(event.seat, this.text.passed);
          break;
        case 'round':
          await this.sweep(event.winner);
          break;
        case 'out': {
          const spot = this.spotOf(event.seat);
          const label = this.text.places[event.place - 1] ?? '';
          floatText(this, spot.x, spot.y - 20, label, {
            size: event.place === 1 ? 26 : 20,
            color: '#7c2d12',
            stroke: '#fde68a',
          });
          if (event.place === 1) {
            this.sfx.play(event.seat === after.seat ? 'fanfare' : 'merge', 8);
            if (event.seat === after.seat) {
              confetti(this, this.layoutInfo.width);
              haptics.play('celebrate');
            }
          }
          break;
        }
        case 'cong':
          for (const seat of event.seats) {
            const spot = this.spotOf(seat);
            floatText(this, spot.x, spot.y, this.text.cong, {
              size: 22,
              color: '#7f1d1d',
              stroke: '#fecaca',
            });
          }
          this.sfx.play('error');
          break;
        case 'paid':
          if (event.line.kind === 'chop') {
            const spot = this.spotOf(event.line.to);
            floatText(this, spot.x, spot.y + 30, `+${event.line.points}`, { size: 18, color: '#14532d' });
          }
          break;
        case 'end':
          break;
      }
    }
    this.render(after);
  }

  private async animatePlay(event: Extract<GameEvent, { type: 'play' }>, after: View) {
    const { tableW, tableY, cardW } = this.layoutInfo;
    // The last play moves aside and dims; anything older goes.
    for (const image of this.previous) image.destroy();
    this.previous = this.tableCards;
    this.tableCards = [];
    for (const image of this.previous) {
      this.tweens.add({
        targets: image,
        y: tableY - 16,
        alpha: 0.4,
        scale: image.scale * 0.88,
        duration: 160,
      });
    }
    const slots = this.tableSlots(event.combo.cards.length, tableW);
    const mine = event.seat === after.seat;
    const from = this.spotOf(event.seat);
    const flights = event.combo.cards.map((card, i) => {
      const held = mine ? this.hand.get(card) : undefined;
      const startX = held?.x ?? from.x;
      const startY = held?.y ?? from.y;
      held?.destroy();
      if (held) this.hand.delete(card);
      const image = crispImage(this, startX, startY, this.faceTexture(card, tableW))
        .setDepth(DEPTH.flying + i)
        .setScale((mine ? cardW / tableW : 0.5) / dprOf(this));
      this.tableCards.push(image);
      return tweenAsync(this, {
        targets: image,
        x: slots[i],
        y: tableY,
        scale: 1 / dprOf(this),
        duration: 220,
        delay: i * 24,
        ease: 'Cubic.easeOut',
      });
    });
    if (mine) {
      this.selected.clear();
      this.hinted.clear();
      this.current = { ...(this.current as View), hand: after.hand };
      this.layoutHand(true);
    }
    await Promise.all(flights);
    this.tableCards.forEach((image, i) => {
      image.setDepth(DEPTH.table + i);
    });
    this.labelTable(event.seat);
    const two = rankOf(event.combo.top) === TWO && event.chop === 0;
    if (event.chop > 0) {
      const big = event.chain >= 2;
      shake(this, big ? 'large' : 'medium');
      burst(this, this.layoutInfo.tableX, tableY, 0xef4444, big ? 30 : 18, big ? 260 : 190);
      floatText(this, this.layoutInfo.tableX, tableY - 40, big ? this.text.chain : this.text.chopped, {
        size: big ? 34 : 28,
        color: '#b91c1c',
        stroke: '#ffffff',
      });
      this.sfx.play(big ? 'levelUp' : 'combo', big ? 10 : 7);
      haptics.play('success');
    } else {
      this.sfx.play(two ? 'pop' : 'drop', two ? 9 : 2);
      haptics.play('bump');
    }
    await delay(this, 120);
  }

  /** The round is over: the table slides to its winner. */
  private async sweep(winner: number) {
    const spot = this.spotOf(winner);
    const cards = [...this.tableCards, ...this.previous];
    this.tableCards = [];
    this.previous = [];
    this.labelTable(-1);
    await tweenAsync(this, {
      targets: cards,
      x: spot.x,
      y: spot.y,
      alpha: 0,
      scale: 0.3 / dprOf(this),
      duration: 260,
      ease: 'Cubic.easeIn',
    });
    for (const image of cards) image.destroy();
  }

  /** A short speech bubble at a seat ("Bỏ"). */
  bubble(seat: number, message: string) {
    const spot = this.spotOf(seat);
    const label = crispText(this, spot.x, spot.y - this.layoutInfo.avatar / 2 - 8, message, {
      fontSize: '14px',
      fontStyle: '900',
      color: '#1f2937',
      backgroundColor: '#ffffff',
      padding: { x: 8, y: 4 },
    })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.text);
    this.tweens.add({
      targets: label,
      y: label.y - 10,
      alpha: { from: 1, to: 0 },
      delay: 650,
      duration: 350,
      onComplete: () => label.destroy(),
    });
  }

  /** A refused play: the selected cards wobble. */
  reject() {
    for (const card of this.selected) {
      const image = this.hand.get(card);
      if (!image) continue;
      this.tweens.add({ targets: image, angle: { from: -6, to: 6 }, duration: 60, yoyo: true, repeat: 2 });
      this.time.delayedCall(400, () => image.setAngle(0));
    }
  }

  /** A banner across the table (instant win, results). */
  banner(message: string) {
    floatText(this, this.layoutInfo.tableX, this.layoutInfo.tableY, message, {
      size: 32,
      color: '#7c2d12',
      stroke: '#fde68a',
      rise: 30,
    });
  }

  celebrate() {
    confetti(this, this.layoutInfo.width, 90);
  }

  /** Waits on the scene's clock, which stops while the game is paused. */
  wait(ms: number): Promise<void> {
    return delay(this, ms);
  }
}
