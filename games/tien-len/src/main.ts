// Wiring: SDK session, kit game, HUD, controls, overlays, saving, and the bots' turns. Rules live in rules.ts (via
// the rules module), bots in bots.ts, drawing in view.ts. Two modes (SPEC.md): one phone against bots, where this
// file referees with the rules module; and a table online (ADR 0016), where the server referees and this file sends
// actions and draws the views it receives.
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
import {
  connect,
  type JsonValue,
  REACTIONS,
  type Reaction,
  type RoomSeat,
  type RoomSession,
  type RoomUpdate,
} from '@tohe/game-sdk';
import { isLevel, LEVELS, type Level, rank } from './bots.ts';
import { cardName, RANK_LABELS } from './cardArt.ts';
import { type Card, type Combo, classify, rankOf } from './cards.ts';
import { rules } from './module.ts';
import { DECKS, type Deck, isDeck, TABLE } from './palette.ts';
import {
  type ActError,
  type Action,
  type Carry,
  check,
  DEFAULT_OPTIONS,
  type GameEvent,
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
/** Online (ADR 0016): the table this phone sits at; null against bots. */
const room = session.room as RoomSession<View> | null;
/** Online: the newest view from the server. */
let roomView: View | null = null;
/** Online: when the turn timer of the current turn runs out (ms since epoch), or null. */
let turnEndsAt: number | null = null;
/** Online: "next hand" was tapped, waiting for the others. */
let waitingNext = false;
/** A finished online hand to replay (ADR 0016): set up and played back with this rules module. */
const replay = session.replay;
let replayState: State | null = null;
let replayStep = 0;
let replayPlaying = false;
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
  if (replay) return replay.seats.map(seatPlayer);
  if (room) return room.seats.map(seatPlayer);
  const me: Player = { name: session.profile.name || t.you, avatar: session.profile.avatar || '🙂' };
  return [me, ...t.bots.slice(0, state.seats - 1)];
}

/** A seat at an online table: a person (🤖 while a bot plays for them, … while their phone is gone), or a bot. */
function seatPlayer(seat: RoomSeat): Player {
  if (seat.profile) {
    const mark = seat.bot ? ' 🤖' : seat.connected ? '' : ' …';
    return { name: `${seat.profile.name || t.you}${mark}`, avatar: seat.profile.avatar || '🙂' };
  }
  const level = seat.bot && seat.bot in t.menu.levels ? t.menu.levels[seat.bot as Level] : (seat.bot ?? '');
  return { name: t.botSeat(level), avatar: '🤖' };
}

/** This phone's seat: always 0 against bots; online, the seat the server gave it. */
const meSeat = (): number => (replay ? replay.seat : room ? (roomView?.seat ?? room.seat) : ME);

const mine = (): View => {
  if (replay && replayState) return rules.view(replayState, replay.seat);
  return room && roomView ? roomView : rules.view(state, ME);
};

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
  const score = replay ? 0 : room ? (room.seats[meSeat()]?.score ?? 0) : (series[ME] ?? 0);
  scoreValue.textContent = signed(score);
  handNo.textContent = replay
    ? t.replay.title
    : room
      ? meSeat() < 0
        ? t.watching
        : t.online
      : t.handNo(handsPlayed + (state.over ? 0 : 1));
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
  if (replay) {
    // The three buttons drive the replay: back, forward, play / pause.
    const total = replay.actions.length;
    passButton.textContent = `◀ ${t.replay.back}`;
    hintButton.textContent = `${t.replay.forward} ▶`;
    playButton.textContent = replayPlaying ? `⏸ ${t.replay.pause}` : `▶ ${t.replay.play}`;
    passButton.disabled = busy || replayStep === 0;
    hintButton.disabled = busy || replayStep >= total;
    playButton.disabled = replayStep >= total && !replayPlaying;
    status.textContent = t.replay.step(replayStep, total);
    return;
  }
  if (room && !roomView) {
    playButton.disabled = passButton.disabled = hintButton.disabled = true;
    status.textContent = '…';
    return;
  }
  const v = mine();
  const me = meSeat();
  const myTurn = !v.over && v.turn === me && !v.cong.includes(me) && v.hand.length > 0;
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
      error === 'must_beat' && v.table && (v.turn === me || canChop)
        ? t.mustBeat(describe(v.table))
        : t.errors[error];
  } else if (cards.length > 0) line = describe(classify(cards) as Combo);
  else if (myTurn) line = teaching(v) ?? t.yourTurn;
  else if (canChop) line = t.teach.chop;
  else line = `${players()[v.turn]?.name ?? ''} …`;
  // Online, the turn timer counts down on the status line (SPEC.md, "Screens").
  if (room && turnEndsAt !== null && !v.over && cards.length === 0) {
    line = `${line} · ${Math.max(0, Math.ceil((turnEndsAt - Date.now()) / 1000))}s`;
  }
  if (room && v.over && waitingNext) line = t.waitingOthers;
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
  if (!room) schedule();
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
  if (!room || roomView) board.render(mine());
  board.setSelected(selected);
  showHud();
  showControls();
}

