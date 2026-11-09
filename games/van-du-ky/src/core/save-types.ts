/** The JSON the hub stores for Vân Du Ký. Every field is plain JSON; the game owns migrations. */

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
  readonly column: 0 | 1;
}

export interface SaveRecords {
  readonly bestStage: string;
  readonly tower: number;
  readonly bossDamage: number;
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
  readonly daily: {
    readonly date: string;
    readonly tasks: string[];
    readonly expedition: boolean;
    readonly boss: boolean;
    readonly journeyDay: number;
  };
  readonly summon: { readonly pityRare: number; readonly pityEpic: number; readonly lastFree: string | null };
  readonly settings: {
    readonly autoCast: boolean;
    readonly speed: 1 | 2 | 3;
    readonly reducedMotion: boolean;
  };
  readonly offline: { readonly at: number; readonly stage: string };
  readonly tutorial: { readonly seen: boolean };
}
