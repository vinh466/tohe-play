import type { SaveData } from './core/save-types.ts';
import type { Element, Role } from './core/types.ts';

export interface Strings {
  title: string;
  howToTitle: string;
  hints: string[];
  progress(save: SaveData): string;
  roles: Record<Role, string>;
  elements: Record<Element, string>;
  autoCast: string;
  autoCastNote: string;
  reducedMotion: string;
  reducedMotionNote: string;
  stage(stageId: string): string;
  autoCastOn: string;
  autoCastOff: string;
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
}

const VI: Strings = {
  title: 'Vân Du Ký',
  howToTitle: 'Cách chơi',
  hints: [
    'Đoàn tự đánh qua từng màn. Chạm một thẻ để xem, hoặc tắt Tự tung chiêu để tự chọn.',
    'Hàng trước đỡ đòn; hàng sau an toàn hơn. Đổi đội hình khi gặp tường.',
    'Thắng màn nhận vàng, tinh chất và mảnh; mở thẻ mới ở Triệu hồi.',
    'Đóng app thì đoàn vẫn đi; quay lại nhận phần đã farm (tối đa 12 giờ).',
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
  autoCast: 'Tự tung chiêu',
  autoCastNote: 'Tắt để tự bấm chiêu khi tới lượt hero.',
  reducedMotion: 'Giảm chuyển động',
  reducedMotionNote: 'Bớt rung và hiệu ứng khi đánh.',
  stage: (stageId) => `Màn ${stageId}`,
  autoCastOn: 'Tự tung chiêu: bật',
  autoCastOff: 'Tự tung chiêu: tắt',
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
};

const EN: Strings = {
  title: 'Vân Du Ký',
  howToTitle: 'How to play',
  hints: [
    'The company fights through each stage. Tap a card to inspect it, or turn Auto-cast off to pick skills.',
    'The front row takes the hits; the back row is safer. Change formation when you hit a wall.',
    'A win pays gold, essence and shards; open new cards in Summon.',
    'Close the app and the company keeps walking; come back for up to 12 hours of farm.',
  ],
  progress: (save) =>
    `Company level ${save.company.level} · Region ${save.progress.region} · Stage ${save.progress.stage}`,
  roles: {
    vanguard: 'Vanguard',
    blade: 'Blade',
    seer: 'Seer',
    binder: 'Binder',
  },
  elements: { ember: 'Ember', tide: 'Tide', stone: 'Stone', gale: 'Gale' },
  autoCast: 'Auto-cast',
  autoCastNote: 'Turn it off to cast a skill yourself on a hero turn.',
  reducedMotion: 'Reduced motion',
  reducedMotionNote: 'Less shake and fewer effects in battle.',
  stage: (stageId) => `Stage ${stageId}`,
  autoCastOn: 'Auto-cast: on',
  autoCastOff: 'Auto-cast: off',
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
};

export function stringsFor(locale: string): Strings {
  return locale === 'en' ? EN : VI;
}
