import { addCurrency, cloneSave } from './progression.ts';
import type { SaveData } from './save-types.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The local date, `YYYY-MM-DD`. */
export function dayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** The Monday of the local week, `YYYY-MM-DD`. */
export function weekKey(date = new Date()): string {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  return dayKey(copy);
}

/** Days since the Unix epoch in local time; a stable seed for a rotating dungeon. */
export function dayIndex(date = new Date()): number {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return Math.floor(copy.getTime() / DAY_MS);
}

export interface DailyTask {
  readonly id: string;
  readonly title: string;
  readonly counter: 'stages' | 'upgrades' | 'summons';
  readonly target: number;
  readonly reward: { readonly gold: number; readonly essence: number; readonly shards: number };
}

export const DAILY_TASKS: readonly DailyTask[] = [
  {
    id: 'clear-3',
    title: 'Thắng 3 màn',
    counter: 'stages',
    target: 3,
    reward: { gold: 150, essence: 0, shards: 40 },
  },
  {
    id: 'upgrade-1',
    title: 'Nâng 1 trang bị',
    counter: 'upgrades',
    target: 1,
    reward: { gold: 0, essence: 40, shards: 20 },
  },
  {
    id: 'summon-1',
    title: 'Triệu hồi 1 lần',
    counter: 'summons',
    target: 1,
    reward: { gold: 100, essence: 0, shards: 30 },
  },
];

export function taskProgress(save: SaveData, task: DailyTask): number {
  return Math.min(task.target, save.daily[task.counter]);
}

export function taskReady(save: SaveData, task: DailyTask): boolean {
  return !save.daily.tasks.includes(task.id) && save.daily[task.counter] >= task.target;
}

export function claimDailyTask(save: SaveData, taskId: string): SaveData {
  const task = DAILY_TASKS.find((candidate) => candidate.id === taskId);
  if (!task) throw new Error(`daily: no task "${taskId}"`);
  if (save.daily.tasks.includes(task.id)) throw new Error('daily: already claimed today');
  if (save.daily[task.counter] < task.target) throw new Error('daily: not finished yet');
  const next = addCurrency(cloneSave(save), task.reward);
  return { ...next, daily: { ...next.daily, tasks: [...next.daily.tasks, task.id].slice(0, 3) } };
}

/** Tower rewards; only the next floor pays, so a replay is practice. */
export function towerClear(save: SaveData, floor: number): SaveData {
  const next = cloneSave(save);
  const advanced = floor === next.progress.tower && floor <= 40;
  const tower = advanced ? Math.min(41, next.progress.tower + 1) : next.progress.tower;
  const paid = advanced
    ? addCurrency(next, {
        gold: 120 + floor * 30,
        essence: 10 + floor * 3,
        shards: 4 + Math.floor(floor / 4),
      })
    : next;
  return {
    ...paid,
    progress: {
      ...paid.progress,
      tower,
      records: { ...paid.progress.records, tower: Math.max(paid.progress.records.tower, floor) },
    },
  };
}

/** The daily expedition pays once; the reward grows with the company. */
export function expeditionReward(companyLevel: number): {
  gold: number;
  essence: number;
  shards: number;
} {
  return {
    gold: 500 + companyLevel * 50,
    essence: 50 + companyLevel * 5,
    shards: 25,
  };
}

export function markExpedition(save: SaveData): SaveData {
  if (save.daily.expedition) throw new Error('expedition: already done today');
  const next = addCurrency(cloneSave(save), expeditionReward(save.company.level));
  return { ...next, daily: { ...next.daily, expedition: true } };
}

/** Record the best damage a week's world boss took; the all-time record stays too. */
export function recordBossDamage(save: SaveData, damage: number): SaveData {
  const dealt = Math.max(0, Math.floor(damage));
  const next = cloneSave(save);
  return {
    ...next,
    weekly: { ...next.weekly, bossDamage: Math.max(next.weekly.bossDamage, dealt) },
    progress: {
      ...next.progress,
      records: {
        ...next.progress.records,
        bossDamage: Math.max(next.progress.records.bossDamage, dealt),
      },
    },
  };
}

/** Participation pay for the week's boss, once, scaled by the best hit. */
export function bossReward(damage: number): { gold: number; essence: number; shards: number } {
  return {
    gold: 200,
    essence: 0,
    shards: damage >= 20_000 ? 100 : damage >= 8_000 ? 60 : 30,
  };
}

export function claimBossReward(save: SaveData): SaveData {
  if (save.weekly.bossClaimed) throw new Error('boss: already claimed this week');
  const next = addCurrency(cloneSave(save), bossReward(save.weekly.bossDamage));
  return { ...next, weekly: { ...next.weekly, bossClaimed: true } };
}

/** The weekly challenge records the fewest rounds; 0 is not cleared. */
export function recordChallenge(save: SaveData, rounds: number): SaveData {
  const value = Math.max(1, Math.floor(rounds));
  const next = cloneSave(save);
  const best = next.weekly.challengeRounds;
  return {
    ...next,
    weekly: { ...next.weekly, challengeRounds: best === 0 ? value : Math.min(best, value) },
  };
}

export function challengeReward(): { gold: number; essence: number; shards: number } {
  return { gold: 500, essence: 100, shards: 100 };
}

export function claimChallengeReward(save: SaveData): SaveData {
  if (save.weekly.challengeRounds <= 0) throw new Error('challenge: not cleared this week');
  if (save.weekly.challengeClaimed) throw new Error('challenge: already claimed this week');
  const next = addCurrency(cloneSave(save), challengeReward());
  return { ...next, weekly: { ...next.weekly, challengeClaimed: true } };
}

/** Khởi Hành: seven days of rewards; a missed day waits, it never resets. */
export const JOURNEY_DAYS = 7;

export function journeyReward(day: number): { gold: number; essence: number; shards: number } {
  return {
    gold: 200 + day * 100,
    essence: 20 + day * 10,
    shards: 20 + day * 5,
  };
}

export function journeyReady(save: SaveData, today = dayKey()): boolean {
  return save.daily.journeyDay <= JOURNEY_DAYS && save.daily.journeyDate !== today;
}

export function claimJourney(save: SaveData, today = dayKey()): SaveData {
  if (save.daily.journeyDay > JOURNEY_DAYS) throw new Error('journey: finished');
  if (save.daily.journeyDate === today) throw new Error('journey: already claimed today');
  const next = addCurrency(cloneSave(save), journeyReward(save.daily.journeyDay));
  return {
    ...next,
    daily: {
      ...next.daily,
      journeyDay: Math.min(JOURNEY_DAYS + 1, next.daily.journeyDay + 1),
      journeyDate: today,
    },
  };
}
