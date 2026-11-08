// The play stage (ADR 0020): the board, the tray, the HUD and the moves. Rules live in logic.ts; this file only reads
// input, calls the rules and animates their events. The board is DOM: 64 buttons, three piece buttons, CSS blocks.
import {
  choiceList,
  createHud,
  haptics,
  icon,
  newRunId,
  type OverlayAction,
  type PlayStage,
  prefersReducedMotion,
  type StageContext,
} from '@tohe/game-kit';
import {
  dropParked,
  finishGame,
  journeyStars,
  nextSeed,
  parkActive,
  parkedRun,
  persist,
  resumeParked,
  scoreText,
  session,
  sfx,
  store,
  t,
} from './app.ts';
import { chapterOf, DAILY_GOALS, DAILY_MOVES, dailySeed, LEVEL_BY_ID, LEVELS } from './content/levels.ts';
import { bounds, type Shape, shapeById } from './content/shapes.ts';
import { SKINS, skinById } from './content/skins.ts';
import {
  anyPieceFits,
  anyShapeFits,
  completed,
  finish,
  type Goal,
  goalMet,
  hint,
  newGame,
  place,
  placements,
  preview,
  rescue,
  type State,
  starsFor,
} from './logic.ts';
import { DEFAULT_PALETTE, isPalette, PALETTE_COLOURS, PALETTE_IDS } from './palette.ts';
import { dailyDateOf, isLive, MODE_SLOTS, type ModeSlot, nextLevelId, slotOf } from './runs.ts';
import { paletteLabel, todayId } from './strings.ts';

interface Started {
  state: State;
  goals: readonly Goal[];
  runId: string;
}

const goalsFor = (state: State): readonly Goal[] => {
  if (state.mode === 'journey' && state.level) return LEVEL_BY_ID.get(state.level)?.goals ?? [];
  if (state.mode === 'daily') return DAILY_GOALS;
  return [];
};

const startLevel = (id: string): Started => {
  const level = LEVEL_BY_ID.get(id);
  if (!level) return startEndless();
  return {
    state: newGame(level.seed, store.best, {
      mode: 'journey',
      level: level.id,
      moveLimit: level.moveLimit,
      profile: level.profile,
    }),
    goals: level.goals,
    runId: newId(),
  };
};

const startDaily = (date: string): Started => ({
  state: newGame(dailySeed(date), store.best, {
    mode: 'daily',
    level: `daily-${date}`,
    moveLimit: DAILY_MOVES,
    profile: 'all',
  }),
  goals: DAILY_GOALS,
  runId: newId(),
});

const startEndless = (): Started => ({
  state: newGame(nextSeed(), store.best, { mode: 'endless', profile: 'all' }),
  goals: [],
  runId: newId(),
});

const newId = (): string => newRunId();

const fromRun = (state: State, runId: string | null): Started => ({
  state,
  goals: goalsFor(state),
  runId: runId ?? newId(),
});

/** The next journey level to offer: the first without a star, else the last one. */
const nextJourney = (): string =>
  nextLevelId(
    store.journey,
    LEVELS.map((level) => level.id),
  );

/** Ends the live score of a run a new one replaces, so the board does not keep it open. */
const closeRun = (state: State): void => {
  if (store.run)
    void session
      .run(store.run)
      .finish(state.score)
      .catch((error) => session.log('warn', String(error)));
};

/**
 * A mode chosen on the pre-play screen: resume that mode's run (the active one or a parked one), or start a fresh one.
 * A run of another mode is parked first, never thrown away. `fresh` (a "Ván mới" on the mode) replaces the mode's run.
 */
function modeStart(slot: ModeSlot, fresh: boolean): Started {
  const active = isLive(store.game) ? store.game : null;
  if (!fresh && active && slotOf(active) === slot) return fromRun(active, store.run);
  if (active && slotOf(active) !== slot) parkActive();
  if (fresh) {
    dropParked(slot);
    if (active && slotOf(active) === slot) closeRun(active);
    return slot === 'journey'
      ? startLevel(nextJourney())
      : slot === 'daily'
        ? startDaily(todayId())
        : startEndless();
  }
  const parked = resumeParked(slot);
  if (parked) return fromRun(parked.state, parked.runId);
  return slot === 'journey'
    ? startLevel(nextJourney())
    : slot === 'daily'
      ? startDaily(todayId())
      : startEndless();
}

