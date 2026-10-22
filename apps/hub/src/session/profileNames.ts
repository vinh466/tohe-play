// Profile names (ADR 0023): free, public, checked by the API (ProfileNames.cs). The hub only helps people type them.
import { ANIMALS } from './animals.ts';

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

/**
 * A fun name and the avatar that goes with it, from one animal ("Cáo Vui" with 🦊): for a new profile, a name never
 * taken from an email or a real name, because profile names are public. People change either as they like.
 * `random` is the source of chance (tests give it a fixed one).
 */
export function funIdentity(
  language: string,
  random: () => number = Math.random,
): { name: string; avatar: string } {
  const { traits, join } = language.startsWith('en') ? words.en : words.vi;
  const animal = ANIMALS[Math.floor(random() * ANIMALS.length)] ?? ANIMALS[0];
  const trait = traits[Math.floor(random() * traits.length)] ?? '';
  return {
    name: join(language.startsWith('en') ? (animal?.en ?? '') : (animal?.vi ?? ''), trait),
    avatar: animal?.avatar ?? '🦊',
  };
}

/** Only the name, where the avatar is chosen elsewhere or later: like "Mèo Vui" or "Cáo Nhanh" (D-17). */
export const funName = (language: string): string => funIdentity(language).name;
