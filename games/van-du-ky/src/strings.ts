import type { SaveData, SaveSlot } from './core/save-types.ts';
import type { Element, Rarity, Role } from './core/types.ts';

export interface Strings {
  title: string;
  howToTitle: string;
  hints: string[];
  progress(save: SaveData): string;
  roles: Record<Role, string>;
  elements: Record<Element, string>;
  rarities: Record<Rarity, string>;
  slots: Record<SaveSlot, string>;
  autoCast: string;
  autoCastNote: string;
  reducedMotion: string;
  reducedMotionNote: string;
  stage(stageId: string): string;
  wave: string;
  autoCastOn: string;
  autoCastOff: string;
  autoOnShort: string;
  autoOffShort: string;
  speedShort: string;
  run: string;
  speed: string;
  stop: string;
  upgrade: string;
  win: string;
  lose: string;
  next: string;
  retry: string;
  menu: string;
  team: string;
  summon: string;
  codex: string;
  gear: string;
  more: string;
  close: string;
  continue: string;
  daily: string;
  stages: string;
  records: string;
  inventory: string;
  equip: string;
  equipped: string;
  remove: string;
  pick: string;
  start: string;
  warnPower: string;
  cleared: string;
  firstClear: string;
  recommended: string;
  yourPower: string;
  tower: string;
  floor: string;
  expedition: string;
  expeditionShort: string;
  boss: string;
  bossShort: string;
  challenge: string;
  challengeShort: string;
  week: string;
  claim: string;
  claimed: string;
  ready: string;
  journey: string;
  quests: string;
  reward: string;
  credits: string;
  bond: string;
  bonds: string;
  region: string;
  levelShort: string;
  furthest: string;
  heroes: string;
  enemies: string;
  back: string;
  none: string;
  company: string;
  power: string;
  stats: string;
  skills: string;
  passive: string;
  shards: string;
  gold: string;
  essence: string;
  open: string;
  locked: string;
  done: string;
}

const VI: Strings = {
  title: 'Vân Du Ký',
  howToTitle: 'Cách chơi',
  hints: [
    'Đoàn tự đánh. Chạm thẻ khi tới lượt để tung chiêu.',
    'Hàng trước đỡ đòn; hàng sau đánh mạnh hơn.',
    'Thắng màn nhận vàng, tinh chất, mảnh; mở thẻ ở Triệu hồi.',
    'Đóng app, đoàn vẫn đi; quay lại nhận tối đa 12 giờ.',
  ],
  progress: (save) =>
    `Công ty cấp ${save.company.level} · Vùng ${save.progress.region} · Màn ${save.progress.stage}`,
  roles: {
    vanguard: 'Tiên phong',
    blade: 'Kiếm sĩ',
    seer: 'Tiên tri',
    binder: 'Trói buộc',
  },
  elements: { ember: 'Lửa', tide: 'Nước', stone: 'Đá', gale: 'Gió' },
  rarities: { common: 'Thường', rare: 'Hiếm', epic: 'Sử thi' },
  slots: { weapon: 'Vũ khí', armor: 'Giáp', charm: 'Bùa', relic: 'Di vật' },
  autoCast: 'Tự tung chiêu',
  autoCastNote: 'Tắt để tự bấm chiêu khi tới lượt hero.',
  reducedMotion: 'Giảm chuyển động',
  reducedMotionNote: 'Bớt rung và hiệu ứng khi đánh.',
  stage: (stageId) => `Màn ${stageId}`,
  wave: 'Đợt',
  autoCastOn: 'Tự tung chiêu: bật',
  autoCastOff: 'Tự tung chiêu: tắt',
  autoOnShort: 'Tự',
  autoOffShort: 'Tay',
  speedShort: 'Tốc',
  run: 'Chạy',
  speed: 'Tốc độ',
  stop: 'Dừng',
  upgrade: 'Nâng cấp',
  win: 'Thắng màn',
  lose: 'Thua',
  next: 'Tiếp',
  retry: 'Đánh lại',
  menu: 'Menu',
  team: 'Đội',
  summon: 'Triệu hồi',
  codex: 'Sổ tay',
  gear: 'Trang bị',
  more: 'Khác',
  close: 'Đóng',
  continue: 'Tiếp tục',
  daily: 'Hôm nay',
  stages: 'Chặng đường',
  records: 'Kỷ lục',
  inventory: 'Túi đồ',
  equip: 'Lắp',
  equipped: 'Đang dùng',
  remove: 'Tháo',
  pick: 'Chọn',
  start: 'Đi',
  warnPower: 'Sức mạnh dưới mức đề nghị — vẫn đi được, nhưng hãy chuẩn bị.',
  cleared: 'Đã qua',
  firstClear: 'Thưởng lần đầu',
  recommended: 'Đề nghị',
  yourPower: 'Sức mạnh',
  tower: 'Tháp Đường Mây',
  floor: 'Tầng',
  expedition: 'Chuyến đi trong ngày',
  expeditionShort: 'Đi trong ngày',
  boss: 'Boss thế giới',
  bossShort: 'Boss tuần',
  challenge: 'Thử Thách Đường Mây',
  challengeShort: 'Thử thách tuần',
  week: 'Tuần',
  claim: 'Nhận',
  claimed: 'Đã nhận',
  ready: 'Sẵn sàng',
  journey: 'Khởi Hành',
  quests: 'Việc hôm nay',
  reward: 'Thưởng',
  credits: 'Ghi công',
  bond: 'Mối nối',
  bonds: 'Mối nối',
  region: 'Vùng',
  levelShort: 'Cấp',
  furthest: 'Màn xa nhất',
  heroes: 'Anh hùng',
  enemies: 'Quái',
  back: 'Quay lại',
  none: '—',
  company: 'Công ty',
  power: 'Sức mạnh',
  stats: 'Chỉ số',
  skills: 'Kỹ năng',
  passive: 'Bị động',
  shards: 'Mảnh',
  gold: 'Vàng',
  essence: 'Tinh chất',
  open: 'Mở',
  locked: 'Chưa mở',
  done: 'Xong',
};

