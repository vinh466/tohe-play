// The device's half of the proof-of-work (ADR 0037): find the number whose SHA-256, after the salt, is the challenge.
// SHA-256 is computed here rather than with crypto.subtle: that exists only on HTTPS (UAT is plain HTTP inside the
// VPN), and one asynchronous call per try would be slower than the whole search.

import { ApiError, auth, type ProofOfWorkChallenge, type ProofOfWorkSolution } from '../api/client.ts';

/** The first 32 bits of the fractional parts of the cube roots of the first 64 primes (FIPS 180-4). */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
]);

const encoder = new TextEncoder();
const schedule = new Uint32Array(64);

const rotate = (x: number, n: number) => (x >>> n) | (x << (32 - n));

/** An element the loops below read within the array's bounds, which the type checker cannot see. */
const at = (array: Uint8Array | Uint32Array, index: number) => array[index] as number;

/** SHA-256 of a text's UTF-8 bytes, in hexadecimal. */
export function sha256Hex(text: string): string {
  const bytes = encoder.encode(text);
  const blocks = Math.ceil((bytes.length + 9) / 64);
  const words = new Uint32Array(blocks * 16);
  for (let i = 0; i < bytes.length; i++)
    words[i >> 2] = at(words, i >> 2) | (at(bytes, i) << (24 - (i % 4) * 8));
  words[bytes.length >> 2] = at(words, bytes.length >> 2) | (0x80 << (24 - (bytes.length % 4) * 8));
  words[words.length - 1] = bytes.length * 8;

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const w = schedule;
  for (let block = 0; block < blocks; block++) {
    for (let t = 0; t < 16; t++) w[t] = at(words, block * 16 + t);
    for (let t = 16; t < 64; t++) {
      const x = at(w, t - 15);
      const y = at(w, t - 2);
      const s0 = rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3);
      const s1 = rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10);
      w[t] = (at(w, t - 16) + s0 + at(w, t - 7) + s1) | 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let t = 0; t < 64; t++) {
      const t1 =
        (h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + ((e & f) ^ (~e & g)) + at(K, t) + at(w, t)) | 0;
      const t2 = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

/** Tries between two pauses that let the page draw: the button's spinner keeps turning. */
const TRIES_PER_PAUSE = 5000;

/** Finds the answer to the API's challenge; on average half of `maxNumber` tries. */
export async function solve(challenge: ProofOfWorkChallenge): Promise<ProofOfWorkSolution> {
  for (let number = 0; number <= challenge.maxNumber; number++) {
    if (sha256Hex(challenge.salt + number) === challenge.challenge) return { token: challenge.token, number };
    if (number % TRIES_PER_PAUSE === TRIES_PER_PAUSE - 1)
      await new Promise((resume) => setTimeout(resume, 0));
  }
  throw new Error('No answer below maxNumber: the challenge is not one of the API');
}

/**
 * Sends a request that may need a proof-of-work: with one when the config says `proofOfWork`, and once more with a
 * fresh one when the server asks anyway — the console may have switched it on since the page loaded, or the challenge
 * may have expired.
 */
export async function withProof<T>(
  asked: boolean | undefined,
  send: (proof: ProofOfWorkSolution | null) => Promise<T>,
): Promise<T> {
  try {
    return await send(asked ? await solve(await auth.challenge()) : null);
  } catch (error) {
    if (!(error instanceof ApiError && error.code === 'proof_of_work_required')) throw error;
    return send(await solve(await auth.challenge()));
  }
}
