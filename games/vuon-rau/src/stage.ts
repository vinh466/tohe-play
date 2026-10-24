// The play stage (ADR 0020): the farm, the HUD and the panel. The shell creates it when the player presses play and
// destroys it when they go back to the menu; leave() saves and stops everything start() started. Rules live in
// logic.ts, walking in path.ts, drawing in view.ts, the save in app.ts. A tap sends the farmer to the plot, the stall or
// anywhere he can walk, and he does what the plot needs next; a long press tells what grows there.
import { createHud, formatScore, type PlayStage, type StageContext } from '@tohe/game-kit';
import { createGame, layoutOf, splitLayout } from '@tohe/game-kit/phaser';
import { persist, session, sfx, store, t } from './app.ts';
import { assets } from './assets.gen.ts';
import { type CropId, crops } from './content/crops.ts';
import { lineFor } from './content/lines.ts';
import { type Cell, keeper, plots, stall, TILESET } from './content/map.ts';
import { dayPart } from './light.ts';
import {
  basketValue,
  buy,
  type GameEvent,
  harvest,
  newGame,
  nextStep,
  plant,
  plotInfo,
  type Result,
  type State,
  sell,
  tick,
  till,
  water,
} from './logic.ts';
import { createPanel, sprite } from './panel.ts';
import { route, standCells } from './path.ts';
import { duration, localeOf } from './strings.ts';
import { FarmScene, GRASS_COLOUR } from './view.ts';

/** The panel's size: its height at the bottom in portrait, its width at the right in landscape. CSS pixels. */
const PANEL = { bottom: 104, right: 176 };
/** The safe area is kept by #app's padding (style.css): the stage is inside it already. */
const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
const localHour = () => {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
};

