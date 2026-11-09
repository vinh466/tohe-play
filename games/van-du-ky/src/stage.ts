// The play stage (ADR 0020): the board is the whole game. The Phaser scene draws the 6v6 cards; this file owns the
// shell's menu button, the battle controls and the dock, and turns a win into the next stage.

import type { PlayStage, StageContext } from '@tohe/game-kit';
import { createGame } from '@tohe/game-kit/phaser';
import { persist, session, sfx, store, t } from './app.ts';
import { STAGES } from './content/stages.ts';
import { loadouts, nextStage, recordClear } from './core/progression.ts';
import type { StageDef } from './core/types.ts';
import {
  closeSheets,
  openHeroSheet,
  openOfflineCard,
  openSummonSheet,
  openTeamSheet,
  type SheetHost,
} from './ui/sheets.ts';
import { BoardScene, type BoardSceneData } from './view.ts';

export async function start(ctx: StageContext): Promise<PlayStage> {
  const template = document.querySelector<HTMLTemplateElement>('#play-stage') as HTMLTemplateElement;
  ctx.root.append(template.content.cloneNode(true));
  const root = ctx.root.querySelector<HTMLElement>('#stage') as HTMLElement;

  const top = document.createElement('div');
  top.className = 'battle-top';
  const menu = ctx.menuButton();
  menu.className = 'battle-menu';
  const label = document.createElement('span');
  label.className = 'battle-label';
  top.append(menu, label);
  root.append(top);

  const controls = document.createElement('div');
  controls.className = 'battle-controls';
  const auto = button('', () => {
    const on = !store.save.settings.autoCast;
    store.set({ ...store.save, settings: { ...store.save.settings, autoCast: on } });
    scene.setAutoCast(on);
    paintAuto();
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
  const dockItems: [string, string][] = [
    ['Đ', t.team],
    ['T', t.gear],
    ['S', t.summon],
    ['S', t.codex],
    ['⋯', t.more],
  ];
  for (const [icon, text] of dockItems) {
    const item = document.createElement('button');
    item.className = 'dock-item';
    item.innerHTML = `<span class="dock-icon">${icon}</span><span>${text}</span>`;
    item.addEventListener('click', () => {
      if (text === t.team || text === t.gear) openTeamSheet(sheetHost, (id) => openHeroSheet(sheetHost, id));
      else if (text === t.summon) openSummonSheet(sheetHost);
      else showSheet(text, 'Chưa mở ở bản core.');
    });
    dock.append(item);
  }
  root.append(dock);

  let stage: StageDef =
    STAGES.items[Math.min(STAGES.items.length - 1, Math.max(0, store.save.progress.stage - 1))]!;
  let team = loadouts(store.save);
  let companyLevel = store.save.company.level;
  let scene!: BoardScene;

  const sheetHost: SheetHost = {
    save: () => store.save,
    setSave: (next) => {
      store.set(next);
      void persist();
    },
    onTeamChanged: () => {
      team = loadouts(store.save);
      companyLevel = store.save.company.level;
      paint();
      scene.restart(data());
    },
  };

  const data = (): BoardSceneData => ({
    stage,
    team,
    companyLevel,
    autoCast: store.save.settings.autoCast,
    speed: store.save.settings.speed,
    reducedMotion: store.save.settings.reducedMotion,
    onEnd: (result) => {
      if (result === 'win') onWin();
      else onLose();
    },
  });

  const kit = createGame({
    parent: root,
    background: '#171614',
    createScene: () => {
      scene = new BoardScene(data());
      return scene;
    },
  });

  const paint = () => {
    label.textContent = `${t.stage(stage.id)} · ${stage.waves.length} đợt`;
    paintAuto();
    speed.textContent = `×${store.save.settings.speed}`;
  };

  const paintAuto = () => {
    auto.textContent = store.save.settings.autoCast ? t.autoCastOn : t.autoCastOff;
    auto.classList.toggle('on', store.save.settings.autoCast);
  };

  const onWin = () => {
    sfx.play('levelUp');
    const nextSave = recordClear(store.save, stage, Date.now());
    store.set(nextSave);
    void persist();
    const next = nextStage(stage);
    ctx.gameOver(
      { title: t.win, body: `${t.stage(stage.id)} · ${nextSave.currencies.gold} vàng` },
      next
        ? {
            label: t.next,
            icon: 'caret-right',
            onClick: () => {
              stage = next;
              team = loadouts(store.save);
              companyLevel = store.save.company.level;
              paint();
              scene.restart(data());
            },
          }
        : undefined,
    );
  };

  const onLose = () => {
    sfx.play('error');
    ctx.gameOver(
      { title: t.lose, body: 'Đổi đội hình hoặc nâng gear rồi thử lại.' },
      {
        label: t.retry,
        icon: 'arrow-counter-clockwise',
        onClick: () => {
          team = loadouts(store.save);
          companyLevel = store.save.company.level;
          scene.restart(data());
        },
      },
    );
  };

  paint();
  ctx.ready();
  openOfflineCard(sheetHost);

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

function showSheet(title: string, body: string) {
  const card = document.createElement('div');
  card.className = 'sheet-card';
  card.innerHTML = `<h2>${title}</h2><p>${body}</p>`;
  const close = document.createElement('button');
  close.className = 'battle-btn';
  close.textContent = 'Đóng';
  close.addEventListener('click', () => card.remove());
  card.append(close);
  document.querySelector('#stage')?.append(card);
  session.telemetry.count('sheet.open');
}
