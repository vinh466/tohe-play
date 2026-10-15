// Wiring: SDK session, kit game, HUD, controls, overlays, saving, and the bots' turns. Rules live in rules.ts (via
// the rules module), bots in bots.ts, drawing in view.ts. Version 0.1 plays one phone against bots (SPEC.md).
import '@tohe/game-kit/overlay.css';
import './style.css';
import {
  type Choice,
  choiceList,
  createLifecycle,
  createOverlay,
  createSfx,
  followTheme,
  haptics,
  hintList,
  lifecycleStrings,
  type Theme,
} from '@tohe/game-kit';
import { createGame } from '@tohe/game-kit/phaser';
import { connect } from '@tohe/game-sdk';
import { isLevel, LEVELS, type Level, rank } from './bots.ts';
import { cardName, RANK_LABELS } from './cardArt.ts';
import { type Card, type Combo, classify, rankOf } from './cards.ts';
import { rules } from './module.ts';
import { DECKS, type Deck, isDeck, TABLE } from './palette.ts';
import {
  type Action,
  type Carry,
  check,
  DEFAULT_OPTIONS,
  INSTANT_WINS,
  legalPlays,
  normalizeOptions,
  type Options,
  restore,
  type State,
  type View,
} from './rules.ts';
import { stringsFor } from './strings.ts';
import { type Player, TableScene } from './view.ts';

/** The player's seat; the bots sit at the others. */
const ME = 0;

interface Saved {
  v: 1;
  /** The hand in progress, or the last one when it is over. */
  state: State | null;
  /** Points of each seat at this table (bảng điểm). */
  series: number[];
  /** Hands played at this table. */
  hands: number;
  seats: number;
  level: Level;
  options: Options;
  deck: Deck;
  sort: 'rank' | 'combos';
  tutorialSeen: boolean;
  /** The practice hand (suggestions on every turn) is done. */
  practiced: boolean;
  stats: { hands: number; places: number[] };
}

const session = await connect<Saved>({ gameId: 'tien-len' });
const t = stringsFor(session.locale);
document.documentElement.lang = session.locale;

const sfx = createSfx({ telemetry: session.telemetry });
sfx.setMuted(session.settings.muted);
session.on('settings', (settings) => sfx.setMuted(settings.muted));

const saved = session.saved;
let seats = saved?.seats && saved.seats >= 2 && saved.seats <= 4 ? saved.seats : 4;
let level: Level = isLevel(saved?.level) ? saved.level : 'normal';
let options: Options = normalizeOptions(saved?.options ?? DEFAULT_OPTIONS);
let deck: Deck = isDeck(saved?.deck) ? saved.deck : 'classic';
let sortBy: 'rank' | 'combos' = saved?.sort === 'combos' ? 'combos' : 'rank';
let tutorialSeen = saved?.tutorialSeen ?? false;
let practiced = saved?.practiced ?? false;
const stats = saved?.stats ?? { hands: 0, places: [0, 0, 0, 0] };
const resumed = restore(saved?.state);
let state: State =
  resumed && resumed.seats === seats
    ? resumed
    : rules.setup({ seats, seed: session.seed, options, carry: null });
let series: number[] =
  Array.isArray(saved?.series) && saved.series.length === state.seats
    ? saved.series
    : state.hands.map(() => 0);
let handsPlayed = resumed ? (saved?.hands ?? 0) : 0;

/** Bumped on every change of state, so a bot's move planned for an older state is dropped. */
let version = 0;
/** An action is animating. */
let busy = false;
let selected = new Set<Card>();
let hintIndex = 0;
let paused = false;

function players(): Player[] {
  const me: Player = { name: session.profile.name || t.you, avatar: session.profile.avatar || '🙂' };
  return [me, ...t.bots.slice(0, state.seats - 1)];
}

const mine = (): View => rules.view(state, ME);

// ------------------------------------------------------------------ DOM

const app = document.querySelector<HTMLElement>('#app') as HTMLElement;
const stage = document.querySelector<HTMLElement>('#stage') as HTMLElement;
const scoreValue = document.querySelector('#score') as HTMLElement;
const handNo = document.querySelector('#hand-no') as HTMLElement;
const sortButton = document.querySelector('#sort') as HTMLButtonElement;
const status = document.querySelector('#status') as HTMLElement;
const passButton = document.querySelector('#pass') as HTMLButtonElement;
const hintButton = document.querySelector('#hint') as HTMLButtonElement;
const playButton = document.querySelector('#play') as HTMLButtonElement;
(document.querySelector('#score-label') as HTMLElement).textContent = t.tableScore;
passButton.textContent = t.pass;
hintButton.textContent = `💡 ${t.hint}`;

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

