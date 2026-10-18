// Profile names (ADR 0023): free, public, checked by the API (ProfileNames.cs). The hub only helps people type them.

/** The most visible characters a name may have, as the API counts them. */
export const MAX_NAME_LENGTH = 24;

/** Visible characters, not UTF-16 units: an emoji family counts as one, like on the API. */
export function visibleLength(text: string): number {
  return [...new Intl.Segmenter().segment(text)].length;
}

/** What the hub sends: composed (NFC), since the API cannot compose text itself, and trimmed. */
export const cleanName = (text: string) => text.normalize('NFC').trim();

const words = {
  vi: {
    animals: [
      'Mèo',
      'Cá Heo',
      'Gấu Trúc',
      'Thỏ',
      'Cáo',
      'Hổ',
      'Ếch',
      'Cánh Cụt',
      'Koala',
      'Sư Tử',
      'Kỳ Lân',
      'Bạch Tuộc',
      'Rùa',
      'Khủng Long',
      'Ong',
      'Cú',
    ],
    traits: [
      'Vui',
      'Nhanh',
      'Lém Lỉnh',
      'Dũng Cảm',
      'Tinh Nghịch',
      'Thông Thái',
      'Siêu Tốc',
      'Lấp Lánh',
      'Hiền Khô',
      'Mê Ngủ',
      'Tò Mò',
      'Hăng Hái',
    ],
    join: (animal: string, trait: string) => `${animal} ${trait}`,
  },
  en: {
    animals: [
      'Cat',
      'Dolphin',
      'Panda',
      'Bunny',
      'Fox',
      'Tiger',
      'Frog',
      'Penguin',
      'Koala',
      'Lion',
      'Unicorn',
      'Octopus',
      'Turtle',
      'Dino',
      'Bee',
      'Owl',
    ],
    traits: [
      'Happy',
      'Speedy',
      'Clever',
      'Brave',
      'Cheeky',
      'Wise',
      'Turbo',
      'Sparkly',
      'Gentle',
      'Sleepy',
      'Curious',
      'Jolly',
    ],
    join: (animal: string, trait: string) => `${trait} ${animal}`,
  },
};

const pick = (items: string[]) => items[Math.floor(Math.random() * items.length)] ?? '';

/**
 * A fun name for a new account's first profile, like "Mèo Vui" or "Cá Heo Nhanh" (D-17): never one taken from an
 * email or a real name, because profile names are public. People change it as they like.
 */
export function funName(language: string): string {
  const { animals, traits, join } = language.startsWith('en') ? words.en : words.vi;
  return join(pick(animals), pick(traits));
}
