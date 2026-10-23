// DOM screens with one look shared by every game: the game shell's menu stage (title screen and its full screens)
// and the panels over play (the in-game menu, the game's own cards, the end of a game). Big rounded buttons,
// safe-area aware, on the design tokens. Styles: import '@tohe/game-kit/overlay.css' once. Pictures are the kit's SVG
// icons (icons.ts) or the game's own art, never emoji (ADR 0049): every icon sits beside a visible label.
import { icon as drawIcon, shape as drawShape, type IconName, type ShapeName } from './icons.ts';

/** A card's picture: an icon of the kit's set, or an image of the game's own — its logo, `{ src: 'icon.svg' }`. */
export type Picture = IconName | { src: string };

/** A shape drifting behind a title screen, in a colour of the game's art (default: the accent token), faint. */
export interface DecorShape {
  shape: ShapeName;
  colour?: string;
}

export interface OverlayAction {
  label: string;
  onClick(): void;
  /** `quiet`: a low-key button, e.g. the seat's way out at the bottom of a table's menu. */
  variant?: 'primary' | 'secondary' | 'quiet';
  /** An icon before the label (a button) or large above it (a tool). */
  icon?: IconName;
  /** The accessible name when the visible label is short (a tool's caption, e.g. "Âm thanh: bật"). */
  ariaLabel?: string;
  /** Extra attributes for the button, e.g. `data-tohe-exit` (what conformance looks for, ADR 0018). */
  attributes?: Record<string, string>;
}

/**
 * A row of a panel or a screen (ADR 0020): a switch that changes something at once, or a link that opens a card —
 * with the current choice (`value`) shown before its arrow, e.g. "Màu khối · Hoàng hôn".
 */
export type OverlayRow =
  | { kind: 'switch'; label: string; icon?: IconName; on: boolean; onChange(on: boolean): void }
  | { kind: 'link'; label: string; icon?: IconName; value?: string; onClick(): void };

export interface OverlaySection {
  title: string;
  /** An icon before the title. */
  icon?: IconName;
  /** Under the title, e.g. "Đổi ở menu chính, áp dụng từ ván sau." */
  note?: string;
  content: HTMLElement;
}

export interface OverlayCard {
  /** The picture shown large above the title: an icon, or the game's own art (its logo on the title screen). */
  icon?: Picture;
  title: string;
  body?: string;
  /** Extra content between the body and the buttons (e.g. a score table or hints). */
  content?: HTMLElement;
  actions: OverlayAction[];
  /** Rows: switches that change something at once, links to cards (a list to choose from, rules to read). */
  rows?: OverlayRow[];
  /** A screen's sections (Cài đặt: one per setting), each with a title over its content. */
  sections?: OverlaySection[];
  /** Round picture buttons in a row: sound, settings, leaderboard, how to play. */
  tools?: OverlayAction[];
  /** The last button, under the tools: the way out (back to Tò He on the title screen, the seat's at a table). */
  footer?: OverlayAction;
  /** A screen's way back, in its header. */
  corner?: OverlayAction;
  /** A few shapes drifting behind the title screen, in the game's spirit. */
  decor?: DecorShape[];
  /**
   * `card` (default): a card over the game. `menu`: the in-game panel. `title`: a game's title screen.
   * `screen`: a full screen of the menu stage (settings, how to play) with a way back in its header. `count`: a big
   * number alone (3, 2, 1). `loading`: the game's logo and a few dots while play gets ready.
   */
  layout?: 'card' | 'menu' | 'title' | 'screen' | 'count' | 'loading';
}

export interface Overlay {
  show(card: OverlayCard): void;
  hide(): void;
  readonly visible: boolean;
}