function showHud() {
  scoreValue.textContent = signed(series[ME] ?? 0);
  handNo.textContent = t.handNo(handsPlayed + (state.over ? 0 : 1));
  sortButton.textContent = sortBy === 'rank' ? t.sortCombos : t.sortRank;
}

/** "đôi 7", "sảnh 5→9", "7♥". */
function describe(combo: Combo): string {
  const low = RANK_LABELS[rankOf(combo.cards[0] as Card)];
  const high = RANK_LABELS[rankOf(combo.top)];
  switch (combo.kind) {
    case 'single':
      return cardName(combo.top);
    case 'straight':
      return `${t.kinds.straight} ${low}→${high}`;
    case 'pairs':
      return `${combo.ranks} ${t.kinds.pairs} ${low}→${high}`;
    default:
      return `${t.kinds[combo.kind]} ${high}`;
  }
}

/** Buttons and the status line follow the view and the selection (SPEC.md, "Screens"). */
function showControls() {
  const v = mine();
  const myTurn = !v.over && v.turn === ME && !v.cong.includes(ME) && v.hand.length > 0;
  const cards = [...selected];
  const error = cards.length > 0 ? check(v, cards) : null;
  const canChop = !myTurn && legalPlays(v).length > 0;
  playButton.disabled = busy || cards.length === 0 || error !== null;
  playButton.textContent = canChop ? t.chop : t.play;
  playButton.classList.toggle('is-chop', canChop);
  passButton.disabled = busy || !myTurn || v.table === null;
  hintButton.disabled = busy || (!myTurn && !canChop);
  let line = '';
  if (v.over) line = '';
  else if (cards.length > 0 && error) {
    line =
      error === 'must_beat' && v.table && (v.turn === ME || canChop)
        ? t.mustBeat(describe(v.table))
        : t.errors[error];
  } else if (cards.length > 0) line = describe(classify(cards) as Combo);
  else if (myTurn) line = teaching(v) ?? t.yourTurn;
  else if (canChop) line = t.teach.chop;
  else line = `${players()[v.turn]?.name ?? ''} …`;
  status.textContent = line;
}

/** Practice hand: the suggested play and a sentence saying why (SPEC.md, "Screens" 1). */
function teaching(v: View): string | null {
  if (practiced) return null;
  const legal = legalPlays(v);
  const best = rank(v, legal)[0];
  if (!best) return null;
  board.setHint(best.type === 'play' ? best.cards : []);
  if (best.type === 'pass') return t.teach.pass;
  const combo = classify(best.cards) as Combo;
  if (best.cards.length === v.hand.length) return t.teach.out;
  if (v.mustInclude !== null) return t.teach.firstLead;
  if (!v.table) return t.teach.lead;
  if (v.table && combo.kind !== v.table.kind) return t.teach.chop;
  return t.teach.follow(t.kinds[combo.kind]);
}

function setSelected(cards: Iterable<Card>) {
  selected = new Set(cards);
  board.setSelected(selected);
  showControls();
}

// ------------------------------------------------------------------ game

let theme: Theme = session.settings.theme;
const kit = createGame({
  parent: stage,
  background: TABLE[theme].background,
  telemetry: session.telemetry,
  createScene: () =>
    new TableScene(
      sfx,
      t,
      {
        onTap: (card) => tap(card),
        onSlide: (cards, select) => {
          const next = new Set(selected);
          for (const card of cards) {
            if (select) next.add(card);
            else next.delete(card);
          }
          if (next.size !== selected.size) sfx.play('click');
          setSelected(next);
        },
      },
      theme,
      deck,
    ),
});
let board = kit.scene;

followTheme(session, (next) => {
  theme = next;
  board.setTheme(next);
  kit.setBackground(TABLE[next].background);
});
kit.onResize((size) => board.relayout(size.width, size.height));
kit.onRestart(async (scene) => {
  board = scene;
  await board.whenReady;
  board.relayout(kit.size().width, kit.size().height);
  drawAll();
  busy = false;
  schedule();
});

