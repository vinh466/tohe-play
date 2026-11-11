import type { StageDef } from '../core/types.ts';

/** A battle the board can open outside the story road. */
export type RunMode =
  | { readonly kind: 'story' }
  | { readonly kind: 'tower'; readonly floor: number }
  | { readonly kind: 'expedition' }
  | { readonly kind: 'boss' }
  | { readonly kind: 'challenge' }
  | { readonly kind: 'rift' };

export function modeName(mode: RunMode): string {
  switch (mode.kind) {
    case 'tower':
      return `Tháp · tầng ${mode.floor}`;
    case 'expedition':
      return 'Chuyến đi trong ngày';
    case 'boss':
      return 'Boss thế giới';
    case 'challenge':
      return 'Thử Thách Đường Mây';
    case 'rift':
      return 'Dị Bản';
    default:
      return 'Chặng đường';
  }
}

export interface RunStart {
  readonly stage: StageDef;
  readonly mode: RunMode;
}
