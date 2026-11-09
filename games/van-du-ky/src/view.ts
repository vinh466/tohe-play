// The board (Phaser): 6 heroes vs 6 enemies on three rows, the turn loop, and the card clash. The pure rules live in
// core/battle.ts; this scene only draws them and forwards the player's taps.

import { crispText, floatText, shake } from '@tohe/game-kit/phaser';
import Phaser from 'phaser';
import { sfx } from './app.ts';
import { RULES } from './content/index.ts';
import { REGIONS } from './content/stages.ts';
import { basicAttack, cast, createBattle, step } from './core/battle.ts';
import type { BattleState, BattleUnit, HeroLoadout, StageDef } from './core/types.ts';

export interface BoardSceneData {
  readonly stage: StageDef;
  readonly team: readonly HeroLoadout[];
  readonly companyLevel: number;
  readonly autoCast: boolean;
  readonly speed: 1 | 2 | 3;
  readonly reducedMotion: boolean;
  readonly onEnd: (result: 'win' | 'lose') => void;
}

interface CardView {
  readonly container: Phaser.GameObjects.Container;
  readonly box: Phaser.GameObjects.Rectangle;
  readonly name: Phaser.GameObjects.Text;
  readonly hp: Phaser.GameObjects.Rectangle;
  readonly charge: Phaser.GameObjects.Text;
}

export class BoardScene extends Phaser.Scene {
  private config!: BoardSceneData;
  private state!: BattleState;
  private waveIndex = 0;
  private eventIndex = 0;
  private cards = new Map<string, CardView>();
  private cardLayer!: Phaser.GameObjects.Container;
  private turnText!: Phaser.GameObjects.Text;
  private timer?: Phaser.Time.TimerEvent;
  private ended = false;
  private paused = false;
  private speed: 1 | 2 | 3 = 2;
  private autoCast = true;
  private reducedMotion = false;

  constructor(data: BoardSceneData) {
    super('board');
    this.config = data;
  }

  init(data?: Partial<BoardSceneData>) {
    if (data?.stage) this.config = data as BoardSceneData;
  }

  create() {
    const { stage, team, companyLevel } = this.config;
    const { width, height } = this.viewSize();
    this.speed = this.config.speed;
    this.autoCast = this.config.autoCast;
    this.reducedMotion = this.config.reducedMotion;
    this.ended = false;
    this.paused = false;
    this.waveIndex = 0;
    this.eventIndex = 0;
    this.cards.clear();
    this.cameras.main.setBackgroundColor('#171614');

    const regionName = REGIONS.items.find((region) => region.id === stage.region)?.name ?? stage.region;
    this.add
      .text(width / 2, 14, regionName.toUpperCase(), {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        color: '#a89f8d',
      })
      .setOrigin(0.5, 0);
    this.turnText = this.add
      .text(width / 2, 30, '', {
        fontFamily: 'sans-serif',
        fontSize: '9px',
        color: '#a89f8d',
      })
      .setOrigin(0.5, 0);
    this.add
      .text(width / 2, height * 0.44, '─'.repeat(36), {
        fontFamily: 'sans-serif',
        fontSize: '9px',
        color: '#39342c',
      })
      .setOrigin(0.5);

    this.cardLayer = this.add.container(0, 0);
    this.state = createBattle(RULES, {
      seed: stage.index * 1000 + 17,
      companyLevel,
      heroes: team,
      enemies: stage.waves[0]!.enemies,
      autoCast: this.autoCast,
    });
    this.drawCards();
    this.armTimer();
    this.processEvents();
  }