session.on('pause', () => {
  paused = true;
  kit.pause();
});
session.on('resume', () => {
  paused = false;
  if (!overlay.visible) kit.resume();
});

const overlay = createOverlay(app);

function drawAll() {
  board.setPlayers(players());
  board.setSort(sortBy);
  board.render(mine());
  board.setSelected(selected);
  showHud();
  showControls();
}

/** A tap on a card: toggles it; with nothing selected, picks the smallest play with it that beats the table. */
function tap(card: Card) {
  if (state.over) return;
  sfx.play('click');
  haptics.play('tap');
  const v = mine();
  if (selected.size === 0 && v.table && v.table.cards.length > 1) {
    const plays = legalPlays(v).filter((combo) => combo.cards.includes(card));
    const smallest = plays.sort((a, b) => a.cards.length - b.cards.length || a.top - b.top)[0];
    if (smallest) {
      setSelected(smallest.cards);
      return;
    }
  }
  const next = new Set(selected);
  if (next.has(card)) next.delete(card);
  else next.add(card);
  setSelected(next);
}

async function apply(seat: number, action: Action): Promise<boolean> {
  const result = rules.act(state, seat, action);
  if (!result.ok) return false;
  version++;
  state = result.state;
  busy = true;
  if (seat === ME) {
    selected.clear();
    hintIndex = 0;
  }
  board.setHint([]);
  showControls();
  await board.play(result.events, mine());
  busy = false;
  showHud();
  void persist();
  if (state.over) await endHand();
  else schedule();
  return true;
}

/** After every change: a bot that chops out of turn, then whoever's turn it is (SPEC.md, "Bots"). */
function schedule() {
  showControls();
  const s = rules.status(state);
  if (s.over || busy) return;
  const planned = version;
  const botSeat = (seat: number) => seat !== ME;
  const chopper = s.chop.filter(botSeat).find((seat) => rules.bot(state, seat, level, version * 7 + seat));
  const humanMayChop = s.chop.includes(ME);
  if (chopper === undefined && state.turn === ME) {
    sfx.play('pop', 4);
    haptics.play('tap');
    return;
  }
  const seat = chopper ?? state.turn;
  // A bot thinks 0.6–1.3 s; longer when the player could chop, so they have a moment to see it.
  const think = (chopper !== undefined ? 450 : 600 + ((version * 97) % 700)) + (humanMayChop ? 1600 : 0);
  void board.wait(think).then(async () => {
    if (planned !== version || busy) return;
    while (overlay.visible || paused) await board.wait(200);
    if (planned !== version) return;
    const action = rules.bot(state, seat, level, version * 31 + seat) ?? { type: 'pass' as const };
    if (!(await apply(seat, action)) && seat === state.turn) {
      await apply(seat, rules.timeout(state, seat));
    }
  });
}

async function play() {
  if (busy || state.over) return;
  const cards = [...selected];
  const error = check(mine(), cards);
  if (error) {
    board.reject();
    sfx.play('error');
    haptics.play('error');
    showControls();
    return;
  }
  await apply(ME, { type: 'play', cards });
}

async function pass() {
  if (busy || state.over || state.turn !== ME || !state.table) return;
  setSelected([]);
  await apply(ME, { type: 'pass' });
}

/** 💡 cycles through the plays the normal bot would make, best first. */
function hint() {
  const v = mine();
  const ranked = rank(v, legalPlays(v));
  if (ranked.length === 0) return;
  const choice = ranked[hintIndex % ranked.length] as Action;
  hintIndex++;
  sfx.play('click');
  if (choice.type === 'pass') {
    setSelected([]);
    passButton.classList.remove('bump');
    void passButton.offsetWidth;
    passButton.classList.add('bump');
    status.textContent = t.teach.pass;
  } else setSelected(choice.cards);
}

playButton.addEventListener('click', () => void play());
passButton.addEventListener('click', () => void pass());
hintButton.addEventListener('click', () => hint());
sortButton.addEventListener('click', () => {
  sortBy = sortBy === 'rank' ? 'combos' : 'rank';
  sfx.play('click');
  board.setSort(sortBy);
  showHud();
  void persist();
});

// ------------------------------------------------------------------ hands and tables

