// The play stage (ADR 0020): the board is the whole game. The stage is a column — HUD, board canvas, controls, dock —
// so the HUD can never cover a card. The Phaser scene draws the 6v6 cards; this file owns the shell's menu button, the
// bars, the number layer and every run mode (story, tower, expedition, world boss, weekly challenge).
import { haptics, icon as kitIcon, type PlayStage, type StageContext } from '@tohe/game-kit';
import { createGame } from '@tohe/game-kit/phaser';
import { persist, session, sfx, store, t } from './app.ts';
import { bossStage, challengeStage, expeditionStage, towerStage } from './content/events.ts';
import { REGIONS, regionNumber, STAGES } from './content/stages.ts';
import {
  dailyReady,
  dayIndex,
  dayKey,
  markExpedition,
  recordBossDamage,
  recordChallenge,
  towerClear,
  weekKey,
} from './core/daily.ts';
import {
  hasAffordableUpgrade,
  loadouts,
  nextStage,
  recordClear,
  resetDaily,
  resetWeekly,
} from './core/progression.ts';
import type { SaveData } from './core/save-types.ts';
import type { StageDef } from './core/types.ts';
import type { RunMode } from './ui/run-mode.ts';
import {
  closeSheets,
  openCodex,
  openDailySheet,
  openGearSheet,
  openHeroSheet,
  openOfflineCard,
  openStagePicker,
  openSummonSheet,
  openTeamSheet,
  type SheetHost,
} from './ui/sheets.ts';
import { BoardScene, type BoardSceneData, type BoardSummary, type Impact, type TurnToken } from './view.ts';

/** The stage the story resumes at: the next stage of the road, or the last one after the end. */
function storyStage(save: SaveData): StageDef {
  const candidate = STAGES.items.find(
    (stage) => stage.id === `${save.progress.region}-${save.progress.stage}`,
  );
  if (candidate) return candidate;
  return STAGES.items.find((stage) => stage.id === save.progress.highest) ?? (STAGES.items[0] as StageDef);
}

function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.0', '')}m`;
  if (value >= 10_000) return `${Math.round(value / 1000)}k`;
  return value.toLocaleString('vi-VN');
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

function resourceIcon(kind: 'gold' | 'essence'): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'res-icon');
  svg.setAttribute('aria-hidden', 'true');
  if (kind === 'gold') {
    const outer = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    outer.setAttribute('cx', '12');
    outer.setAttribute('cy', '12');
    outer.setAttribute('r', '7');
    outer.setAttribute('fill', 'none');
    outer.setAttribute('stroke', 'currentColor');
    outer.setAttribute('stroke-width', '2');
    const inner = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    inner.setAttribute('cx', '12');
    inner.setAttribute('cy', '12');
    inner.setAttribute('r', '2.5');
    inner.setAttribute('fill', 'currentColor');
    svg.append(outer, inner);
  } else {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12 3l5 7-5 11-5-11z');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linejoin', 'round');
    svg.append(path);
  }
  return svg;
}