/** `stage`: an opaque layer for the menu stage (the title screen and its screens), not a scrim over play. */
export function createOverlay(root: HTMLElement, { stage = false }: { stage?: boolean } = {}): Overlay {
  const layer = document.createElement('div');
  const base = stage ? 'tohe-overlay tohe-menu-stage' : 'tohe-overlay';
  layer.className = base;
  layer.hidden = true;
  root.append(layer);

  return {
    show(card) {
      const layout = card.layout ?? 'card';
      // The same screen drawn again (a switch flipped): no entrance animation, it only changes in place.
      const again = !layer.hidden && layer.dataset.title === `${layout}:${card.title}`;
      layer.dataset.title = `${layout}:${card.title}`;
      layer.className = `${base} tohe-overlay-${layout}`;
      const box = element('div', `tohe-card tohe-layout-${layout}${again ? ' tohe-still' : ''}`);
      const title = element(layout === 'title' ? 'h1' : 'h2', 'tohe-card-title', card.title);
      title.id = `tohe-title-${stage ? 'stage' : 'play'}`;
      box.setAttribute('aria-labelledby', title.id);
      if (layout === 'count' || layout === 'loading') {
        box.setAttribute('role', 'status');
        if (card.icon) box.append(picture(card.icon, 'tohe-card-icon'));
        box.append(title);
        if (layout === 'loading') box.append(dots());
        layer.replaceChildren(box);
        layer.hidden = false;
        return;
      }
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      const children: HTMLElement[] = [];
      if (card.decor?.length) children.push(decor(card.decor));
      if (layout === 'screen') {
        const head = element('header', 'tohe-screen-head');
        if (card.corner) head.append(button({ variant: 'quiet', ...card.corner }, false, 'tohe-screen-back'));
        if (card.icon) head.append(picture(card.icon, 'tohe-screen-icon'));
        head.append(title);
        box.append(head);
      } else {
        const hero = layout === 'title' ? element('div', 'tohe-title-hero') : box;
        if (card.icon) hero.append(picture(card.icon, 'tohe-card-icon'));
        hero.append(title);
        if (hero !== box) box.append(hero);
      }
      const body = layout === 'screen' ? element('div', 'tohe-screen-body') : box;
      if (body !== box) box.append(body);
      if (card.body) body.append(element('p', 'tohe-card-body', card.body));
      if (card.content) body.append(card.content);
      // A screen (settings) puts its switches first, then its sections; a panel puts its actions (Tiếp tục) first.
      const rows = card.rows?.length ? rowsOf(card.rows) : null;
      if (rows && layout === 'screen') body.append(rows);
      for (const section of card.sections ?? []) body.append(sectionOf(section));
      const actions = element('div', 'tohe-card-actions');
      for (const action of card.actions) actions.append(button(action, layout === 'title'));
      if (card.actions.length > 0) body.append(actions);
      if (rows && layout !== 'screen') body.append(rows);
      if (card.tools?.length) {
        const tools = element('div', 'tohe-tools');
        for (const tool of card.tools) tools.append(toolButton(tool));
        body.append(tools);
      }
      if (card.footer) body.append(button({ variant: 'quiet', ...card.footer }, false));
      children.push(box);
      layer.replaceChildren(...children);
      layer.hidden = false;
      (actions.querySelector('button') as HTMLButtonElement | null)?.focus({ preventScroll: true });
    },
    hide() {
      layer.hidden = true;
      delete layer.dataset.title;
      layer.replaceChildren();
    },
    get visible() {
      return !layer.hidden;
    },
  };
}

/** A picture in a box of `className`: an icon, or the game's own image (decoration: the title beside it names it). */
function picture(source: Picture, className: string): HTMLElement {
  const box = element('div', className);
  box.setAttribute('aria-hidden', 'true');
  if (typeof source === 'string') box.append(drawIcon(source));
  else {
    box.classList.add('is-picture');
    const image = document.createElement('img');
    image.src = source.src;
    image.alt = '';
    image.draggable = false;
    box.append(image);
  }
  return box;
}

/** A label with its icon before it; the icon is hidden from screen readers, the words name the control. */
function labelled(node: HTMLElement, label: string, name?: IconName) {
  if (name) node.append(drawIcon(name));
  node.append(element('span', 'tohe-label', label));
}

function button(action: OverlayAction, hero: boolean, extra?: string): HTMLButtonElement {
  const variant = action.variant ?? 'primary';
  const node = element('button', `tohe-button tohe-button-${variant}`);
  labelled(node, action.label, action.icon);
  if (hero && variant === 'primary') node.classList.add('tohe-button-hero');
  if (extra) node.classList.add(extra);
  node.type = 'button';
  if (action.ariaLabel) node.setAttribute('aria-label', action.ariaLabel);
  for (const [name, value] of Object.entries(action.attributes ?? {})) node.setAttribute(name, value);
  node.addEventListener('click', action.onClick);
  return node;
}