async function endHand() {
  const result = state.result;
  if (!result) return;
  handsPlayed++;
  series = series.map((points, seat) => points + (result.points[seat] ?? 0));
  stats.hands++;
  const place = result.ranking.indexOf(ME);
  stats.places[place] = (stats.places[place] ?? 0) + 1;
  if (!practiced) practiced = true;
  showHud();
  void persist();
  if (result.instant) {
    board.banner(`${t.instant} ${t.instantWins[result.instant.win]}`);
    board.celebrate();
    sfx.play('fanfare');
  }
  await board.wait(900);
  showResults();
}

function showResults() {
  const result = state.result;
  if (!result) return;
  const names = players();
  const table = document.createElement('div');
  table.className = 'results';
  const header = document.createElement('div');
  header.className = 'result-row result-header';
  for (const [text, name] of [
    ['', 'result-who'],
    [t.columnHand, 'result-points'],
    [t.columnTable, 'result-total'],
  ]) {
    const cell = document.createElement('span');
    cell.className = name as string;
    cell.textContent = text as string;
    header.append(cell);
  }
  table.append(header);
  result.ranking.forEach((seat, place) => {
    const row = document.createElement('div');
    row.className = `result-row${seat === ME ? ' is-me' : ''}`;
    const who = document.createElement('span');
    who.className = 'result-who';
    who.textContent = `${t.medals[place] ?? ''} ${names[seat]?.avatar ?? ''} ${names[seat]?.name ?? ''}`;
    const hand = document.createElement('span');
    hand.className = 'result-points';
    hand.textContent = signed(result.points[seat] ?? 0);
    const total = document.createElement('span');
    total.className = 'result-total';
    total.textContent = signed(series[seat] ?? 0);
    row.append(who, hand, total);
    table.append(row);
  });
  const extras = result.lines.filter((line) => line.kind !== 'place');
  if (extras.length > 0) {
    const list = document.createElement('ul');
    list.className = 'result-lines';
    for (const line of extras) {
      const item = document.createElement('li');
      item.textContent = `${t.lines[line.kind]}: ${names[line.from]?.name} → ${names[line.to]?.name} ${line.points}`;
      list.append(item);
    }
    table.append(list);
  }
  const won = result.ranking[0] === ME;
  overlay.show({
    icon: won ? '🏆' : '🃏',
    title: result.instant ? `${t.instant}` : t.results,
    body: result.instant ? t.instantWins[result.instant.win] : undefined,
    content: table,
    actions: [
      {
        label: t.nextHand,
        onClick: () => {
          sfx.play('click');
          overlay.hide();
          void nextHand();
        },
      },
      ...(session.mode === 'embedded'
        ? [{ label: t.exit, variant: 'secondary' as const, onClick: () => session.exit() }]
        : []),
    ],
  });
}

/** Deals the next hand at this table, or a new table when the number of players changed. */
async function nextHand() {
  const status = rules.status(state);
  const carry: Carry | null = status.over ? status.carry : null;
  if (seats !== state.seats) {
    await newTable();
    return;
  }
  await deal(rules.setup({ seats, seed: state.rng, options, carry }));
}

async function newTable() {
  series = Array.from({ length: seats }, () => 0);
  handsPlayed = 0;
  await deal(rules.setup({ seats, seed: (state.rng ^ 0x5bd1e995) >>> 0, options, carry: null }));
}

async function deal(next: State) {
  version++;
  state = next;
  selected.clear();
  hintIndex = 0;
  busy = true;
  board.setPlayers(players());
  showHud();
  showControls();
  void persist();
  await board.deal(mine());
  busy = false;
  showControls();
  if (state.over) await endHand();
  else schedule();
}

function persist(): Promise<void> {
  const data: Saved = {
    v: 1,
    state,
    series,
    hands: handsPlayed,
    seats,
    level,
    options,
    deck,
    sort: sortBy,
    tutorialSeen,
    practiced,
    stats,
  };
  return session.save(data).catch((error) => session.log('warn', `save failed: ${String(error)}`));
}

// ------------------------------------------------------------------ menu

