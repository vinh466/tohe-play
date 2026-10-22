// The animals of a profile: each has an avatar and a name in each language, from one list — so a random name and a
// random avatar are one pick and always match ("Cáo Lém Lỉnh" with 🦊, never "Cá Heo Lém Lỉnh" with 🦊). The avatars are
// the API's `ProfileOptions.Avatars`, mirrored (storage/deviceProfiles.ts: AVATARS; profiles.test.ts keeps the two in
// step), so every avatar has a name and every name an avatar.

export interface Animal {
  avatar: string;
  vi: string;
  en: string;
}

export const ANIMALS: readonly Animal[] = [
  { avatar: '🦊', vi: 'Cáo', en: 'Fox' },
  { avatar: '🐼', vi: 'Gấu Trúc', en: 'Panda' },
  { avatar: '🐯', vi: 'Hổ', en: 'Tiger' },
  { avatar: '🐸', vi: 'Ếch', en: 'Frog' },
  { avatar: '🐧', vi: 'Cánh Cụt', en: 'Penguin' },
  { avatar: '🐨', vi: 'Koala', en: 'Koala' },
  { avatar: '🦁', vi: 'Sư Tử', en: 'Lion' },
  { avatar: '🐰', vi: 'Thỏ', en: 'Bunny' },
  { avatar: '🐱', vi: 'Mèo', en: 'Cat' },
  { avatar: '🐶', vi: 'Chó', en: 'Dog' },
  { avatar: '🦄', vi: 'Kỳ Lân', en: 'Unicorn' },
  { avatar: '🐙', vi: 'Bạch Tuộc', en: 'Octopus' },
  { avatar: '🐢', vi: 'Rùa', en: 'Turtle' },
  { avatar: '🦖', vi: 'Khủng Long', en: 'Dino' },
  { avatar: '🐝', vi: 'Ong', en: 'Bee' },
  { avatar: '🦉', vi: 'Cú', en: 'Owl' },
];
