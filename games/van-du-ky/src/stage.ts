// The play stage (ADR 0020): the board is the whole game. The Phaser scene draws the 6v6 cards; this file owns the
// shell's menu button, the battle controls, the dock and every run mode — the story road, the tower, the daily
// expedition, the world boss and the weekly challenge.
import { haptics, type PlayStage, type StageContext } from '@tohe/game-kit';
import { createGame } from '@tohe/game-kit/phaser';
import { persist, session, sfx, store, t } from './app.ts';
import { bossStage, challengeStage, expeditionStage, towerStage } from './content/events.ts';
import { regionNumber, STAGES } from './content/stages.ts';
import {
  dayIndex,
  dayKey,
  markExpedition,
  recordBossDamage,
  recordChallenge,
  towerClear,
  weekKey,
} from './core/daily.ts';
import { loadouts, nextStage, recordClear, resetDaily, resetWeekly } from './core/progression.ts';
import type { SaveData } from './core/save-types.ts';
import type { StageDef } from './core/types.ts';
import type { RunMode } from './ui/run-mode.ts';
import {
  closeSheets,
  openCodex,
  openDailySheet,
  openGearSheet,
  openHeroSheet,
  openMoreSheet,
  openOfflineCard,
  openStagePicker,
  openSummonSheet,
  openTeamSheet,
  type SheetHost,
} from './ui/sheets.ts';
import { BoardScene, type BoardSceneData, type BoardSummary } from './view.ts';

/** The stage the story resumes at: the next stage of the road, or the last one after the end. */
function storyStage(save: SaveData): StageDef {
  const candidate = STAGES.items.find(
    (stage) => stage.id === `${save.progress.region}-${save.progress.stage}`,
  );
  if (candidate) return candidate;
  return STAGES.items.find((stage) => stage.id === save.progress.highest) ?? (STAGES.items[0] as StageDef);
}

