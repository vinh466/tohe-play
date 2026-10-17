// What an authenticator app shows (RFC 6238: HMAC-SHA1, 30-second steps, six digits) for a base32 key, so the smoke test
// can pass the admin console's two-factor authentication (ADR 0027).
import { createHmac } from 'node:crypto';

export function totp(sharedKey: string, at = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigInt64BE(BigInt(Math.floor(at / 30_000)));
  const hash = createHmac('sha1', base32(sharedKey)).update(counter).digest();
  const offset = (hash[hash.length - 1] ?? 0) & 0x0f;
  const binary =
    (((hash[offset] ?? 0) & 0x7f) << 24) |
    ((hash[offset + 1] ?? 0) << 16) |
    ((hash[offset + 2] ?? 0) << 8) |
    (hash[offset + 3] ?? 0);
  return String(binary % 1_000_000).padStart(6, '0');
}

function base32(text: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const c of text.toUpperCase().replace(/[\s=]/g, '')) {
    buffer = (buffer << 5) | alphabet.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
      buffer &= (1 << bits) - 1;
    }
  }
  return Buffer.from(bytes);
}
