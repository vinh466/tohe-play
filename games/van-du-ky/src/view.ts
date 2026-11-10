// The board (Phaser): 6 heroes vs 6 enemies on three rows, the turn loop, and the card clash. The pure rules live in
// core/battle.ts; this scene draws them. Static card faces are pre-drawn textures, dynamic bars are shapes, and damage
// numbers are DOM (the stage listens to `onImpact`), so a tick never rebuilds a canvas or allocates a text object.

import { haptics } from '@tohe/game-kit';
import { crispImage, drawTexture, roundedRect, shake } from '@tohe/game-kit/phaser';
import Phaser from 'phaser';
import { sfx } from './app.ts';
import { ENEMIES } from './content/enemies.ts';
import { HEROES } from './content/heroes.ts';
import { RULES } from './content/index.ts';
import { REGIONS } from './content/stages.ts';
import { basicAttack, cast, createBattle, step } from './core/battle.ts';
import type { BattleState, BattleUnit, Element, HeroLoadout, Role, StageDef } from './core/types.ts';
import { type BoardLayout, boardLayout } from './view-layout.ts';

export interface BoardSummary {
  /** Effective HP taken off the enemies across every wave. */
  readonly damage: number;
  /** Rounds spent across every wave. */
  readonly rounds: number;
}

/** One actor in the turn rail. */
export interface TurnToken {
  readonly id: string;
  readonly defId: string;
  readonly name: string;
  readonly side: 'hero' | 'enemy';
  readonly element: Element;
}

export type ImpactKind = 'damage' | 'crit' | 'heal' | 'burn' | 'shield';

/** A number the stage draws over the board; the canvas stays free of text. */
export interface Impact {
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly kind: ImpactKind;
}

export interface BoardSceneData {
  readonly stage: StageDef;
  readonly team: readonly HeroLoadout[];
  readonly companyLevel: number;
  readonly autoCast: boolean;
  readonly speed: 1 | 2 | 3;
  readonly reducedMotion: boolean;
  readonly onEnd: (result: 'win' | 'lose', summary: BoardSummary) => void;
  readonly onTurn: (tokens: readonly TurnToken[], currentId: string | null) => void;
  readonly onImpact: (impact: Impact) => void;
  /** The wave just started, 1-based, and how many the stage has. */
  readonly onWave?: (wave: number, total: number) => void;
  /** A tap on a hero when it is not that hero's turn: open its sheet. */
  readonly onCardTap?: (defId: string) => void;
}

interface CardView {
  readonly container: Phaser.GameObjects.Container;
  readonly image: Phaser.GameObjects.Image;
  readonly portrait: Phaser.GameObjects.Image;
  readonly hp: Phaser.GameObjects.Rectangle;
  readonly pips: readonly Phaser.GameObjects.Rectangle[];
  readonly border: Phaser.GameObjects.Rectangle;
  readonly deadOverlay: Phaser.GameObjects.Rectangle;
  readonly flash: Phaser.GameObjects.Rectangle;
  lastHp: number;
  lastCharge: number;
  active: boolean;
  dead: boolean;
}

const ELEMENT_COLORS: Record<Element, string> = {
  ember: '#d05a4a',
  tide: '#5a9fc0',
  stone: '#b7a878',
  gale: '#7fae86',
};

const ELEMENT_LETTER: Record<Element, string> = {
  ember: 'L',
  tide: 'N',
  stone: 'Đ',
  gale: 'G',
};

const ROLE_SHORT: Record<Role, string> = {
  vanguard: 'TIÊN PHONG',
  blade: 'KIẾM SĨ',
  seer: 'TIÊN TRI',
  binder: 'TRÓI BUỘC',
};

export class BoardScene extends Phaser.Scene {
  private config!: BoardSceneData;
  private state!: BattleState;
  private layout!: BoardLayout;
  private waveIndex = 0;
  private eventIndex = 0;
  private dealt = 0;
  private rounds = 0;
  private cards = new Map<string, CardView>();
  private cardLayer!: Phaser.GameObjects.Container;
  private slotsLayer?: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Image[] = [];
  private timer?: Phaser.Time.TimerEvent;
  private ended = false;
  private paused = false;
  private speed: 1 | 2 | 3 = 2;
  private autoCast = true;
  private reducedMotion = false;
  private turnSignature = '';
  private lastHitSound = 0;

