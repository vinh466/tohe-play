// Six board skins, earned by playing. A skin changes the board frame/background, never the piece palette, so a
// player can always read the board. The values are CSS classes in style.css.
export interface Skin {
  readonly id: string;
  readonly vi: string;
  readonly en: string;
  /** Journey stars needed to unlock it. */
  readonly at: number;
}

export const SKINS: readonly Skin[] = [
  { id: 'paper', vi: 'Giấy', en: 'Paper', at: 0 },
  { id: 'ink', vi: 'Mực', en: 'Ink', at: 6 },
  { id: 'gac', vi: 'Gấc', en: 'Gac', at: 12 },
  { id: 'turmeric', vi: 'Nghệ', en: 'Turmeric', at: 18 },
  { id: 'leaf', vi: 'Lá', en: 'Leaf', at: 24 },
  { id: 'night', vi: 'Đêm', en: 'Night', at: 36 },
];

export const skinById = (id: string): Skin | undefined => SKINS.find((skin) => skin.id === id);

export const skinName = (id: string, locale: string): string => {
  const skin = skinById(id) ?? (SKINS[0] as Skin);
  return locale.startsWith('vi') ? skin.vi : skin.en;
};