export async function start(ctx: StageContext): Promise<PlayStage> {
  const template = document.querySelector<HTMLTemplateElement>('#play-stage') as HTMLTemplateElement;
  ctx.root.append(template.content.cloneNode(true));
  const root = ctx.root.querySelector<HTMLElement>('#stage') as HTMLElement;

  // A new day and a new week reset the tasks, the boss and the challenge; a miss never wipes the journey.
  const normalized = resetWeekly(resetDaily(store.save, dayKey()), weekKey());
  if (normalized !== store.save) store.set(normalized);

  const top = document.createElement('div');
  top.className = 'battle-top';
  const menu = ctx.menuButton();
  menu.className = 'battle-menu';
  const label = document.createElement('span');
  label.className = 'battle-label';
  top.append(menu, label);
  root.append(top);

  let mode: RunMode = { kind: 'story' };
  let stage: StageDef = storyStage(store.save);

  const controls = document.createElement('div');
  controls.className = 'battle-controls';
  const auto = button('', () => {
    const on = !store.save.settings.autoCast;
    store.set({ ...store.save, settings: { ...store.save.settings, autoCast: on } });
    scene.setAutoCast(on);
    paint();
  });
  auto.className = 'battle-btn';
  const speed = button('×2', () => {
    const next = store.save.settings.speed === 1 ? 2 : store.save.settings.speed === 2 ? 3 : 1;
    store.set({ ...store.save, settings: { ...store.save.settings, speed: next } });
    scene.setSpeed(next);
    speed.textContent = `×${next}`;
  });
  speed.className = 'battle-btn';
  const stop = button(t.stop, () => {
    if (stop.dataset.on === '1') {
      scene.resumeAuto();
      stop.dataset.on = '0';
      stop.textContent = t.stop;
    } else {
      scene.stopAuto();
      stop.dataset.on = '1';
      stop.textContent = t.continue;
    }
  });
  stop.className = 'battle-btn';
  const upgrade = button(t.upgrade, () => openTeamSheet(sheetHost, (id) => openHeroSheet(sheetHost, id)));
  upgrade.className = 'battle-btn accent';
  controls.append(auto, speed, stop, upgrade);
  root.append(controls);

  const dock = document.createElement('nav');
  dock.className = 'battle-dock';
  const dockItems: readonly { icon: string; text: string; open: () => void }[] = [
    {
      icon: 'Đ',
      text: t.team,
      open: () => openTeamSheet(sheetHost, (id) => openHeroSheet(sheetHost, id)),
    },
    { icon: 'T', text: t.gear, open: () => openGearSheet(sheetHost) },
    { icon: 'S', text: t.summon, open: () => openSummonSheet(sheetHost) },
    { icon: 'S', text: t.codex, open: () => openCodex(sheetHost) },
    { icon: '⋯', text: t.more, open: () => openMoreSheet(sheetHost) },
  ];
  for (const item of dockItems) {
    const node = document.createElement('button');
    node.className = 'dock-item';
    node.innerHTML = `<span class="dock-icon">${item.icon}</span><span>${item.text}</span>`;
    node.addEventListener('click', item.open);
    dock.append(node);
  }
  root.append(dock);

  let scene!: BoardScene;
  let kit!: ReturnType<typeof createGame>;

  const sheetHost: SheetHost = {
    save: () => store.save,
    setSave: (next) => {
      store.set(next);
      void persist();
    },
    onTeamChanged: () => {
      paint();
      scene.restart(data());
    },
    startStory: (next) => startRun(next, { kind: 'story' }),
    startMode: (next) => startRun(modeStage(next), next),
    pause: () => kit.pause(),
    resume: () => kit.resume(),
  };

  const data = (): BoardSceneData => ({
    stage,
    label: modeLabel(mode),
    team: loadouts(store.save),
    companyLevel: store.save.company.level,
    autoCast: store.save.settings.autoCast,
    speed: store.save.settings.speed,
    reducedMotion: store.save.settings.reducedMotion,
    onEnd: (result, summary) => finish(result, summary),
  });

  const modeLabel = (current: RunMode) => {
    switch (current.kind) {
      case 'tower':
        return `${t.tower} · ${t.floor} ${current.floor}`;
      case 'expedition':
        return t.expedition;
      case 'boss':
        return t.boss;
      case 'challenge':
        return t.challenge;
      default:
        return t.stages;
    }
  };

  const paint = () => {
    const prefix =
      mode.kind === 'story'
        ? `${t.region} ${regionNumber(stage.id)} · ${t.stage(stage.id)}`
        : modeLabel(mode);
    label.textContent = `${prefix} · ${stage.waves.length} đợt`;
    auto.textContent = store.save.settings.autoCast ? t.autoCastOn : t.autoCastOff;
    auto.classList.toggle('on', store.save.settings.autoCast);
    speed.textContent = `×${store.save.settings.speed}`;
  };

  const startRun = (next: StageDef, nextMode: RunMode) => {
    ctx.overlay.hide();
    stage = next;
    mode = nextMode;
    paint();
    scene.restart(data());
  };

  const returnToStory = () => {
    ctx.overlay.hide();
    mode = { kind: 'story' };
    stage = storyStage(store.save);
    paint();
    scene.restart(data());
  };

  const retry = () => {
    ctx.overlay.hide();
    scene.restart(data());
  };

  function finish(result: 'win' | 'lose', summary: BoardSummary): void {
    if (mode.kind === 'story') {
      if (result === 'win') storyWin();
      else storyLose();
      return;
    }
    switch (mode.kind) {
      case 'tower':
        towerEnd(result, summary);
        return;
      case 'expedition':
        expeditionEnd(result);
        return;
      case 'boss':
        bossEnd(summary);
        return;
      case 'challenge':
        challengeEnd(result, summary);
        return;
      default:
        retry();
    }
  }

  function storyWin() {
    const before = store.save;
    const after = recordClear(before, stage, Date.now());
    store.set(after);
    sfx.play('levelUp');
    haptics.play('celebrate');
    const next = nextStage(stage);
    const gainedGold = after.currencies.gold - before.currencies.gold;
    const gainedShards = after.currencies.shards - before.currencies.shards;
    ctx.gameOver(
      {
        title: t.win,
        body: `${t.stage(stage.id)} · +${gainedGold} ${t.gold}${
          gainedShards > 0 ? ` · +${gainedShards} ${t.shards}` : ''
        } · ${t.company} ${after.company.level}`,
      },
      next
        ? {
            label: `${t.next} · ${t.stage(next.id)}`,
            icon: 'caret-right',
            onClick: () => startRun(next, { kind: 'story' }),
          }
        : { label: t.stages, icon: 'house', onClick: returnToStory },
      [
        {
          label: t.stages,
          icon: 'house',
          onClick: () => {
            ctx.overlay.hide();
            openStagePicker(sheetHost);
          },
        },
        {
          label: t.team,
          icon: 'users-three',
          onClick: () => {
            ctx.overlay.hide();
            openTeamSheet(sheetHost, (id) => openHeroSheet(sheetHost, id));
          },
        },
      ],
    );
  }

  function storyLose() {
    sfx.play('error');
    haptics.play('error');
    ctx.gameOver(
      { title: t.lose, body: 'Đổi đội hình hoặc nâng gear rồi thử lại.' },
      { label: t.retry, icon: 'arrow-counter-clockwise', onClick: retry },
      [
        {
          label: 'Đổi đội hình',
          icon: 'users-three',
          onClick: () => {
            ctx.overlay.hide();
            openTeamSheet(sheetHost, (id) => openHeroSheet(sheetHost, id));
          },
        },
        {
          label: t.stages,
          icon: 'house',
          onClick: () => {
            ctx.overlay.hide();
            openStagePicker(sheetHost);
          },
        },
      ],
    );
  }

  function towerEnd(result: 'win' | 'lose', summary: BoardSummary) {
    if (mode.kind !== 'tower') return retry();
    const floor = mode.floor;
    if (result === 'lose') {
      ctx.gameOver(
        { title: `${t.tower} · ${t.floor} ${floor}`, body: `Đội đã dừng ở tầng ${floor}.` },
        { label: t.retry, icon: 'arrow-counter-clockwise', onClick: retry },
        [{ label: t.stages, icon: 'house', onClick: returnToStory }],
      );
      return;
    }
    const before = store.save;
    const after = towerClear(before, floor);
    store.set(after);
    sfx.play('levelUp');
    const nextFloor = floor + 1;
    ctx.gameOver(
      {
        title: `${t.floor} ${floor} đã qua`,
        body: `+${after.currencies.gold - before.currencies.gold} ${t.gold} · +${
          after.currencies.shards - before.currencies.shards
        } ${t.shards} · ${summary.rounds} lượt`,
      },
      nextFloor <= 40
        ? {
            label: `${t.floor} ${nextFloor}`,
            icon: 'caret-right',
            onClick: () => startRun(towerStage(nextFloor), { kind: 'tower', floor: nextFloor }),
          }
        : { label: t.stages, icon: 'house', onClick: returnToStory },
      [{ label: t.stages, icon: 'house', onClick: returnToStory }],
    );
  }

  function expeditionEnd(result: 'win' | 'lose') {
    if (result === 'lose') {
      ctx.gameOver(
        { title: t.expedition, body: 'Chuyến đi chưa xong — thử lại khi đội khỏe hơn.' },
        { label: t.retry, icon: 'arrow-counter-clockwise', onClick: retry },
        [{ label: t.stages, icon: 'house', onClick: returnToStory }],
      );
      return;
    }
    const before = store.save;
    let after: SaveData;
    try {
      after = markExpedition(before);
      store.set(after);
    } catch {
      after = before;
    }
    sfx.play('levelUp');
    ctx.gameOver(
      {
        title: t.expedition,
        body: `+${after.currencies.gold - before.currencies.gold} ${t.gold} · +${
          after.currencies.essence - before.currencies.essence
        } ${t.essence} · +${after.currencies.shards - before.currencies.shards} ${t.shards}`,
      },
      { label: t.stages, icon: 'house', onClick: returnToStory },
    );
  }

  function bossEnd(summary: BoardSummary) {
    const before = store.save;
    const after = recordBossDamage(before, summary.damage);
    store.set(after);
    sfx.play('fanfare');
    ctx.gameOver(
      {
        title: t.boss,
        body: `Sát thương ${Math.round(summary.damage).toLocaleString('vi-VN')} · tốt nhất tuần ${after.weekly.bossDamage.toLocaleString('vi-VN')} · ${summary.rounds} lượt`,
      },
      { label: t.retry, icon: 'arrow-counter-clockwise', onClick: retry },
      [
        { label: t.stages, icon: 'house', onClick: returnToStory },
        {
          label: t.claim,
          icon: 'caret-right',
          onClick: () => {
            ctx.overlay.hide();
            openDailySheet(sheetHost);
          },
        },
      ],
    );
  }

  function challengeEnd(result: 'win' | 'lose', summary: BoardSummary) {
    if (result === 'lose') {
      ctx.gameOver(
        {
          title: t.challenge,
          body: `Đội dừng sau ${summary.rounds} lượt. Giảm cấp quái bằng cách luyện thêm.`,
        },
        { label: t.retry, icon: 'arrow-counter-clockwise', onClick: retry },
        [{ label: t.stages, icon: 'house', onClick: returnToStory }],
      );
      return;
    }
    const after = recordChallenge(store.save, summary.rounds);
    store.set(after);
    sfx.play('levelUp');
    ctx.gameOver(
      {
        title: t.challenge,
        body: `${summary.rounds} lượt · tốt nhất tuần ${after.weekly.challengeRounds} · nhận thưởng ở ${t.daily}`,
      },
      { label: t.retry, icon: 'arrow-counter-clockwise', onClick: retry },
      [
        { label: t.stages, icon: 'house', onClick: returnToStory },
        {
          label: t.daily,
          icon: 'caret-right',
          onClick: () => {
            ctx.overlay.hide();
            openDailySheet(sheetHost);
          },
        },
      ],
    );
  }

  function modeStage(next: RunMode): StageDef {
    const save = store.save;
    switch (next.kind) {
      case 'tower':
        return towerStage(next.floor);
      case 'expedition':
        return expeditionStage(dayIndex(), save.company.level);
      case 'boss':
        return bossStage(weekKey(), save.company.level);
      case 'challenge':
        return challengeStage(weekKey(), save.company.level);
      default:
        return storyStage(save);
    }
  }

  kit = createGame({
    parent: root,
    background: '#171614',
    createScene: () => {
      scene = new BoardScene(data());
      return scene;
    },
  });

  paint();
  ctx.ready();
  openOfflineCard(sheetHost);
  session.telemetry.count('stage.open');

  return {
    pause: () => kit.pause(),
    resume: () => kit.resume(),
    newGame: () => scene.restart(data()),
    leave: async () => {
      await persist();
      closeSheets();
      kit.destroy();
    },
    quick: () => [],
  };
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement('button');
  element.textContent = label;
  element.addEventListener('click', onClick);
  return element;
}
