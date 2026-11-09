// The sheets over the board: formation, hero detail, summon and the offline return. DOM, dark, one hand. The board
// stays behind; the shell pauses it while a sheet is open.

import { t } from '../app.ts';
import { GEAR } from '../content/gear.ts';
import { HEROES } from '../content/heroes.ts';
import { RULES } from '../content/index.ts';
import { claimOffline, offlineReward, summon } from '../core/economy.ts';
import {
  equipGear,
  loadouts,
  setFormation,
  starCost,
  starUp,
  teamPower,
  upgradeCost,
  upgradeGear,
} from '../core/progression.ts';
import { createRng } from '../core/rng.ts';
import type { SaveData, SaveFormation } from '../core/save-types.ts';
import { heroStats } from '../core/stats.ts';
import type { HeroDef, Row } from '../core/types.ts';

export interface SheetHost {
  save(): SaveData;
  setSave(next: SaveData): void;
  onTeamChanged(): void;
}

const POSITIONS: readonly { row: Row; column: 0 | 1 }[] = [
  { row: 0, column: 0 },
  { row: 0, column: 1 },
  { row: 1, column: 0 },
  { row: 1, column: 1 },
  { row: 2, column: 0 },
  { row: 2, column: 1 },
];

export function closeSheets() {
  for (const node of document.querySelectorAll('.vd-sheet')) node.remove();
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label: string, onClick: () => void, className = 'vd-btn') {
  const node = el('button', className, label);
  node.addEventListener('click', onClick);
  return node;
}

function openSheet(title: string): { card: HTMLElement; body: HTMLElement; close: () => void } {
  closeSheets();
  const root = el('div', 'vd-sheet');
  const card = el('div', 'vd-sheet-card');
  const head = el('div', 'vd-sheet-head');
  head.append(el('h2', '', title));
  const close = button(t.close, closeSheets, 'vd-close');
  head.append(close);
  const body = el('div', 'vd-sheet-body');
  card.append(head, body);
  root.append(card);
  (document.querySelector('#stage') ?? document.body).append(root);
  return { card, body, close: closeSheets };
}

