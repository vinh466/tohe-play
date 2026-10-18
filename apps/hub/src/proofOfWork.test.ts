import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256Hex, solve } from './session/proofOfWork.ts';

const reference = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

describe('the proof-of-work (ADR 0037)', () => {
  it('hashes as SHA-256 does, in one block or several, ASCII or not', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    for (const text of [
      '',
      'a',
      'Tò He 🦊',
      'x'.repeat(55),
      'x'.repeat(56),
      'x'.repeat(64),
      'y'.repeat(200),
    ]) {
      expect(sha256Hex(text)).toBe(reference(text));
    }
  });

  it("finds the number the API hid, and hands back the API's token", async () => {
    const salt = randomBytes(12).toString('hex');
    const challenge = {
      algorithm: 'SHA-256',
      challenge: reference(`${salt}4321`),
      salt,
      maxNumber: 5000,
      token: 't',
    };

    await expect(solve(challenge)).resolves.toEqual({ token: 't', number: 4321 });
    await expect(solve({ ...challenge, challenge: reference('not this salt') })).rejects.toThrow();
  });
});
