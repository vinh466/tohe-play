// The sheets over the board: formation, hero, gear, summon, offline, stage picker, codex and today. DOM, dark, one
// hand. The board stays behind; the shell pauses it while a sheet is open.
import { t } from '../app.ts';
import { BONDS } from '../content/bonds.ts';
import { ENEMIES } from '../content/enemies.ts';
import { bossName } from '../content/events.ts';
import { GEAR } from '../content/gear.ts';
import { HEROES } from '../content/heroes.ts';
import { RULES } from '../content/index.ts';
import { REGIONS, STAGES } from '../content/stages.ts';
import {
  bossReward,
  challengeReward,
  claimBossReward,
  claimChallengeReward,
  claimDailyTask,
  claimJourney,
  DAILY_TASKS,
  dayIndex,
  dayKey,
  expeditionReward,
  journeyReady,
  journeyReward,
  taskProgress,
  taskReady,
  weekKey,
} from '../core/daily.ts';
import { claimOffline, offlineReward, summon } from '../core/economy.ts';
import {
  equipGear,
  inventory,
  loadouts,
  resetDaily,
  resetWeekly,
  setFormation,
  starCost,
  starUp,
  teamPower,
  unequipGear,
  upgradeCost,
  upgradeGear,
} from '../core/progression.ts';
import { createRng } from '../core/rng.ts';
import type { SaveData, SaveFormation, SaveSlot } from '../core/save-types.ts';
import { heroStats } from '../core/stats.ts';
import { terrainAt } from '../core/terrain.ts';
import type { HeroDef, Row, StageDef } from '../core/types.ts';
import type { RunMode } from './run-mode.ts';

export interface SheetHost {
  save(): SaveData;
  setSave(next: SaveData): void;
  onTeamChanged(): void;
  startStory(stage: StageDef): void;
  startMode(mode: RunMode): void;
  /** A sheet covers the board: the battle holds its timer until every sheet closes. */
  pause(): void;
  resume(): void;
}

/** The 12 cells of one side: three ranks × four lanes. Six are filled at most; the rest are open. */
const POSITIONS: readonly { row: Row; column: 0 | 1 | 2 | 3 }[] = [0, 1, 2].flatMap((row) =>
  [0, 1, 2, 3].map((column) => ({ row: row as Row, column: column as 0 | 1 | 2 | 3 })),
);

const SLOT_ORDER: readonly SaveSlot[] = ['weapon', 'armor', 'charm', 'relic'];

interface Sheet {
  readonly card: HTMLElement;
  readonly body: HTMLElement;
  readonly close: () => void;
}

let resumeAfterSheets: (() => void) | null = null;

