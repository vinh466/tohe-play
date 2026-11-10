// Where the twelve cards, the row tags and the clash line sit inside the board canvas. Pure CSS pixels, no Phaser:
// the scene draws with it and `view-layout.test.ts` checks that no row can overlap another at any phone size.

export interface BoardLayout {
  readonly width: number;
  readonly height: number;
  /** Width of the vertical TRƯỚC/GIỮA/SAU tags on the left. */
  readonly rowTag: number;
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly rowGap: number;
  readonly columnGap: number;
  /** Card centres, column 0 (left) and 1 (right). */
  readonly x: readonly [number, number];
  /** Card centres by row: 0 front, 1 mid, 2 back, for the enemies (top) and the heroes (bottom). */
  readonly enemyY: readonly [number, number, number];
  readonly heroY: readonly [number, number, number];
  /** Where the dashed clash line and its diamond sit. */
  readonly clashY: number;
  readonly clashTop: number;
  readonly clashBottom: number;
  /** The vertical span the cards occupy, for a subtle background band. */
  readonly top: number;
  readonly bottom: number;
  readonly tagX: number;
}

const MARGIN_X = 8;
const MARGIN_Y = 5;
const ROW_TAG = 12;
const COLUMN_GAP = 7;
const MAX_CARD_HEIGHT = 64;

export function boardLayout(width: number, height: number): BoardLayout {
  const safeWidth = Math.max(0, width);
  const safeHeight = Math.max(0, height);
  const rowGap = Math.max(4, Math.min(9, safeHeight * 0.014));
  const clashGap = Math.max(14, Math.min(36, safeHeight * 0.07));
  const available = Math.max(0, safeHeight - MARGIN_Y * 2 - rowGap * 5 - clashGap);
  const cardHeight = Math.max(20, Math.min(MAX_CARD_HEIGHT, available / 6));
  const contentHeight = cardHeight * 6 + rowGap * 5 + clashGap;
  const top = Math.max(MARGIN_Y, (safeHeight - contentHeight) / 2);
  const bottom = top + contentHeight;

  const contentX = MARGIN_X + ROW_TAG;
  const cardWidth = Math.max(40, (safeWidth - MARGIN_X * 2 - ROW_TAG - COLUMN_GAP) / 2);
  const x0 = contentX + cardWidth / 2;
  const x1 = contentX + cardWidth + COLUMN_GAP + cardWidth / 2;

  const enemyBack = top + cardHeight / 2;
  const enemyMid = enemyBack + cardHeight + rowGap;
  const enemyFront = enemyMid + cardHeight + rowGap;
  const clashTop = enemyFront + cardHeight / 2 + rowGap / 2;
  const clashBottom = clashTop + clashGap;
  const heroFront = clashBottom + cardHeight / 2;
  const heroMid = heroFront + cardHeight + rowGap;
  const heroBack = heroMid + cardHeight + rowGap;

  return {
    width: safeWidth,
    height: safeHeight,
    rowTag: ROW_TAG,
    cardWidth,
    cardHeight,
    rowGap,
    columnGap: COLUMN_GAP,
    x: [x0, x1],
    enemyY: [enemyFront, enemyMid, enemyBack],
    heroY: [heroFront, heroMid, heroBack],
    clashY: (clashTop + clashBottom) / 2,
    clashTop,
    clashBottom,
    top,
    bottom,
    tagX: MARGIN_X + ROW_TAG / 2,
  };
}