export async function start(ctx: StageContext): Promise<PlayStage> {
  const template = document.querySelector<HTMLTemplateElement>('#play-stage') as HTMLTemplateElement;
  ctx.root.append(template.content.cloneNode(true));
  const root = ctx.root.querySelector<HTMLElement>('#stage') as HTMLElement;

  const normalized = resetWeekly(resetDaily(store.save, dayKey()), weekKey());
  if (normalized !== store.save) store.set(normalized);

  let mode: RunMode = { kind: 'story' };
  let stage: StageDef = storyStage(store.save);
  let stopped = false;
  let scene!: BoardScene;
  let kit!: ReturnType<typeof createGame>;

  // MARK: HUD

  const hud = el('header', 'battle-hud');
  const hudMain = el('div', 'hud-main');
  const menu = ctx.menuButton();
  menu.classList.add('hud-menu');
  const stageButton = el('button', 'hud-stage');
  stageButton.type = 'button';
  const regionLine = el('span', 'hud-region');
  const stageLine = el('strong', 'hud-stage-name');
  const chevron = el('span', 'hud-chevron', '›');
  stageButton.append(regionLine, stageLine, chevron);
  stageButton.addEventListener('click', () => openStagePicker(sheetHost));

  const resources = el('div', 'hud-res');
  const goldChip = el('button', 'res-chip');
  goldChip.type = 'button';
  goldChip.append(resourceIcon('gold'), el('span', 'res-value'));
  const essenceChip = el('button', 'res-chip');
  essenceChip.type = 'button';
  essenceChip.append(resourceIcon('essence'), el('span', 'res-value'));
  const goldValue = goldChip.querySelector('.res-value') as HTMLElement;
  const essenceValue = essenceChip.querySelector('.res-value') as HTMLElement;
  goldChip.addEventListener('click', () => openGearSheet(sheetHost));
  essenceChip.addEventListener('click', () => openTeamSheet(sheetHost, (id) => openHeroSheet(sheetHost, id)));
  resources.append(goldChip, essenceChip);
  hudMain.append(menu, stageButton, resources);

  const turnRow = el('div', 'hud-turn');
  const turnLabel = el('span', 'hud-turn-label', 'LƯỢT');
  const turnList = el('div', 'turn-rail');
  const waveLabel = el('span', 'hud-wave');
  turnRow.append(turnLabel, turnList, waveLabel);
  const progress = el('div', 'hud-progress');
  const progressFill = el('i');
  progress.append(progressFill);
  hud.append(hudMain, turnRow, progress);
  root.append(hud);

  const turnChips: HTMLElement[] = [];
  for (let index = 0; index < 6; index++) {
    const chip = el('div', 'turn-chip');
    chip.hidden = true;
    const image = el('img');
    image.alt = '';
    image.draggable = false;
    chip.append(image);
    turnList.append(chip);
    turnChips.push(chip);
  }

  // MARK: board and effect layer

  const board = el('div', 'battle-board');
  root.append(board);
  const fx = el('div', 'battle-fx');
  board.append(fx);
  const fxPool: HTMLDivElement[] = [];
  for (let index = 0; index < 12; index++) {
    const node = el('div', 'dmg');
    fx.append(node);
    fxPool.push(node);
  }
  let fxCursor = 0;

  const impact = (data: Impact) => {
    const node = fxPool[fxCursor++ % fxPool.length] as HTMLDivElement;
    node.className = `dmg ${data.kind}`;
    node.textContent = data.text;
    node.style.left = `${data.x}px`;
    node.style.top = `${data.y}px`;
    node.style.animation = 'none';
    void node.offsetWidth;
    node.style.animation = '';
  };

  const renderTurn = (tokens: readonly TurnToken[], currentId: string | null) => {
    turnChips.forEach((chip, index) => {
      const token = tokens[index];
      if (!token) {
        chip.hidden = true;
        return;
      }
      chip.hidden = false;
      chip.className = `turn-chip ${token.side}${token.id === currentId ? ' now' : ''}`;
      const image = chip.querySelector('img') as HTMLImageElement;
      const src = `portraits/${token.defId}.png`;
      if (image.getAttribute('src') !== src) image.src = src;
      chip.title = token.name;
    });
  };

  // MARK: controls and dock

  const controls = el('div', 'battle-controls');
  const makeControl = (iconName: Parameters<typeof kitIcon>[0], label: string, onClick: () => void) => {
    const button = el('button', 'ctl');
    button.type = 'button';
    const icon = el('span', 'ctl-icon');
    icon.append(kitIcon(iconName));
    const big = el('span', 'ctl-big');
    const small = el('span', 'ctl-label', label);
    button.append(icon, big, small);
    button.addEventListener('click', onClick);
    return { button, icon, big, label: small };
  };

  const auto = makeControl('lightbulb', t.autoOnShort, () => {
    const on = !store.save.settings.autoCast;
    store.set({ ...store.save, settings: { ...store.save.settings, autoCast: on } });
    scene.setAutoCast(on);
  });
  auto.button.setAttribute('aria-label', t.autoCast);
  const speed = makeControl('timer', t.speedShort, () => {
    const next = store.save.settings.speed === 1 ? 2 : store.save.settings.speed === 2 ? 3 : 1;
    store.set({ ...store.save, settings: { ...store.save.settings, speed: next } });
    scene.setSpeed(next);
  });
  speed.button.setAttribute('aria-label', t.speed);
  const stop = makeControl('pause', t.stop, () => {
    stopped = !stopped;
    if (stopped) scene.stopAuto();
    else scene.resumeAuto();
    paintHud();
  });
  stop.button.setAttribute('aria-label', t.stop);
  const upgrade = el('button', 'ctl primary');
  upgrade.type = 'button';
  upgrade.append(kitIcon('star'), el('span', 'ctl-primary-label', t.upgrade), el('i', 'badge'));
  upgrade.addEventListener('click', () => openTeamSheet(sheetHost, (id) => openHeroSheet(sheetHost, id)));
  controls.append(auto.button, speed.button, stop.button, upgrade);
  root.append(controls);

  const dock = el('nav', 'battle-dock');
  const makeDock = (id: string, iconName: Parameters<typeof kitIcon>[0], label: string, open: () => void) => {
    const button = el('button', 'dock-item');
    button.type = 'button';
    button.dataset.dock = id;
    button.append(kitIcon(iconName), el('span', 'dock-label', label), el('i', 'badge'));
    button.addEventListener('click', open);
    dock.append(button);
    return button;
  };
  makeDock('team', 'users-three', t.team, () =>
    openTeamSheet(sheetHost, (id) => openHeroSheet(sheetHost, id)),
  );
  makeDock('gear', 'gear-six', t.gear, () => openGearSheet(sheetHost));
  makeDock('summon', 'cards', t.summon, () => openSummonSheet(sheetHost));
  makeDock('codex', 'scroll', t.codex, () => openCodex(sheetHost));
  const dailyDock = makeDock('daily', 'timer', t.daily, () => openDailySheet(sheetHost));
  root.append(dock);

  const summonBadge = dock.querySelector('[data-dock="summon"] .badge') as HTMLElement;
  const dailyBadge = dailyDock.querySelector('.badge') as HTMLElement;
  const upgradeBadge = upgrade.querySelector('.badge') as HTMLElement;

  // MARK: paint

  const modeLabel = (current: RunMode): string => {
    switch (current.kind) {
      case 'tower':
        return t.tower;
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

  const modeStageName = (current: RunMode): string => {
    switch (current.kind) {
      case 'tower':
        return `${t.floor} ${current.floor}`;
      case 'expedition':
        return t.expeditionShort;
      case 'boss':
        return t.bossShort;
      case 'challenge':
        return t.challengeShort;
      default:
        return t.stage(stage.id);
    }
  };

  const paintHud = () => {
    const save = store.save;
    if (mode.kind === 'story') {
      const region = REGIONS.items.find((candidate) => candidate.id === stage.region);
      regionLine.textContent = `${t.levelShort} ${save.company.level} · ${t.region} ${regionNumber(stage.id)} · ${region?.name ?? ''}`;
      stageLine.textContent = t.stage(stage.id);
      progress.style.visibility = 'visible';
      progressFill.style.width = `${Math.min(100, (stage.index / 12) * 100)}%`;
    } else {
      regionLine.textContent = modeLabel(mode);
      stageLine.textContent = modeStageName(mode);
      progress.style.visibility = 'hidden';
    }
    goldValue.textContent = compact(save.currencies.gold);
    essenceValue.textContent = compact(save.currencies.essence);
    auto.label.textContent = save.settings.autoCast ? t.autoOnShort : t.autoOffShort;
    auto.button.classList.toggle('on', save.settings.autoCast);
    auto.button.setAttribute('aria-pressed', String(save.settings.autoCast));
    speed.big.textContent = `×${save.settings.speed}`;
    stop.label.textContent = stopped ? t.run : t.stop;
    stop.icon.replaceChildren(kitIcon(stopped ? 'play' : 'pause'));
    upgradeBadge.style.display = hasAffordableUpgrade(save) ? 'block' : 'none';
    summonBadge.style.display = save.currencies.shards >= 100 ? 'block' : 'none';
    dailyBadge.style.display = dailyReady(save) ? 'block' : 'none';
    stageButton.setAttribute('aria-label', `${regionLine.textContent}, ${stageLine.textContent}`);
  };

  // MARK: modes

  const modeStage = (next: RunMode): StageDef => {
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
  };

  const data = (): BoardSceneData => ({
    stage,
    team: loadouts(store.save),
    companyLevel: store.save.company.level,
    autoCast: store.save.settings.autoCast,
    speed: store.save.settings.speed,
    reducedMotion: store.save.settings.reducedMotion,
    onEnd: (result, summary) => finish(result, summary),
    onTurn: renderTurn,
    onImpact: impact,
    onWave: (wave, total) => {
      waveLabel.textContent = `${t.wave} ${wave}/${total}`;
    },
    onCardTap: (defId) => openHeroSheet(sheetHost, defId),
  });

  const sheetHost: SheetHost = {
    save: () => store.save,
    setSave: (next) => {
      store.set(next);
      void persist();
    },
    onTeamChanged: () => {
      paintHud();
      scene.restart(data());
    },
    startStory: (next) => startRun(next, { kind: 'story' }),
    startMode: (next) => startRun(modeStage(next), next),
    pause: () => kit.pause(),
    resume: () => kit.resume(),
  };

  const startRun = (next: StageDef, nextMode: RunMode) => {
    ctx.overlay.hide();
    stage = next;
    mode = nextMode;
    stopped = false;
    paintHud();
    scene.restart(data());
  };

  const returnToStory = () => {
    ctx.overlay.hide();
    mode = { kind: 'story' };
    stage = storyStage(store.save);
    stopped = false;
    paintHud();
    scene.restart(data());
  };

  const retry = () => {
    ctx.overlay.hide();
    stopped = false;
    paintHud();
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
    const gainedEssence = after.currencies.essence - before.currencies.essence;
    const gainedShards = after.currencies.shards - before.currencies.shards;
    ctx.gameOver(
      {
        title: t.win,
        body: `${t.stage(stage.id)} · +${gainedGold} ${t.gold} · +${gainedEssence} ${t.essence}${
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
    haptics.play('celebrate');
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
    haptics.play('celebrate');
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
    haptics.play('celebrate');
    ctx.gameOver(
      {
        title: t.boss,
        body: `Sát thương ${Math.round(summary.damage).toLocaleString('vi-VN')} · tốt nhất tuần ${after.weekly.bossDamage.toLocaleString('vi-VN')} · ${summary.rounds} lượt`,
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

  function challengeEnd(result: 'win' | 'lose', summary: BoardSummary) {
    if (result === 'lose') {
      ctx.gameOver(
        {
          title: t.challenge,
          body: `Đội dừng sau ${summary.rounds} lượt. Luyện thêm rồi thử lại.`,
        },
        { label: t.retry, icon: 'arrow-counter-clockwise', onClick: retry },
        [{ label: t.stages, icon: 'house', onClick: returnToStory }],
      );
      return;
    }
    const after = recordChallenge(store.save, summary.rounds);
    store.set(after);
    sfx.play('levelUp');
    haptics.play('celebrate');
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

  await document.fonts.ready;
  kit = createGame({
    parent: board,
    background: '#171614',
    maxDpr: 1.25,
    createScene: () => {
      scene = new BoardScene(data());
      return scene;
    },
  });
  board.append(fx);
  const stopResize = kit.onResize(() => {
    scene.relayout();
    paintHud();
  });
  const unsubscribe = store.subscribe(paintHud);
  paintHud();
  ctx.ready();
  openOfflineCard(sheetHost);
  session.telemetry.count('stage.open');

  return {
    pause: () => kit.pause(),
    resume: () => kit.resume(),
    newGame: () => scene.restart(data()),
    leave: async () => {
      unsubscribe();
      stopResize();
      await persist();
      closeSheets();
      kit.destroy();
    },
    quick: () => [],
  };
}