export function closeSheets(resume = true): void {
  for (const node of document.querySelectorAll('.vd-sheet')) node.remove();
  if (resume) {
    const wake = resumeAfterSheets;
    resumeAfterSheets = null;
    wake?.();
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label: string, onClick: () => void, className = 'vd-btn'): HTMLButtonElement {
  const node = el('button', className, label);
  node.addEventListener('click', onClick);
  return node;
}

function portrait(id: string, size: 'sm' | 'md' | 'lg' = 'sm'): HTMLImageElement {
  const image = el('img', `vd-portrait ${size}`);
  image.src = `portraits/${id}.png`;
  image.alt = '';
  image.loading = 'lazy';
  return image;
}

function number(value: number): string {
  return Math.round(value).toLocaleString('vi-VN');
}

function openSheet(host: SheetHost, title: string, subtitle?: string): Sheet {
  closeSheets(false);
  host.pause();
  resumeAfterSheets = () => host.resume();
  const root = el('div', 'vd-sheet');
  const card = el('div', 'vd-sheet-card');
  const head = el('div', 'vd-sheet-head');
  const titles = el('div', 'vd-sheet-titles');
  titles.append(el('h2', '', title));
  if (subtitle) titles.append(el('p', 'vd-sheet-subtitle', subtitle));
  head.append(titles, button(t.close, closeSheets, 'vd-close'));
  const body = el('div', 'vd-sheet-body');
  const grab = el('div', 'vd-grab');
  card.append(grab, head, body);
  root.append(card);
  (document.querySelector('#stage') ?? document.body).append(root);
  return { card, body, close: closeSheets };
}

function section(title: string, ...children: (HTMLElement | string)[]): HTMLElement {
  const box = el('section', 'vd-section');
  if (title) box.append(el('h3', 'vd-section-title', title));
  box.append(...children);
  return box;
}

function hint(text: string): HTMLElement {
  return el('p', 'vd-hint', text);
}

function statLine(label: string, value: string): HTMLElement {
  const row = el('div', 'vd-stat');
  row.append(el('span', 'vd-muted', label), el('strong', '', value));
  return row;
}

function heroOf(id: string): HeroDef | undefined {
  return HEROES.items.find((hero) => hero.id === id);
}

function gearDefOf(id: string) {
  const piece = GEAR.items.find((candidate) => candidate.id === id);
  return piece;
}

function heroPower(save: SaveData, def: HeroDef, heroId: string): number {
  const saved = save.roster[heroId];
  if (!saved) return 0;
  const slot = save.formation.find((entry) => entry.heroId === heroId);
  const gearIds = Object.values(saved.gear).filter((id): id is string => typeof id === 'string');
  const gear = gearIds
    .map((id) => GEAR.items.find((piece) => piece.id === id))
    .filter((piece): piece is NonNullable<typeof piece> => piece !== undefined);
  const plus = gearIds.map((id) => save.gear[id]?.plus ?? 0);
  const team = new Set(save.formation.map((entry) => entry.heroId));
  const stats = heroStats(def, {
    companyLevel: save.company.level,
    star: saved.star,
    gear,
    plus,
    bond: team.has(def.bond),
  });
  const row = slot?.row ?? 0;
  const rowStats = { ...stats };
  if (row === 0) {
    rowStats.hp = Math.round(rowStats.hp * 1.1);
    rowStats.def = Math.round(rowStats.def * 1.2);
  } else if (row === 1) {
    rowStats.atk = Math.round(rowStats.atk * 1.1);
    rowStats.spd = Math.round(rowStats.spd * 1.05);
  } else if (row === 2) {
    rowStats.atk = Math.round(rowStats.atk * 1.15);
  }
  return Math.round(
    rowStats.hp * 0.12 + rowStats.atk * 2.4 + rowStats.def * 1.8 + rowStats.spd * 3.2 + rowStats.crit * 400,
  );
}

// MARK: team

export function openTeamSheet(host: SheetHost, onHero?: (heroId: string) => void): void {
  const sheet = openSheet(host, t.team);
  const save = host.save();
  const draft: (SaveFormation | null)[] = POSITIONS.map((position) => {
    const found = save.formation.find(
      (entry) => entry.row === position.row && entry.column === position.column,
    );
    return found ? { ...found } : null;
  });
  let selected = 0;

  const render = () => {
    const current = host.save();
    const formation = draft.filter((entry): entry is SaveFormation => entry !== null);
    const preview = { ...current, formation };
    sheet.body.replaceChildren();
    sheet.body.append(
      hint(
        `${t.yourPower} ${number(teamPower(preview))} · chạm một ô rồi chọn hero · 12 ô, tối đa 6 hero · hàng trước +DEF/HP, hàng sau +ATK`,
      ),
    );

    const grid = el('div', 'vd-formation');
    POSITIONS.forEach((position, index) => {
      const entry = draft[index];
      const hero = entry ? heroOf(entry.heroId) : undefined;
      const slot = button(
        '',
        () => {
          selected = index;
          render();
        },
        `vd-slot${index === selected ? ' selected' : ''}`,
      );
      if (hero) {
        const info = el('div', 'vd-slot-info');
        info.append(portrait(hero.id), el('span', '', hero.name));
        slot.append(info);
      } else {
        slot.append(el('span', 'vd-muted', 'Trống'));
      }
      const terrain = terrainAt('hero', position.row, position.column);
      if (terrain) slot.append(el('span', 'vd-slot-terrain', terrain.label));
      slot.title = `${hero ? `${hero.name} · ${t.roles[hero.role]} · ${t.elements[hero.element]}` : 'Trống'} · ô ${position.row + 1}-${position.column + 1}${terrain ? ` · ${terrain.label}` : ''}`;
      grid.append(slot);
    });
    sheet.body.append(grid);

    sheet.body.append(el('h3', 'vd-section-title', 'Danh sách'));
    const roster = el('div', 'vd-roster');
    for (const hero of HEROES.items) {
      const saved = current.roster[hero.id];
      const slotIndex = draft.findIndex((entry) => entry?.heroId === hero.id);
      const row = el('div', 'vd-roster-row');
      const info = el('div', 'vd-roster-info');
      info.append(
        portrait(hero.id),
        el('strong', '', hero.name),
        el(
          'span',
          'vd-muted',
          saved
            ? `${t.roles[hero.role]} · ${t.elements[hero.element]} · ★${saved.star}`
            : `Chưa sở hữu · ${t.rarities[hero.rarity]}`,
        ),
      );
      const actions = el('div', 'vd-row-actions');
      const choose = button(
        slotIndex >= 0 ? 'Trong đội' : t.pick,
        () => {
          if (!saved) return;
          const position = POSITIONS[selected];
          if (!position) return;
          if (slotIndex >= 0) draft[slotIndex] = null;
          draft[selected] = { heroId: hero.id, row: position.row, column: position.column };
          render();
        },
        'vd-btn small',
      );
      choose.disabled = !saved;
      actions.append(choose);
      if (saved && onHero) {
        actions.append(button(t.open, () => onHero(hero.id), 'vd-btn small quiet'));
      }
      row.append(info, actions);
      roster.append(row);
    }
    sheet.body.append(roster);
    sheet.body.append(
      button(
        'Lưu đội hình',
        () => {
          const next = setFormation(
            host.save(),
            draft.filter((entry): entry is SaveFormation => entry !== null),
          );
          host.setSave(next);
          host.onTeamChanged();
          closeSheets();
        },
        'vd-btn primary',
      ),
    );
  };
  render();
}

// MARK: hero and gear

export function openHeroSheet(host: SheetHost, heroId: string): void {
  const sheet = openSheet(host, 'Hồ sơ');
  const hero = heroOf(heroId);
  if (!hero) return;
  let message = '';

  const render = () => {
    const save = host.save();
    const saved = save.roster[hero.id];
    sheet.body.replaceChildren();
    if (!saved) {
      sheet.body.append(portrait(hero.id, 'lg'), hint('Chưa sở hữu hero này. Mở thẻ ở Triệu hồi.'));
      sheet.body.append(button(t.summon, () => openSummonSheet(host), 'vd-btn primary'));
      return;
    }
    const gearIds = Object.values(saved.gear).filter((id): id is string => typeof id === 'string');
    const gear = gearIds
      .map((id) => GEAR.items.find((piece) => piece.id === id))
      .filter((piece): piece is NonNullable<typeof piece> => piece !== undefined);
    const plus = gearIds.map((id) => save.gear[id]?.plus ?? 0);
    const team = new Set(save.formation.map((entry) => entry.heroId));
    const stats = heroStats(hero, {
      companyLevel: save.company.level,
      star: saved.star,
      gear,
      plus,
      bond: team.has(hero.bond),
    });
    const head = el('div', 'vd-hero-head');
    const info = el('div', 'vd-hero-info');
    info.append(
      el('strong', '', hero.name),
      el(
        'span',
        'vd-muted',
        `${t.rarities[hero.rarity]} · ${t.roles[hero.role]} · ${t.elements[hero.element]} · ★${saved.star}`,
      ),
      el('span', 'vd-muted', `${number(heroPower(save, hero, hero.id))} ${t.power}`),
    );
    head.append(portrait(hero.id, 'lg'), info);
    sheet.body.append(head);
    sheet.body.append(el('p', 'vd-blurb', hero.blurb ?? ''));

    const statsBox = el('div', 'vd-stats');
    statsBox.append(
      statLine('HP', number(stats.hp)),
      statLine('ATK', number(stats.atk)),
      statLine('DEF', number(stats.def)),
      statLine('SPD', number(stats.spd)),
      statLine('CRIT', `${Math.round(stats.crit * 100)}%`),
      statLine(t.bond, heroOf(hero.bond)?.name ?? t.none),
    );
    sheet.body.append(section(t.stats, statsBox));
    const bond = BONDS.items.find((candidate) => candidate.a === hero.id || candidate.b === hero.id);
    if (bond) sheet.body.append(hint(`${bond.name} — ${bond.note}`));

    const skills = el('div', 'vd-skills');
    for (const id of [hero.basic, hero.active]) {
      const skill = RULES.skill(id);
      skills.append(
        el(
          'div',
          'vd-skill',
          `${skill.name} — ${skill.kind === 'active' ? `hồi ${skill.charge} lượt` : 'đánh thường'}${
            skill.element ? ` · ${t.elements[skill.element]}` : ''
          }`,
        ),
      );
    }
    skills.append(
      el(
        'div',
        'vd-skill',
        `${t.passive}: ${hero.passive.stat.toUpperCase()} +${Math.round(hero.passive.value * 100)}% ở ★${hero.passive.star}`,
      ),
    );
    sheet.body.append(section(t.skills, skills));

    const gearBox = el('div', 'vd-gear');
    for (const slot of SLOT_ORDER) {
      const id = saved.gear[slot];
      const piece = id ? save.gear[id] : undefined;
      const def = piece ? gearDefOf(piece.defId) : undefined;
      const row = el('div', 'vd-gear-row');
      const label = el('div', 'vd-gear-label');
      label.append(
        el('strong', '', t.slots[slot]),
        el('span', 'vd-muted', def ? `${def.name} +${piece?.plus ?? 0}` : t.none),
      );
      const actions = el('div', 'vd-row-actions');
      if (piece && def) {
        actions.append(
          button(
            `+1 · ${number(upgradeCost(piece))}`,
            () => {
              try {
                host.setSave(upgradeGear(host.save(), id as string));
                message = '';
              } catch (error) {
                message = String(error instanceof Error ? error.message : error);
              }
              render();
            },
            'vd-btn small',
          ),
          button(
            t.remove,
            () => {
              host.setSave(unequipGear(host.save(), hero.id, slot));
              render();
            },
            'vd-btn small quiet',
          ),
        );
      }
      row.append(label, actions);
      gearBox.append(row);
      const free = inventory(save, slot);
      if (free.length > 0) {
        const list = el('div', 'vd-inventory-row');
        for (const pieceFree of free.slice(0, 4)) {
          const defFree = gearDefOf(pieceFree.defId);
          if (!defFree) continue;
          list.append(
            button(
              `${defFree.name} +${pieceFree.plus}`,
              () => {
                host.setSave(equipGear(host.save(), hero.id, pieceFree.id));
                render();
              },
              'vd-btn tiny',
            ),
          );
        }
        gearBox.append(list);
      }
    }
    sheet.body.append(section(t.gear, gearBox));

    if (saved.star < 5) {
      sheet.body.append(
        button(
          `Nâng ★ (${starCost(saved.star)} ${t.shards})`,
          () => {
            try {
              host.setSave(starUp(host.save(), hero.id));
              message = '';
            } catch (error) {
              message = String(error instanceof Error ? error.message : error);
            }
            render();
          },
          'vd-btn primary',
        ),
      );
    }
    if (message) sheet.body.append(el('p', 'vd-error', message));
    sheet.body.append(
      button(`← ${t.team}`, () => openTeamSheet(host, (id) => openHeroSheet(host, id)), 'vd-btn quiet'),
    );
  };
  render();
}

/** A compact enemy card: the board has no names, so a tap opens the detail here. */
export function openEnemySheet(host: SheetHost, enemyId: string): void {
  const enemy = ENEMIES.items.find((candidate) => candidate.id === enemyId);
  const sheet = openSheet(host, 'Hồ sơ quái');
  if (!enemy) {
    sheet.body.append(hint('Không tìm thấy quái này.'));
    return;
  }
  const head = el('div', 'vd-hero-head');
  const info = el('div', 'vd-hero-info');
  info.append(
    el('strong', '', enemy.name),
    el(
      'span',
      'vd-muted',
      `${t.roles[enemy.role]} · ${t.elements[enemy.element]}${enemy.boss ? ' · Boss' : ''}`,
    ),
  );
  head.append(portrait(enemy.id, 'lg'), info);
  sheet.body.append(head);
  sheet.body.append(el('p', 'vd-blurb', enemy.blurb ?? ''));
  const stats = el('div', 'vd-stats');
  stats.append(
    statLine('HP', number(enemy.base.hp)),
    statLine('ATK', number(enemy.base.atk)),
    statLine('DEF', number(enemy.base.def)),
    statLine('SPD', number(enemy.base.spd)),
    statLine('CRIT', `${Math.round(enemy.base.crit * 100)}%`),
  );
  sheet.body.append(section(t.stats, stats));
  const skills = el('div', 'vd-skills');
  for (const id of [enemy.basic, enemy.active]) {
    const skill = RULES.skill(id);
    skills.append(
      el(
        'div',
        'vd-skill',
        `${skill.name} — ${skill.kind === 'active' ? `hồi ${skill.charge} lượt` : 'đánh thường'}${
          skill.element ? ` · ${t.elements[skill.element]}` : ''
        }`,
      ),
    );
  }
  sheet.body.append(section(t.skills, skills));
}

export function openGearSheet(host: SheetHost): void {
  const sheet = openSheet(host, t.gear, t.inventory);
  const save = host.save();
  let selected = save.formation[0]?.heroId ?? HEROES.items[0]?.id ?? '';
  let message = '';

  const render = () => {
    const current = host.save();
    sheet.body.replaceChildren();
    const heroes = current.formation
      .map((entry) => heroOf(entry.heroId))
      .filter((hero): hero is HeroDef => hero !== undefined);
    const picker = el('div', 'vd-hero-picker');
    for (const hero of heroes) {
      const chip = button(
        '',
        () => {
          selected = hero.id;
          render();
        },
        `vd-hero-chip${selected === hero.id ? ' selected' : ''}`,
      );
      chip.append(portrait(hero.id), el('span', '', hero.name));
      picker.append(chip);
    }
    sheet.body.append(picker);
    const hero = heroOf(selected);
    const saved = current.roster[selected];
    if (hero && saved) {
      sheet.body.append(hint(`${hero.name} · ${number(heroPower(current, hero, hero.id))} ${t.power}`));
      const equipped = el('div', 'vd-gear');
      for (const slot of SLOT_ORDER) {
        const id = saved.gear[slot];
        const piece = id ? current.gear[id] : undefined;
        const def = piece ? gearDefOf(piece.defId) : undefined;
        const row = el('div', 'vd-gear-row');
        const label = el('div', 'vd-gear-label');
        label.append(
          el('strong', '', t.slots[slot]),
          el('span', 'vd-muted', def ? `${def.name} +${piece?.plus ?? 0}` : t.none),
        );
        const actions = el('div', 'vd-row-actions');
        if (piece) {
          actions.append(
            button(
              `+1 · ${number(upgradeCost(piece))}`,
              () => {
                try {
                  host.setSave(upgradeGear(host.save(), piece.defId));
                  message = '';
                } catch (error) {
                  message = String(error instanceof Error ? error.message : error);
                }
                render();
              },
              'vd-btn small',
            ),
            button(
              t.remove,
              () => {
                host.setSave(unequipGear(host.save(), selected, slot));
                render();
              },
              'vd-btn small quiet',
            ),
          );
        }
        row.append(label, actions);
        equipped.append(row);
      }
      sheet.body.append(section(t.equipped, equipped));
    }

    const free = inventory(current);
    if (free.length === 0) {
      sheet.body.append(hint('Túi đồ trống. Thắng màn để nhận trang bị.'));
    } else {
      const list = el('div', 'vd-inventory');
      for (const piece of free) {
        const def = gearDefOf(piece.defId);
        if (!def) continue;
        const row = el('div', 'vd-roster-row');
        const info = el('div', 'vd-roster-info');
        info.append(
          el('strong', '', def.name),
          el('span', 'vd-muted', `${t.slots[def.slot]} · +${piece.plus} · ${t.rarities[def.rarity]}`),
        );
        row.append(
          info,
          button(
            `${t.equip} → ${heroOf(selected)?.name ?? ''}`,
            () => {
              try {
                host.setSave(equipGear(host.save(), selected, piece.id));
                message = '';
              } catch (error) {
                message = String(error instanceof Error ? error.message : error);
              }
              render();
            },
            'vd-btn small primary',
          ),
        );
        list.append(row);
      }
      sheet.body.append(section(t.inventory, list));
    }
    if (message) sheet.body.append(el('p', 'vd-error', message));
  };
  render();
}

// MARK: summon and offline

export function openSummonSheet(host: SheetHost): void {
  const sheet = openSheet(host, t.summon);
  let results: { heroId: string; rarity: string; duplicate: boolean; shards: number }[] = [];
  let message = '';
  const render = () => {
    const save = host.save();
    sheet.body.replaceChildren();
    const purse = el('div', 'vd-purse');
    purse.append(
      statLine(t.shards, number(save.currencies.shards)),
      statLine('Pity hiếm', `${save.summon.pityRare}/10`),
      statLine('Pity sử thi', `${save.summon.pityEpic}/50`),
    );
    sheet.body.append(purse);
    const pity = el('div', 'vd-pity');
    const fill = el('i');
    fill.style.width = `${(save.summon.pityRare / 10) * 100}%`;
    pity.append(fill);
    sheet.body.append(pity);
    const row = el('div', 'vd-row-actions');
    const canPull1 = save.currencies.shards >= 100;
    const canPull10 = save.currencies.shards >= 900;
    const pull1 = button(`×1 · 100`, () => pull(1), 'vd-btn');
    pull1.disabled = !canPull1;
    const pull10 = button(`×10 · 900`, () => pull(10), 'vd-btn primary');
    pull10.disabled = !canPull10;
    row.append(pull1, pull10);
    sheet.body.append(row);
    if (!canPull1) sheet.body.append(hint('Cần 100 mảnh từ màn chơi để triệu hồi.'));
    else if (!canPull10) sheet.body.append(hint(`×10 cần 900 mảnh — còn ${900 - save.currencies.shards}.`));
    if (message) sheet.body.append(el('p', 'vd-error', message));
    if (results.length > 0) {
      const list = el('div', 'vd-results');
      for (const result of results) {
        const hero = heroOf(result.heroId);
        const line = el('div', `vd-result ${result.rarity}${result.duplicate ? '' : ' new'}`);
        line.append(
          portrait(result.heroId, 'md'),
          el(
            'span',
            '',
            `${hero?.name ?? result.heroId} · ${t.rarities[result.rarity as keyof typeof t.rarities] ?? result.rarity}${
              result.duplicate ? ` · +${result.shards} ${t.shards}` : ' · MỚI'
            }`,
          ),
        );
        list.append(line);
      }
      sheet.body.append(list);
    }
  };
  const pull = (count: 1 | 10) => {
    try {
      const outcome = summon(host.save(), createRng((Date.now() >>> 0) + count), count);
      host.setSave(outcome.save);
      results = outcome.results.map((result) => ({ ...result }));
      message = '';
      render();
    } catch (error) {
      message = String(error instanceof Error ? error.message : error);
      render();
    }
  };
  render();
}

export function openOfflineCard(host: SheetHost): void {
  const reward = offlineReward(host.save(), Date.now());
  if (reward.hours <= 0) return;
  const sheet = openSheet(host, 'Đoàn đã đi');
  sheet.body.append(
    hint(`${reward.hours} giờ · tối đa 12 giờ`),
    el('div', 'vd-result', `${t.gold} +${number(reward.gold)}`),
    el('div', 'vd-result', `${t.essence} +${number(reward.essence)}`),
    el('div', 'vd-result', `${t.shards} +${number(reward.shards)}`),
    el('div', 'vd-result', `XP +${number(reward.xp)}`),
    button(
      t.claim,
      () => {
        const claimed = claimOffline(host.save(), Date.now());
        host.setSave(claimed.save);
        closeSheets();
      },
      'vd-btn primary',
    ),
  );
}

// MARK: stages

export function openStagePicker(host: SheetHost): void {
  const sheet = openSheet(host, t.stages);
  const save = host.save();
  let selected = save.progress.highest;

  const render = () => {
    const current = host.save();
    const power = teamPower(current);
    sheet.body.replaceChildren();
    sheet.body.append(hint(`${t.yourPower} ${number(power)} · ${t.furthest} ${current.progress.highest}`));
    const stage = STAGES.items.find((candidate) => candidate.id === selected) ?? STAGES.items[0];
    if (stage) {
      const details = el('div', 'vd-stage-detail top');
      details.append(
        el('h3', '', `${t.stage(stage.id)} · ${stage.waves.length} đợt`),
        statLine(t.recommended, number(stage.recommendedPower)),
        statLine(t.yourPower, number(power)),
        statLine(
          t.firstClear,
          `${number(stage.firstClear.gold)} ${t.gold} · ${number(stage.firstClear.shards)} ${t.shards}`,
        ),
        statLine(
          t.reward,
          `${number(stage.loot.gold)} ${t.gold} · ${number(stage.loot.essence)} ${t.essence}${
            'gear' in stage.loot && stage.loot.gear
              ? ` · ${gearDefOf(stage.loot.gear)?.name ?? stage.loot.gear}`
              : ''
          }`,
        ),
      );
      if (power < stage.recommendedPower) details.append(el('p', 'vd-warn', t.warnPower));
      details.append(
        button(
          `${t.start} ${t.stage(stage.id)}`,
          () => {
            closeSheets();
            host.startStory(stage);
          },
          'vd-btn primary',
        ),
      );
      sheet.body.append(details);
    }
    for (const [regionIndex, region] of REGIONS.items.entries()) {
      const stages = STAGES.items.filter((stage) => stage.region === region.id);
      const opened = stages.some((stage) => current.cleared.includes(stage.id));
      const regionBox = section(`${t.region} ${regionIndex + 1} · ${region.name}`, hint(region.blurb ?? ''));
      const grid = el('div', 'vd-stage-grid');
      for (const stage of stages) {
        const cleared = current.cleared.includes(stage.id);
        const chip = button(
          `${stage.index}${stage.boss ? ' ☠' : stage.elite ? ' ✦' : ''}${cleared ? ' ✓' : ''}`,
          () => {
            selected = stage.id;
            render();
          },
          `vd-stage-chip${selected === stage.id ? ' selected' : ''}${stage.boss ? ' boss' : ''}${
            cleared ? ' cleared' : ''
          }`,
        );
        chip.title = `${stage.id} · ${number(stage.recommendedPower)}`;
        grid.append(chip);
      }
      regionBox.append(grid);
      if (!opened && regionIndex > 0) regionBox.append(el('p', 'vd-muted', 'Chưa đặt chân tới vùng này.'));
      sheet.body.append(regionBox);
    }
  };
  render();
}

// MARK: codex

export function openCodex(host: SheetHost): void {
  const sheet = openSheet(host, t.codex);
  type Tab = 'heroes' | 'enemies' | 'regions' | 'bonds' | 'records';
  let tab: Tab = 'heroes';
  const tabs: readonly { id: Tab; label: string }[] = [
    { id: 'heroes', label: t.heroes },
    { id: 'enemies', label: t.enemies },
    { id: 'regions', label: t.region },
    { id: 'bonds', label: t.bonds },
    { id: 'records', label: t.records },
  ];
  const render = () => {
    const save = host.save();
    sheet.body.replaceChildren();
    const bar = el('div', 'vd-tabs');
    for (const entry of tabs) {
      bar.append(
        button(
          entry.label,
          () => {
            tab = entry.id;
            render();
          },
          `vd-tab${tab === entry.id ? ' selected' : ''}`,
        ),
      );
    }
    sheet.body.append(bar);

    if (tab === 'heroes') {
      const list = el('div', 'vd-codex-list');
      for (const hero of HEROES.items) {
        const saved = save.roster[hero.id];
        const row = el('div', 'vd-codex-row');
        const info = el('div', 'vd-codex-info');
        info.append(
          el('strong', '', hero.name),
          el(
            'span',
            'vd-muted',
            `${t.rarities[hero.rarity]} · ${t.roles[hero.role]} · ${t.elements[hero.element]}${
              saved ? ` · ★${saved.star}` : ' · chưa sở hữu'
            }`,
          ),
          el('span', 'vd-blurb', hero.blurb ?? ''),
        );
        row.append(portrait(hero.id, 'md'), info);
        if (saved) row.append(button(t.open, () => openHeroSheet(host, hero.id), 'vd-btn tiny'));
        list.append(row);
      }
      sheet.body.append(list);
    } else if (tab === 'enemies') {
      const list = el('div', 'vd-codex-list');
      for (const enemy of ENEMIES.items) {
        const row = el('div', 'vd-codex-row');
        const info = el('div', 'vd-codex-info');
        info.append(
          el('strong', '', enemy.name),
          el(
            'span',
            'vd-muted',
            `${enemy.boss ? 'Boss · ' : ''}${t.roles[enemy.role]} · ${t.elements[enemy.element]}`,
          ),
          el('span', 'vd-blurb', enemy.blurb ?? ''),
        );
        row.append(portrait(enemy.id, 'md'), info);
        list.append(row);
      }
      sheet.body.append(list);
    } else if (tab === 'regions') {
      const list = el('div', 'vd-codex-list');
      for (const [index, region] of REGIONS.items.entries()) {
        const stages = STAGES.items.filter((stage) => stage.region === region.id);
        const cleared = stages.filter((stage) => save.cleared.includes(stage.id)).length;
        const row = el('div', 'vd-codex-row');
        const swatches = el('div', 'vd-swatches');
        for (const colour of region.palette) {
          const dot = el('i');
          dot.style.background = colour;
          swatches.append(dot);
        }
        const info = el('div', 'vd-codex-info');
        info.append(
          el('strong', '', `${t.region} ${index + 1} · ${region.name}`),
          el('span', 'vd-muted', `${cleared}/${stages.length} ${t.cleared.toLowerCase()}`),
          el('span', 'vd-blurb', region.blurb ?? ''),
        );
        row.append(swatches, info);
        list.append(row);
      }
      sheet.body.append(list);
    } else if (tab === 'bonds') {
      const list = el('div', 'vd-codex-list');
      for (const bond of BONDS.items) {
        const a = heroOf(bond.a);
        const b = heroOf(bond.b);
        if (!a || !b) continue;
        const owned = Boolean(save.roster[a.id]) && Boolean(save.roster[b.id]);
        const row = el('div', 'vd-codex-row');
        const pair = el('div', 'vd-bond-pair');
        pair.append(portrait(a.id, 'md'), portrait(b.id, 'md'));
        const info = el('div', 'vd-codex-info');
        info.append(
          el('strong', '', `${bond.name} · ${a.name} + ${b.name}`),
          el('span', 'vd-muted', owned ? 'Đã đủ cặp · +6% HP/ATK khi cùng ra trận' : 'Chưa đủ cặp'),
          el('span', 'vd-blurb', bond.note),
        );
        row.append(pair, info);
        list.append(row);
      }
      sheet.body.append(list);
    } else {
      const records = save.progress.records;
      const box = el('div', 'vd-stats');
      box.append(
        statLine(t.company, `Cấp ${save.company.level}`),
        statLine(t.yourPower, number(teamPower(save))),
        statLine('Màn xa nhất', records.bestStage),
        statLine(t.tower, `${records.tower}/40`),
        statLine(t.boss, `${number(records.bossDamage)} sát thương`),
        statLine(
          t.challenge,
          save.weekly.challengeRounds > 0 ? `${save.weekly.challengeRounds} lượt` : t.none,
        ),
        statLine(t.gold, number(save.currencies.gold)),
        statLine(t.essence, number(save.currencies.essence)),
        statLine(t.shards, number(save.currencies.shards)),
        statLine('Anh hùng', `${Object.keys(save.roster).length}/${HEROES.items.length}`),
      );
      sheet.body.append(section(t.records, box));
    }
  };
  render();
}

// MARK: today

export function openDailySheet(host: SheetHost): void {
  const sheet = openSheet(host, t.daily);
  const today = dayKey();
  const week = weekKey();
  const normalized = resetWeekly(resetDaily(host.save(), today), week);
  if (normalized !== host.save()) host.setSave(normalized);

  const render = () => {
    const save = host.save();
    sheet.body.replaceChildren();
    const purse = el('div', 'vd-purse');
    purse.append(
      statLine(t.gold, number(save.currencies.gold)),
      statLine(t.essence, number(save.currencies.essence)),
      statLine(t.shards, number(save.currencies.shards)),
      statLine(t.company, `Cấp ${save.company.level}`),
    );
    sheet.body.append(purse);

    const tasks = el('div', 'vd-tasks');
    for (const task of DAILY_TASKS) {
      const row = el('div', 'vd-task');
      const info = el('div', 'vd-task-info');
      info.append(
        el('strong', '', task.title),
        el(
          'span',
          'vd-muted',
          `${taskProgress(save, task)}/${task.target} · +${number(task.reward.gold)} ${t.gold} +${number(task.reward.shards)} ${t.shards}`,
        ),
      );
      const bar = el('div', 'vd-pity');
      const fill = el('i');
      fill.style.width = `${(taskProgress(save, task) / task.target) * 100}%`;
      bar.append(fill);
      info.append(bar);
      row.append(info);
      if (save.daily.tasks.includes(task.id)) {
        row.append(el('span', 'vd-done', t.claimed));
      } else {
        const claim = button(
          t.claim,
          () => {
            try {
              host.setSave(claimDailyTask(host.save(), task.id));
            } catch {
              /* not ready: the button stays disabled */
            }
            render();
          },
          'vd-btn small primary',
        );
        claim.disabled = !taskReady(save, task);
        row.append(claim);
      }
      tasks.append(row);
    }
    sheet.body.append(section(t.quests, tasks));

    const journey = el('div', 'vd-journey');
    const day = Math.min(7, save.daily.journeyDay);
    for (let index = 1; index <= 7; index++) {
      const step = el(
        'span',
        `vd-journey-step${index < day ? ' done' : ''}${index === day ? ' current' : ''}`,
      );
      step.textContent = String(index);
      journey.append(step);
    }
    sheet.body.append(
      section(
        t.journey,
        journey,
        hint(
          save.daily.journeyDay > 7
            ? 'Đã đi hết bảy ngày Khởi Hành.'
            : `Ngày ${day}/7 · +${number(journeyReward(day).gold)} ${t.gold} +${number(journeyReward(day).shards)} ${t.shards}`,
        ),
        journeyReady(save, today) && save.daily.journeyDay <= 7
          ? button(
              t.claim,
              () => {
                try {
                  host.setSave(claimJourney(host.save(), today));
                } catch {
                  /* finished or claimed */
                }
                render();
              },
              'vd-btn primary',
            )
          : el('span', 'vd-done', save.daily.journeyDay > 7 ? t.done : t.claimed),
      ),
    );

    const modes = el('div', 'vd-mode-list');
    const expeditionDay = dayIndex();
    const region = REGIONS.items[Math.abs(expeditionDay) % REGIONS.items.length];
    modes.append(
      modeRow(
        t.expedition,
        `${region?.name ?? ''} · +${number(expeditionReward(save.company.level).gold)} ${t.gold}`,
        save.daily.expedition ? t.done : t.ready,
        save.daily.expedition
          ? undefined
          : () => {
              host.startMode({ kind: 'expedition' });
              closeSheets();
            },
      ),
      modeRow(
        t.tower,
        `${t.floor} ${Math.min(40, save.progress.tower)}/40 · kỷ lục ${save.progress.records.tower}`,
        save.progress.tower > 40 ? t.done : t.ready,
        save.progress.tower > 40
          ? undefined
          : () => {
              host.startMode({ kind: 'tower', floor: save.progress.tower });
              closeSheets();
            },
      ),
      modeRow(
        t.boss,
        `${bossName(week)} · tốt nhất ${number(save.weekly.bossDamage)} · +${bossReward(save.weekly.bossDamage).shards} ${t.shards}`,
        save.weekly.bossClaimed ? t.claimed : save.weekly.bossDamage > 0 ? t.claim : t.ready,
        () => {
          host.startMode({ kind: 'boss' });
          closeSheets();
        },
        save.weekly.bossDamage > 0 && !save.weekly.bossClaimed
          ? () => {
              try {
                host.setSave(claimBossReward(host.save()));
              } catch {
                /* claimed */
              }
              render();
            }
          : undefined,
      ),
      modeRow(
        t.challenge,
        `Tuần ${week} · ${save.weekly.challengeRounds > 0 ? `${save.weekly.challengeRounds} lượt` : 'chưa qua'} · +${challengeReward().shards} ${t.shards}`,
        save.weekly.challengeClaimed ? t.claimed : save.weekly.challengeRounds > 0 ? t.claim : t.ready,
        () => {
          host.startMode({ kind: 'challenge' });
          closeSheets();
        },
        save.weekly.challengeRounds > 0 && !save.weekly.challengeClaimed
          ? () => {
              try {
                host.setSave(claimChallengeReward(host.save()));
              } catch {
                /* claimed */
              }
              render();
            }
          : undefined,
      ),
    );
    sheet.body.append(section('Đường đi', modes));
    sheet.body.append(button(t.credits, () => openCredits(host), 'vd-btn quiet'));
  };
  render();
}

function modeRow(
  title: string,
  note: string,
  state: string,
  onStart?: () => void,
  onClaim?: () => void,
): HTMLElement {
  const row = el('div', 'vd-mode');
  const info = el('div', 'vd-mode-info');
  info.append(el('strong', '', title), el('span', 'vd-muted', note), el('span', 'vd-mode-state', state));
  row.append(info);
  if (onClaim) row.append(button(t.claim, onClaim, 'vd-btn small primary'));
  if (onStart) row.append(button(t.start, onStart, 'vd-btn small'));
  return row;
}

// MARK: more and credits

export function openMoreSheet(host: SheetHost): void {
  const sheet = openSheet(host, t.more);
  const menu = el('div', 'vd-menu');
  menu.append(
    button(`${t.stages} →`, () => openStagePicker(host), 'vd-menu-item'),
    button(`${t.codex} →`, () => openCodex(host), 'vd-menu-item'),
    button(`${t.daily} →`, () => openDailySheet(host), 'vd-menu-item'),
    button(`${t.gear} →`, () => openGearSheet(host), 'vd-menu-item'),
    button(`${t.summon} →`, () => openSummonSheet(host), 'vd-menu-item'),
    button(`${t.credits} →`, () => openCredits(host), 'vd-menu-item'),
  );
  sheet.body.append(menu);
}

export function openCredits(host: SheetHost): void {
  const sheet = openSheet(host, t.credits);
  sheet.body.append(
    hint('Vân Du Ký · bản 1.0.1'),
    el('p', 'vd-credits', 'Ý tưởng và chỉ đạo: gia đình Tò He.'),
    el('p', 'vd-credits', 'Pixel portrait: vẽ bằng code trong art/generate-portraits.py.'),
    el('p', 'vd-credits', 'Engine: Phaser 4 (MIT), @tohe/game-kit, Be Vietnam Pro.'),
    el('p', 'vd-credits', 'Font Be Vietnam Pro: SIL Open Font License.'),
    el('p', 'vd-credits', 'Không quảng cáo, không nạp, không theo dõi.'),
  );
}

/** The six loadouts of the saved team, for a scene restart. */
export function currentTeam(save: SaveData) {
  return loadouts(save);
}