/** A level from the journey screen: resume it when it is the live journey, or start it (the screen confirmed). */
function levelStart(levelId: string, restart = false): Started {
  const active = isLive(store.game) ? store.game : null;
  if (!restart && active?.mode === 'journey' && active.level === levelId) return fromRun(active, store.run);
  const parked = parkedRun('journey');
  if (!restart && parked?.level === levelId) {
    if (active?.mode === 'journey') closeRun(active);
    else if (active) parkActive();
    const resumed = resumeParked('journey');
    return resumed ? fromRun(resumed.state, resumed.runId) : startLevel(levelId);
  }
  if (active?.mode === 'journey') closeRun(active);
  else if (active) parkActive();
  dropParked('journey');
  return startLevel(levelId);
}

/** Today's daily: resume it when it is live or parked, otherwise start it (or a practice run). */
function dailyStart(date: string, restart = false): Started {
  const active = isLive(store.game) ? store.game : null;
  if (!restart && active?.mode === 'daily' && dailyDateOf(active) === date) return fromRun(active, store.run);
  if (active?.mode === 'daily') closeRun(active);
  else if (active) parkActive();
  const parked = parkedRun('daily');
  if (!restart && parked && dailyDateOf(parked) === date) {
    const resumed = resumeParked('daily');
    return resumed ? fromRun(resumed.state, resumed.runId) : startDaily(date);
  }
  if (parked) dropParked('daily');
  return startDaily(date);
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const iconSpan = (name: Parameters<typeof icon>[0], className = 'ui-icon') => {
  const span = el('span', className);
  span.setAttribute('aria-hidden', 'true');
  span.append(icon(name));
  return span;
};

const shapeGrid = (shape: Shape): HTMLElement => {
  const { rows, cols } = bounds(shape);
  const grid = el('span', 'piece-grid');
  grid.style.setProperty('--cols', String(cols));
  grid.style.setProperty('--rows', String(rows));
  const cells = new Set(shape.cells.map(([row, col]) => `${row},${col}`));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = el('i', 'piece-cell');
      if (cells.has(`${row},${col}`)) {
        cell.classList.add('is-filled');
        cell.dataset.colour = String(shape.colour);
      }
      grid.append(cell);
    }
  }
  return grid;
};