  /** Restart the scene with a new stage or team; the shell's play stage calls `scene.restart`. */
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
  }

  private armTimer() {
    this.timer?.remove(false);
    this.timer = this.time.addEvent({
      delay: 700 / this.speed,
      loop: true,
      callback: () => this.tick(),
    });
  }

  private tick() {
    if (this.ended || this.paused) return;
    if (this.state.pending) {
      this.highlight(this.state.pending.unitId);
      return;
    }
    step(this.state, RULES);
    this.updateCards();
    this.processEvents();
    if (this.state.result !== 'ongoing') this.endWave(this.state.result);
  }

  private endWave(result: 'win' | 'lose') {
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
    });
    this.drawCards();
    this.processEvents();
  }

  private teamWithHp(hp: readonly number[]): HeroLoadout[] {
    return this.config.team.map((hero, index) => ({ ...hero, hp: hp[index] ?? hero.hp }));
  }

  private finish(result: 'win' | 'lose') {
    if (this.ended) return;
    this.ended = true;
    this.timer?.remove(false);
    this.config.onEnd(result);
  }

  private viewSize(): { width: number; height: number } {
    const dpr = Number(this.registry.get('dpr')) || 1;
    return { width: this.scale.width / dpr, height: this.scale.height / dpr };
  }

  private drawCards() {
    this.cardLayer.destroy(true);
    this.cardLayer = this.add.container(0, 0);
    this.cards.clear();
    const { width, height } = this.viewSize();
    const gap = 8;
    const cardW = (width - gap * 3) / 2;
    const cardH = Math.min(56, height * 0.075);
    const rowY = [0.13, 0.22, 0.31, 0.56, 0.65, 0.74].map((fraction) => height * fraction);
    const enemyRowY = [0.31, 0.22, 0.13];
    const xs = [width * 0.27, width * 0.73];

    const heroes = this.state.units.filter((unit) => unit.side === 'hero');
    const enemies = this.state.units.filter((unit) => unit.side === 'enemy');
    const place = (unit: BattleUnit, y: number, x: number) => {
      const container = this.add.container(x, y);
      const box = this.add
        .rectangle(0, 0, cardW, cardH, unit.side === 'hero' ? 0x1f2a22 : 0x2d1f1c)
        .setStrokeStyle(1.5, unit.side === 'hero' ? 0x456c4e : 0x6d3831);
      const name = crispText(this, -cardW / 2 + 6, -cardH / 2 + 4, unit.name, {
        fontSize: '10px',
        fontStyle: '800',
        color: '#f2ead9',
      }).setOrigin(0, 0);
      const hpBack = this.add.rectangle(0, cardH / 2 - 8, cardW - 12, 5, 0x3a342b).setOrigin(0.5);
      const hp = this.add
        .rectangle(-cardW / 2 + 6, cardH / 2 - 8, cardW - 12, 5, unit.side === 'hero' ? 0x7fae86 : 0xd05a4a)
        .setOrigin(0, 0.5);
      const element = crispText(this, cardW / 2 - 8, -cardH / 2 + 4, unit.element.slice(0, 1).toUpperCase(), {
        fontSize: '9px',
        fontStyle: '800',
        color: '#d8a84e',
      }).setOrigin(1, 0);
      const charge = crispText(this, -cardW / 2 + 6, cardH / 2 - 20, '', {
        fontSize: '8px',
        color: '#a89f8d',
      }).setOrigin(0, 0.5);
      container.add([box, name, hpBack, hp, element, charge]);
      container.setSize(cardW, cardH);
      container.setInteractive({ useHandCursor: true });
      container.on('pointerdown', () => this.tap(unit.id));
      this.cardLayer.add(container);
      this.cards.set(unit.id, { container, box, name, hp, charge });
    };

    // Enemies: back row on top, then mid, then front; the enemy front is closest to the clash line.
    const enemyRows = [2, 1, 0] as const;
    for (const row of enemyRows) {
      for (const unit of enemies.filter((candidate) => candidate.row === row)) {
        place(unit, height * enemyRowY[row]!, xs[unit.column]!);
      }
    }
    // Heroes: front closest to the clash line, then mid, then back.
    for (const row of [0, 1, 2] as const) {
      for (const unit of heroes.filter((candidate) => candidate.row === row)) {
        place(unit, rowY[3 + row]!, xs[unit.column]!);
      }
    }
    this.updateCards();
  }

  private updateCards() {
    const next = this.state.order
      .slice(this.state.turn)
      .map((id) => this.state.units.find((unit) => unit.id === id))
      .filter((unit): unit is BattleUnit => unit !== undefined && !unit.dead)
      .slice(0, 6)
      .map((unit) => unit.name);
    this.turnText.setText(next.length > 0 ? `LƯỢT · ${next.join(' · ')}` : '');
    for (const unit of this.state.units) {
      const card = this.cards.get(unit.id);
      if (!card) continue;
      const ratio = Math.max(0, Math.min(1, unit.hp / unit.maxHp));
      card.hp.setScale(ratio, 1);
      card.name.setAlpha(unit.dead ? 0.35 : 1);
      card.box.setAlpha(unit.dead ? 0.3 : 1);
      card.charge.setText(unit.dead ? '' : `✦ ${unit.charge}/${unit.activeCharge}`);
      card.box.setStrokeStyle(
        1.5,
        this.state.pending?.unitId === unit.id ? 0xd8a84e : unit.side === 'hero' ? 0x456c4e : 0x6d3831,
        1,
      );
    }
  }

  private highlight(unitId: string) {
    for (const [id, card] of this.cards) {
      card.box.setStrokeStyle(1.5, id === unitId ? 0xd8a84e : id.startsWith('h') ? 0x456c4e : 0x6d3831, 1);
    }
  }

  /** A tap on a card: a manual hero turn casts its active if ready, else its basic. */
  private tap(unitId: string) {
    if (this.ended || this.paused || !this.state.pending) return;
    if (this.state.pending.unitId !== unitId) return;
    const actor = this.state.units.find((unit) => unit.id === unitId);
    if (!actor) return;
    const before = this.eventIndex;
    if (this.state.pending.activeReady) cast(this.state, RULES, unitId, actor.active);
    else basicAttack(this.state, RULES, unitId);
    this.eventIndex = before;
    this.updateCards();
    this.processEvents();
    if (this.state.result !== 'ongoing') this.endWave(this.state.result);
  }

  private processEvents() {
    const events = this.state.events;
    for (; this.eventIndex < events.length; this.eventIndex++) {
      const event = events[this.eventIndex]!;
      if (event.type === 'damage') {
        const target = this.cards.get(event.target);
        if (target) {
          floatText(this, target.container.x, target.container.y - 16, `-${event.amount}`, {
            color: event.crit ? '#d8a84e' : '#d05a4a',
            stroke: '#171614',
            size: event.crit ? 16 : 13,
          });
          if (!this.reducedMotion) shake(this, event.crit ? 'medium' : 'small');
          if (!this.reducedMotion) sfx.play('merge');
          this.tweens.add({
            targets: target.container,
            x: target.container.x + (event.source.startsWith('h') ? 6 : -6),
            duration: 60,
            yoyo: true,
          });
        }
      } else if (event.type === 'heal') {
        const target = this.cards.get(event.target);
        if (target)
          floatText(this, target.container.x, target.container.y - 16, `+${event.amount}`, {
            color: '#7fae86',
            stroke: '#171614',
            size: 13,
          });
        sfx.play('pop');
      } else if (event.type === 'death') {
        const target = this.cards.get(event.unit);
        target?.container.setAlpha(0.28);
      } else if (event.type === 'turn') {
        this.highlight(event.unit);
      }
    }
    this.updateCards();
  }
}
