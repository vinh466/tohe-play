// The play stage (ADR 0020): the board is the whole game. The stage is a column — HUD, hex board, deck, controls,
// dock — so nothing can cover a card. The board itself is DOM/CSS (view.ts); this file owns the shell menu, HUD,
// the road/bench deck, rewards, the loss rewind and every run mode (story, tower, expedition, world boss, challenge).
import { haptics, icon as kitIcon, type PlayStage, type StageContext } from '@tohe/game-kit';
import { persist, session, sfx, store, t } from './app.ts';
import { bossStage, challengeStage, expeditionStage, towerStage } from './content/events.ts';
import { HEROES } from './content/heroes.ts';
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
  addCurrency,
  hasAffordableUpgrade,
  loadouts,
  nextStage,
  recordClear,
  resetDaily,
  resetWeekly,
  teamPower,
} from './core/progression.ts';
import type { SaveData } from './core/save-types.ts';
import { terrainAt } from './core/terrain.ts';
import type { StageDef } from './core/types.ts';
import type { RunMode } from './ui/run-mode.ts';
import {
  closeSheets,
  openCodex,
  openDailySheet,
  openEnemySheet,
  openGearSheet,
  openHeroSheet,
  openOfflineCard,
  openStagePicker,
  openSummonSheet,
  openTeamSheet,
  type SheetHost,
} from './ui/sheets.ts';
import { type BoardSummary, BoardView, type FeedEvent, type TurnToken } from './view.ts';

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