const lifecycle = createLifecycle({
  overlay,
  strings: {
    ...lifecycleStrings(session.locale),
    newGame: t.newTable,
    confirmTitle: t.newTableTitle,
    confirmBody: t.newTableBody,
  },
  icon: '🃏',
  title: t.title,
  howTo: () => ({ icon: '🃏', title: t.title, content: hintList(t.hints) }),
  menuCards: [
    { label: t.menu.rules, card: () => ({ icon: '📜', title: t.menu.rules, content: houseRules() }) },
    { label: t.menu.table, card: () => ({ icon: '🪑', title: t.menu.table, content: tableSettings() }) },
    { label: t.menu.deck, card: () => ({ icon: '🎴', title: t.menu.deck, content: deckPicker() }) },
  ],
  onNewGame: () => {
    sfx.play('click');
    kit.resume();
    void newTable();
  },
  onResume: () => {
    if (!paused) kit.resume();
  },
});

const menuButton = document.createElement('button');
menuButton.type = 'button';
menuButton.className = 'tohe-icon-button';
menuButton.setAttribute('aria-label', lifecycleStrings(session.locale).menu);
menuButton.textContent = '⏸';
menuButton.addEventListener('click', () => {
  if (overlay.visible) return;
  kit.pause();
  lifecycle.openMenu();
});
document.querySelector('#menu-slot')?.append(menuButton);

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

/** ⏸ → Luật nhà: H1–H9, from the next hand on (SPEC.md, "House rules"). */
function houseRules(): HTMLElement {
  const box = document.createElement('div');
  box.className = 'tohe-choices';
  const set = (change: Partial<Options>) => {
    options = { ...options, ...change };
    void persist();
  };
  const h = t.houseRules;
  box.append(
    note(t.menu.nextHandNote),
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
          instantWins: INSTANT_WINS.filter((w) => (w === win ? on : options.instantWins.includes(w))),
        }),
      ),
    ),
  );
  return box;
}

/** ⏸ → Bàn chơi: players (a new table from the next hand) and the bots' level (at once). */
function tableSettings(): HTMLElement {
  const box = document.createElement('div');
  const counts: Choice<'2' | '3' | '4'>[] = (['2', '3', '4'] as const).map((n) => ({
    id: n,
    label: t.menu.players(Number(n)),
  }));
  const levels: Choice<Level>[] = LEVELS.map((id) => ({ id, label: t.menu.levels[id] }));
  box.append(
    note(t.menu.newTableNote),
    choiceList(counts, String(seats) as '2' | '3' | '4', (id) => {
      sfx.play('click');
      seats = Number(id);
      void persist();
    }),
    note(t.menu.level),
    choiceList(levels, level, (id) => {
      sfx.play('click');
      level = id;
      void persist();
    }),
  );
  return box;
}

/** ⏸ → Bộ bài: two or four suit colours, at once. */
function deckPicker(): HTMLElement {
  const choices: Choice<Deck>[] = DECKS.map((id) => ({ id, label: t.menu.decks[id] }));
  return choiceList(choices, deck, (id) => {
    sfx.play('click');
    deck = id;
    board.setDeck(id);
    void persist();
  });
}

window.addEventListener('keydown', (event) => {
  if (overlay.visible || event.target instanceof HTMLButtonElement) return;
  if (event.key === 'Escape') {
    kit.pause();
    lifecycle.openMenu();
  } else if (event.key === 'Enter') void play();
  else if (event.key.toLowerCase() === 'p') void pass();
  else if (event.key.toLowerCase() === 'h') hint();
  else return;
  event.preventDefault();
});

// ------------------------------------------------------------------ start

await board.whenReady;
board.relayout(kit.size().width, kit.size().height);
const fresh = !resumed || resumed.over || resumed.seats !== seats;

function begin() {
  if (fresh) void (resumed?.over ? nextHand() : deal(state));
  else {
    drawAll();
    schedule();
  }
}

if (!tutorialSeen) {
  board.setPlayers(players());
  showHud();
  overlay.show({
    icon: '🃏',
    title: t.title,
    content: hintList(t.hints),
    actions: [
      {
        label: t.start,
        onClick: () => {
          sfx.play('pop');
          haptics.play('tap');
          overlay.hide();
          tutorialSeen = true;
          begin();
        },
      },
    ],
  });
} else if (!fresh && state.moves > 0) {
  drawAll();
  lifecycle.offerContinue(t.inProgress);
  const waitForChoice = async () => {
    while (overlay.visible) await board.wait(150);
    schedule();
  };
  void waitForChoice();
} else begin();