/** A tap on a card: toggles it; with nothing selected, picks the smallest play with it that beats the table. */
function tap(card: Card) {
  if (mine().over || replay) return;
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
  if (replay) {
    replayPlaying = !replayPlaying;
    showControls();
    if (replayPlaying) void runReplay();
    return;
  }
  const v = mine();
  if (busy || v.over) return;
  const cards = [...selected];
  const error = check(v, cards);
  if (error) {
    board.reject();
    sfx.play('error');
    haptics.play('error');
    showControls();
    return;
  }
  if (room) await sendOnline({ type: 'play', cards });
  else await apply(ME, { type: 'play', cards });
}

async function pass() {
  if (replay) {
    replayPlaying = false;
    await replayBack();
    return;
  }
  const v = mine();
  if (busy || v.over || v.turn !== meSeat() || !v.table) return;
  setSelected([]);
  if (room) await sendOnline({ type: 'pass' });
  else await apply(ME, { type: 'pass' });
}

/** Online: the server referees; a refusal comes back with the rules' error code, shown in words. */
async function sendOnline(action: Action) {
  if (!room) return;
  busy = true;
  showControls();
  try {
    await room.act(action as unknown as JsonValue);
    hintIndex = 0;
    board.setHint([]);
  } catch (error) {
    const code = (error instanceof Error ? error.message : '') as ActError;
    board.reject();
    sfx.play('error');
    haptics.play('error');
    busy = false;
    showControls();
    status.textContent = t.errors[code] ?? code;
    return;
  }
  busy = false;
  showControls();
}