const EN: Strings = {
  title: 'Vân Du Ký',
  howToTitle: 'How to play',
  hints: [
    'The company fights on its own. Tap a card on its turn to cast.',
    'The front row takes hits; the back row hits harder.',
    'A win pays gold, essence and shards; open cards in Summon.',
    'Close the app and the company keeps walking; up to 12 hours of farm.',
  ],
  progress: (save) =>
    `Company level ${save.company.level} · Region ${save.progress.region} · Stage ${save.progress.stage}`,
  roles: { vanguard: 'Vanguard', blade: 'Blade', seer: 'Seer', binder: 'Binder' },
  elements: { ember: 'Ember', tide: 'Tide', stone: 'Stone', gale: 'Gale' },
  rarities: { common: 'Common', rare: 'Rare', epic: 'Epic' },
  slots: { weapon: 'Weapon', armor: 'Armor', charm: 'Charm', relic: 'Relic' },
  autoCast: 'Auto-cast',
  autoCastNote: 'Turn it off to cast a skill yourself on a hero turn.',
  reducedMotion: 'Reduced motion',
  reducedMotionNote: 'Less shake and fewer effects in battle.',
  stage: (stageId) => `Stage ${stageId}`,
  wave: 'Wave',
  autoCastOn: 'Auto-cast: on',
  autoCastOff: 'Auto-cast: off',
  autoOnShort: 'Auto',
  autoOffShort: 'Manual',
  speedShort: 'Speed',
  run: 'Run',
  speed: 'Speed',
  stop: 'Stop',
  upgrade: 'Upgrade',
  win: 'Stage clear',
  lose: 'Defeat',
  next: 'Next',
  retry: 'Retry',
  menu: 'Menu',
  team: 'Team',
  summon: 'Summon',
  codex: 'Codex',
  gear: 'Gear',
  more: 'More',
  close: 'Close',
  continue: 'Continue',
  daily: 'Today',
  stages: 'The road',
  records: 'Records',
  inventory: 'Inventory',
  equip: 'Equip',
  equipped: 'Equipped',
  remove: 'Remove',
  pick: 'Pick',
  start: 'Go',
  warnPower: 'Below the recommended power — you may go, but be ready.',
  cleared: 'Cleared',
  firstClear: 'First clear',
  recommended: 'Recommended',
  yourPower: 'Power',
  tower: 'Cloud Road Tower',
  floor: 'Floor',
  expedition: 'Daily expedition',
  expeditionShort: 'Expedition',
  boss: 'World boss',
  bossShort: 'Weekly boss',
  challenge: 'Cloud Road Challenge',
  challengeShort: 'Weekly challenge',
  week: 'Week',
  claim: 'Claim',
  claimed: 'Claimed',
  ready: 'Ready',
  journey: 'Departure',
  quests: "Today's tasks",
  reward: 'Reward',
  credits: 'Credits',
  bond: 'Bond',
  bonds: 'Bonds',
  region: 'Region',
  levelShort: 'Lv',
  furthest: 'Furthest',
  heroes: 'Heroes',
  enemies: 'Enemies',
  back: 'Back',
  none: '—',
  company: 'Company',
  power: 'Power',
  stats: 'Stats',
  skills: 'Skills',
  passive: 'Passive',
  shards: 'Shards',
  gold: 'Gold',
  essence: 'Essence',
  open: 'Open',
  locked: 'Locked',
  done: 'Done',
};

export function stringsFor(locale: string): Strings {
  return locale === 'en' ? EN : VI;
}