/** A round picture with its caption under it; the picture is decoration, the caption (or `ariaLabel`) its name. */
function toolButton(action: OverlayAction): HTMLButtonElement {
  const node = element('button', 'tohe-tool');
  node.type = 'button';
  const icon = element('span', 'tohe-tool-icon');
  icon.setAttribute('aria-hidden', 'true');
  if (action.icon) icon.append(drawIcon(action.icon));
  node.append(icon, element('span', 'tohe-tool-label', action.label));
  if (action.ariaLabel) node.setAttribute('aria-label', action.ariaLabel);
  for (const [name, value] of Object.entries(action.attributes ?? {})) node.setAttribute(name, value);
  node.addEventListener('click', action.onClick);
  return node;
}

function rowsOf(rows: OverlayRow[]): HTMLElement {
  const list = element('div', 'tohe-rows');
  for (const row of rows) {
    const label = element('span', 'tohe-row-label');
    labelled(label, row.label, row.icon);
    if (row.kind === 'switch') {
      const node = element('button', 'tohe-row tohe-row-switch');
      node.type = 'button';
      node.setAttribute('role', 'switch');
      node.setAttribute('aria-checked', String(row.on));
      const knob = element('span', 'tohe-switch');
      knob.setAttribute('aria-hidden', 'true');
      node.append(label, knob);
      node.addEventListener('click', () => row.onChange(!row.on));
      list.append(node);
    } else {
      const node = element('button', 'tohe-row tohe-row-link');
      node.type = 'button';
      const end = element('span', 'tohe-row-end');
      if (row.value) end.append(element('span', 'tohe-row-value', row.value));
      end.append(drawIcon('caret-right', 'tohe-svg tohe-row-chevron'));
      node.append(label, end);
      node.addEventListener('click', row.onClick);
      list.append(node);
    }
  }
  return list;
}

function sectionOf(section: OverlaySection): HTMLElement {
  const node = element('section', 'tohe-section');
  const title = element('h3', 'tohe-section-title');
  labelled(title, section.title, section.icon);
  node.append(title);
  if (section.note) node.append(element('p', 'tohe-section-note', section.note));
  node.append(section.content);
  return node;
}

/** Shapes spread over the title screen at fixed places (no randomness: the screen looks the same each time). */
function decor(items: DecorShape[]): HTMLElement {
  const layer = element('div', 'tohe-decor');
  layer.setAttribute('aria-hidden', 'true');
  const spots = [
    [8, 14],
    [82, 10],
    [16, 44],
    [88, 38],
    [6, 76],
    [78, 70],
    [44, 6],
    [52, 88],
  ];
  spots.forEach(([left, top], index) => {
    const { shape, colour } = items[index % items.length] as DecorShape;
    const item = drawShape(shape, 'tohe-svg tohe-decor-item');
    if (colour) item.style.color = colour;
    item.style.left = `${left}%`;
    item.style.top = `${top}%`;
    item.style.animationDelay = `${-index * 1.3}s`;
    layer.append(item);
  });
  return layer;
}

function dots(): HTMLElement {
  const row = element('span', 'tohe-dots');
  row.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 3; i++) row.append(element('span', 'tohe-dot'));
  return row;
}

/** A list of "picture + sentence" rows, used for first-time hints. */
export function hintList(hints: { icon: string; text: string }[]): HTMLElement {
  const list = element('ul', 'tohe-hints');
  for (const hint of hints) {
    const row = element('li', 'tohe-hint');
    row.append(element('span', 'tohe-hint-icon', hint.icon), element('span', 'tohe-hint-text', hint.text));
    list.append(row);
  }
  return list;
}

export interface Choice<Id extends string> {
  id: Id;
  label: string;
  /** Shown under the label, e.g. sample blocks in a colour preset. */
  preview?: HTMLElement;
}

/**
 * Rows to pick one of (e.g. a colour preset): the chosen row is marked, and tapping another one marks it and calls
 * `onChoose` at once, so the game can show the change behind the card.
 */
export function choiceList<Id extends string>(
  choices: Choice<Id>[],
  chosen: Id,
  onChoose: (id: Id) => void,
): HTMLElement {
  const list = element('div', 'tohe-choices');
  const buttons = choices.map((choice) => {
    const button = element('button', 'tohe-choice');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(choice.id === chosen));
    button.append(element('span', 'tohe-choice-label', choice.label));
    if (choice.preview) button.append(choice.preview);
    button.addEventListener('click', () => {
      for (const other of buttons) other.setAttribute('aria-pressed', String(other === button));
      onChoose(choice.id);
    });
    return button;
  });
  list.append(...buttons);
  return list;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
