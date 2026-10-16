// The play stage (ADR 0020): the table, the HUD, the controls and the bots' turns — against bots on this phone, at an
// online table refereed by the server (ADR 0016), or replaying a finished hand. The shell creates it when the player
// presses play (or at once at a table) and destroys it when they go back to the menu; leave() saves and stops
// everything start() started. Rules live in rules.ts (via the rules module), bots in bots.ts, drawing in view.ts,
// the save in app.ts.
import {
  createHud,
  haptics,
  type PlayStage,
  type StageContext,
  shellStrings,
  type Theme,
} from '@tohe/game-kit';
import { createGame } from '@tohe/game-kit/phaser';
import { type JsonValue, REACTIONS, type Reaction, type RoomSeat, type RoomUpdate } from '@tohe/game-sdk';
import { ME, replay, persist as saveStore, session, sfx, store, t, room as table } from './app.ts';
import { type Level, rank } from './bots.ts';
import { cardName, RANK_LABELS } from './cardArt.ts';
import { type Card, type Combo, classify, rankOf } from './cards.ts';
import { rules } from './module.ts';
import { DECKS, type Deck, TABLE } from './palette.ts';
import {
  type ActError,
  type Action,
  type Carry,
  check,
  type GameEvent,
  legalPlays,
  normalizeOptions,
  type State,
  type View,
} from './rules.ts';
import { tableRules } from './settings.ts';
import { type Player, TableScene } from './view.ts';

