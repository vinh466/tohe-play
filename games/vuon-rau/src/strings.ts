// Vườn Rau's words: Vietnamese first, English second. The crops' names live with the crops (content/crops.ts), Cô Ba's
// lines with her (content/lines.ts).

export const strings = {
  vi: {
    title: 'Vườn Rau',
    coins: 'Xu',
    basket: 'Giỏ',
    seeds: 'Hạt',
    hints: [
      { icon: '👆', text: 'Chạm vào ô đất: bác nông dân đi tới và làm việc ô đó cần.' },
      { icon: '🌱', text: 'Cuốc đất, gieo hạt, rồi tưới nước. Mỗi lần cây lớn lại cần tưới.' },
      { icon: '🧺', text: 'Cây chín thì chạm để hái. Rau lớn cả khi đã tắt trò chơi.' },
      { icon: '🪙', text: 'Chạm vào quầy để bán rau và mua thêm hạt.' },
    ],
    pick: 'Gieo hạt gì?',
    pickNone: 'Hết hạt rồi. Ra quầy của Cô Ba mua thêm nhé.',
    have: (n: number) => `còn ${n}`,
    stall: 'Quầy của Cô Ba',
    sellAll: (coins: string) => `Bán hết giỏ: ${coins} xu`,
    nothingToSell: 'Giỏ chưa có rau',
    buy: 'Mua hạt',
    seedLine: (price: number, minutes: number) => `${price} xu · chín sau ${minutes} phút`,
    close: 'Xong',
    cancel: 'Thôi',
    gained: (coins: number) => `+${coins} xu`,
    plus: '+1',
    grass: 'Đất cỏ. Chạm để cuốc.',
    tilled: 'Đất đã cuốc. Chạm để gieo hạt.',
    thirsty: (crop: string) => `${crop} cần tưới nước.`,
    growing: (crop: string, left: string) => `${crop} · chín sau ${left}.`,
    ripe: (crop: string) => `${crop} chín rồi! Chạm để hái.`,
    minutes: (n: number) => `${n} phút`,
    hours: (h: number, m: number) => (m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`),
    lessThanAMinute: 'chưa tới 1 phút',
    inProgress: (coins: string) => `Vườn của bạn có ${coins} xu.`,
  },
  en: {
    title: 'Veggie Patch',
    coins: 'Coins',
    basket: 'Basket',
    seeds: 'Seeds',
    hints: [
      { icon: '👆', text: 'Tap a plot: the farmer walks over and does what it needs.' },
      { icon: '🌱', text: 'Dig, sow, then water. A crop needs water again each time it grows.' },
      { icon: '🧺', text: 'Tap a ripe crop to pick it. Crops grow even while the game is closed.' },
      { icon: '🪙', text: 'Tap the stall to sell your vegetables and buy more seeds.' },
    ],
    pick: 'Which seed?',
    pickNone: 'No seeds left. Buy some at Cô Ba’s stall.',
    have: (n: number) => `${n} left`,
    stall: 'Cô Ba’s stall',
    sellAll: (coins: string) => `Sell the basket: ${coins} coins`,
    nothingToSell: 'The basket is empty',
    buy: 'Buy seeds',
    seedLine: (price: number, minutes: number) => `${price} coins · ripe in ${minutes} min`,
    close: 'Done',
    cancel: 'Not now',
    gained: (coins: number) => `+${coins} coins`,
    plus: '+1',
    grass: 'Grass. Tap to dig.',
    tilled: 'Dug soil. Tap to sow.',
    thirsty: (crop: string) => `The ${crop.toLowerCase()} needs water.`,
    growing: (crop: string, left: string) => `${crop} · ripe in ${left}.`,
    ripe: (crop: string) => `The ${crop.toLowerCase()} is ripe! Tap to pick it.`,
    minutes: (n: number) => `${n} min`,
    hours: (h: number, m: number) => (m > 0 ? `${h} h ${m} min` : `${h} h`),
    lessThanAMinute: 'under a minute',
    inProgress: (coins: string) => `Your farm has ${coins} coins.`,
  },
} as const;

export type Locale = keyof typeof strings;
export type Strings = (typeof strings)[Locale];

export const stringsFor = (locale: string): Strings => (locale.startsWith('vi') ? strings.vi : strings.en);
export const localeOf = (locale: string): Locale => (locale.startsWith('vi') ? 'vi' : 'en');

/** How long until something happens, in words: minutes up to an hour, then hours and minutes. */
export function duration(t: Strings, ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  if (ms < 60_000) return t.lessThanAMinute;
  if (minutes < 60) return t.minutes(minutes);
  return t.hours(Math.floor(minutes / 60), minutes % 60);
}