  constructor(data: BoardSceneData) {
    super('board');
    this.config = data;
  }

  init(data?: Partial<BoardSceneData>) {
    if (data?.stage) this.config = data as BoardSceneData;
  }

  /** One atlas for all 44 portraits: one texture, one batch, no 44 requests. */
  preload() {
    if (!this.textures.exists('portraits')) {
      this.load.atlas('portraits', 'portraits/atlas.png', 'portraits/atlas.json');
    }
  }

  create() {
    const { stage, team, companyLevel } = this.config;
    this.speed = this.config.speed;
    this.autoCast = this.config.autoCast;
    this.reducedMotion = this.config.reducedMotion;
    this.ended = false;
    this.paused = false;
    this.waveIndex = 0;
    this.eventIndex = 0;
    this.dealt = 0;
    this.rounds = 0;
    this.turnSignature = '';
    this.cards.clear();
    this.cameras.main.setBackgroundColor('#171614');
    const texture = this.textures.get('portraits');
    texture?.setFilter(Phaser.Textures.FilterMode.NEAREST);

    const view = this.viewSize();
    this.layout = boardLayout(view.width, view.height);
    this.drawBackground();
    this.cardLayer = this.add.container(0, 0);
    this.state = createBattle(RULES, {
      seed: stage.index * 1000 + 17 + this.waveIndex * 7919,
      companyLevel,
      heroes: team,
      enemies: stage.waves[0]!.enemies,
      autoCast: this.autoCast,
      maxRounds: stage.rounds,
    });
    this.drawCards();
    this.armTimer();
    this.processEvents();
    this.updateCards();
    this.notifyWave();
  }

  /** Restart the scene with a new stage or team; the play stage calls it through `createGame`. */
  restart(data: BoardSceneData) {
    this.config = data;
    this.scene.restart(data);
  }

  pause() {
    this.paused = true;
    if (this.timer) this.timer.paused = true;
  }

  resume() {
    this.paused = false;
    if (this.timer) this.timer.paused = false;
  }

  stopAuto() {
    this.paused = true;
    if (this.timer) this.timer.paused = true;
  }

  resumeAuto() {
    this.paused = false;
    if (this.timer) this.timer.paused = false;
  }

  setSpeed(speed: 1 | 2 | 3) {
    this.speed = speed;
    this.armTimer();
  }

  setAutoCast(on: boolean) {
    this.autoCast = on;
    this.state.autoCast = on;
    // Turning auto-cast on while a hero waits resolves that one turn at once; the board keeps moving.
    if (on && this.state.pending) {
      const pending = this.state.pending;
      const actor = this.state.units.find((unit) => unit.id === pending.unitId);
      if (actor) {
        const skill = pending.activeReady ? actor.active : actor.basic;
        cast(this.state, RULES, pending.unitId, skill);
        this.processEvents();
        this.updateCards();
      }
    }
  }

  private armTimer() {
    this.timer?.remove(false);
    this.timer = this.time.addEvent({
      delay: 320 / this.speed,
      loop: true,
      callback: () => this.tick(),
    });
  }

  private tick() {
    if (this.ended || this.paused) return;
    if (this.state.pending) {
      this.updateCards();
      return;
    }
    step(this.state, RULES);
    this.processEvents();
    this.updateCards();
    if (this.state.result !== 'ongoing') this.endWave(this.state.result);
  }

  private endWave(result: 'win' | 'lose') {
    this.dealt += this.waveDamage();
    this.rounds += this.state.round;
    if (result === 'lose') return this.finish('lose');
    const next = this.waveIndex + 1;
    if (next >= this.config.stage.waves.length) return this.finish('win');
    const heroes = this.state.units
      .filter((unit) => unit.side === 'hero')
      .map((unit) => (unit.dead ? 0 : Math.min(unit.maxHp, unit.hp + Math.round(unit.maxHp * 0.15))));
    this.waveIndex = next;
    this.eventIndex = 0;
    this.state = createBattle(RULES, {
      seed: this.config.stage.index * 1000 + 17 + next * 7919,
      companyLevel: this.config.companyLevel,
      heroes: this.teamWithHp(heroes),
      enemies: this.config.stage.waves[next]!.enemies,
      autoCast: this.autoCast,
      maxRounds: this.config.stage.rounds,
    });
    this.drawCards();
    this.notifyWave();
    this.processEvents();
    this.updateCards();
  }

