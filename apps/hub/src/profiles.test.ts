import { describe, expect, it } from 'vitest';
import { ANIMALS } from './session/animals.ts';
import { checkDigit, formatProfileId, parseProfileId } from './session/profileIds.ts';
import { cleanName, funIdentity, funName, MAX_NAME_LENGTH, visibleLength } from './session/profileNames.ts';
import { AVATARS } from './storage/deviceProfiles.ts';

/** An ID as the API makes them: eleven digits and their Damm check digit. */
const withCheck = (body: string) => body + checkDigit(body);

describe('profile IDs', () => {
  it('end in the Damm check digit, as on the API', () => {
    expect(checkDigit('572')).toBe(4); // the worked example of Damm's algorithm
    expect(checkDigit('5724')).toBe(0);
  });

  it('are read out in groups of four and typed back with spaces or dashes', () => {
    const id = withCheck('48291736504');
    expect(formatProfileId(id)).toBe(`${id.slice(0, 4)} ${id.slice(4, 8)} ${id.slice(8)}`);
    expect(parseProfileId(formatProfileId(id))).toBe(id);
    expect(parseProfileId(` ${id.slice(0, 4)}-${id.slice(4, 8)}-${id.slice(8)} `)).toBe(id);
  });

  it('catch a mistyped digit or two swapped neighbours before asking the API', () => {
    const id = withCheck('48291736504');
    const typo = `${id.slice(0, 5)}${(Number(id[5]) + 1) % 10}${id.slice(6)}`;
    const swapped = `${id.slice(0, 2)}${id[3]}${id[2]}${id.slice(4)}`;
    expect(parseProfileId(typo)).toBeNull();
    expect(parseProfileId(swapped)).toBeNull();
  });

  it('never start with 0 and always have twelve digits', () => {
    expect(parseProfileId(withCheck('01234567890'))).toBeNull();
    expect(parseProfileId(withCheck('4829173650'))).toBeNull();
    expect(parseProfileId(`${withCheck('48291736504')}7`)).toBeNull();
  });
});

describe('profile names', () => {
  it('count what people see, as the API does: an emoji family is one character', () => {
    expect(visibleLength('\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}')).toBe(1);
    expect(visibleLength('Bé Na 👧🏻')).toBe(7);
  });

  it('are sent composed and trimmed, because the API cannot compose text itself', () => {
    expect(cleanName('  Bố Vinh ')).toBe('Bố Vinh');
  });

  it('start as a fun name that fits', () => {
    for (const language of ['vi', 'en']) {
      for (let i = 0; i < 100; i++) {
        const name = funName(language);
        expect(name.split(' ').length).toBeGreaterThanOrEqual(2);
        expect(visibleLength(name)).toBeLessThanOrEqual(MAX_NAME_LENGTH);
      }
    }
  });
});

describe('a random name and its avatar', () => {
  it('are one animal: the name says the animal of the avatar, in either language', () => {
    for (const language of ['vi', 'en']) {
      for (const animal of ANIMALS) {
        // The same chance for every animal in turn: the one at this index of the list.
        const at = ANIMALS.indexOf(animal);
        const { name, avatar } = funIdentity(language, () => (at + 0.5) / ANIMALS.length);
        expect(avatar).toBe(animal.avatar);
        expect(name).toContain(language === 'en' ? animal.en : animal.vi);
      }
    }
  });

  it('never name an animal that has no avatar, nor leave an avatar without a name', () => {
    expect(new Set(ANIMALS.map((animal) => animal.avatar))).toEqual(new Set(AVATARS));
    expect(ANIMALS.length).toBe(AVATARS.length);
    for (const animal of ANIMALS) {
      expect(animal.vi.trim()).not.toBe('');
      expect(animal.en.trim()).not.toBe('');
    }
  });

  it('start as a name that fits, with an avatar from the list', () => {
    for (const language of ['vi', 'en']) {
      for (let i = 0; i < 200; i++) {
        const { name, avatar } = funIdentity(language);
        expect(visibleLength(name)).toBeLessThanOrEqual(MAX_NAME_LENGTH);
        expect(AVATARS as readonly string[]).toContain(avatar);
      }
    }
  });

  it('leave funName as the name alone', () => {
    expect(funName('en').split(' ').length).toBeGreaterThanOrEqual(2);
  });
});
