// The Workshop (SPEC.md, "Xưởng"): the game's light meta, shown on the title screen's Cài đặt and over play. It draws
// the machine's rank, the scrap, the four part blueprints and the block colours; it never changes how a run plays
// except the parts the Ca làm may offer. No timers, no energy, nothing to buy with money.
import { choiceList, type Theme } from '@tohe/game-kit';
import { blueprintCost, buyBlueprint, levelFor, MACHINE_LEVELS, sfx, store } from './app.ts';
import { PART_IDS, type PartId } from './logic.ts';
import { PALETTE_IDS, type PaletteId } from './palette.ts';
import type { Strings } from './strings.ts';
import { samples } from './swatches.ts';

export interface WorkshopOptions {
  t: Strings;
  theme: Theme;
  palette: PaletteId;
  onPalette(id: PaletteId): void;
}

const PART_ICONS: Record<PartId, string> = {
  tank: '<circle cx="12" cy="13" r="7"/><path d="M9 3h6M12 3v3" fill="none"/>',
  chute: '<path d="M4 6h16l-3 7H7z"/><path d="M9 13v7h6v-7" fill="none"/>',
  lube: '<path d="M12 3c3 5 6 8 6 11a6 6 0 1 1-12 0c0-3 3-6 6-11z"/>',
  gear: '<circle cx="12" cy="12" r="4" fill="none"/><circle cx="12" cy="12" r="1.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" fill="none"/>',
};

function partIcon(part: PartId): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('workshop-part-icon');
  svg.innerHTML = `<g fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${PART_ICONS[part]}</g>`;
  return svg;
}

/** The Workshop's content, rebuilt in place when a blueprint is bought or a colour picked. */
export function workshopContent(options: WorkshopOptions): HTMLElement {
  const { t, theme } = options;
  const root = document.createElement('div');
  root.className = 'workshop';

  const draw = () => {
    const level = levelFor(store.workshop.xp);
    const next = MACHINE_LEVELS[level + 1];
    const rank = t.workshop.levelName(level);
    root.replaceChildren();

    const top = document.createElement('div');
    top.className = 'workshop-top';
    top.append(
      stat(t.workshop.scrap, String(store.workshop.scrap)),
      stat(t.workshop.level, rank, t.workshop.xpLine(String(store.workshop.xp), next ? String(next) : null)),
    );
    root.append(top);

    root.append(heading(t.workshop.blueprints));
    const list = document.createElement('ul');
    list.className = 'workshop-parts';
    for (const part of PART_IDS) {
      const owned = store.workshop.blueprints.includes(part);
      const cost = blueprintCost(part);
      const item = document.createElement('li');
      item.className = 'workshop-part';
      const icon = document.createElement('span');
      icon.className = 'workshop-part-mark';
      icon.append(partIcon(part));
      const words = document.createElement('div');
      words.className = 'workshop-part-words';
      const name = document.createElement('strong');
      name.textContent = t.orders.part[part];
      const line = document.createElement('span');
      line.textContent = t.orders.partLine[part];
      words.append(name, line);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tohe-button workshop-buy';
      if (owned) {
        button.textContent = t.workshop.owned;
        button.disabled = true;
      } else if (store.workshop.scrap < cost) {
        button.textContent = t.workshop.notEnough;
        button.disabled = true;
        button.title = t.workshop.buy(String(cost));
      } else {
        button.textContent = t.workshop.buy(String(cost));
        button.addEventListener('click', () => {
          if (buyBlueprint(part)) draw();
        });
      }
      item.append(icon, words, button);
      list.append(item);
    }
    root.append(list);

    root.append(heading(t.colours));
    const colours = document.createElement('div');
    colours.className = 'workshop-colours';
    colours.append(
      choiceList(
        PALETTE_IDS.map((id) => ({ id, label: t.palettes[id], preview: samples(id, theme) })),
        options.palette,
        (id) => {
          sfx.play('click');
          options.onPalette(id);
          draw();
        },
      ),
    );
    root.append(colours);

    const note = document.createElement('p');
    note.className = 'workshop-note';
    note.textContent = t.workshop.noTimers;
    root.append(note);
  };

  draw();
  return root;
}

function heading(text: string): HTMLElement {
  const title = document.createElement('h3');
  title.className = 'workshop-heading';
  title.textContent = text;
  return title;
}

function stat(label: string, value: string, note?: string): HTMLElement {
  const box = document.createElement('div');
  box.className = 'workshop-stat';
  const name = document.createElement('span');
  name.className = 'workshop-stat-label';
  name.textContent = label;
  const number = document.createElement('strong');
  number.className = 'workshop-stat-value';
  number.textContent = value;
  box.append(name, number);
  if (note) {
    const small = document.createElement('small');
    small.textContent = note;
    box.append(small);
  }
  return box;
}
