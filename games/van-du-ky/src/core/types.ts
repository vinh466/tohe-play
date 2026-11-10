// The pure rules of Vân Du Ký. Nothing here knows Phaser, the DOM, the hub or the wall clock: the view and the
// balance simulation both call these functions, so a battle is the same on a phone and in a test.

export const ELEMENTS = ['ember', 'tide', 'stone', 'gale'] as const;
export type Element = (typeof ELEMENTS)[number];

export const ROLES = ['vanguard', 'blade', 'seer', 'binder'] as const;
export type Role = (typeof ROLES)[number];

export const RARITIES = ['common', 'rare', 'epic'] as const;
export type Rarity = (typeof RARITIES)[number];

/** Rows: 0 front, 1 mid, 2 back. Columns: 0 left, 1 right. */
export type Row = 0 | 1 | 2;
export type Column = 0 | 1;

export interface Stats {
  readonly hp: number;
  readonly atk: number;
  readonly def: number;
  readonly spd: number;
  /** Critical chance, 0…1. */
  readonly crit: number;
}

export type SkillEffect =
  | 'damage'
  | 'heal'
  | 'shield'
  | 'stun'
  | 'buff-atk'
  | 'buff-def'
  | 'buff-spd'
  | 'burn';

export type SkillTarget =
  | 'enemy-lowest'
  | 'enemy-front'
  | 'enemy-back'
  | 'enemy-all'
  | 'ally-lowest'
  | 'ally-all'
  | 'self';

export interface SkillDef {
  readonly id: string;
  readonly name: string;
  readonly kind: 'basic' | 'active' | 'passive';
  readonly target: SkillTarget;
  /** Damage/heal multiplier of the attacker's ATK. */
  readonly power: number;
  /** Turns of charge before an active is ready; 0 for a basic. */
  readonly charge: number;
  readonly effect: SkillEffect;
  /** For a buff: share of the base stat added; for a shield: share of the caster's max HP; for a burn: share of ATK. */
  readonly value?: number;
  /** Turns a status lasts. */
  readonly duration?: number;
  readonly element?: Element;
}

export interface GearDef {
  readonly id: string;
  readonly name: string;
  readonly slot: 'weapon' | 'armor' | 'charm' | 'relic';
  readonly set: string;
  readonly rarity: Rarity;
  /** The main stat and how much it adds before the + level. */
  readonly stat: keyof Stats;
  readonly value: number;
}

export interface PassiveDef {
  readonly stat: keyof Stats;
  readonly value: number;
  /** The star that unlocks it. */
  readonly star: number;
}

export interface HeroDef {
  readonly id: string;
  readonly name: string;
  readonly role: Role;
  readonly element: Element;
  readonly rarity: Rarity;
  readonly base: Stats;
  readonly basic: string;
  readonly active: string;
  readonly passive: PassiveDef;
  readonly bond: string;
  /** One line of the codex that tells who they are. */
  readonly blurb?: string;
}

export interface EnemyDef {
  readonly id: string;
  readonly name: string;
  readonly role: Role;
  readonly element: Element;
  readonly base: Stats;
  readonly basic: string;
  readonly active: string;
  readonly boss?: boolean;
  readonly immuneControl?: boolean;
  readonly blurb?: string;
}

export interface StageEnemy {
  readonly enemyId: string;
  readonly row: Row;
  readonly column: Column;
  readonly level: number;
}

export interface WaveDef {
  readonly enemies: readonly StageEnemy[];
  readonly elite?: boolean;
  readonly boss?: boolean;
}

export interface StageDef {
  readonly id: string;
  readonly region: string;
  readonly index: number;
  readonly waves: readonly WaveDef[];
  readonly recommendedPower: number;
  /** The round cap for this stage; 30 by default, 40 for a boss. */
  readonly rounds?: number;
  readonly elite?: boolean;
  readonly boss?: boolean;
  readonly firstClear: { readonly gold: number; readonly essence: number; readonly shards: number };
  readonly loot: {
    readonly gold: number;
    readonly essence: number;
    readonly shardChance: number;
    readonly gear?: string;
  };
  readonly modifiers?: readonly string[];
}

export interface RegionDef {
  readonly id: string;
  readonly name: string;
  readonly blurb?: string;
  readonly palette: readonly string[];
}

export interface HeroLoadout {
  readonly heroId: string;
  readonly row: Row;
  readonly column: Column;
  readonly star: number;
  readonly gear: readonly string[];
  /** The `+` level of each gear piece, in the same order as `gear`; absent means +0. */
  readonly plus?: readonly number[];
  /** Current HP when a stage carries it between waves; absent means full. */
  readonly hp?: number;
}

export interface BattleEnemyLoadout {
  readonly enemyId: string;
  readonly row: Row;
  readonly column: Column;
  readonly level: number;
}

/** One resolved hit, heal or status, for the view and the tests. */
export type BattleEvent =
  | {
      readonly type: 'damage';
      readonly source: string;
      readonly target: string;
      readonly amount: number;
      readonly crit: boolean;
      readonly element: number;
    }
  | { readonly type: 'heal'; readonly source: string; readonly target: string; readonly amount: number }
  | { readonly type: 'shield'; readonly source: string; readonly target: string; readonly amount: number }
  | { readonly type: 'status'; readonly source: string; readonly target: string; readonly status: string }
  | { readonly type: 'death'; readonly unit: string }
  | { readonly type: 'round'; readonly round: number }
  | { readonly type: 'wave'; readonly wave: number; readonly result: 'win' | 'lose' }
  | { readonly type: 'turn'; readonly unit: string; readonly skill: string };

export interface Status {
  readonly kind: 'stun' | 'burn' | 'buff-atk' | 'buff-def' | 'buff-spd';
  readonly value: number;
  remaining: number;
}

export interface BattleUnit {
  readonly id: string;
  readonly side: 'hero' | 'enemy';
  readonly defId: string;
  readonly name: string;
  readonly role: Role;
  readonly element: Element;
  readonly row: Row;
  readonly column: Column;
  readonly base: Stats;
  hp: number;
  maxHp: number;
  shield: number;
  charge: number;
  /** Turns of basic attacks the active needs; copied from the skill so the turn loop needs no rules for it. */
  readonly activeCharge: number;
  readonly basic: string;
  readonly active: string;
  readonly immuneControl: boolean;
  readonly statuses: Status[];
  dead: boolean;
}

export interface PendingTurn {
  readonly unitId: string;
  readonly activeReady: boolean;
}

export type BattleResult = 'ongoing' | 'win' | 'lose';

export interface BattleState {
  readonly seed: number;
  readonly rng: Rng;
  round: number;
  readonly maxRounds: number;
  /** The order of this round's actors, by SPD; stale entries are skipped when dead. */
  order: string[];
  turn: number;
  readonly units: BattleUnit[];
  pending: PendingTurn | null;
  autoCast: boolean;
  result: BattleResult;
  readonly events: BattleEvent[];
}

export interface Rng {
  /** The next integer in [0, 2^32). */
  next(): number;
  /** A float in [0, 1). */
  float(): number;
  /** An integer in [0, max). */
  int(max: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
}

export type Phase = 'idle' | 'pending' | 'ongoing' | 'win' | 'lose';
