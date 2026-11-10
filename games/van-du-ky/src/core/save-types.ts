/** The JSON the hub stores for Vân Du Ký. Every field is plain JSON; the game owns migrations. */

import type { Speed } from './types.ts';

export type SaveSlot = 'weapon' | 'armor' | 'charm' | 'relic';

export interface SaveGear {
  readonly defId: string;
  readonly plus: number;
}

export interface SaveHero {
  readonly star: number;
  readonly shards: number;
  readonly gear: Partial<Record<SaveSlot, string>>;
}

export interface SaveFormation {
  readonly heroId: string;
  readonly row: 0 | 1 | 2;
  readonly column: 0 | 1 | 2 | 3;
}

export interface SaveRecords {
  readonly bestStage: string;
  readonly tower: number;
  readonly bossDamage: number;
}

export interface SaveDaily {
  /** The local date this block belongs to (`YYYY-MM-DD`). */
  readonly date: string;
  /** Stages cleared today. */
  readonly stages: number;
  /** Gear pieces upgraded today. */
  readonly upgrades: number;
  /** Summons made today. */
  readonly summons: number;
  /** Claimed task ids. */
  readonly tasks: string[];
  readonly expedition: boolean;
  /** The 7-day Khởi Hành journey, 1–7, and the last day claimed. */
  readonly journeyDay: number;
  readonly journeyDate: string;
}

export interface SaveWeekly {
  /** The Monday of the week this block belongs to (`YYYY-MM-DD`). */
  readonly week: string;
  readonly bossDamage: number;
  readonly bossClaimed: boolean;
  /** Fewest rounds a weekly challenge was cleared in; 0 means not cleared. */
  readonly challengeRounds: number;
  readonly challengeClaimed: boolean;
}

export interface SaveData {
  readonly v: number;
  readonly company: { readonly level: number; readonly xp: number };
  readonly currencies: { readonly gold: number; readonly essence: number; readonly shards: number };
  readonly roster: Record<string, SaveHero>;
  readonly gear: Record<string, SaveGear>;
  readonly formation: readonly SaveFormation[];
  readonly progress: {
    readonly region: number;
    readonly stage: number;
    readonly highest: string;
    readonly tower: number;
    readonly records: SaveRecords;
  };
  /** Stages whose first-clear bonus has been taken. */
  readonly cleared: string[];
  readonly daily: SaveDaily;
  readonly weekly: SaveWeekly;
  readonly summon: { readonly pityRare: number; readonly pityEpic: number; readonly lastFree: string | null };
  readonly settings: {
    readonly autoCast: boolean;
    readonly speed: Speed;
    readonly reducedMotion: boolean;
    /** Set by v1.1.1+; absent on older saves, which resets the old ×2 to the readable ×1 once. */
    readonly speedV2?: boolean;
  };
  readonly offline: { readonly at: number; readonly stage: string };
  readonly tutorial: { readonly seen: boolean };
}