  /** Effective damage: what the enemies lost, not an overkill number. */
  private waveDamage(): number {
    return this.state.units
      .filter((unit) => unit.side === 'enemy')
      .reduce((sum, unit) => sum + Math.max(0, unit.maxHp - unit.hp), 0);
  }

  private teamWithHp(hp: readonly number[]): HeroLoadout[] {
    return this.config.team.map((hero, index) => ({ ...hero, hp: hp[index] ?? hero.hp }));
  }

  private finish(result: 'win' | 'lose') {
    if (this.ended) return;
    this.ended = true;
    this.timer?.remove(false);
    this.config.onEnd(result, { damage: this.dealt, rounds: this.rounds });
  }

  private viewSize(): { width: number; height: number } {
    const dpr = Number(this.registry.get('dpr')) || 1;
    return { width: this.scale.width / dpr, height: this.scale.height / dpr };
  }

  private drawBackground() {
    const { stage } = this.config;
    const { width, top, bottom, clashTop, clashBottom, rowTag } = this.layout;
    const clashGap = clashBottom - clashTop;
    const region = REGIONS.items.find((candidate) => candidate.id === stage.region);
    const accent = region?.palette[2] ?? '#456c4e';
    for (const image of this.background) image.destroy();
    this.cameras.main.setBackgroundColor('#171614');

    // Only the small strips that carry information are textures; the board itself is the clear colour, so no
    // full-screen image is filled every frame.
    const tagsKey = drawTexture(
      this,
      `vd-tags-${stage.region}-${Math.round(width)}x${Math.round(bottom - top)}`,
      rowTag + 2,
      bottom - top,
      (ctx) => {
        ctx.fillStyle = '#7a7266';
        ctx.font = '600 6px "Be Vietnam Pro", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const tag = (text: string, y: number) => {
          ctx.save();
          ctx.translate((rowTag + 2) / 2, y - top);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(text, 0, 0);
          ctx.restore();
        };
        tag('SAU', this.layout.enemyY[2]);
        tag('GIỮA', this.layout.enemyY[1]);
        tag('TRƯỚC', this.layout.enemyY[0]);
        tag('TRƯỚC', this.layout.heroY[0]);
        tag('GIỮA', this.layout.heroY[1]);
        tag('SAU', this.layout.heroY[2]);
      },
    );
    const clashKey = drawTexture(
      this,
      `vd-clash-${stage.region}-${Math.round(width)}x${Math.round(clashGap)}`,
      width,
      clashGap,
      (ctx) => {
        ctx.strokeStyle = '#3a342c';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.moveTo(12, clashGap / 2);
        ctx.lineTo(width - 12, clashGap / 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(width / 2, clashGap / 2 - 4);
        ctx.lineTo(width / 2 + 4, clashGap / 2);
        ctx.lineTo(width / 2, clashGap / 2 + 4);
        ctx.lineTo(width / 2 - 4, clashGap / 2);
        ctx.closePath();
        ctx.fill();
      },
    );
    this.background = [
      crispImage(this, 0, top, tagsKey).setOrigin(0, 0).setDepth(-10),
      crispImage(this, 0, clashTop, clashKey).setOrigin(0, 0).setDepth(-10),
    ];
  }

