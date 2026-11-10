import { describe, expect, it } from 'vitest';
import {
  bossReward,
  claimBossReward,
  claimChallengeReward,
  claimDailyTask,
  claimJourney,
  DAILY_TASKS,
  dailyReady,
  dayKey,
  expeditionReward,
  journeyReady,
  journeyReward,
  markExpedition,
  recordBossDamage,
  recordChallenge,
  taskReady,
  towerClear,
  weekKey,
} from './daily.ts';
import { emptySave } from './save.ts';

describe('day and week keys', () => {
  it('writes a local date and the Monday of its week', () => {
    expect(dayKey(new Date(2026, 10, 9))).toBe('2026-11-09');
    expect(weekKey(new Date(2026, 10, 9))).toBe('2026-11-09');
    expect(weekKey(new Date(2026, 10, 15))).toBe('2026-11-09');
  });
});

describe('daily tasks', () => {
  it('offers three tasks and pays each once when its counter reaches the target', () => {
    expect(DAILY_TASKS).toHaveLength(3);
    const task = DAILY_TASKS[0]!;
    const save = { ...emptySave(), daily: { ...emptySave().daily, stages: 3 } };
    expect(taskReady(save, task)).toBe(true);
    const claimed = claimDailyTask(save, task.id);
    expect(claimed.daily.tasks).toContain(task.id);
    expect(claimed.currencies.gold).toBe(task.reward.gold);
    expect(() => claimDailyTask(claimed, task.id)).toThrow('already');
  });

  it('refuses a task that is not finished', () => {
    expect(() => claimDailyTask(emptySave(), DAILY_TASKS[0]!.id)).toThrow('not finished');
  });
});

describe('tower', () => {
  it('pays the next floor once, advances and records the best', () => {
    const first = towerClear(emptySave(), 1);
    expect(first.progress.tower).toBe(2);
    expect(first.progress.records.tower).toBe(1);
    expect(first.currencies.gold).toBeGreaterThan(0);
    const replay = towerClear(first, 1);
    expect(replay.currencies.gold).toBe(first.currencies.gold);
    expect(replay.progress.tower).toBe(2);
  });

  it('stops at floor 40', () => {
    const save = {
      ...emptySave(),
      progress: { ...emptySave().progress, tower: 40 },
    };
    const done = towerClear(save, 40);
    expect(done.progress.tower).toBe(41);
    expect(done.progress.records.tower).toBe(40);
  });
});

describe('expedition', () => {
  it('pays once a day and scales with the company', () => {
    const done = markExpedition(emptySave());
    expect(done.daily.expedition).toBe(true);
    expect(done.currencies.gold).toBe(expeditionReward(1).gold);
    expect(() => markExpedition(done)).toThrow('already');
  });
});

describe('world boss', () => {
  it('keeps the week and all-time bests and pays once', () => {
    const hit = recordBossDamage(emptySave(), 12_000);
    expect(hit.weekly.bossDamage).toBe(12_000);
    expect(hit.progress.records.bossDamage).toBe(12_000);
    const lower = recordBossDamage(hit, 500);
    expect(lower.weekly.bossDamage).toBe(12_000);
    const paid = claimBossReward(lower);
    expect(paid.weekly.bossClaimed).toBe(true);
    expect(paid.currencies.shards).toBe(160);
    expect(bossReward(12_000).shards).toBe(60);
    expect(() => claimBossReward(paid)).toThrow('already');
  });
});

describe('weekly challenge', () => {
  it('keeps the fewest rounds and pays once', () => {
    const first = recordChallenge(emptySave(), 6);
    const better = recordChallenge(first, 4);
    expect(better.weekly.challengeRounds).toBe(4);
    const paid = claimChallengeReward(better);
    expect(paid.weekly.challengeClaimed).toBe(true);
    expect(paid.currencies.shards).toBe(200);
    expect(() => claimChallengeReward(paid)).toThrow('already');
  });

  it('refuses a claim before a clear', () => {
    expect(() => claimChallengeReward(emptySave())).toThrow('not cleared');
  });
});

describe('Khởi Hành journey', () => {
  it('pays one day at a time and finishes after seven', () => {
    let save = emptySave();
    for (let day = 1; day <= 7; day++) {
      expect(journeyReady(save, '2026-11-09')).toBe(true);
      save = claimJourney(save, '2026-11-09');
      expect(save.currencies.shards).toBe(
        100 + Array.from({ length: day }, (_, i) => journeyReward(i + 1).shards).reduce((a, b) => a + b, 0),
      );
      if (day < 7) expect(() => claimJourney(save, '2026-11-09')).toThrow('already');
      save = { ...save, daily: { ...save.daily, journeyDate: '' } };
    }
    expect(save.daily.journeyDay).toBe(8);
    expect(journeyReady(save, '2026-11-10')).toBe(false);
    expect(() => claimJourney(save, '2026-11-10')).toThrow('finished');
  });
});

describe('daily ready dot', () => {
  it('is on for a stale day and off when nothing is waiting', () => {
    const today = '2026-11-10';
    const week = '2026-11-09';
    expect(dailyReady(emptySave(), today, week)).toBe(true);
    const quiet = {
      ...emptySave(),
      daily: {
        ...emptySave().daily,
        date: today,
        expedition: true,
        journeyDay: 8,
        journeyDate: today,
      },
      weekly: {
        ...emptySave().weekly,
        week,
        bossClaimed: true,
        challengeClaimed: true,
      },
    };
    expect(dailyReady(quiet, today, week)).toBe(false);
    const task = { ...quiet, daily: { ...quiet.daily, stages: 3 } };
    expect(dailyReady(task, today, week)).toBe(true);
  });
});
