// The table's settings as controls: the menu stage's ⚙️ Cài đặt (house rules, players and level, the deck) and, read
// only, a room's rules in the in-game panel. They change the save in app.ts; the play stage reads it when it starts.
import { type Choice, choiceList, hintList, icon } from '@tohe/game-kit';
import { persist, sfx, store, t } from './app.ts';
import { LEVELS, type Level } from './bots.ts';
import { DECKS, type Deck } from './palette.ts';
import { INSTANT_WINS, type Options } from './rules.ts';

/** A room's house rules, as the host chose them (read only). */
export function tableRules(rules: Options): HTMLElement {
  const h = t.houseRules;
  const rows: [string, boolean][] = [
    [h.firstLeadThree, rules.firstLeadThree],
    [h.chopOutOfTurn, rules.chopOutOfTurn],
    [h.chopChain, rules.chopChain],
    [h.leftovers, rules.leftovers],
    [h.cong, rules.cong],
    [h.endAtFirstOut, rules.endAtFirstOut],
    [h.placesOnly, rules.points === 'places'],
    [h.pairsBeatTwoPair, rules.pairsBeatTwoPair],
    ...INSTANT_WINS.map((win): [string, boolean] => [
      `${t.instant} ${t.instantWins[win]}`,
      rules.instantWins.includes(win),
    ]),
  ];
  // The kit's check or dash in each row's picture, its word for screen readers (ADR 0049).
  const list = hintList(rows.map(([text]) => ({ icon: '', text })));
  list.querySelectorAll<HTMLElement>('.tohe-hint-icon').forEach((picture, index) => {
    const on = rows[index]?.[1] ?? false;
    picture.setAttribute('role', 'img');
    picture.setAttribute('aria-label', on ? t.ruleOn : t.ruleOff);
    picture.classList.toggle('is-off', !on);
    picture.append(icon(on ? 'check' : 'minus'));
  });
  return list;
}

/** A row that switches on and off. */
function toggle(label: string, on: boolean, onChange: (on: boolean) => void): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tohe-choice toggle';
  button.setAttribute('aria-pressed', String(on));
  const text = document.createElement('span');
  text.className = 'tohe-choice-label';
  text.textContent = label;
  button.append(text);
  button.addEventListener('click', () => {
    const next = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(next));
    sfx.play('click');
    onChange(next);
  });
  return button;
}

function note(text: string): HTMLElement {
  const p = document.createElement('p');
  p.className = 'menu-note';
  p.textContent = text;
  return p;
}

/** ⚙️ Cài đặt → Luật nhà: H1–H9, from the next hand on (SPEC.md, "House rules"). */
export function houseRules(): HTMLElement {
  const box = document.createElement('div');
  box.className = 'tohe-choices';
  const set = (change: Partial<Options>) => {
    store.options = { ...store.options, ...change };
    void persist();
  };
  const h = t.houseRules;
  const options = store.options;
  box.append(
    toggle(h.firstLeadThree, options.firstLeadThree, (on) => set({ firstLeadThree: on })),
    toggle(h.chopOutOfTurn, options.chopOutOfTurn, (on) => set({ chopOutOfTurn: on })),
    toggle(h.chopChain, options.chopChain, (on) => set({ chopChain: on })),
    toggle(h.leftovers, options.leftovers, (on) => set({ leftovers: on })),
    toggle(h.cong, options.cong, (on) => set({ cong: on })),
    toggle(h.endAtFirstOut, options.endAtFirstOut, (on) => set({ endAtFirstOut: on })),
    toggle(h.placesOnly, options.points === 'places', (on) => set({ points: on ? 'places' : 'full' })),
    toggle(h.pairsBeatTwoPair, options.pairsBeatTwoPair, (on) => set({ pairsBeatTwoPair: on })),
    note(t.menu.instantTitle),
    ...INSTANT_WINS.map((win) =>
      toggle(t.instantWins[win], options.instantWins.includes(win), (on) =>
        set({
          instantWins: INSTANT_WINS.filter((w) => (w === win ? on : store.options.instantWins.includes(w))),
        }),
      ),
    ),
  );
  return box;
}

/** ⚙️ Cài đặt → Bàn chơi: players (a new table from the next hand) and the bots' level. */
export function tableSettings(): HTMLElement {
  const box = document.createElement('div');
  const counts: Choice<'2' | '3' | '4'>[] = (['2', '3', '4'] as const).map((n) => ({
    id: n,
    label: t.menu.players(Number(n)),
  }));
  const levels: Choice<Level>[] = LEVELS.map((id) => ({ id, label: t.menu.levels[id] }));
  box.append(
    note(t.menu.newTableNote),
    choiceList(counts, String(store.seats) as '2' | '3' | '4', (id) => {
      sfx.play('click');
      store.seats = Number(id);
      void persist();
    }),
    note(t.menu.level),
    choiceList(levels, store.level, (id) => {
      sfx.play('click');
      store.level = id;
      void persist();
    }),
  );
  return box;
}

/** ⚙️ Cài đặt → Bộ bài: two or four suit colours. */
export function deckPicker(): HTMLElement {
  const choices: Choice<Deck>[] = DECKS.map((id) => ({ id, label: t.menu.decks[id] }));
  return choiceList(choices, store.deck, (id) => {
    sfx.play('click');
    store.deck = id;
    void persist();
  });
}
