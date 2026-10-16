// DOM screens over the game canvas with one look shared by every game: the game shell's title screen and menus
// (shell.ts), and the game's own cards (hints, results). Big rounded buttons, safe-area aware, on the design tokens.
// Styles: import '@tohe/game-kit/overlay.css' once.

export interface OverlayAction {
  label: string;
  onClick(): void;
  /** `quiet`: a low-key button, e.g. the way out at the bottom of a menu. */
  variant?: 'primary' | 'secondary' | 'quiet';
  /** A tool's picture (⚙️), shown large above its label. */
  icon?: string;
  /** The accessible name when the visible label is short (a tool's caption, a corner button). */
  ariaLabel?: string;
  /** Extra attributes for the button, e.g. `data-tohe-exit` (what conformance looks for, ADR 0018). */
  attributes?: Record<string, string>;
}

export interface OverlayCard {
  /** Emoji or short text shown large above the title. */
  icon?: string;
  title: string;
  body?: string;
  /** Extra content between the body and the buttons (e.g. a score table or hints). */
  content?: HTMLElement;
  actions: OverlayAction[];
  /** Round picture buttons in a row under the actions: sound, settings, leaderboard, how to play. */
  tools?: OverlayAction[];
  /** The quiet button at the bottom of a menu: the way out of the game. */
  footer?: OverlayAction;
  /** A small button in the top-left corner of the screen (the title screen's way back to Tò He). */
  corner?: OverlayAction;
  /**
   * `card` (default): a card over the game. `menu`: a card with many buttons, a little tighter. `title`: a game's
   * title screen, the whole screen over its art. `count`: a big number alone (3, 2, 1 before play goes on).
   */
  layout?: 'card' | 'menu' | 'title' | 'count';
}

export interface Overlay {
  show(card: OverlayCard): void;
  hide(): void;
  readonly visible: boolean;
}

export function createOverlay(root: HTMLElement): Overlay {
  const layer = document.createElement('div');
  layer.className = 'tohe-overlay';
  layer.hidden = true;
  root.append(layer);

  return {
    show(card) {
      const layout = card.layout ?? 'card';
      layer.className = `tohe-overlay tohe-overlay-${layout}`;
      const box = element('div', `tohe-card tohe-layout-${layout}`);
      if (layout !== 'count') {
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
      }
      const title = element(layout === 'title' ? 'h1' : 'h2', 'tohe-card-title', card.title);
      title.id = 'tohe-card-title';
      box.setAttribute('aria-labelledby', title.id);
      if (layout === 'count') {
        box.setAttribute('role', 'status');
        box.append(title);
        layer.replaceChildren(box);
        layer.hidden = false;
        return;
      }
      const hero = layout === 'title' ? element('div', 'tohe-title-hero') : box;
      if (card.icon) hero.append(element('div', 'tohe-card-icon', card.icon));
      hero.append(title);
      if (card.body) hero.append(element('p', 'tohe-card-body', card.body));
      if (hero !== box) box.append(hero);
      if (card.content) box.append(card.content);
      const actions = element('div', 'tohe-card-actions');
      for (const action of card.actions) actions.append(button(action, layout === 'title'));
      box.append(actions);
      if (card.tools?.length) {
        const tools = element('div', 'tohe-tools');
        for (const tool of card.tools) tools.append(toolButton(tool));
        box.append(tools);
      }
      if (card.footer) box.append(button({ variant: 'quiet', ...card.footer }, false));
      const children: HTMLElement[] = [box];
      if (card.corner) {
        const corner = button({ variant: 'quiet', ...card.corner }, false);
        corner.classList.add('tohe-corner');
        children.unshift(corner);
      }
      layer.replaceChildren(...children);
      layer.hidden = false;
      (actions.querySelector('button') as HTMLButtonElement | null)?.focus({ preventScroll: true });
    },
    hide() {
      layer.hidden = true;
      layer.replaceChildren();
    },
    get visible() {
      return !layer.hidden;
    },
  };
}

function button(action: OverlayAction, hero: boolean): HTMLButtonElement {
  const variant = action.variant ?? 'primary';
  const node = element('button', `tohe-button tohe-button-${variant}`, action.label);
  if (hero && variant === 'primary') node.classList.add('tohe-button-hero');
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
  node.append(
    element('span', 'tohe-tool-icon', action.icon ?? '•'),
    element('span', 'tohe-tool-label', action.label),
  );
  (node.firstChild as HTMLElement).setAttribute('aria-hidden', 'true');
  if (action.ariaLabel) node.setAttribute('aria-label', action.ariaLabel);
  for (const [name, value] of Object.entries(action.attributes ?? {})) node.setAttribute(name, value);
  node.addEventListener('click', action.onClick);
  return node;
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
