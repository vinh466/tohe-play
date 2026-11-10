// The board, now DOM/CSS: 24 flat-top hexes (12 per side), six deployed heroes and enemies, and a small effect layer.
// The pure rules live in core/battle.ts; this view draws them. No engine, no canvas: one CSS grid, one timer and
// CSS/WAAPI transforms. The old Phaser board is gone; the shell, SFX and haptics still come from @tohe/game-kit.

import { haptics } from '@tohe/game-kit';
import { sfx } from './app.ts';
import { ENEMIES } from './content/enemies.ts';
import { RULES } from './content/index.ts';
import { basicAttack, cast, createBattle, step } from './core/battle.ts';
import { terrainAt } from './core/terrain.ts';
import type {
  BattleEvent,
  BattleState,
  BattleUnit,
  Column,
  Element,
  HeroLoadout,
  Row,
  Speed,
  StageDef,
} from './core/types.ts';
import { centerAt, HEX_COLUMNS, HEX_ROWS, type HexCenter, type HexLayout, hexLayout } from './view-layout.ts';

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

/** A line for the deck's three-line feed. The stage owns the DOM; the view owns the battle names. */
export interface FeedEvent {
  readonly kind: 'hit' | 'heal' | 'shield' | 'death';
  readonly source: string;
  readonly target: string;
  readonly skill?: string;
  readonly amount?: number;
  readonly crit?: boolean;
}

export interface BoardViewData {
  stage: StageDef;
  team: readonly HeroLoadout[];
  companyLevel: number;
  speed: Speed;
  reducedMotion: boolean;
  onEnd: (result: 'win' | 'lose', summary: BoardSummary) => void;
  onTurn: (tokens: readonly TurnToken[], currentId: string | null) => void;
  onWave: (wave: number, total: number) => void;
  onFeed: (event: FeedEvent) => void;
  onCardTap: (defId: string, side: 'hero' | 'enemy') => void;
}