export async function start(ctx: StageContext): Promise<PlayStage> {
  /** Online (ADR 0016): the table this phone sits at; null against bots. A local copy keeps its type in closures. */
  const room = table;
  /** Listeners and timers to stop in leave(). */
  const cleanups: (() => void)[] = [];
  /** Set by leave(): what still animates stops there. */
  let left = false;

  // The table from the save; the settings were chosen in the menu stage.
  const seats = store.seats;
  const level = store.level;
  const options = store.options;
  let deck = store.deck;
  let sortBy = store.sort;
  let practiced = store.practiced;
  const stats = store.stats;
  let state: State = store.state;
  let series = store.series;
  let handsPlayed = store.hands;
  let dealt = store.dealt;
  /** Online: the newest view from the server. */
  let roomView: View | null = null;
  /** Online: when the turn timer of the current turn runs out (ms since epoch), or null. */
  let turnEndsAt: number | null = null;
  /** Online: "next hand" was tapped, waiting for the others. */
  let waitingNext = false;
  let replayState: State | null = null;
  let replayStep = 0;
  let replayPlaying = false;

  /** Writes the table back to the save. */
  function persist(): Promise<void> {
    Object.assign(store, { deck, sort: sortBy, practiced, state, series, hands: handsPlayed, dealt });
    return saveStore();
  }

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

  const template = document.querySelector<HTMLTemplateElement>('#play-stage') as HTMLTemplateElement;
  ctx.root.append(template.content.cloneNode(true));
  const stage = ctx.root.querySelector<HTMLElement>('#stage') as HTMLElement;
  const status = ctx.root.querySelector('#status') as HTMLElement;
  const passButton = ctx.root.querySelector('#pass') as HTMLButtonElement;
  const hintButton = ctx.root.querySelector('#hint') as HTMLButtonElement;
  const playButton = ctx.root.querySelector('#play') as HTMLButtonElement;
  passButton.textContent = t.pass;
  hintButton.textContent = `💡 ${t.hint}`;

  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

  function showHud() {
    const score = replay ? 0 : room ? (room.seats[meSeat()]?.score ?? 0) : (series[ME] ?? 0);
    tableScore.set(score);
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

  // Light/dark follows the hub (ADR 0013): the page through the menu stage's followTheme, the table here.
  cleanups.push(
    session.on('settings', (settings) => {
      if (settings.theme === theme) return;
      theme = settings.theme;
      board.setTheme(theme);
      kit.setBackground(TABLE[theme].background);
    }),
  );
  kit.onResize((size) => board.relayout(size.width, size.height));
  kit.onRestart(async (scene) => {
    board = scene;
    await board.whenReady;
    board.relayout(kit.size().width, kit.size().height);
    drawAll();
    busy = false;
    if (!room) schedule();
  });

  // At a table the menu stops nothing, so the shell leaves the table on screen when the hub hides this phone: drawing
  // waits until it is back (the views queue up). Against bots and in a replay the shell opens its menu instead.
  if (room) {
    cleanups.push(
      session.on('pause', () => {
        paused = true;
        kit.pause();
      }),
      session.on('resume', () => {
        paused = false;
        if (!overlay.visible) kit.resume();
      }),
    );
  }

  const overlay = ctx.overlay;

  // ☰ | table score | hand number | (😀) sort — the kit's HUD.
  const hud = createHud({ menu: ctx.menuButton(), parent: ctx.root, locale: session.locale });
  const tableScore = hud.stat(t.tableScore, { format: signed });
  const handNo = document.createElement('span');
  handNo.className = 'hand-no';
  hud.center.append(handNo);
  const sortButton = document.createElement('button');
  sortButton.type = 'button';
  sortButton.className = 'sort';
  hud.end.append(sortButton);

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
      if (left || planned !== version || busy) return;
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
    const card = {
      icon: won ? '🏆' : '🃏',
      title: result.instant ? `${t.instant}` : t.results,
      body: result.instant ? t.instantWins[result.instant.win] : undefined,
      content: table,
    };
    // Against bots and in a replay the hand is over: the shell's end card (Back goes to the title screen). At a table
    // the table goes on: the next hand, or for a spectator the way out, on the game's own card.
    if (!room) {
      ctx.gameOver(card, nextAction);
      return;
    }
    const leave = { label: t.stopWatching, variant: 'secondary' as const, onClick: () => session.exit() };
    overlay.show({ ...card, actions: me < 0 ? [leave] : [nextAction] });
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
    dealt = true;
    state = next;
    selected.clear();
    hintIndex = 0;
    busy = true;
    board.setPlayers(players());
    showHud();
    showControls();
    void persist();
    await board.deal(mine());
    if (left) return;
    busy = false;
    showControls();
    if (state.over) await endHand();
    else schedule();
  }

  const onKey = (event: KeyboardEvent) => {
    if (overlay.visible || event.target instanceof HTMLButtonElement) return;
    if (event.key === 'Enter') void play();
    else if (event.key.toLowerCase() === 'p') void pass();
    else if (event.key.toLowerCase() === 'h') hint();
    else return;
    event.preventDefault();
  };
  window.addEventListener('keydown', onKey);

  await board.whenReady;
  board.relayout(kit.size().width, kit.size().height);

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
        { label: shellStrings(session.locale).back, variant: 'secondary', onClick: () => overlay.hide() },
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
    cleanups.push(
      room.onSeats(() => {
        board.setPlayers(players());
        showHud();
        showControls();
      }),
      room.onReaction((seat, reaction) =>
        board.bubble(seat, `${REACTIONS[reaction]} ${t.reactions[reaction]}`),
      ),
      room.onView((update) => onRoomView(update)),
    );
    const ticking = setInterval(() => {
      if (turnEndsAt !== null && !busy) showControls();
    }, 1000);
    cleanups.push(() => clearInterval(ticking));
    board.setPlayers(players());
    showHud();
    showControls();
    if (room.latest) onRoomView(room.latest);
  }

  /** Chơi: continue the hand on the table, deal the next one of the series, or the first one. */
  function startPlay() {
    if (dealt && !state.over) {
      drawAll();
      schedule();
    } else if (state.over) void nextHand();
    else void deal(state);
  }

  if (!room && !replay) {
    // Online the table is the server's, and a replay plays itself. Against bots: the table as it was left, then play.
    if (dealt) drawAll();
    else {
      board.setPlayers(players());
      showHud();
    }
  }
  ctx.ready();
  if (!room && !replay) {
    if (ctx.fresh) void newTable();
    else startPlay();
  }

  return {
    // Against bots everything stops for the panel; a table goes on (its views keep animating), a replay stops playing.
    pause() {
      if (room) return;
      if (replay) {
        replayPlaying = false;
        showControls();
      }
      kit.pause();
    },
    resume() {
      if (!room) kit.resume();
    },
    newGame() {
      sfx.play('click');
      void newTable();
    },
    quick: () => [
      {
        kind: 'choices',
        icon: '🎴',
        label: t.menu.deck,
        choices: DECKS.map((id) => ({ id, label: t.menu.decks[id] })),
        chosen: deck,
        onChoose: (id) => {
          sfx.play('click');
          deck = id as Deck;
          board.setDeck(deck);
          void persist();
        },
      },
      ...(room
        ? [
            {
              kind: 'info' as const,
              icon: '📜',
              label: t.menu.tableRules,
              card: () => ({
                icon: '📜',
                title: t.menu.tableRules,
                content: tableRules(normalizeOptions(room.options)),
              }),
            },
          ]
        : []),
    ],
    leave() {
      left = true;
      window.removeEventListener('keydown', onKey);
      for (const cleanup of cleanups) cleanup();
      void persist();
      kit.destroy();
    },
  };
}