  private drawCards() {
    this.cardLayer.destroy(true);
    this.cardLayer = this.add.container(0, 0);
    this.slotsLayer?.destroy(true);
    this.slotsLayer = this.add.container(0, 0).setDepth(-5);
    this.cards.clear();
    const { cardWidth, cardHeight, x, enemyY, heroY } = this.layout;
    // Faint empty slots keep a three-row formation readable when a wave has fewer than six enemies.
    for (const row of [0, 1, 2] as const) {
      for (const column of [0, 1] as const) {
        for (const y of [enemyY[row]!, heroY[row]!]) {
          const slot = this.add
            .rectangle(x[column]!, y, cardWidth - 2, cardHeight - 2)
            .setStrokeStyle(1, 0x2f2b26, 0.38);
          this.slotsLayer.add(slot);
        }
      }
    }

    const place = (unit: BattleUnit, centreX: number, centreY: number) => {
      const container = this.add.container(centreX, centreY);
      const cardKey = this.cardTexture(unit, cardWidth, cardHeight);
      const image = crispImage(this, 0, 0, cardKey);
      const pic = this.portraitSize();
      const portrait = this.add
        .image(-cardWidth / 2 + 8 + pic / 2, 0, 'portraits', unit.defId)
        .setDisplaySize(pic, pic);
      const hpBack = this.add
        .rectangle(-cardWidth / 2 + 8, cardHeight / 2 - 6, cardWidth - 16, 5, 0x3a342b)
        .setOrigin(0, 0.5);
      const hp = this.add
        .rectangle(
          -cardWidth / 2 + 8,
          cardHeight / 2 - 6,
          cardWidth - 16,
          5,
          unit.side === 'hero' ? 0x7fae86 : 0xd05a4a,
        )
        .setOrigin(0, 0.5);
      const pips: Phaser.GameObjects.Rectangle[] = [];
      const chargeCount = Math.max(3, unit.activeCharge);
      const pipWidth = 6;
      const pipGap = 2;
      const total = chargeCount * pipWidth + (chargeCount - 1) * pipGap;
      for (let index = 0; index < chargeCount; index++) {
        pips.push(
          this.add
            .rectangle(
              cardWidth / 2 - 8 - total + index * (pipWidth + pipGap) + pipWidth / 2,
              cardHeight / 2 - 14,
              pipWidth,
              4,
              0xd8a84e,
            )
            .setStrokeStyle(1, 0x5a5348),
        );
      }
      const border = this.add
        .rectangle(0, 0, cardWidth, cardHeight)
        .setFillStyle(0x000000, 0)
        .setStrokeStyle(2, 0xd8a84e)
        .setVisible(false);
      const deadOverlay = this.add.rectangle(0, 0, cardWidth, cardHeight, 0x171614, 0.55).setVisible(false);
      const flash = this.add.rectangle(0, 0, cardWidth, cardHeight, 0xffffff, 0).setVisible(false);
      container.add([image, portrait, hpBack, hp, ...pips, border, deadOverlay, flash]);
      container.setSize(cardWidth, cardHeight);
      container.setInteractive({ useHandCursor: true });
      container.on('pointerdown', () => this.tap(unit.id));
      this.cardLayer.add(container);
      this.cards.set(unit.id, {
        container,
        image,
        portrait,
        hp,
        pips,
        border,
        deadOverlay,
        flash,
        lastHp: -1,
        lastCharge: -1,
        active: false,
        dead: false,
      });
    };

    // Enemies: back on top, then mid, then front; the enemy front is closest to the clash.
    const enemies = this.state.units.filter((unit) => unit.side === 'enemy');
    for (const row of [2, 1, 0] as const) {
      for (const unit of enemies.filter((candidate) => candidate.row === row)) {
        place(unit, x[unit.column]!, enemyY[row]!);
      }
    }
    // Heroes: front closest to the clash, then mid, then back.
    const heroes = this.state.units.filter((unit) => unit.side === 'hero');
    for (const row of [0, 1, 2] as const) {
      for (const unit of heroes.filter((candidate) => candidate.row === row)) {
        place(unit, x[unit.column]!, heroY[row]!);
      }
    }
    this.updateCards();
  }

  private portraitSize(): number {
    return Math.max(22, Math.min(34, Math.round(this.layout.cardHeight * 0.52)));
  }