interface UnitView {
  readonly cell: HTMLElement;
  readonly hpFill: HTMLElement;
  readonly hpGhost: HTMLElement;
  readonly pips: HTMLElement[];
  readonly pipsBox: HTMLElement;
  readonly portrait: HTMLImageElement;
  lastRatio: number;
  lastCharge: number;
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

function cellKey(side: 'hero' | 'enemy', row: Row, column: Column): string {
  return `${side}:${row}:${column}`;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export class BoardView {
  private readonly host: HTMLElement;
  private readonly root: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly fx: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly cells = new Map<string, HTMLElement>();
  private readonly unitViews = new Map<string, UnitView>();
  private readonly numbers: HTMLElement[] = [];
  private readonly centerCache = new Map<string, HexCenter>();
  private readonly bursts: HTMLElement[] = [];
  private readonly timers = new Set<number>();
  private resizeObserver: ResizeObserver | null = null;
  private data: BoardViewData;
  private stage: StageDef;
  private team: readonly HeroLoadout[];
  private state!: BattleState;
  private layout: HexLayout;
  private waveIndex = 0;
  private waveStartHp: readonly (number | undefined)[] = [];
  private dealt = 0;
  private rounds = 0;
  private ended = false;
  private paused = false;
  private animating = false;
  private speed: Speed;
  private reducedMotion: boolean;
  private timer: number | null = null;
  private turnSignature = '';
  private numberCursor = 0;
  private lastHitSound = 0;
  private epoch = 0;

  constructor(host: HTMLElement, data: BoardViewData) {
    this.host = host;
    this.data = data;
    this.stage = data.stage;
    this.team = data.team;
    this.speed = data.speed;
    this.reducedMotion = data.reducedMotion;
    this.root = el('div', 'hex-board');
    this.root.setAttribute('role', 'group');
    this.root.setAttribute('aria-label', 'Bàn đấu');
    this.grid = el('div', 'hex-grid');
    const sides = el('div', 'hex-sides');
    sides.append(el('span', 'hex-side hero', 'ĐOÀN'), el('span', 'hex-side enemy', 'ĐỊCH'));
    this.fx = el('div', 'hex-fx');
    this.banner = el('div', 'skill-banner');
    this.root.append(this.grid, sides, this.fx, this.banner);
    host.append(this.root);
    this.layout = hexLayout(host.clientWidth, host.clientHeight);
    this.buildGrid();
    this.buildNumbers();
    this.applyMotion();
    this.bindResize();
    this.load(data);
  }

  /** Swap in a new stage or team and start at wave 1, full HP. */
  load(data: BoardViewData): void {
    this.data = data;
    this.stage = data.stage;
    this.team = data.team;
    this.speed = data.speed;
    this.reducedMotion = data.reducedMotion;
    this.applyMotion();
    this.waveIndex = 0;
    this.dealt = 0;
    this.rounds = 0;
    this.ended = false;
    this.paused = false;
    this.animating = false;
    this.turnSignature = '';
    this.epoch++;
    this.clearTimers();
    this.clearEffects();
    this.startWave(
      0,
      this.team.map(() => undefined),
    );
  }

  /** Restart the current stage from wave 1; used by the wall's retry and after a team change. */
  restartStage(team: readonly HeroLoadout[] = this.team): void {
    this.load({ ...this.data, team, speed: this.speed, reducedMotion: this.reducedMotion });
  }

  /** Re-enter the current wave from the HP it had when the wave began. */
  rewindWave(): void {
    this.epoch++;
    this.clearTimers();
    this.clearEffects();
    this.ended = false;
    this.paused = false;
    this.animating = false;
    this.startWave(this.waveIndex, this.waveStartHp);
  }

  setSpeed(speed: Speed): void {
    this.speed = speed;
    this.data.speed = speed;
    this.applyMotion();
    if (!this.ended && !this.paused && !this.animating) this.schedule(this.turnGap);
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    this.data.reducedMotion = reduced;
    this.applyMotion();
  }

  pause(): void {
    this.paused = true;
    this.clearTimer();
  }

  resume(): void {
    if (this.paused) {
      this.paused = false;
      if (!this.ended) this.schedule(120);
    }
  }

  stopAuto(): void {
    this.pause();
  }

  resumeAuto(): void {
    this.resume();
  }

  get wave(): number {
    return this.waveIndex + 1;
  }

  destroy(): void {
    this.epoch++;
    this.clearTimers();
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.onResize);
    this.root.remove();
  }

  // MARK: board construction

  private buildGrid(): void {
    for (let column = 0; column < HEX_COLUMNS; column++) {
      const columnNode = el('div', 'hex-col');
      for (let row = 0; row < HEX_ROWS; row++) {
        const side: 'hero' | 'enemy' = column < 3 ? 'hero' : 'enemy';
        const rank = (side === 'hero' ? 2 - column : column - 3) as Row;
        const lane = row as Column;
        const terrain = terrainAt(side, rank, lane);
        const cell = el(
          'div',
          `hex-cell ${side} empty${terrain ? ' has-terrain' : ''}${side === 'enemy' ? ' enemy-side' : ''}`,
        );
        cell.dataset.column = String(column);
        cell.dataset.row = String(row);
        cell.dataset.side = side;
        cell.dataset.rank = String(rank);
        cell.dataset.lane = String(lane);
        const rim = el('div', 'hex-rim');
        const shape = el('div', 'hex-shape');
        const impact = el('span', 'hex-impact');
        const body = el('div', 'hex-body');
        body.append(el('span', 'hex-empty', '+'));
        const flash = el('span', 'hex-flash');
        const ring = el('span', 'hex-ring');
        const shield = el('span', 'hex-shield');
        const boss = el('span', 'hex-boss', '♛');
        boss.setAttribute('aria-hidden', 'true');
        cell.append(rim, shape, impact, body, flash, ring, shield, boss);
        if (terrain) cell.append(el('span', 'hex-terrain', terrain.label));
        cell.addEventListener('click', () => this.tap(cell));
        cell.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          this.tap(cell);
        });
        this.cells.set(cellKey(side, rank, lane), cell);
        columnNode.append(cell);
      }
      this.grid.append(columnNode);
    }
  }

  private buildNumbers(): void {
    for (let index = 0; index < 16; index++) {
      const node = el('div', 'dmg');
      this.fx.append(node);
      this.numbers.push(node);
    }
  }

  /** CSS/WAAPI durations scale with the turn speed; x1 is the readable default. */
  private get motionScale(): number {
    if (this.reducedMotion) return 0.45;
    return this.speed === 10 ? 0.12 : this.speed === 5 ? 0.25 : this.speed === 2 ? 0.5 : 1;
  }

  private get turnGap(): number {
    return Math.max(18, Math.round(100 * this.motionScale));
  }

  private get waveDelay(): number {
    return this.speed === 10 ? 160 : this.speed === 5 ? 260 : this.speed === 2 ? 500 : 800;
  }

  private applyMotion(): void {
    this.root.classList.toggle('reduced-motion', this.reducedMotion);
    this.root.classList.toggle('x2', this.speed === 2);
    this.root.classList.toggle('x5', this.speed === 5);
    this.root.classList.toggle('x10', this.speed === 10);
    this.root.dataset.speed = String(this.speed);
    this.root.style.setProperty('--fx', String(this.motionScale));
  }

  private bindResize(): void {
    window.addEventListener('resize', this.onResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.relayout());
      this.resizeObserver.observe(this.host);
    }
  }

  private readonly onResize = (): void => this.relayout();

  private relayout(): void {
    const next = hexLayout(this.host.clientWidth, this.host.clientHeight);
    this.layout = next;
    this.grid.style.width = `${next.gridW}px`;
    this.grid.style.height = `${next.gridH}px`;
    this.root.style.setProperty('--hw', `${next.cellW}px`);
    this.root.style.setProperty('--hh', `${next.cellH}px`);
    this.root.style.setProperty('--grid-h', `${next.gridH}px`);
    this.cacheCenters();
  }

  /** Card centres in board pixels, cached after a wave and on resize; effect code never measures per hit. */
  private cacheCenters(): void {
    this.centerCache.clear();
    const board = this.root.getBoundingClientRect();
    for (const unit of this.state?.units ?? []) {
      const view = this.unitViews.get(unit.id);
      if (!view) continue;
      const rect = view.cell.getBoundingClientRect();
      this.centerCache.set(unit.id, {
        column: 0,
        row: 0,
        x: rect.left - board.left + rect.width / 2,
        y: rect.top - board.top + rect.height / 2,
      });
    }
  }

  private center(unitId: string): HexCenter {
    return (
      this.centerCache.get(unitId) ?? {
        column: 0,
        row: 0,
        x: this.layout.width / 2,
        y: this.layout.height / 2,
      }
    );
  }

  // MARK: a wave from start to result

  private startWave(index: number, hp: readonly (number | undefined)[]): void {
    this.waveIndex = index;
    this.waveStartHp = hp;
    this.turnSignature = '';
    const wave = this.stage.waves[index];
    if (!wave) {
      this.finishStage('win');
      return;
    }
    this.state = createBattle(RULES, {
      seed: this.stage.index * 1000 + 17 + index * 7919,
      companyLevel: this.data.companyLevel,
      heroes: this.heroesWithHp(hp),
      enemies: wave.enemies,
      // Auto is always on for Vân Du Ký; Dừng pauses, it does not hand the turn to the player.
      autoCast: true,
      maxRounds: this.stage.rounds,
    });
    this.renderUnits();
    this.relayout();
    this.updateCards(true);
    this.data.onWave(this.waveIndex + 1, this.stage.waves.length);
    this.schedule(this.speed === 10 ? 120 : this.speed === 5 ? 180 : this.speed === 2 ? 280 : 420);
  }

  private heroesWithHp(hp: readonly (number | undefined)[]): HeroLoadout[] {
    return this.team.map((hero, index) => {
      const value = hp[index];
      return value === undefined ? { ...hero } : { ...hero, hp: value };
    });
  }

  private schedule(delay: number): void {
    this.clearTimer();
    const epoch = this.epoch;
    const timer = window.setTimeout(
      () => {
        this.timers.delete(timer);
        if (epoch === this.epoch) this.pump();
      },
      Math.max(0, delay),
    );
    this.timers.add(timer);
    this.timer = timer;
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timers.delete(this.timer);
      this.timer = null;
    }
  }

  private clearTimers(): void {
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers.clear();
    this.timer = null;
  }

  private after(delay: number, callback: () => void): void {
    const epoch = this.epoch;
    const timer = window.setTimeout(
      () => {
        this.timers.delete(timer);
        if (epoch === this.epoch) callback();
      },
      Math.max(0, delay),
    );
    this.timers.add(timer);
  }

  private pump(): void {
    if (this.ended || this.paused || this.animating) return;
    if (this.state.result !== 'ongoing') return;
    const before = this.state.events.length;
    step(this.state, RULES);
    const events = this.state.events.slice(before);
    if (events.length === 0) {
      this.schedule(80);
      return;
    }
    this.animating = true;
    void this.playEvents(events).then(() => {
      this.animating = false;
      this.updateCards();
      if (this.state.result !== 'ongoing') this.handleResult(this.state.result);
      else this.schedule(this.turnGap);
    });
  }

  private handleResult(result: 'win' | 'lose'): void {
    this.dealt += this.waveDamage();
    this.rounds += this.state.round;
    if (result === 'lose') {
      this.finishStage('lose');
      return;
    }
    const next = this.waveIndex + 1;
    if (next >= this.stage.waves.length) {
      this.finishStage('win');
      return;
    }
    const hp = this.state.units
      .filter((unit) => unit.side === 'hero')
      .map((unit) => (unit.dead ? 0 : Math.min(unit.maxHp, unit.hp + Math.round(unit.maxHp * 0.15))));
    this.animating = true;
    this.after(this.waveDelay, () => {
      this.animating = false;
      this.startWave(next, hp);
    });
  }

  private finishStage(result: 'win' | 'lose'): void {
    if (this.ended) return;
    this.ended = true;
    this.animating = false;
    this.clearTimer();
    this.data.onEnd(result, { damage: this.dealt, rounds: this.rounds });
  }

  private waveDamage(): number {
    return this.state.units
      .filter((unit) => unit.side === 'enemy')
      .reduce((sum, unit) => sum + Math.max(0, unit.maxHp - unit.hp), 0);
  }

  // MARK: drawing cards

  private renderUnits(): void {
    this.unitViews.clear();
    this.centerCache.clear();
    for (const cell of this.cells.values()) {
      const side = cell.dataset.side as 'hero' | 'enemy';
      const rank = Number(cell.dataset.rank) as Row;
      const lane = Number(cell.dataset.lane) as Column;
      const terrain = terrainAt(side, rank, lane);
      cell.className = `hex-cell ${side} empty${terrain ? ' has-terrain' : ''}${
        side === 'enemy' ? ' enemy-side' : ''
      }`;
      cell.removeAttribute('data-unit');
      cell.removeAttribute('title');
      cell.removeAttribute('aria-label');
      cell.removeAttribute('role');
      cell.removeAttribute('tabindex');
      const body = cell.querySelector('.hex-body') as HTMLElement;
      body.replaceChildren(el('span', 'hex-empty', '+'));
    }

    for (const unit of this.state.units) {
      const cell = this.cells.get(cellKey(unit.side, unit.row, unit.column));
      if (!cell) continue;
      cell.classList.remove('empty');
      cell.classList.add('occupied');
      cell.dataset.unit = unit.id;
      cell.setAttribute('role', 'button');
      cell.tabIndex = 0;
      cell.setAttribute('aria-label', `${unit.name} · ${Math.max(0, unit.hp)}/${unit.maxHp} HP`);
      cell.title = unit.name;
      const body = cell.querySelector('.hex-body') as HTMLElement;
      const portraitBox = el('div', 'hex-portrait');
      const portrait = el('img');
      portrait.src = `portraits/${unit.defId}.png`;
      portrait.alt = '';
      portrait.draggable = false;
      portrait.loading = 'eager';
      portraitBox.append(portrait);
      const hp = el('div', 'hex-hp');
      const ghost = el('i', 'ghost');
      const fill = el('i', 'fill');
      hp.append(ghost, fill);
      const meta = el('div', 'hex-meta');
      const gem = el('span', `hex-element ${unit.element}`, ELEMENT_LETTER[unit.element]);
      const pips = el('span', 'hex-pips');
      const count = Math.max(3, Math.min(5, unit.activeCharge));
      const pipNodes: HTMLElement[] = [];
      for (let index = 0; index < count; index++) {
        const pip = el('i');
        pips.append(pip);
        pipNodes.push(pip);
      }
      meta.append(gem, pips);
      body.replaceChildren(portraitBox, hp, meta);
      const boss = ENEMIES.items.find((candidate) => candidate.id === unit.defId)?.boss === true;
      cell.classList.toggle('boss', boss);
      this.unitViews.set(unit.id, {
        cell,
        hpFill: fill,
        hpGhost: ghost,
        pips: pipNodes,
        pipsBox: pips,
        portrait,
        lastRatio: -1,
        lastCharge: -1,
        dead: false,
      });
    }
    this.updateCards(true);
    this.cacheCenters();
  }

  private updateCards(force = false): void {
    if (!this.state) return;
    const activeId = this.state.pending?.unitId ?? this.state.order[this.state.turn] ?? null;
    for (const unit of this.state.units) {
      const view = this.unitViews.get(unit.id);
      if (!view) continue;
      const ratio = Math.max(0, Math.min(1, unit.hp / unit.maxHp));
      if (force || view.lastRatio !== ratio) {
        const old = view.lastRatio < 0 ? ratio : view.lastRatio;
        view.hpFill.style.transform = `scaleX(${ratio})`;
        if (ratio < old) {
          view.hpGhost.style.transition = 'none';
          view.hpGhost.style.transform = `scaleX(${old})`;
          requestAnimationFrame(() => {
            view.hpGhost.style.transition = '';
            view.hpGhost.style.transform = `scaleX(${ratio})`;
          });
        } else {
          view.hpGhost.style.transition = '';
          view.hpGhost.style.transform = `scaleX(${ratio})`;
        }
        view.lastRatio = ratio;
        view.cell.setAttribute('aria-label', `${unit.name} · ${Math.max(0, unit.hp)}/${unit.maxHp} HP`);
      }
      if (force || view.lastCharge !== unit.charge) {
        view.pips.forEach((pip, index) => {
          pip.classList.toggle('off', index >= unit.charge);
        });
        view.pipsBox.classList.toggle('ready', unit.charge >= unit.activeCharge);
        view.lastCharge = unit.charge;
      }
      view.cell.classList.toggle('low-hp', ratio > 0 && ratio <= 0.3);
      if (view.dead !== unit.dead) {
        view.dead = unit.dead;
        view.cell.classList.toggle('dead', unit.dead);
      }
    }
    for (const cell of this.cells.values()) cell.classList.remove('active');
    const active = activeId ? this.unitViews.get(activeId) : undefined;
    if (active && !active.dead) active.cell.classList.add('active');
    this.notifyTurn(activeId);
  }

  private notifyTurn(currentId: string | null): void {
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
    this.data.onTurn(tokens, currentId);
  }

  // MARK: effects

  private async playEvents(events: readonly BattleEvent[]): Promise<void> {
    const turn = events.find((event) => event.type === 'turn');
    const source = turn?.type === 'turn' ? this.unitById(turn.unit) : undefined;
    const skill = turn?.type === 'turn' ? RULES.skill(turn.skill) : undefined;
    const active = skill?.kind === 'active';
    const reduced = this.reducedMotion;
    const scale = this.motionScale;
    const windup = reduced ? 0 : Math.round(160 * scale);
    const travel = reduced ? 0 : Math.round(220 * scale);
    const impact = windup + travel;
    const recovery = Math.round(260 * scale);
    const hitStop = reduced ? 0 : Math.round(60 * scale);
    const damage = events.find((event) => event.type === 'damage' && event.source !== event.target);
    const target = damage?.type === 'damage' ? this.unitById(damage.target) : undefined;
    const color = source ? ELEMENT_COLORS[source.element] : '#f2ead9';

    if (source) this.lunge(source, target, impact);
    if (source && target && !reduced) {
      this.after(windup, () => this.strike(source.id, target.id, color, travel));
      if (source.role === 'seer' || source.role === 'binder') {
        this.after(windup, () => this.projectile(source.id, target.id, color));
      }
    }
    if (active && skill) this.showBanner(skill.name);
    if (active && !reduced) {
      this.after(0, () => haptics.play('success'));
      this.shake();
    }

    let offset = 0;
    for (const event of events) {
      const delay = impact + offset;
      offset += 8;
      if (event.type === 'damage') {
        const hitTarget = this.unitById(event.target);
        if (!hitTarget) continue;
        const burn = event.source === event.target;
        this.after(burn ? impact + offset : delay, () =>
          this.hitUnit(
            hitTarget,
            source,
            event.amount,
            event.crit,
            burn,
            skill?.kind === 'active',
            skill?.name,
          ),
        );
      } else if (event.type === 'heal') {
        const hitTarget = this.unitById(event.target);
        if (!hitTarget) continue;
        this.after(delay, () => this.healUnit(hitTarget, event.amount));
        this.after(delay, () =>
          this.data.onFeed({
            kind: 'heal',
            source: this.unitName(event.source),
            target: this.unitName(event.target),
            skill: skill?.name,
            amount: event.amount,
          }),
        );
      } else if (event.type === 'shield') {
        const hitTarget = this.unitById(event.target);
        if (!hitTarget) continue;
        this.after(delay, () => this.shieldUnit(hitTarget, event.amount));
        this.after(delay, () =>
          this.data.onFeed({
            kind: 'shield',
            source: this.unitName(event.source),
            target: this.unitName(event.target),
            skill: skill?.name,
            amount: event.amount,
          }),
        );
      } else if (event.type === 'death') {
        const dead = this.unitById(event.unit);
        if (dead) this.after(delay, () => this.killUnit(dead));
      }
    }
    await new Promise<void>((resolve) => this.after(impact + recovery + offset + hitStop, resolve));
  }

  private lunge(source: BattleUnit, target: BattleUnit | undefined, impact: number): void {
    const view = this.unitViews.get(source.id);
    if (!view) return;
    const targetUnit = target ?? this.state.units.find((unit) => unit.side !== source.side && !unit.dead);
    const targetX = targetUnit ? this.center(targetUnit.id).x : this.layout.width / 2;
    const sourceX = this.center(source.id).x;
    view.cell.style.setProperty('--cast-color', ELEMENT_COLORS[source.element]);
    view.cell.classList.remove('toward-left', 'toward-right', 'casting');
    view.cell.classList.add(sourceX < targetX ? 'toward-right' : 'toward-left');
    view.cell.classList.add('attacking', 'casting');
    this.after(impact + Math.round(120 * this.motionScale), () => {
      view.cell.classList.remove('attacking', 'toward-left', 'toward-right', 'casting');
    });
  }

  /** A visible element streak from attacker to target; the cause is readable before the impact. */
  private strike(sourceId: string, targetId: string, color: string, travel: number): void {
    if (this.reducedMotion) return;
    const a = this.center(sourceId);
    const b = this.center(targetId);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.max(24, Math.hypot(dx, dy) - this.layout.cellW * 0.2);
    const line = el('span', 'strike');
    line.style.left = `${a.x}px`;
    line.style.top = `${a.y}px`;
    line.style.width = `${length}px`;
    line.style.color = color;
    line.style.setProperty('--angle', `${Math.atan2(dy, dx)}rad`);
    line.style.animationDuration = `${Math.max(90, travel)}ms`;
    this.fx.append(line);
    this.after(Math.max(90, travel) + 80, () => line.remove());
  }

  private hitUnit(
    target: BattleUnit,
    source: BattleUnit | undefined,
    amount: number,
    crit: boolean,
    burn: boolean,
    active: boolean,
    skillName: string | undefined,
  ): void {
    const view = this.unitViews.get(target.id);
    if (!view) return;
    this.updateCards();
    const color = ELEMENT_COLORS[target.element];
    view.cell.style.setProperty('--hit-color', color);
    view.cell.style.setProperty('--ring-color', crit ? 'var(--vd-gold)' : color);
    view.cell.classList.remove('hit', 'crit', 'flee-left', 'flee-right');
    void view.cell.offsetWidth;
    view.cell.classList.add('hit');
    if (crit) view.cell.classList.add('crit');
    const targetX = this.center(target.id).x;
    const sourceX = source ? this.center(source.id).x : targetX - 10;
    view.cell.classList.add(targetX < sourceX ? 'flee-left' : 'flee-right');
    this.showNumber(view, `${burn ? '' : '-'}${amount}`, burn ? 'burn' : crit ? 'crit' : 'damage');
    if (!burn) this.slash(view, color, crit);
    const sparks = crit
      ? this.speed >= 10
        ? 5
        : this.speed >= 5
          ? 7
          : 12
      : this.speed >= 10
        ? 3
        : this.speed >= 5
          ? 5
          : 9;
    this.sparks(view, color, sparks);
    if (!burn) {
      this.hitSound(crit, active);
      if (crit && !this.reducedMotion && this.speed <= 5) haptics.play('bump');
      if ((crit || active) && !this.reducedMotion && this.speed <= 5) this.shake();
    }
    this.after(Math.max(180, Math.round(650 * this.motionScale)), () => {
      view.cell.classList.remove('hit', 'crit', 'flee-left', 'flee-right');
    });
    if (source) {
      this.data.onFeed({
        kind: 'hit',
        source: source.name,
        target: target.name,
        skill: skillName,
        amount,
        crit,
      });
    }
  }

  private healUnit(target: BattleUnit, amount: number): void {
    const view = this.unitViews.get(target.id);
    if (!view) return;
    this.updateCards();
    view.cell.style.setProperty('--ring-color', '#8ed6a0');
    view.cell.classList.remove('healed');
    void view.cell.offsetWidth;
    view.cell.classList.add('healed');
    this.showNumber(view, `+${amount}`, 'heal');
    this.sparks(view, '#8ed6a0', this.speed >= 5 ? 5 : 8);
    this.after(Math.max(220, Math.round(520 * this.motionScale)), () => view.cell.classList.remove('healed'));
  }

  private shieldUnit(target: BattleUnit, amount: number): void {
    const view = this.unitViews.get(target.id);
    if (!view) return;
    view.cell.style.setProperty('--ring-color', '#8fc8ff');
    view.cell.classList.remove('shielded');
    void view.cell.offsetWidth;
    view.cell.classList.add('shielded');
    this.showNumber(view, `+${amount}`, 'shield');
    this.sparks(view, '#8fc8ff', this.speed >= 5 ? 4 : 6);
    this.after(Math.max(260, Math.round(820 * this.motionScale)), () =>
      view.cell.classList.remove('shielded'),
    );
  }

  private killUnit(target: BattleUnit): void {
    const view = this.unitViews.get(target.id);
    if (!view) return;
    this.updateCards();
    this.sparks(view, '#f2ead9', this.speed >= 5 ? 5 : 9);
    if (!this.reducedMotion) {
      sfx.play('drop');
      if (this.speed <= 5) haptics.play('tap');
    }
    this.data.onFeed({ kind: 'death', source: target.name, target: target.name });
  }

  private showBanner(name: string): void {
    this.banner.textContent = `CHIÊU · ${name.toUpperCase()}`;
    this.banner.classList.remove('go');
    void this.banner.offsetWidth;
    this.banner.classList.add('go');
  }

  private showNumber(view: UnitView, text: string, kind: ImpactKind): void {
    const node = this.numbers[this.numberCursor++ % this.numbers.length];
    if (!node) return;
    const point = this.center(view.cell.dataset.unit ?? '');
    node.className = `dmg ${kind}`;
    node.textContent = text;
    node.style.opacity = '';
    node.style.left = `${point.x + (Math.random() * 10 - 5)}px`;
    node.style.top = `${point.y - this.layout.cellH * 0.2}px`;
    node.style.animation = 'none';
    void node.offsetWidth;
    node.style.animation = '';
  }

  /** A bright slash across the target: the clearest single cue that a hit landed. */
  private slash(view: UnitView, color: string, crit: boolean): void {
    if (this.reducedMotion) return;
    const point = this.center(view.cell.dataset.unit ?? '');
    const angle = (crit ? -32 : -18) + Math.random() * 36;
    const slash = el('span', 'slash');
    slash.style.left = `${point.x}px`;
    slash.style.top = `${point.y}px`;
    slash.style.width = `${Math.round(this.layout.cellW * (crit ? 1.02 : 0.86))}px`;
    slash.style.color = color;
    slash.style.setProperty('--slash-angle', `${angle}deg`);
    slash.style.animationDuration = `${Math.max(100, Math.round(220 * this.motionScale))}ms`;
    this.fx.append(slash);
    this.after(Math.max(120, Math.round(260 * this.motionScale)), () => slash.remove());
  }

  private sparks(view: UnitView, color: string, count: number): void {
    if (this.reducedMotion) return;
    if (this.bursts.length >= 3) {
      const old = this.bursts.shift();
      old?.remove();
    }
    const point = this.center(view.cell.dataset.unit ?? '');
    const burst = el('span', 'burst');
    burst.style.left = `${point.x}px`;
    burst.style.top = `${point.y}px`;
    burst.style.color = color;
    for (let index = 0; index < count; index++) {
      const bit = el('i');
      const angle = Math.random() * Math.PI * 2;
      const distance = 14 + Math.random() * 26;
      bit.style.setProperty('--x', `${Math.cos(angle) * distance}px`);
      bit.style.setProperty('--y', `${Math.sin(angle) * distance}px`);
      bit.style.animationDelay = `${Math.random() * 40}ms`;
      burst.append(bit);
    }
    this.fx.append(burst);
    this.bursts.push(burst);
    this.after(Math.max(160, Math.round(600 * this.motionScale)), () => {
      burst.remove();
      const index = this.bursts.indexOf(burst);
      if (index >= 0) this.bursts.splice(index, 1);
    });
  }

  private projectile(sourceId: string, targetId: string, color: string): void {
    const a = this.center(sourceId);
    const b = this.center(targetId);
    const orb = el('span', 'orb');
    orb.style.left = `${a.x}px`;
    orb.style.top = `${a.y}px`;
    orb.style.background = color;
    orb.style.color = color;
    orb.style.setProperty('--dx', `${b.x - a.x}px`);
    orb.style.setProperty('--dy', `${b.y - a.y}px`);
    this.fx.append(orb);
    this.after(Math.max(140, Math.round(320 * this.motionScale)), () => orb.remove());
  }

  private shake(): void {
    this.root.classList.remove('shake');
    void this.root.offsetWidth;
    this.root.classList.add('shake');
    this.after(220, () => this.root.classList.remove('shake'));
  }

  private hitSound(crit: boolean, active: boolean): void {
    const now = performance.now();
    if (now - this.lastHitSound < 45) return;
    this.lastHitSound = now;
    sfx.play(active ? 'combo' : crit ? 'combo' : 'merge');
  }

  private clearEffects(): void {
    for (const node of this.numbers) {
      node.textContent = '';
      node.style.animation = 'none';
      node.style.opacity = '0';
    }
    for (const node of this.fx.querySelectorAll('.orb, .burst')) node.remove();
    this.bursts.length = 0;
    for (const cell of this.cells.values()) {
      cell.classList.remove(
        'dead',
        'hit',
        'crit',
        'healed',
        'shielded',
        'attacking',
        'toward-left',
        'toward-right',
        'flee-left',
        'flee-right',
        'active',
      );
    }
    this.banner.classList.remove('go');
    this.root.classList.remove('shake');
  }

  // MARK: taps and helpers

  private tap(cell: HTMLElement): void {
    const unitId = cell.dataset.unit;
    if (!unitId) return;
    const unit = this.unitById(unitId);
    if (unit) this.data.onCardTap(unit.defId, unit.side);
  }

  private unitById(id: string): BattleUnit | undefined {
    return this.state.units.find((unit) => unit.id === id);
  }

  private unitName(id: string): string {
    return this.unitById(id)?.name ?? '—';
  }

  /** Kept for the stage's optional manual tap path; auto normally handles every turn. */
  castPending(unitId: string): void {
    if (!this.state.pending || this.state.pending.unitId !== unitId) return;
    const actor = this.unitById(unitId);
    if (!actor) return;
    if (this.state.pending.activeReady) cast(this.state, RULES, unitId, actor.active);
    else basicAttack(this.state, RULES, unitId);
    this.updateCards();
  }

  /** The layout the board is using; exposed for tests and the stage's optional overlays. */
  get geometry(): HexLayout {
    return this.layout;
  }

  /** A centre by grid position, for callers that want to place an overlay on an empty cell. */
  cellCenter(column: number, row: number): HexCenter {
    return centerAt(this.layout, column, row);
  }
}