function power(value: number): string {
  return Math.round(value).toLocaleString('vi-VN');
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

interface FeedLine {
  readonly kind: 'hit' | 'heal' | 'shield' | 'death' | 'clear' | 'loss' | 'info';
  readonly tag: string;
  readonly text: string;
  readonly next?: string;
}

const FEED_TAG: Record<FeedLine['kind'], string> = {
  hit: '⚔',
  heal: '✚',
  shield: '◈',
  death: '☠',
  clear: '✓',
  loss: '✕',
  info: '▸',
};

export async function start(ctx: StageContext): Promise<PlayStage> {
  const template = document.querySelector<HTMLTemplateElement>('#play-stage') as HTMLTemplateElement;
  ctx.root.append(template.content.cloneNode(true));
  const root = ctx.root.querySelector<HTMLElement>('#stage') as HTMLElement;

  const normalized = resetWeekly(resetDaily(store.save, dayKey()), weekKey());
  if (normalized !== store.save) store.set(normalized);

  let mode: RunMode = { kind: 'story' };
  let stage: StageDef = storyStage(store.save);
  let stopped = false;
  let view!: BoardView;
  let activeTab: 'road' | 'bench' = 'road';
  let lossCount = 0;
  let lossTimer: number | null = null;
  let runToken = 0;

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
  chevron.setAttribute('aria-hidden', 'true');
  stageButton.append(regionLine, stageLine, chevron);
  stageButton.addEventListener('click', () => openStagePicker(sheetHost));

  const resources = el('div', 'hud-res');
  const goldChip = el('div', 'res-chip');
  goldChip.append(resourceIcon('gold'), el('span', 'res-value'));
  const essenceChip = el('div', 'res-chip');
  essenceChip.append(resourceIcon('essence'), el('span', 'res-value'));
  const goldValue = goldChip.querySelector('.res-value') as HTMLElement;
  const essenceValue = essenceChip.querySelector('.res-value') as HTMLElement;
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

  // MARK: board, effects, loss popup

  const boardHost = el('div', 'battle-board');
  root.append(boardHost);

  const lossPopup = el('div', 'loss-popup');
  lossPopup.hidden = true;
  const lossInfo = el('div', 'loss-info');
  const lossTitle = el('strong');
  const lossBody = el('span');
  lossInfo.append(lossTitle, lossBody);
  const lossStop = el('button', 'loss-stop', t.stop);
  lossStop.type = 'button';
  lossStop.addEventListener('click', () => cancelLossRetry());
  const lossTimerBar = el('div', 'loss-timer');
  lossTimerBar.append(el('i'));
  lossPopup.append(lossInfo, lossStop, lossTimerBar);
  boardHost.append(lossPopup);

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
      chip.setAttribute('aria-label', token.name);
    });
  };

  // MARK: deck (road + feed, bench)

  const deck = el('div', 'battle-deck');
  const tabs = el('div', 'deck-tabs');
  const roadTab = el('button', 'deck-tab on', 'Đường đi');
  roadTab.type = 'button';
  const benchTab = el('button', 'deck-tab', 'Dự bị');
  benchTab.type = 'button';
  tabs.append(roadTab, benchTab);
  deck.append(tabs);

  const roadPanel = el('div', 'deck-panel road-panel');
  const roadHead = el('div', 'road-head');
  const roadTitle = el('strong');
  const roadCount = el('span', 'road-count');
  const autoBadge = el('span', 'auto-badge', '● Tự động');
  roadHead.append(roadTitle, roadCount, autoBadge);
  const roadNodes = el('div', 'road-nodes');
  const roadFoot = el('div', 'road-foot');
  const nextLine = el('span');
  const teamLine = el('span');
  roadFoot.append(nextLine, teamLine);
  const feed = el('div', 'feed');
  roadPanel.append(roadHead, roadNodes, roadFoot, feed);
  deck.append(roadPanel);

  const benchPanel = el('div', 'deck-panel bench-panel');
  benchPanel.hidden = true;
  const benchGrid = el('div', 'bench-grid');
  const benchAction = el('button', 'bench-action vd-btn small', 'Sửa đội hình');
  benchAction.type = 'button';
  benchAction.addEventListener('click', () => openTeamSheet(sheetHost, (id) => openHeroSheet(sheetHost, id)));
  benchPanel.append(benchGrid, benchAction);
  deck.append(benchPanel);

  const wallPanel = el('div', 'wall-panel');
  wallPanel.hidden = true;
  const wallTitle = el('strong', 'wall-title');
  const wallBody = el('span', 'wall-body');
  const wallActions = el('div', 'wall-actions');
  const wallTeam = el('button', 'vd-btn small', 'Đổi đội');
  wallTeam.type = 'button';
  wallTeam.addEventListener('click', () => openTeamSheet(sheetHost, (id) => openHeroSheet(sheetHost, id)));
  const wallUpgrade = el('button', 'vd-btn small', 'Nâng cấp');
  wallUpgrade.type = 'button';
  wallUpgrade.addEventListener('click', () => openTeamSheet(sheetHost, (id) => openHeroSheet(sheetHost, id)));
  const wallRetry = el('button', 'vd-btn small primary', t.retry);
  wallRetry.type = 'button';
  wallRetry.addEventListener('click', () => {
    hideWall();
    lossCount = 0;
    stopped = false;
    paintHud();
    view.restartStage(loadouts(store.save));
  });
  wallActions.append(wallTeam, wallUpgrade, wallRetry);
  wallPanel.append(wallTitle, wallBody, wallActions);
  deck.append(wallPanel);
  root.append(deck);

  let feedLines: FeedLine[] = [];

  const renderFeed = () => {
    feed.replaceChildren(
      ...feedLines.map((line) => {
        const node = el('div', `feed-line ${line.kind}`);
        node.append(el('span', 'feed-tag', line.tag), el('span', 'feed-text', line.text));
        if (line.next) node.append(el('span', 'feed-next', line.next));
        return node;
      }),
    );
  };

  const addFeed = (line: FeedLine) => {
    feedLines = [line, ...feedLines].slice(0, 3);
    renderFeed();
  };

  const setDeckTab = (tab: 'road' | 'bench') => {
    activeTab = tab;
    roadTab.classList.toggle('on', tab === 'road');
    benchTab.classList.toggle('on', tab === 'bench');
    if (wallPanel.hidden) {
      roadPanel.hidden = tab !== 'road';
      benchPanel.hidden = tab !== 'bench';
    }
  };
  roadTab.addEventListener('click', () => setDeckTab('road'));
  benchTab.addEventListener('click', () => setDeckTab('bench'));

  const renderBench = () => {
    const team = loadouts(store.save);
    const byCell = new Map(team.map((hero) => [`${hero.row}:${hero.column}`, hero]));
    benchGrid.replaceChildren();
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 4; column++) {
        const hero = byCell.get(`${row}:${column}`);
        const terrain = terrainAt('hero', row as 0 | 1 | 2, column as 0 | 1 | 2 | 3);
        const slot = el('button', `bench-cell${hero ? ' filled' : ''}${terrain ? ' has-terrain' : ''}`);
        slot.type = 'button';
        slot.title = terrain ? `Ô ${row + 1}-${column + 1} · ${terrain.label}` : `Ô ${row + 1}-${column + 1}`;
        if (hero) {
          const def = HEROES.items.find((candidate) => candidate.id === hero.heroId);
          const image = el('img');
          image.src = `portraits/${hero.heroId}.png`;
          image.alt = '';
          image.draggable = false;
          slot.append(image, el('span', 'bench-name', def?.name ?? hero.heroId));
        } else {
          slot.append(el('span', 'bench-plus', '+'));
        }
        if (terrain) slot.append(el('span', 'bench-terrain', terrain.label));
        slot.addEventListener('click', () => openTeamSheet(sheetHost, (id) => openHeroSheet(sheetHost, id)));
        benchGrid.append(slot);
      }
    }
  };

  const renderRoad = () => {
    roadNodes.replaceChildren();
    if (mode.kind !== 'story') {
      roadTitle.textContent = modeLabel(mode);
      roadCount.textContent = modeStageName(mode);
      roadNodes.hidden = true;
      roadFoot.hidden = true;
      return;
    }
    roadNodes.hidden = false;
    roadFoot.hidden = false;
    const region = REGIONS.items.find((candidate) => candidate.id === stage.region);
    roadTitle.textContent = `Đường đi · ${region?.name ?? ''}`;
    roadCount.textContent = `${stage.index}/12`;
    for (let index = 1; index <= 12; index++) {
      const node = el(
        'span',
        `road-node${index < stage.index ? ' done' : index === stage.index ? ' now' : ''}${
          index === 12 ? ' boss' : ''
        }`,
      );
      node.append(el('i'), el('span', '', String(index)));
      roadNodes.append(node);
    }
    const next = nextStage(stage);
    nextLine.replaceChildren(
      document.createTextNode('Tiếp: '),
      el('b', '', next ? `${t.stage(next.id)} · ${power(next.recommendedPower)}` : 'hết chặng'),
    );
    teamLine.replaceChildren(document.createTextNode('Đội: '), el('b', '', power(teamPower(store.save))));
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

  const speed = makeControl('timer', t.speedShort, () => {
    const next = store.save.settings.speed === 1 ? 2 : store.save.settings.speed === 2 ? 3 : 1;
    store.set({ ...store.save, settings: { ...store.save.settings, speed: next } });
    view.setSpeed(next);
    paintHud();
  });
  speed.button.setAttribute('aria-label', t.speed);
  const stop = makeControl('pause', t.stop, () => {
    if (!lossPopup.hidden) {
      cancelLossRetry();
      return;
    }
    if (!wallPanel.hidden) return;
    stopped = !stopped;
    if (stopped) {
      view.stopAuto();
      if (!wallPanel.hidden) {
        // The wall is already the stopped state.
      }
    } else {
      view.resumeAuto();
      hideWall();
    }
    paintHud();
  });
  stop.button.setAttribute('aria-label', t.stop);
  const upgrade = el('button', 'ctl primary');
  upgrade.type = 'button';
  upgrade.append(kitIcon('star'), el('span', 'ctl-primary-label', t.upgrade), el('i', 'badge'));
  upgrade.addEventListener('click', () => openTeamSheet(sheetHost, (id) => openHeroSheet(sheetHost, id)));
  controls.append(speed.button, stop.button, upgrade);
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
    speed.big.textContent = `×${save.settings.speed}`;
    stop.label.textContent = stopped ? t.run : t.stop;
    stop.icon.replaceChildren(kitIcon(stopped ? 'play' : 'pause'));
    view?.setReducedMotion(save.settings.reducedMotion);
    autoBadge.textContent = stopped ? '● Đã dừng' : '● Tự động';
    autoBadge.classList.toggle('paused', stopped);
    upgradeBadge.style.display = hasAffordableUpgrade(save) ? 'block' : 'none';
    summonBadge.style.display = save.currencies.shards >= 100 ? 'block' : 'none';
    dailyBadge.style.display = dailyReady(save) ? 'block' : 'none';
    stageButton.setAttribute('aria-label', `${regionLine.textContent}, ${stageLine.textContent}`);
    renderRoad();
    renderBench();
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

  const data = () => ({
    stage,
    team: loadouts(store.save),
    companyLevel: store.save.company.level,
    speed: store.save.settings.speed,
    reducedMotion: store.save.settings.reducedMotion,
    onEnd: (result: 'win' | 'lose', summary: BoardSummary) => finish(result, summary),
    onTurn: renderTurn,
    onWave: (wave: number, total: number) => {
      waveLabel.textContent = `${t.wave} ${wave}/${total}`;
    },
    onFeed: (event: FeedEvent) => {
      const amount = event.amount ?? 0;
      const sign = event.kind === 'hit' || event.kind === 'death' ? '-' : '+';
      const text =
        event.kind === 'death'
          ? `${event.target} ngã`
          : `${event.source} · ${event.skill ?? 'Đòn đánh'} · ${sign}${amount} · ${event.target}${
              event.crit ? ' · chí mạng' : ''
            }`;
      addFeed({ kind: event.kind, tag: FEED_TAG[event.kind], text });
    },
    onCardTap: (defId: string, side: 'hero' | 'enemy') => {
      if (side === 'hero') openHeroSheet(sheetHost, defId);
      else openEnemySheet(sheetHost, defId);
    },
  });

  const sheetHost: SheetHost = {
    save: () => store.save,
    setSave: (next) => {
      store.set(next);
      void persist();
    },
    onTeamChanged: () => {
      lossCount = 0;
      hideLoss();
      hideWall();
      paintHud();
      view.load(data());
      if (stopped) view.stopAuto();
    },
    startStory: (next) => startRun(next, { kind: 'story' }),
    startMode: (next) => startRun(modeStage(next), next),
    pause: () => view.pause(),
    resume: () => view.resume(),
  };

  const startRun = (next: StageDef, nextMode: RunMode) => {
    ctx.overlay.hide();
    runToken++;
    stage = next;
    mode = nextMode;
    stopped = false;
    lossCount = 0;
    hideLoss();
    hideWall();
    paintHud();
    view.load(data());
    setDeckTab('road');
  };

  const returnToStory = () => {
    ctx.overlay.hide();
    runToken++;
    mode = { kind: 'story' };
    stage = storyStage(store.save);
    stopped = false;
    lossCount = 0;
    hideLoss();
    hideWall();
    paintHud();
    view.load(data());
    setDeckTab('road');
  };

  const retry = () => {
    ctx.overlay.hide();
    runToken++;
    stopped = false;
    lossCount = 0;
    hideLoss();
    hideWall();
    paintHud();
    view.load(data());
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

  // MARK: story: a clear ribbon, no popup; a loss popup, one auto rewind

  function storyWin(): void {
    const before = store.save;
    const first = !before.cleared.includes(stage.id);
    const after = recordClear(before, stage, Date.now());
    store.set(after);
    sfx.play(first ? 'levelUp' : 'pop');
    haptics.play(first ? 'celebrate' : 'tap');
    const gainedGold = after.currencies.gold - before.currencies.gold;
    const gainedEssence = after.currencies.essence - before.currencies.essence;
    const gainedShards = after.currencies.shards - before.currencies.shards;
    const parts = [`+${gainedGold} ${t.gold}`];
    if (gainedEssence > 0) parts.push(`+${gainedEssence} ${t.essence}`);
    if (gainedShards > 0) parts.push(`+${gainedShards} ${t.shards}`);
    const next = nextStage(stage);
    const clearedId = stage.id;
    addFeed({
      kind: 'clear',
      tag: '✓',
      text: `${t.stage(stage.id)} đã qua · ${parts.join(' · ')}`,
      next: next ? `→ ${next.id}` : undefined,
    });
    paintHud();
    if (!next) {
      stopped = true;
      view.stopAuto();
      paintHud();
      addFeed({ kind: 'info', tag: '▸', text: 'Đã hết chặng đường hiện có.' });
      return;
    }
    const token = ++runToken;
    const delay = Math.max(400, 1000 - store.save.settings.speed * 200);
    const advance = () => {
      if (token !== runToken || mode.kind !== 'story' || stage.id !== clearedId) return;
      if (document.querySelector('.vd-sheet')) {
        window.setTimeout(advance, 220);
        return;
      }
      stage = next;
      stopped = false;
      lossCount = 0;
      paintHud();
      view.load(data());
      setDeckTab('road');
    };
    window.setTimeout(advance, delay);
  }

  function storyLose(): void {
    lossCount++;
    const gold = 8 + stage.index * 2 + (regionNumber(stage.id) - 1) * 4;
    store.set(addCurrency(store.save, { gold }));
    paintHud();
    addFeed({
      kind: 'loss',
      tag: '✕',
      text: `Đội ngã ở đợt ${view.wave} · +${gold} ${t.gold} · không nhận thưởng màn`,
    });
    sfx.play('error');
    haptics.play('error');
    if (lossCount >= 2) {
      showWall();
      return;
    }
    showLoss();
  }

  function showLoss(): void {
    clearLossTimer();
    const wave = view.wave;
    lossTitle.textContent = `Đội ngã ở đợt ${wave}`;
    lossBody.textContent = `Quay lại đầu đợt ${wave} sau 1s · +${
      8 + stage.index * 2 + (regionNumber(stage.id) - 1) * 4
    } ${t.gold} · không nhận thưởng màn`;
    lossPopup.hidden = false;
    lossPopup.classList.remove('go');
    void lossPopup.offsetWidth;
    lossPopup.classList.add('go');
    view.stopAuto();
    stopped = true;
    paintHud();
    const token = runToken;
    lossTimer = window.setTimeout(() => {
      if (token !== runToken) return;
      hideLoss();
      stopped = false;
      view.rewindWave();
      if (document.querySelector('.vd-sheet')) view.pause();
      paintHud();
    }, 1200);
  }

  function cancelLossRetry(): void {
    clearLossTimer();
    hideLoss();
    stopped = true;
    view.stopAuto();
    showWall();
    paintHud();
  }

  function clearLossTimer(): void {
    if (lossTimer !== null) {
      window.clearTimeout(lossTimer);
      lossTimer = null;
    }
  }

  function hideLoss(): void {
    clearLossTimer();
    lossPopup.hidden = true;
    lossPopup.classList.remove('go');
  }

  function showWall(): void {
    clearLossTimer();
    hideLoss();
    stopped = true;
    view.stopAuto();
    wallTitle.textContent = `Đội dừng ở ${t.stage(stage.id)}`;
    wallBody.textContent = `Đợt ${view.wave}/${stage.waves.length} · lần thua chỉ nhận vàng cơ bản · đổi đội hình hoặc nâng đồ rồi đánh lại.`;
    wallPanel.hidden = false;
    roadPanel.hidden = true;
    benchPanel.hidden = true;
    paintHud();
  }

  function hideWall(): void {
    wallPanel.hidden = true;
    setDeckTab(activeTab);
  }

  // MARK: other modes (unchanged popups; the board is shared)

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

  // MARK: boot

  await document.fonts.ready;
  view = new BoardView(boardHost, data());
  setDeckTab('road');
  addFeed({ kind: 'info', tag: '▸', text: 'Chạm một thẻ để mở hồ sơ · đoàn tự đánh' });
  paintHud();
  const unsubscribe = store.subscribe(paintHud);
  ctx.ready();
  openOfflineCard(sheetHost);
  session.telemetry.count('stage.open');

  return {
    pause: () => view.pause(),
    resume: () => view.resume(),
    newGame: () => view.restartStage(loadouts(store.save)),
    leave: async () => {
      runToken++;
      unsubscribe();
      clearLossTimer();
      await persist();
      closeSheets();
      view.destroy();
    },
    quick: () => [],
  };
}