  /** One pre-drawn sticker per unit, side, size and DPR: the name, portrait frame, rarity and element never re-render. */
  private cardTexture(unit: BattleUnit, width: number, height: number): string {
    const hero = unit.side === 'hero';
    const rarity = hero
      ? (HEROES.items.find((candidate) => candidate.id === unit.defId)?.rarity ?? 'common')
      : 'enemy';
    const rarityColor = hero
      ? ({ common: '#6b6257', rare: '#4a7fa0', epic: '#b07a3a' } as const)[
          rarity as 'common' | 'rare' | 'epic'
        ]
      : '#8a3a30';
    const border = hero ? '#456c4e' : '#6d3831';
    const fill = hero ? '#1f2a22' : '#2d1f1c';
    const key = `vd-card-${unit.side}-${unit.defId}-${Math.round(width)}x${Math.round(height)}`;
    return drawTexture(this, key, width, height, (ctx) => {
      // A hard offset shadow, like a printed sticker (the kit's look, ADR 0057).
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      roundedRect(ctx, 1, 2, width, height, 10);
      ctx.fill();
      ctx.fillStyle = fill;
      roundedRect(ctx, 0, 0, width, height, 10);
      ctx.fill();
      ctx.strokeStyle = border;
      ctx.lineWidth = 1.5;
      roundedRect(ctx, 0.75, 0.75, width - 1.5, height - 1.5, 9.25);
      ctx.stroke();
      // Rarity strip.
      ctx.fillStyle = rarityColor;
      roundedRect(ctx, 0, 8, 2.5, height - 16, 1.25);
      ctx.fill();
      // The portrait frame; the portrait itself is a separate atlas image.
      const pic = this.portraitSize();
      ctx.fillStyle = '#171614';
      roundedRect(ctx, 7, (height - pic) / 2 - 1, pic + 2, pic + 2, 5);
      ctx.fill();
      // Name and role.
      const nameX = 8 + pic + 7;
      const maxName = Math.max(20, width - nameX - 22);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f2ead9';
      ctx.font = `800 ${Math.max(9, Math.min(11, Math.round(height * 0.18)))}px "Be Vietnam Pro", system-ui, sans-serif`;
      ctx.fillText(unit.name, nameX, height * 0.34, maxName);
      ctx.fillStyle = '#a89f8d';
      ctx.font = '600 7px "Be Vietnam Pro", system-ui, sans-serif';
      ctx.fillText(ROLE_SHORT[unit.role], nameX, height * 0.57, maxName);
      // Element gem: colour and a letter, never colour alone.
      const gemX = width - 13;
      const gemY = 13;
      ctx.fillStyle = ELEMENT_COLORS[unit.element];
      ctx.beginPath();
      ctx.arc(gemX, gemY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#171614';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#171614';
      ctx.font = '800 8px "Be Vietnam Pro", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ELEMENT_LETTER[unit.element], gemX, gemY + 0.5);
      // A boss gets a gold notch; a star-up is in the hero sheet, not on a 56 px card.
      if (!hero && ENEMIES.items.find((candidate) => candidate.id === unit.defId)?.boss) {
        ctx.fillStyle = '#d8a84e';
        ctx.fillRect(4, 4, 11, 2);
      }
    });
  }

  /** A rotation or a resize: lay the cards out again without touching the battle. */
  relayout() {
    if (!this.state) return;
    const view = this.viewSize();
    this.layout = boardLayout(view.width, view.height);
    this.drawBackground();
    this.drawCards();
    this.updateCards();
  }

  private updateCards() {
    const activeId = this.state.pending?.unitId ?? this.state.order[this.state.turn] ?? null;
    for (const unit of this.state.units) {
      const card = this.cards.get(unit.id);
      if (!card) continue;
      const ratio = Math.max(0, Math.min(1, unit.hp / unit.maxHp));
      if (card.lastHp !== unit.hp) {
        card.hp.setScale(ratio, 1);
        card.lastHp = unit.hp;
      }
      if (card.lastCharge !== unit.charge) {
        card.pips.forEach((pip, index) => {
          const visible = index < unit.activeCharge;
          pip.setVisible(visible);
          pip.setFillStyle(index < unit.charge ? 0xd8a84e : 0x3a342b);
        });
        card.lastCharge = unit.charge;
      }
      if (card.dead !== unit.dead) {
        card.dead = unit.dead;
        card.deadOverlay.setVisible(unit.dead);
        card.image.setTint(unit.dead ? 0x666666 : 0xffffff);
        card.portrait.setTint(unit.dead ? 0x666666 : 0xffffff);
        card.hp.setVisible(!unit.dead);
        for (const pip of card.pips) pip.setVisible(!unit.dead && card.pips.indexOf(pip) < unit.activeCharge);
        card.border.setVisible(false);
      }
      const active = !unit.dead && activeId === unit.id;
      if (card.active !== active) {
        card.active = active;
        card.border.setVisible(active);
        this.tweens.killTweensOf(card.border);
        card.border.setAlpha(1);
        // Manual mode: the waiting hero's ring breathes so a tap is the obvious next move.
        if (active && this.state.pending && !this.reducedMotion) {
          this.tweens.add({
            targets: card.border,
            alpha: { from: 1, to: 0.35 },
            duration: 520,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }
      }
    }
    this.notifyTurn(activeId);
  }

  private notifyWave() {
    this.config.onWave?.(this.waveIndex + 1, this.config.stage.waves.length);
  }

  private notifyTurn(currentId: string | null) {
    const tokens: TurnToken[] = [];
    for (let index = this.state.turn; index < this.state.order.length && tokens.length < 6; index++) {
      const unit = this.state.units.find((candidate) => candidate.id === this.state.order[index]);
      if (!unit || unit.dead) continue;
      tokens.push({
        id: unit.id,
        defId: unit.defId,
        name: unit.name,
        side: unit.side,
        element: unit.element,
      });
    }
    const signature = `${this.state.round}:${tokens.map((token) => token.id).join(',')}:${currentId ?? ''}`;
    if (signature === this.turnSignature) return;
    this.turnSignature = signature;
    this.config.onTurn(tokens, currentId);
  }

  /** A tap on a card: a manual hero turn casts; otherwise a hero opens its sheet. */
  private tap(unitId: string) {
    if (this.ended || this.paused) return;
    const actor = this.state.units.find((unit) => unit.id === unitId);
    if (!actor) return;
    if (this.state.pending && this.state.pending.unitId === unitId) {
      if (this.state.pending.activeReady) {
        cast(this.state, RULES, unitId, actor.active);
        sfx.play('combo');
        if (!this.reducedMotion) haptics.play('success');
      } else {
        basicAttack(this.state, RULES, unitId);
        sfx.play('click');
      }
      this.processEvents();
      this.updateCards();
      if (this.state.result !== 'ongoing') this.endWave(this.state.result);
      return;
    }
    if (actor.side === 'hero') this.config.onCardTap?.(actor.defId);
  }

  private processEvents() {
    const events = this.state.events;
    let skillKind: string | null = null;
    for (; this.eventIndex < events.length; this.eventIndex++) {
      const event = events[this.eventIndex]!;
      if (event.type === 'turn') {
        skillKind = RULES.skill(event.skill).kind;
      } else if (event.type === 'damage') {
        const target = this.cards.get(event.target);
        if (!target) continue;
        const burn = event.source === event.target;
        const kind: ImpactKind = burn ? 'burn' : event.crit ? 'crit' : 'damage';
        this.impact(target, `${burn ? '' : '-'}${event.amount}`, kind);
        this.flash(target, burn ? 0xffab5e : event.crit ? 0xffd36e : 0xffffff);
        if (!burn) {
          this.nudge(target, event.source.startsWith('h'));
          this.hitSound(event.crit);
          if (event.crit && !this.reducedMotion) haptics.play('bump');
          if (!this.reducedMotion && (event.crit || skillKind === 'active')) shake(this, 'small');
        }
      } else if (event.type === 'heal') {
        const target = this.cards.get(event.target);
        if (target) {
          this.impact(target, `+${event.amount}`, 'heal');
          this.flash(target, 0x7fae86);
        }
        sfx.play('pop');
      } else if (event.type === 'shield') {
        const target = this.cards.get(event.target);
        if (target) this.impact(target, `+${event.amount}`, 'shield');
      } else if (event.type === 'death') {
        const target = this.cards.get(event.unit);
        if (target) {
          target.deadOverlay.setVisible(true);
          if (!this.reducedMotion) {
            sfx.play('drop');
            haptics.play('tap');
          }
        }
      }
    }
  }

  private impact(card: CardView, text: string, kind: ImpactKind) {
    this.config.onImpact({
      x: card.container.x + (Math.random() * 12 - 6),
      y: card.container.y - this.layout.cardHeight * 0.55,
      text,
      kind,
    });
  }

  private flash(card: CardView, color: number) {
    card.flash.setFillStyle(color, 1).setAlpha(0.2).setVisible(true);
    this.tweens.killTweensOf(card.flash);
    this.tweens.add({
      targets: card.flash,
      alpha: 0,
      duration: this.reducedMotion ? 60 : 140,
      ease: 'Quad.easeOut',
      onComplete: () => card.flash.setVisible(false),
    });
  }

  private nudge(card: CardView, fromHero: boolean) {
    if (this.tweens.isTweening(card.container) || this.reducedMotion) return;
    this.tweens.add({
      targets: card.container,
      x: card.container.x + (fromHero ? 3 : -3),
      duration: 50,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private hitSound(crit: boolean) {
    const now = performance.now();
    if (now - this.lastHitSound < 45) return;
    this.lastHitSound = now;
    sfx.play(crit ? 'combo' : 'merge');
  }
}
