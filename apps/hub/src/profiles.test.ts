import { describe, expect, it } from 'vitest';
import { checkDigit, formatProfileId, parseProfileId } from './session/profileIds.ts';
import { cleanName, funName, MAX_NAME_LENGTH, visibleLength } from './session/profileNames.ts';

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