export function openTeamSheet(host: SheetHost, onHero?: (heroId: string) => void) {
  const sheet = openSheet(t.team);
  const save = host.save();
  const draft: (SaveFormation | null)[] = POSITIONS.map((position) => {
    const found = save.formation.find(
      (entry) => entry.row === position.row && entry.column === position.column,
    );
    return found ? { ...found } : null;
  });
  let selected = 0;

  const render = () => {
    sheet.body.replaceChildren();
    const power = teamPower({
      ...save,
      formation: draft.filter((entry): entry is SaveFormation => entry !== null),
    });
    sheet.body.append(
      el('p', 'vd-hint', `Sức mạnh ${power.toLocaleString('vi-VN')} · chạm một ô rồi chọn hero`),
    );
    const grid = el('div', 'vd-formation');
    POSITIONS.forEach((position, index) => {
      const entry = draft[index];
      const hero = entry ? HEROES.items.find((candidate) => candidate.id === entry.heroId) : undefined;
      const slot = button(
        hero ? `${hero.name}\n${t.roles[hero.role]} · ${t.elements[hero.element]}` : 'Trống',
        () => {
          selected = index;
          render();
        },
        `vd-slot${index === selected ? ' selected' : ''}`,
      );
      slot.style.whiteSpace = 'pre-line';
      grid.append(slot);
    });
    sheet.body.append(grid);
    sheet.body.append(el('p', 'vd-hint', 'Chọn hero cho ô đang chọn:'));
    const roster = el('div', 'vd-roster');
    for (const hero of HEROES.items) {
      const saved = save.roster[hero.id];
      const inSlot = draft.findIndex((entry) => entry?.heroId === hero.id);
      const row = el('div', 'vd-roster-row');
      const info = el('div', 'vd-roster-info');
      info.append(
        el('strong', '', hero.name),
        el('span', 'vd-muted', `${t.roles[hero.role]} · ${t.elements[hero.element]} · ★${saved?.star ?? 1}`),
      );
      const actions = el('div', 'vd-row-actions');
      actions.append(
        button(
          inSlot >= 0 ? 'Trong đội' : 'Chọn',
          () => {
            const position = POSITIONS[selected]!;
            const previous = draft.findIndex((entry) => entry?.heroId === hero.id);
            if (previous >= 0) draft[previous] = null;
            draft[selected] = { heroId: hero.id, row: position.row, column: position.column };
            render();
          },
          'vd-btn small',
        ),
      );
      if (onHero) actions.append(button('Xem', () => onHero(hero.id), 'vd-btn small quiet'));
      row.append(info, actions);
      roster.append(row);
    }
    sheet.body.append(roster);
    sheet.body.append(
      button(
        'Lưu đội hình',
        () => {
          const next = setFormation(
            save,
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

export function openHeroSheet(host: SheetHost, heroId: string) {
  const sheet = openSheet('Hồ sơ');
  const hero = HEROES.items.find((candidate) => candidate.id === heroId);
  if (!hero) return;
  let message = '';
  const render = () => {
    const save = host.save();
    const saved = save.roster[hero.id];
    if (!saved) {
      sheet.body.replaceChildren(el('p', 'vd-hint', 'Chưa sở hữu hero này.'));
      return;
    }
    const gear = Object.values(saved.gear)
      .filter((id): id is string => typeof id === 'string')
      .map((id) => GEAR.items.find((piece) => piece.id === id))
      .filter((piece): piece is NonNullable<typeof piece> => piece !== undefined);
    const stats = heroStats(hero, { companyLevel: save.company.level, star: saved.star, gear });
    sheet.body.replaceChildren();
    sheet.body.append(
      el(
        'p',
        'vd-hint',
        `${t.roles[hero.role]} · ${t.elements[hero.element]} · ★${saved.star} · ${saved.shards} mảnh`,
      ),
    );
    const statGrid = el('div', 'vd-stats');
    for (const [label, value] of [
      ['HP', Math.round(stats.hp)],
      ['ATK', Math.round(stats.atk)],
      ['DEF', Math.round(stats.def)],
      ['SPD', Math.round(stats.spd)],
      ['CRIT', `${Math.round(stats.crit * 100)}%`],
    ]) {
      statGrid.append(el('div', '', `${label} ${value}`));
    }
    sheet.body.append(statGrid);
    const skills = el('div', 'vd-skills');
    for (const id of [hero.basic, hero.active]) {
      const skill = RULES.skill(id);
      skills.append(
        el(
          'div',
          'vd-skill',
          `${skill.name} — ${skill.kind === 'active' ? `hồi ${skill.charge} lượt` : 'đánh thường'}`,
        ),
      );
    }
    skills.append(
      el(
        'div',
        'vd-skill',
        `Bị động: ${hero.passive.stat} +${Math.round(hero.passive.value * 100)}% ở ★${hero.passive.star}`,
      ),
    );
    sheet.body.append(skills);

    const gearBox = el('div', 'vd-gear');
    for (const slot of ['weapon', 'armor', 'charm', 'relic'] as const) {
      const id = saved.gear[slot];
      const piece = id ? save.gear[id] : undefined;
      const def = piece ? GEAR.items.find((candidate) => candidate.id === piece.defId) : undefined;
      const row = el('div', 'vd-gear-row');
      row.append(el('span', '', `${slot}: ${def?.name ?? '—'}${piece ? ` +${piece.plus}` : ''}`));
      if (piece && def) {
        row.append(
          button(
            `+ (${upgradeCost(piece)} vàng)`,
            () => {
              try {
                host.setSave(upgradeGear(host.save(), piece.defId));
                message = '';
                render();
              } catch (error) {
                message = String(error instanceof Error ? error.message : error);
                render();
              }
            },
            'vd-btn small',
          ),
        );
      }
      gearBox.append(row);
    }
    sheet.body.append(gearBox);
    if (saved.star < 5) {
      sheet.body.append(
        button(
          `Nâng ★ (${starCost(saved.star)} mảnh)`,
          () => {
            try {
              host.setSave(starUp(host.save(), hero.id));
              message = '';
              render();
            } catch (error) {
              message = String(error instanceof Error ? error.message : error);
              render();
            }
          },
          'vd-btn primary',
        ),
      );
    }
    if (message) sheet.body.append(el('p', 'vd-error', message));
  };
  render();
}

export function openSummonSheet(host: SheetHost) {
  const sheet = openSheet(t.summon);
  let results: string[] = [];
  let message = '';
  const render = () => {
    const save = host.save();
    sheet.body.replaceChildren();
    sheet.body.append(
      el(
        'p',
        'vd-hint',
        `${save.currencies.shards} mảnh · pity ${save.summon.pityRare}/10 · ${save.summon.pityEpic}/50`,
      ),
    );
    const pity = el('div', 'vd-pity');
    pity.append(el('i', ''));
    pity.firstElementChild!.setAttribute('style', `width:${(save.summon.pityRare / 10) * 100}%`);
    sheet.body.append(pity);
    const row = el('div', 'vd-row-actions');
    const canPull1 = save.currencies.shards >= 100;
    const canPull10 = save.currencies.shards >= 900;
    const pull1 = button('×1 · 100', () => pull(1), 'vd-btn');
    pull1.disabled = !canPull1;
    const pull10 = button('×10 · 900', () => pull(10), 'vd-btn primary');
    pull10.disabled = !canPull10;
    row.append(pull1, pull10);
    sheet.body.append(row);
    if (!canPull1) sheet.body.append(el('p', 'vd-hint', 'Cần thêm mảnh từ màn chơi để triệu hồi.'));
    if (message) sheet.body.append(el('p', 'vd-error', message));
    const list = el('div', 'vd-results');
    for (const line of results) list.append(el('div', 'vd-result', line));
    sheet.body.append(list);
  };
  const pull = (count: 1 | 10) => {
    try {
      const outcome = summon(host.save(), createRng((Date.now() >>> 0) + count), count);
      host.setSave(outcome.save);
      results = outcome.results.map((result) => {
        const hero = HEROES.items.find((candidate) => candidate.id === result.heroId);
        return `${hero?.name ?? result.heroId} · ${result.rarity}${result.duplicate ? ` · +${result.shards} mảnh` : ' · mới'}`;
      });
      message = '';
      render();
    } catch (error) {
      message = String(error instanceof Error ? error.message : error);
      render();
    }
  };
  render();
}

export function openOfflineCard(host: SheetHost) {
  const reward = offlineReward(host.save(), Date.now());
  if (reward.hours <= 0) return;
  const sheet = openSheet('Đoàn đã đi');
  sheet.body.append(
    el('p', 'vd-hint', `${reward.hours} giờ · tối đa 12 giờ`),
    el('div', 'vd-result', `Vàng +${reward.gold}`),
    el('div', 'vd-result', `Tinh chất +${reward.essence}`),
    el('div', 'vd-result', `Mảnh +${reward.shards}`),
    button(
      'Nhận',
      () => {
        const claimed = claimOffline(host.save(), Date.now());
        host.setSave(claimed.save);
        closeSheets();
      },
      'vd-btn primary',
    ),
  );
}

/** The host's current six loadouts, for a scene restart. */
export function currentTeam(save: SaveData) {
  return loadouts(save);
}