export async function start(ctx: StageContext): Promise<PlayStage> {
  const template = document.querySelector<HTMLTemplateElement>('#play-stage') as HTMLTemplateElement;
  ctx.root.append(template.content.cloneNode(true));
  const stage = ctx.root.querySelector<HTMLElement>('#stage') as HTMLElement;
  const locale = localeOf(session.locale);
  const pack = assets.farmTiny;
  const tileset = pack[TILESET]?.url ?? '';

  // ------------------------------------------------------------------ the farm: continue it, or a fresh one

  if (ctx.fresh) store.farm = newGame();
  // Crops grew while the game was closed: the farm as it is now, quietly.
  let farm: State = tick(store.farm, Date.now()).state;
  const save = () => {
    store.farm = farm;
    return persist();
  };

  // ------------------------------------------------------------------ HUD: Menu | coins; the panel: basket, seeds

  const hud = createHud({ menu: ctx.menuButton(), parent: ctx.root, locale: session.locale });
  const coins = hud.stat(t.coins);
  const panel = createPanel(stage, tileset, t, locale);
  const show = (bump?: { list: 'basket' | 'seeds'; crop: CropId }, animate = true) => {
    coins.set(farm.coins, animate);
    panel.set(farm.basket, farm.seeds, bump);
  };

  // ------------------------------------------------------------------ the world

  let left = false;
  let paused = false;
  let keeperTaps = 0;
  const kit = createGame({
    parent: stage,
    background: GRASS_COLOUR,
    telemetry: session.telemetry,
    createScene: () =>
      new FarmScene(pack, sfx, {
        onTap: (cell) => void tap(cell),
        onHold: (cell) => hold(cell),
      }),
  });
  let scene = kit.scene;

  const relayout = () => {
    const layout = layoutOf(kit.size(), NO_INSETS);
    const split = splitLayout(layout, {
      panel: layout.orientation === 'landscape' ? PANEL.right : PANEL.bottom,
    });
    scene.relayout(split.world);
    panel.place(split.panel, split.side);
  };
  const offResize = kit.onResize(relayout);
  kit.onRestart(async (next) => {
    scene = next;
    await scene.whenReady;
    relayout();
    scene.setFarm(farm);
    scene.setLight(dayPart(localHour()));
  });

  /** Plays the outcome of an action: refused, the farmer shakes his head; done, the farm and its events. */
  async function apply(result: Result) {
    if (!result.ok) {
      scene.refuse();
      return;
    }
    farm = result.state;
    void save();
    show(bumpOf(result.events));
    await scene.play(result.events, farm);
  }

  const bumpOf = (events: readonly GameEvent[]) => {
    for (const event of events) {
      if (event.type === 'harvested') return { list: 'basket' as const, crop: event.crop };
      if (event.type === 'planted' || event.type === 'bought')
        return { list: 'seeds' as const, crop: event.crop };
    }
    return undefined;
  };

  /** Walks the farmer next to `target` and turns him to it. False when another tap sent him elsewhere meanwhile. */
  async function goTo(target: Cell): Promise<boolean> {
    const walk = route(scene.at, standCells(target));
    if (walk === null) return true;
    const arrived = await scene.walk(walk);
    if (arrived && !left) scene.face(target);
    return arrived && !left;
  }

  // ------------------------------------------------------------------ taps

  async function tap(cell: Cell) {
    if (ctx.overlay.visible || left) return;
    scene.showHint(null);
    const index = plots.findIndex((plot) => same(plot, cell));
    if (index >= 0) return tapPlot(index);
    if (stall.some((crate) => same(crate, cell))) {
      if (await goTo(cell)) openStall(cell);
      return;
    }
    if (same(keeper, cell)) return talk();
    const walk = route(scene.at, [cell]);
    if (walk) await scene.walk(walk);
  }

  async function tapPlot(index: number) {
    const cell = plots[index] as Cell;
    const plot = tick(farm, Date.now()).state.plots[index];
    if (!plot) return;
    const step = nextStep(plot);
    // A crop growing with water needs nothing: say how long it has left.
    if (step === 'wait') return hold(cell);
    if (!(await goTo(cell))) return;
    if (step === 'plant') return pickSeed(index);
    const now = Date.now();
    await apply(
      step === 'till'
        ? till(farm, index, now)
        : step === 'water'
          ? water(farm, index, now)
          : harvest(farm, index, now),
    );
  }

  /** What a long press says: what grows on a plot and how long it has left, or Cô Ba's line. */
  function hold(cell: Cell) {
    if (ctx.overlay.visible || left) return;
    const index = plots.findIndex((plot) => same(plot, cell));
    if (index < 0) {
      if (same(keeper, cell)) talk();
      return;
    }
    const now = Date.now();
    const plot = tick(farm, now).state.plots[index];
    if (!plot) return;
    const info = plotInfo(plot, now);
    const name = info.crop?.name[locale] ?? '';
    const text =
      info.step === 'till'
        ? t.grass
        : info.step === 'plant'
          ? t.tilled
          : info.step === 'water'
            ? t.thirsty(name)
            : info.step === 'harvest'
              ? t.ripe(name)
              : t.growing(name, duration(t, info.remainingMs ?? 0));
    scene.say(cell, text);
  }

  /** Cô Ba says a line that fits the time of day and the farm. */
  function talk() {
    const noSeeds = crops.ids.every((crop) => farm.seeds[crop] === 0);
    const line = lineFor(
      {
        time: dayPart(localHour()),
        basket: basketValue(farm) > 0,
        noSeeds,
        harvested: farm.harvested.length > 0,
      },
      keeperTaps++,
    );
    scene.greet();
    sfx.play('pop');
    scene.say(keeper, line[locale]);
  }

  // ------------------------------------------------------------------ the seed picker and the stall

  /** A button with a crop's picture, its words and a note, as the picker and the stall show them. */
  function cropButton(frame: number, label: string, note: string, enabled: boolean, onClick: () => void) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'farm-choice';
    button.disabled = !enabled;
    const words = document.createElement('span');
    words.className = 'farm-choice-words';
    const title = document.createElement('strong');
    title.textContent = label;
    const small = document.createElement('small');
    small.textContent = note;
    words.append(title, small);
    button.append(sprite(tileset, frame, 48), words);
    button.addEventListener('click', onClick);
    return button;
  }

  function pickSeed(index: number) {
    const list = document.createElement('div');
    list.className = 'farm-choices';
    for (const crop of crops.items) {
      const have = farm.seeds[crop.id];
      list.append(
        cropButton(crop.art.seed, crop.name[locale], t.have(have), have > 0, () => {
          ctx.overlay.hide();
          void apply(plant(farm, index, crop.id, Date.now()));
        }),
      );
    }
    const none = crops.ids.every((crop) => farm.seeds[crop] === 0);
    ctx.overlay.show({
      icon: { src: 'icon.svg' },
      title: t.pick,
      body: none ? t.pickNone : undefined,
      content: list,
      actions: [{ label: t.cancel, variant: 'secondary', onClick: () => ctx.overlay.hide() }],
    });
  }

  function openStall(cell: Cell) {
    const content = document.createElement('div');
    content.className = 'farm-choices';
    const value = basketValue(farm);
    const sellButton = document.createElement('button');
    sellButton.type = 'button';
    // The kit's own buttons: white on the brand colour is large text only, as they make it.
    sellButton.className =
      value > 0 ? 'tohe-button tohe-button-primary farm-sell' : 'tohe-button tohe-button-secondary farm-sell';
    sellButton.disabled = value === 0;
    sellButton.textContent = value > 0 ? t.sellAll(formatScore(value, session.locale)) : t.nothingToSell;
    sellButton.addEventListener('click', () => {
      const result = sell(farm, Date.now());
      void apply(result);
      if (result.ok) {
        const sold = result.events.find((event) => event.type === 'sold');
        if (sold?.type === 'sold') scene.coinsAt(cell, t.gained(sold.coins));
        sfx.play('fanfare');
      }
      openStall(cell);
    });
    const buyTitle = document.createElement('h3');
    buyTitle.className = 'farm-subtitle';
    buyTitle.textContent = t.buy;
    content.append(sellButton, buyTitle);
    for (const crop of crops.items) {
      content.append(
        cropButton(
          crop.art.seed,
          `${crop.name[locale]} · ${t.have(farm.seeds[crop.id])}`,
          t.seedLine(crop.seedPrice, crop.ripeMinutes),
          farm.coins >= crop.seedPrice,
          () => {
            void apply(buy(farm, crop.id, Date.now()));
            openStall(cell);
          },
        ),
      );
    }
    ctx.overlay.show({
      icon: { src: 'icon.svg' },
      title: t.stall,
      content,
      actions: [{ label: t.close, onClick: () => ctx.overlay.hide() }],
    });
  }

  // ------------------------------------------------------------------ time: crops grow, the day turns

  const clock = window.setInterval(() => {
    if (paused || left) return;
    const grown = tick(farm, Date.now());
    if (grown.events.length > 0) {
      farm = grown.state;
      void save();
      void scene.play(grown.events, farm);
    }
    scene.setLight(dayPart(localHour()));
  }, 1000);

  // ------------------------------------------------------------------ ready

  await scene.whenReady;
  relayout();
  scene.setFarm(farm);
  scene.setLight(dayPart(localHour()));
  show(undefined, false);
  if (ctx.firstTime && farm.plots[0]?.s === 'grass') scene.showHint(0);
  void save();
  ctx.ready();

  return {
    pause: () => {
      paused = true;
      kit.pause();
    },
    resume: () => {
      paused = false;
      kit.resume();
    },
    newGame: () => {
      sfx.play('click');
      scene.stopWalking();
      farm = newGame();
      scene.setFarm(farm);
      show();
      void save();
    },
    leave() {
      left = true;
      window.clearInterval(clock);
      offResize();
      scene.stopWalking();
      void save();
      kit.destroy();
    },
  };
}