/** 💡 cycles through the plays the normal bot would make, best first. */
function hint() {
  if (replay) {
    replayPlaying = false;
    void replayForward();
    return;
  }
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
  const result = replay ? replayState?.result : room ? roomView?.result : state.result;
  if (!result) return;
  const me = meSeat();
  const names = players();
  const table = document.createElement('div');
  table.className = 'results';
  const header = document.createElement('div');
  header.className = 'result-row result-header';
  // A replay has no score sheet: only the hand's points.
  const columns = [
    ['', 'result-who'],
    [t.columnHand, 'result-points'],
    ...(replay ? [] : [[t.columnTable, 'result-total']]),
  ];
  for (const [text, name] of columns) {
    const cell = document.createElement('span');
    cell.className = name as string;
    cell.textContent = text as string;
    header.append(cell);
  }
  table.append(header);
  result.ranking.forEach((seat, place) => {
    const row = document.createElement('div');
    row.className = `result-row${seat === me ? ' is-me' : ''}`;
    const who = document.createElement('span');
    who.className = 'result-who';
    who.textContent = `${t.medals[place] ?? ''} ${names[seat]?.avatar ?? ''} ${names[seat]?.name ?? ''}`;
    const hand = document.createElement('span');
    hand.className = 'result-points';
    hand.textContent = signed(result.points[seat] ?? 0);
    row.append(who, hand);
    if (!replay) {
      const total = document.createElement('span');
      total.className = 'result-total';
      total.textContent = signed(room ? (room.seats[seat]?.score ?? 0) : (series[seat] ?? 0));
      row.append(total);
    }
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
  const won = result.ranking[0] === me;
  const nextAction = {
    label: replay ? t.replay.again : t.nextHand,
    onClick: () => {
      sfx.play('click');
      overlay.hide();
      if (replay) {
        void replayFromStart();
        return;
      }
      if (room) {
        // The next hand starts when everyone is ready, or after a countdown (docs/architecture/rooms.md).
        waitingNext = true;
        showControls();
        void room.next().catch((error) => session.log('warn', `next failed: ${String(error)}`));
      } else void nextHand();
    },
  };
  overlay.show({
    icon: won ? '🏆' : '🃏',
    title: result.instant ? `${t.instant}` : t.results,
    body: result.instant ? t.instantWins[result.instant.win] : undefined,
    content: table,
    actions: [
      // A spectator has no hand to be ready for: the table goes on by itself.
      ...(room && me < 0 ? [] : [nextAction]),
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
menuButton.addEventListener('click', () => openMenu());
document.querySelector('#menu-slot')?.append(menuButton);

function openMenu() {
  if (overlay.visible) return;
  if (room) {
    openTableMenu();
    return;
  }
  kit.pause();
  lifecycle.openMenu();
}

/**
 * The ⏸ menu at an online table: the table goes on (nothing to pause), the room's house rules are the host's, and
 * leaving goes through the hub (it asks whether to give the seat up).
 */
function openTableMenu() {
  const life = lifecycleStrings(session.locale);
  const back = () => openTableMenu();
  overlay.show({
    icon: '🃏',
    title: t.title,
    actions: [
      { label: life.resume, onClick: () => overlay.hide() },
      {
        label: life.howTo,
        variant: 'secondary',
        onClick: () =>
          overlay.show({
            icon: '🃏',
            title: t.title,
            content: hintList(t.hints),
            actions: [{ label: life.back, onClick: back }],
          }),
      },
      {
        label: t.menu.tableRules,
        variant: 'secondary',
        onClick: () =>
          overlay.show({
            icon: '📜',
            title: t.menu.tableRules,
            content: tableRules(normalizeOptions(room?.options)),
            actions: [{ label: life.back, onClick: back }],
          }),
      },
      {
        label: t.menu.deck,
        variant: 'secondary',
        onClick: () =>
          overlay.show({
            icon: '🎴',
            title: t.menu.deck,
            content: deckPicker(),
            actions: [{ label: life.back, onClick: back }],
          }),
      },
      { label: t.leaveTable, variant: 'secondary', onClick: () => session.exit() },
    ],
  });
}

/** The room's house rules, as the host chose them (read only). */
function tableRules(rules: Options): HTMLElement {
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
  return hintList(rows.map(([text, on]) => ({ icon: on ? '✅' : '➖', text })));
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
  if (event.key === 'Escape') openMenu();
  else if (event.key === 'Enter') void play();
  else if (event.key.toLowerCase() === 'p') void pass();
  else if (event.key.toLowerCase() === 'h') hint();
  else return;
  event.preventDefault();
});

// ------------------------------------------------------------------ start

await board.whenReady;
board.relayout(kit.size().width, kit.size().height);
const fresh = !resumed || resumed.over || resumed.seats !== seats;

// ------------------------------------------------------------------ online (ADR 0016)

/** Views are drawn one at a time, each with its events animated, in the order they came. */
const updates: RoomUpdate<View>[] = [];
let drawing = false;

function onRoomView(update: RoomUpdate<View>) {
  updates.push(update);
  if (drawing) return;
  drawing = true;
  void (async () => {
    while (updates.length > 0) await showRoomView(updates.shift() as RoomUpdate<View>);
    drawing = false;
  })();
}

async function showRoomView(update: RoomUpdate<View>) {
  const view = update.view;
  const before = roomView;
  roomView = view;
  turnEndsAt = update.turnMs === null ? null : Date.now() + update.turnMs;
  const newHand =
    !before ||
    view.moves < before.moves ||
    (before.over && view.moves === 0) ||
    (view.moves === 0 && before.hand.join() !== view.hand.join());
  if (newHand) {
    waitingNext = false;
    if (before) overlay.hide();
    selected.clear();
    hintIndex = 0;
    board.setPlayers(players());
    if (view.moves === 0 && !view.over) {
      busy = true;
      await board.deal(view);
      busy = false;
    } else board.render(view);
  } else if (update.events.length > 0) {
    busy = true;
    showControls();
    await board.play(update.events as unknown as GameEvent[], view);
    busy = false;
  } else board.render(view);
  selected = new Set([...selected].filter((card) => view.hand.includes(card)));
  board.setSelected(selected);
  showHud();
  showControls();
  const me = meSeat();
  if (!view.over && view.turn === me && (newHand || before?.turn !== me)) {
    sfx.play('pop', 4);
    haptics.play('tap');
  }
  if (view.over && (newHand || !before?.over)) await endOnlineHand(view);
}

async function endOnlineHand(view: View) {
  const result = view.result;
  if (!result) return;
  stats.hands++;
  const place = result.ranking.indexOf(meSeat());
  if (place >= 0) stats.places[place] = (stats.places[place] ?? 0) + 1;
  if (!practiced) practiced = true;
  void persist();
  if (result.instant) {
    board.banner(`${t.instant} ${t.instantWins[result.instant.win]}`);
    board.celebrate();
    sfx.play('fanfare');
  }
  // The room's score sheet arrives just after the last view: wait for it before showing totals.
  await board.wait(900);
  showResults();
}

/** 😀: a preset reaction for the table (no typed text). */
function openReactions() {
  if (!room || overlay.visible) return;
  const grid = document.createElement('div');
  grid.className = 'reactions';
  for (const reaction of Object.keys(REACTIONS) as Reaction[]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'reaction';
    button.textContent = `${REACTIONS[reaction]} ${t.reactions[reaction]}`;
    button.addEventListener('click', () => {
      sfx.play('click');
      room.react(reaction);
      overlay.hide();
    });
    grid.append(button);
  }
  overlay.show({
    icon: '😀',
    title: t.react,
    content: grid,
    actions: [
      { label: lifecycleStrings(session.locale).back, variant: 'secondary', onClick: () => overlay.hide() },
    ],
  });
}

// ------------------------------------------------------------------ replay (ADR 0016)

/** The hand as it was dealt. */
function replayStart(): State {
  if (!replay) return state;
  return rules.setup({
    seats: replay.seats.length,
    seed: replay.seed,
    options: replay.options,
    carry: replay.carry as Carry | null,
  });
}

async function replayFromStart() {
  replayState = replayStart();
  replayStep = 0;
  replayPlaying = true;
  board.setPlayers(players());
  busy = true;
  showHud();
  showControls();
  await board.deal(mine());
  busy = false;
  showControls();
  void runReplay();
}

/** One action forward, animated as it was played. */
async function replayForward(): Promise<boolean> {
  if (!replay || !replayState || busy) return false;
  const next = replay.actions[replayStep];
  if (!next) return false;
  const result = rules.act(replayState, next.seat, next.action as unknown as Action);
  if (!result.ok) {
    session.log('error', `replay refused step ${replayStep}: ${result.error}`);
    replayPlaying = false;
    showControls();
    return false;
  }
  replayState = result.state;
  replayStep++;
  busy = true;
  showControls();
  await board.play(result.events, mine());
  busy = false;
  showControls();
  if (replayState.over) {
    replayPlaying = false;
    showControls();
    await board.wait(700);
    showResults();
  }
  return true;
}

/** One action back: the hand is rebuilt from its deal (the rules module is deterministic). */
async function replayBack() {
  if (!replay || replayStep === 0 || busy) return;
  let rebuilt = replayStart();
  for (const step of replay.actions.slice(0, replayStep - 1)) {
    const result = rules.act(rebuilt, step.seat, step.action as unknown as Action);
    if (result.ok) rebuilt = result.state;
  }
  replayState = rebuilt;
  replayStep--;
  board.render(mine());
  showControls();
}

async function runReplay() {
  while (replayPlaying && (await replayForward())) {
    await board.wait(650);
  }
  replayPlaying = false;
  showControls();
}

if (replay) {
  document.body.classList.add('is-replay');
  void replayFromStart();
} else if (room) {
  if (meSeat() < 0) document.body.classList.add('is-watching');
  const reactButton = document.createElement('button');
  reactButton.type = 'button';
  reactButton.className = 'tohe-icon-button';
  reactButton.setAttribute('aria-label', t.react);
  reactButton.textContent = '😀';
  reactButton.addEventListener('click', () => openReactions());
  // Spectators watch: they have no seat to react from.
  if (meSeat() >= 0) sortButton.before(reactButton);
  room.onSeats(() => {
    board.setPlayers(players());
    showHud();
    showControls();
  });
  room.onReaction((seat, reaction) => board.bubble(seat, `${REACTIONS[reaction]} ${t.reactions[reaction]}`));
  room.onView((update) => onRoomView(update));
  setInterval(() => {
    if (turnEndsAt !== null && !busy) showControls();
  }, 1000);
  board.setPlayers(players());
  showHud();
  showControls();
  if (room.latest) onRoomView(room.latest);
}

function begin() {
  if (fresh) void (resumed?.over ? nextHand() : deal(state));
  else {
    drawAll();
    schedule();
  }
}

if (room || replay) {
  // Online the table is the server's, and a replay plays itself: no intro to wait on.
} else if (!tutorialSeen) {
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
