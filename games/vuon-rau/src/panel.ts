// The play stage's panel (SPEC.md, "Screens"): the basket and the seeds, at the bottom in portrait and at the right in
// landscape or on a desktop, inside the safe area. DOM, with the design tokens; the crops' pictures are frames of the
// pack's tileset, cut out with CSS so they stay crisp.
import { type CropId, crops } from './content/crops.ts';
import { TILE, TILESET_COLUMNS, TILESET_FRAMES } from './content/map.ts';
import type { Counts } from './logic.ts';
import type { Locale, Strings } from './strings.ts';

/** A frame of the tileset as a picture `size` CSS pixels wide (a whole multiple of 16 keeps every pixel even). */
export function sprite(url: string, frame: number, size: number): HTMLElement {
  const picture = document.createElement('span');
  picture.className = 'sprite';
  picture.setAttribute('aria-hidden', 'true');
  const scale = size / TILE;
  const rows = Math.ceil(TILESET_FRAMES / TILESET_COLUMNS);
  picture.style.width = `${size}px`;
  picture.style.height = `${size}px`;
  picture.style.backgroundImage = `url("${url}")`;
  picture.style.backgroundSize = `${TILESET_COLUMNS * TILE * scale}px ${rows * TILE * scale}px`;
  picture.style.backgroundPosition = `-${(frame % TILESET_COLUMNS) * size}px -${Math.floor(frame / TILESET_COLUMNS) * size}px`;
  return picture;
}

export interface Panel {
  readonly element: HTMLElement;
  /** Shows the basket and the seeds; `bump` makes one row hop (a crop just picked or bought). */
  set(basket: Counts, seeds: Counts, bump?: { list: 'basket' | 'seeds'; crop: CropId }): void;
  /** Puts the panel in its place: the rectangle the layout gives it, and the side it is on. */
  place(rect: { x: number; y: number; width: number; height: number }, side: 'bottom' | 'right'): void;
}

export function createPanel(parent: HTMLElement, tileset: string, t: Strings, locale: Locale): Panel {
  const element = document.createElement('aside');
  element.className = 'farm-panel';
  const rows = new Map<string, HTMLElement>();
  const group = (
    list: 'basket' | 'seeds',
    label: string,
    frame: (crop: (typeof crops.items)[number]) => number,
  ) => {
    const section = document.createElement('section');
    section.className = 'farm-group';
    const title = document.createElement('h2');
    title.textContent = label;
    const items = document.createElement('ul');
    for (const crop of crops.items) {
      const item = document.createElement('li');
      item.append(sprite(tileset, frame(crop), 32));
      const count = document.createElement('span');
      count.className = 'farm-count';
      item.append(count);
      item.setAttribute('aria-label', crop.name[locale]);
      items.append(item);
      rows.set(`${list}:${crop.id}`, item);
    }
    section.append(title, items);
    element.append(section);
  };
  group('basket', t.basket, (crop) => crop.art.produce);
  group('seeds', t.seeds, (crop) => crop.art.seed);
  parent.append(element);

  return {
    element,
    set(basket, seeds, bump) {
      for (const crop of crops.ids) {
        for (const [list, counts] of [
          ['basket', basket],
          ['seeds', seeds],
        ] as const) {
          const row = rows.get(`${list}:${crop}`);
          const count = row?.querySelector('.farm-count');
          if (!row || !count) continue;
          count.textContent = String(counts[crop]);
          row.classList.toggle('is-empty', counts[crop] === 0);
          row.setAttribute('aria-label', `${crops.get(crop).name[locale]}: ${counts[crop]}`);
        }
      }
      if (bump) {
        const row = rows.get(`${bump.list}:${bump.crop}`);
        row?.classList.remove('is-bumped');
        // Restart the animation on the next frame.
        requestAnimationFrame(() => row?.classList.add('is-bumped'));
      }
    },
    place(rect, side) {
      element.dataset.side = side;
      element.style.left = `${rect.x}px`;
      element.style.top = `${rect.y}px`;
      element.style.width = `${rect.width}px`;
      element.style.height = `${rect.height}px`;
    },
  };
}
