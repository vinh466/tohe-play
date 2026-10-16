// DOM screens over the game canvas (intro, pause, game over) with one look shared by every game: big rounded
// buttons, a card that pops in, safe-area aware. Styles: import '@tohe/game-kit/overlay.css' once.

export interface OverlayAction {
  label: string;
  onClick(): void;
  variant?: 'primary' | 'secondary';
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
  /** A menu: many buttons, so the secondary ones are a little smaller and fit a small phone. */
  menu?: boolean;
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
      const box = document.createElement('div');
      box.className = card.menu ? 'tohe-card tohe-card-menu' : 'tohe-card';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      if (card.icon) box.append(element('div', 'tohe-card-icon', card.icon));
      const title = element('h2', 'tohe-card-title', card.title);
      box.append(title);
      if (card.body) box.append(element('p', 'tohe-card-body', card.body));
      if (card.content) box.append(card.content);
      const actions = element('div', 'tohe-card-actions');
      for (const action of card.actions) {
        const button = element(
          'button',
          `tohe-button tohe-button-${action.variant ?? 'primary'}`,
          action.label,
        );
        button.type = 'button';
        for (const [name, value] of Object.entries(action.attributes ?? {})) button.setAttribute(name, value);
        button.addEventListener('click', action.onClick);
        actions.append(button);
      }
      box.append(actions);
      layer.replaceChildren(box);
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