export function start(ctx: StageContext): PlayStage {
  const template = document.querySelector<HTMLTemplateElement>('#play-stage') as HTMLTemplateElement;
  ctx.root.append(template.content.cloneNode(true));
  const stage = ctx.root.querySelector<HTMLElement>('#stage') as HTMLElement;
  const board = ctx.root.querySelector<HTMLElement>('#board') as HTMLElement;
  const boardArea = ctx.root.querySelector<HTMLElement>('#board-area') as HTMLElement;
  const deck = ctx.root.querySelector<HTMLElement>('#deck') as HTMLElement;
  const tray = ctx.root.querySelector<HTMLElement>('#tray') as HTMLElement;
  const actions = ctx.root.querySelector<HTMLElement>('#actions') as HTMLElement;
  const previewBadge = ctx.root.querySelector<HTMLElement>('#preview') as HTMLElement;
  const message = ctx.root.querySelector<HTMLElement>('#message') as HTMLElement;
  board.setAttribute('aria-label', t.boardLabel);
  boardArea.setAttribute('aria-label', t.boardLabel);
  deck.setAttribute('aria-label', t.trayLabel);
  tray.setAttribute('aria-label', t.trayLabel);

  // ------------------------------------------------------------------ the game: a level, the daily, a resume or endless

  const pending = ctx.fresh ? { ...store.pending } : {};
  if (ctx.fresh) store.pending = {};
  const choice = ctx.fresh ? ctx.choice : null;
  const slot = choice?.replace('new:', '') as ModeSlot | undefined;
  let started: Started;
  if (ctx.fresh && slot && MODE_SLOTS.includes(slot))
    started = modeStart(slot, choice?.startsWith('new:') === true);
  else if (ctx.fresh && pending.level) started = levelStart(pending.level, pending.restart === true);
  else if (ctx.fresh && pending.daily) started = dailyStart(pending.daily, pending.restart === true);
  else if (!ctx.fresh && store.game && !store.game.over) started = fromRun(store.game, store.run);
  else started = startEndless();

  let state = started.state;
  let goals = started.goals;
  let runId = started.runId;
  let run = session.run(runId);
  let finished = false;
  let busy = false;
  let paused = false;
  let left = false;
  let selected: number | null = null;
  let previous: State | null = null;
  let undoUsed = false;
  let hintTimer: ReturnType<typeof setTimeout> | null = null;
  let messageTimer: ReturnType<typeof setTimeout> | null = null;

  const save = () => {
    store.game = state;
    store.run = runId;
    return persist();
  };

  // ------------------------------------------------------------------ HUD: Menu | score | goals/combo | best

  const hud = createHud({ menu: ctx.menuButton(), parent: ctx.root, locale: session.locale });
  const scores = hud.score({ score: t.score, best: t.best });
  scores.setBest(store.best);
  const center = el('div', 'stage-center');
  hud.center.append(center);

  // ------------------------------------------------------------------ board and tray

  const cells: HTMLButtonElement[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const cell = el('button', 'cell');
      cell.type = 'button';
      cell.tabIndex = -1;
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.setAttribute('aria-label', t.cell(row + 1, col + 1));
      cell.addEventListener('click', () => {
        if (selected === null || busy) return;
        tryPlace(selected, row, col);
      });
      cell.addEventListener('pointermove', () => {
        if (selected === null || busy) return;
        showGhost(selected, row, col);
      });
      cell.addEventListener('pointerleave', () => clearGhost());
      board.append(cell);
      cells.push(cell);
    }
  }

  const cellAt = (row: number, col: number): HTMLButtonElement | undefined => cells[row * 8 + col];

  const applyLooks = () => {
    const skin = skinById(store.settings.skin);
    if (!skin || skin.at > journeyStars()) store.settings.skin = 'paper';
    const palette = isPalette(store.settings.palette) ? store.settings.palette : DEFAULT_PALETTE;
    store.settings.palette = palette;
    stage.dataset.palette = palette;
    stage.dataset.skin = store.settings.skin;
    PALETTE_COLOURS[palette].forEach((colour, index) => {
      stage.style.setProperty(`--p${index + 1}`, colour);
    });
  };

  function renderBoard(): void {
    for (let index = 0; index < cells.length; index++) {
      const cell = cells[index] as HTMLButtonElement;
      const colour = state.board[index] ?? 0;
      const blocked = state.blocked[index] === 1;
      if (colour > 0) cell.dataset.colour = String(colour);
      else delete cell.dataset.colour;
      cell.classList.toggle('is-filled', colour > 0);
      cell.classList.toggle('is-blocked', blocked);
      cell.classList.toggle('is-over', state.over);
    }
    board.classList.toggle('is-busy', busy);
  }

  function pieceButton(pieceIndex: number, shape: Shape, unfits: boolean): HTMLButtonElement {
    const button = el('button', 'piece');
    button.type = 'button';
    button.dataset.piece = String(pieceIndex);
    button.setAttribute('aria-label', t.piece(pieceIndex + 1));
    button.classList.toggle('is-selected', selected === pieceIndex);
    button.classList.toggle('is-unfit', unfits);
    button.disabled = unfits || busy;
    button.append(shapeGrid(shape));
    button.addEventListener('click', () => {
      if (suppressClick) return;
      selected = selected === pieceIndex ? null : pieceIndex;
      sfx.play('click');
      haptics.play('tap');
      clearHint();
      render();
    });
    button.addEventListener('pointerdown', (event) => beginDrag(event, pieceIndex, shape));
    return button;
  }

  function renderTray(): void {
    tray.replaceChildren();
    state.tray.forEach((id, index) => {
      const shape = shapeById(id);
      if (!shape) return;
      const unfits = placements(state.board, state.blocked, shape).length === 0;
      tray.append(pieceButton(index, shape, unfits));
    });
    tray.classList.toggle('is-busy', busy);
  }

  function renderCenter(): void {
    center.replaceChildren();
    const meter = el('div', 'hud-meter');
    if (goals.length > 0) {
      const met = starsFor(state, goals);
      const goal = el('span', 'goal-count', t.ofTotal(met, goals.length));
      goal.title = goals.map((item) => t.goal(item.kind, item.value)).join(' · ');
      goal.setAttribute('aria-label', t.ofTotal(met, goals.length));
      meter.append(goal);
    }
    const pips = el('span', 'combo-pips');
    pips.setAttribute('aria-hidden', 'true');
    for (let step = 1; step <= 8; step++) {
      pips.append(el('i', step <= state.combo ? 'combo-pip is-on' : 'combo-pip'));
    }
    meter.append(pips, el('span', 'combo-label', `×${state.combo}`));
    if (state.shields > 0) {
      const shields = el('span', 'shield-row');
      shields.setAttribute('aria-label', t.shieldLeft(state.shields));
      for (let i = 0; i < state.shields; i++) shields.append(iconSpan('shield', 'ui-icon shield-icon'));
      meter.append(shields);
    }
    meter.setAttribute(
      'aria-label',
      `${t.combo(state.combo)}${goals.length > 0 ? ` · ${t.ofTotal(starsFor(state, goals), goals.length)}` : ''}${state.shields > 0 ? ` · ${t.shieldLeft(state.shields)}` : ''}`,
    );
    center.append(meter);
  }

  const undoButton = el('button', 'stage-action');
  undoButton.type = 'button';
  undoButton.append(icon('arrow-counter-clockwise'), el('span', 'tohe-label', t.undo));
  undoButton.addEventListener('click', undo);
  const hintButton = el('button', 'stage-action');
  hintButton.type = 'button';
  hintButton.append(icon('lightbulb'), el('span', 'tohe-label', t.hint));
  hintButton.addEventListener('click', () => showHintNow());
  const rescueButton = el('button', 'stage-action stage-action-rescue');
  rescueButton.type = 'button';
  rescueButton.append(icon('shuffle'), el('span', 'tohe-label', t.rescue));
  rescueButton.addEventListener('click', doRescue);
  actions.append(undoButton, hintButton, rescueButton);

  function renderActions(): void {
    const canUndo = previous !== null && !undoUsed && !finished && !state.over;
    undoButton.hidden = !canUndo;
    hintButton.hidden = !store.settings.hints || state.over || finished;
    const canRescue =
      !state.over && !finished && state.rescue > 0 && !anyPieceFits(state) && anyShapeFits(state);
    rescueButton.hidden = !canRescue;
    if (canRescue) rescueButton.querySelector('.tohe-label')!.textContent = t.rescueLeft(state.rescue);
  }

  function render(): void {
    applyLooks();
    renderBoard();
    renderTray();
    renderCenter();
    renderActions();
  }

  // ------------------------------------------------------------------ messages, hints, ghosts

  function showMessage(text: string): void {
    message.textContent = text;
    message.classList.add('is-visible');
    if (messageTimer) clearTimeout(messageTimer);
    messageTimer = setTimeout(() => message.classList.remove('is-visible'), 1200);
  }

  /** A short paper confetti for a perfect clear or a record; the reduced-motion setting keeps it still. */
  function celebrate(): void {
    if (prefersReducedMotion()) return;
    const layer = el('div', 'confetti-layer');
    layer.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 26; i++) {
      const bit = el('i', 'confetti-bit');
      bit.style.left = `${5 + Math.random() * 90}%`;
      bit.style.background = `var(--p${1 + Math.floor(Math.random() * 8)})`;
      bit.style.animationDelay = `${Math.random() * 250}ms`;
      bit.style.setProperty('--drift', `${(Math.random() - 0.5) * 120}px`);
      layer.append(bit);
    }
    stage.append(layer);
    setTimeout(() => layer.remove(), 1700);
  }

  function clearHint(): void {
    if (hintTimer) {
      clearTimeout(hintTimer);
      hintTimer = null;
    }
    for (const cell of cells) cell.classList.remove('is-hint');
    for (const piece of tray.querySelectorAll('.piece')) piece.classList.remove('is-hint');
  }

  function scheduleHint(): void {
    clearHint();
    if (left || !store.settings.hints || paused || busy || finished || state.over || ctx.overlay.visible)
      return;
    hintTimer = setTimeout(showHintNow, 8000);
  }

  function showHintNow(): void {
    if (left || paused || busy || finished || state.over) return;
    clearHint();
    const move = hint(state);
    if (!move) return;
    const shape = shapeById(state.tray[move.pieceIndex] ?? '');
    if (!shape) return;
    const piece = tray.querySelector(`[data-piece="${move.pieceIndex}"]`);
    piece?.classList.add('is-hint');
    for (const [dr, dc] of shape.cells) {
      cellAt(move.row + dr, move.col + dc)?.classList.add('is-hint');
    }
    hintTimer = setTimeout(clearHint, 2600);
  }

  /** The legal placement whose top-left is nearest to a cell; the drag ghost and a tap both use this anchor. */
  function nearest(pieceIndex: number, row: number, col: number, maxDistance = 1.75) {
    const shape = shapeById(state.tray[pieceIndex] ?? '');
    if (!shape) return null;
    let best: { row: number; col: number } | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const spot of placements(state.board, state.blocked, shape)) {
      const distance = Math.hypot(spot.row - row, spot.col - col);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = spot;
      }
    }
    return bestDistance <= maxDistance ? best : null;
  }

  function showPreviewText(text: string): void {
    previewBadge.textContent = text;
    previewBadge.hidden = false;
  }

  function hidePreview(): void {
    previewBadge.hidden = true;
    previewBadge.textContent = '';
  }

  function clearGhost(): void {
    for (const cell of cells) {
      cell.classList.remove('is-ghost', 'is-invalid', 'is-clear-preview');
      cell.style.removeProperty('--ghost-colour');
    }
    hidePreview();
  }

  function showGhost(pieceIndex: number, row: number, col: number, maxDistance = 1.75): void {
    clearGhost();
    const shape = shapeById(state.tray[pieceIndex] ?? '');
    if (!shape) return;
    const spot = nearest(pieceIndex, row, col, maxDistance);
    if (!spot) {
      cellAt(row, col)?.classList.add('is-invalid');
      return;
    }
    for (const [dr, dc] of shape.cells) {
      const cell = cellAt(spot.row + dr, spot.col + dc);
      if (!cell) continue;
      cell.classList.add('is-ghost');
      cell.style.setProperty('--ghost-colour', `var(--p${shape.colour})`);
    }
    const clear = preview(state, pieceIndex, spot.row, spot.col);
    if (clear && clear.lines > 0) {
      for (const line of clear.rows)
        for (let c = 0; c < 8; c++) cellAt(line, c)?.classList.add('is-clear-preview');
      for (const line of clear.cols)
        for (let r = 0; r < 8; r++) cellAt(r, line)?.classList.add('is-clear-preview');
      showPreviewText(t.preview(clear.lines, clear.gained, clear.perfect, state.combo));
    }
  }

  // ------------------------------------------------------------------ drag

  let suppressClick = false;
  let dragCleanup: (() => void) | null = null;

  /** The board's cell size, gap and content origin: the drag piece is drawn at board scale, not tray scale. */
  function boardMetrics() {
    const first = cells[0]?.getBoundingClientRect();
    const rect = board.getBoundingClientRect();
    const style = getComputedStyle(board);
    const gap = Number.parseFloat(style.columnGap || style.gap || '2') || 2;
    const cell = first?.width ?? rect.width / 8;
    return {
      cell,
      gap,
      left: first?.left ?? rect.left,
      top: first?.top ?? rect.top,
      stride: cell + gap,
    };
  }

  function beginDrag(event: PointerEvent, pieceIndex: number, shape: Shape): void {
    if (busy || finished || state.over || ctx.overlay.visible) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    target.classList.add('is-dragging');
    selected = null;
    clearHint();
    let moved = false;
    const metrics = boardMetrics();
    const ghost = el('div', 'drag-piece');
    const grid = shapeGrid(shape);
    grid.classList.add('drag-grid');
    grid.style.setProperty('--piece-cell', `${metrics.cell}px`);
    grid.style.setProperty('--drag-gap', `${metrics.gap}px`);
    ghost.append(grid);
    ghost.style.left = `${startX}px`;
    ghost.style.top = `${startY}px`;
    ghost.hidden = true;
    stage.append(ghost);
    let lastSpot = '';

    /** Where the piece would go: its board-scale bottom sits 56 px above the finger, so the finger never hides it. */
    const targetCell = (clientX: number, clientY: number) => {
      const { rows, cols } = bounds(shape);
      const width = cols * metrics.cell + (cols - 1) * metrics.gap;
      const height = rows * metrics.cell + (rows - 1) * metrics.gap;
      const left = clientX - width / 2;
      const top = clientY - height - 56;
      return {
        row: Math.round((top - metrics.top) / metrics.stride),
        col: Math.round((left - metrics.left) / metrics.stride),
      };
    };

    const move = (next: PointerEvent) => {
      if (next.pointerId !== event.pointerId) return;
      if (!moved && Math.hypot(next.clientX - startX, next.clientY - startY) > 4) {
        moved = true;
        ghost.hidden = false;
      }
      if (!moved) return;
      next.preventDefault();
      ghost.style.left = `${next.clientX}px`;
      ghost.style.top = `${next.clientY}px`;
      const { row, col } = targetCell(next.clientX, next.clientY);
      if (row >= -1 && row <= 8 && col >= -1 && col <= 8) {
        showGhost(pieceIndex, row, col, 2.75);
        const spot = nearest(pieceIndex, row, col, 2.75);
        const key = spot ? `${spot.row},${spot.col}` : '';
        if (key !== lastSpot) {
          lastSpot = key;
          if (key) haptics.play('tap');
        }
      } else {
        clearGhost();
      }
    };

    const up = (next: PointerEvent) => {
      if (next.pointerId !== event.pointerId) return;
      const { row, col } = targetCell(next.clientX, next.clientY);
      const spot = moved ? nearest(pieceIndex, row, col, 2.75) : null;
      cleanup();
      if (moved) {
        suppressClick = true;
        setTimeout(() => {
          suppressClick = false;
        }, 0);
      }
      if (spot) playMove(pieceIndex, spot.row, spot.col);
      else if (moved) {
        sfx.play('error');
        haptics.play('error');
      }
    };

    const cleanup = () => {
      ghost.remove();
      target.classList.remove('is-dragging');
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', cleanup);
      dragCleanup = null;
      clearGhost();
    };
    dragCleanup = cleanup;
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', cleanup);
  }

  function tryPlace(pieceIndex: number, row: number, col: number): void {
    const spot = nearest(pieceIndex, row, col);
    if (!spot) {
      sfx.play('error');
      haptics.play('error');
      cellAt(row, col)?.classList.add('is-invalid');
      setTimeout(() => cellAt(row, col)?.classList.remove('is-invalid'), 220);
      return;
    }
    playMove(pieceIndex, spot.row, spot.col);
  }

  // ------------------------------------------------------------------ a move

  function decorate(result: {
    type: string;
    cells?: { row: number; col: number; colour: number }[];
    perfect?: boolean;
  }): void {
    if (result.type === 'place' && result.cells) {
      for (const cell of result.cells) cellAt(cell.row, cell.col)?.classList.add('is-new');
    }
    if (result.type === 'clear' && result.cells) {
      for (const cell of result.cells) {
        const node = cellAt(cell.row, cell.col);
        if (!node) continue;
        node.classList.add('is-clearing');
        node.style.setProperty('--clear-colour', `var(--p${cell.colour})`);
      }
    }
  }

  function playMove(pieceIndex: number, row: number, col: number): void {
    if (busy || finished || state.over || ctx.overlay.visible) return;
    const result = place(state, pieceIndex, row, col);
    if (!result.ok) {
      sfx.play('error');
      haptics.play('error');
      return;
    }
    const before = state;
    state = result.state;
    previous = state.mode === 'endless' ? null : before;
    undoUsed = false;
    selected = null;
    busy = true;
    clearHint();
    clearGhost();
    render();
    for (const event of result.events) decorate(event);
    scores.set(state.score, true);
    sfx.play('pop');
    haptics.play('tap');
    const shield = result.events.find((event) => event.type === 'shield');
    if (shield?.type === 'shield') {
      showMessage(`${t.shield} · ${t.shieldLeft(shield.left)}`);
      sfx.play('click');
      haptics.play('bump');
    }
    const clear = result.events.find((event) => event.type === 'clear');
    if (clear?.type === 'clear') {
      sfx.play('combo', clear.lines);
      haptics.play(clear.lines > 1 ? 'success' : 'bump');
      if (clear.perfect) {
        sfx.play('levelUp');
        haptics.play('celebrate');
        showMessage(t.perfect);
        celebrate();
      } else if (clear.milestone) {
        showMessage(t.comboMilestone(clear.milestone.combo, clear.milestone.bonus, clear.milestone.shield));
      } else if (clear.lines > 1) {
        showMessage(t.combo(state.combo));
      }
    }
    if (state.score > before.score)
      void run.update(state.score).catch((error) => session.log('warn', String(error)));

    const wait = clear ? 320 : 170;
    setTimeout(() => {
      if (left) return;
      busy = false;
      if (finished) return;
      // The level goes on after the primary goal: the player may still earn the other two stars. It ends when all
      // three are met, the move limit is reached, or the board is stuck.
      const allGoals = goals.length > 0 && goals.every((goal) => goalMet(state, goal));
      if (state.over || allGoals) {
        if (allGoals && !state.over) state = finish(state);
        endGame();
        return;
      }
      render();
      void save();
      scheduleHint();
    }, wait);
  }

  function undo(): void {
    if (!previous || undoUsed || busy || finished) return;
    state = previous;
    previous = null;
    undoUsed = true;
    selected = null;
    clearHint();
    clearGhost();
    sfx.play('click');
    haptics.play('tap');
    scores.set(state.score, false);
    render();
    void run.update(state.score).catch((error) => session.log('warn', String(error)));
    void save();
    scheduleHint();
  }

  function doRescue(): void {
    const result = rescue(state);
    if (!result.ok) return;
    state = result.state;
    busy = false;
    selected = null;
    sfx.play('click');
    haptics.play('success');
    showMessage(t.rescue);
    scores.set(state.score, false);
    render();
    if (state.over) endGame();
    else {
      void save();
      scheduleHint();
    }
  }

  function endGame(): void {
    if (left || finished) return;
    finished = true;
    if (!state.over) state = finish(state);
    store.game = state;
    finishGame(state, goals);
    void run.finish(state.score).catch((error) => session.log('warn', String(error)));
    if (state.maxStreak > 0)
      void session
        .submitScore(state.maxStreak, 'streak')
        .catch((error) => session.log('warn', String(error)));
    void save();
    const record = state.mode === 'endless' && state.score > state.best;
    const stars = starsFor(state, goals);
    const done = goals.length > 0 && completed(state, goals);
    const missed = goals.find((goal) => !goalMet(state, goal));
    const title =
      state.mode === 'endless' ? (record ? t.record : t.over) : done ? t.levelDone(stars) : t.over;
    const comboLine = state.maxCombo > 1 ? ` · ${t.comboRecord(state.maxCombo, state.maxStreak)}` : '';
    const body =
      state.mode === 'endless'
        ? `${t.result(scoreText(state.score), scoreText(store.best))}${comboLine}`
        : `${t.levelResult(scoreText(state.score), stars)}${done ? '' : missed ? ` · ${t.levelMissed(t.goal(missed.kind, missed.value))}` : ''}${comboLine}`;
    sfx.play(record ? 'fanfare' : done ? 'levelUp' : 'drop');
    haptics.play(record || done ? 'celebrate' : 'bump');
    if (record || done) celebrate();
    render();
    const more: OverlayAction[] = [];
    if (session.shell.can.leaderboard) {
      more.push({
        label: t.streakBoard,
        icon: 'trophy',
        onClick: () => session.shell.open('leaderboard', { board: 'streak', label: t.streakBoard }),
      });
    }
    if (state.mode === 'journey' && done && state.level) {
      const index = LEVELS.findIndex((level) => level.id === state.level);
      const next = LEVELS[index + 1];
      if (next && journeyStars() >= chapterOf(next).unlockAt) {
        more.push({
          label: t.nextLevel,
          icon: 'play',
          dismiss: true,
          onClick: () => begin(levelStart(next.id)),
        });
      }
    }
    ctx.gameOver({ icon: record ? 'trophy' : { src: 'icon.svg' }, title, body }, undefined, more);
  }

  // ------------------------------------------------------------------ a new game in place

  function begin(started: Started): void {
    state = started.state;
    goals = started.goals;
    runId = started.runId;
    run = session.run(runId);
    finished = false;
    busy = false;
    selected = null;
    previous = null;
    undoUsed = false;
    ctx.overlay.hide();
    scores.setBest(store.best);
    scores.set(state.score, false);
    render();
    void save();
    scheduleHint();
  }

  /** Ends this run and starts another of the same mode, or of the mode chosen on the pre-play screen. */
  function newGameInPlace(choice?: string): void {
    if (choice) {
      store.game = state;
      store.run = runId;
      const slot = choice.replace('new:', '') as ModeSlot;
      if (MODE_SLOTS.includes(slot)) {
        begin(modeStart(slot, choice.startsWith('new:')));
        return;
      }
    }
    if (!finished && state.score > 0)
      void run.finish(state.score).catch((error) => session.log('warn', String(error)));
    dropParked(slotOf(state));
    if (state.mode === 'journey' && state.level) begin(startLevel(state.level));
    else if (state.mode === 'daily') begin(startDaily(dailyDateOf(state) ?? todayId()));
    else begin(startEndless());
  }

  // ------------------------------------------------------------------ the quick panel's rows

  const paletteRow = () => ({
    kind: 'card' as const,
    icon: 'palette' as const,
    label: t.palette,
    value: paletteLabel(store.settings.palette, t),
    card: () => ({
      icon: 'palette' as const,
      title: t.palette,
      content: choiceList(
        PALETTE_IDS.map((id) => ({ id, label: paletteLabel(id, t) })),
        store.settings.palette,
        (id) => {
          store.settings.palette = id;
          store.settings.palettePicked = true;
          applyLooks();
          void persist();
        },
      ),
    }),
  });

  const skinRow = () => {
    const stars = journeyStars();
    const unlocked = SKINS.filter((skin) => skin.at <= stars);
    const current =
      unlocked.find((skin) => skin.id === store.settings.skin) ?? (SKINS[0] as (typeof SKINS)[number]);
    return {
      kind: 'card' as const,
      icon: 'cards' as const,
      label: t.board,
      value: current[session.locale.startsWith('vi') ? 'vi' : 'en'],
      card: () => ({
        icon: 'cards' as const,
        title: t.board,
        content: choiceList(
          unlocked.map((skin) => ({
            id: skin.id,
            label: session.locale.startsWith('vi') ? skin.vi : skin.en,
          })),
          store.settings.skin,
          (id) => {
            store.settings.skin = id;
            applyLooks();
            void persist();
          },
        ),
      }),
    };
  };

  const quick = () => [
    paletteRow(),
    skinRow(),
    {
      kind: 'switch' as const,
      icon: 'lightbulb' as const,
      label: t.hintsSetting,
      on: store.settings.hints,
      onChange: (on: boolean) => {
        store.settings.hints = on;
        if (!on) clearHint();
        void persist();
      },
    },
  ];

  // ------------------------------------------------------------------ start and leave

  applyLooks();
  render();
  scores.set(state.score, false);
  void save();
  ctx.ready();
  if (ctx.firstTime) setTimeout(() => showHintNow(), 700);
  else scheduleHint();

  return {
    pause() {
      paused = true;
      clearHint();
    },
    resume() {
      paused = false;
      scheduleHint();
    },
    newGame: newGameInPlace,
    quick,
    leave() {
      left = true;
      paused = true;
      clearHint();
      if (messageTimer) clearTimeout(messageTimer);
      if (dragCleanup) dragCleanup();
      void save();
    },
  };
}
