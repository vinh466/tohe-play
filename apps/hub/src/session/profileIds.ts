// Public profile IDs (ADR 0023): 12 digits, the first never 0, the last a Damm check digit. The API makes them
// (services/api/src/Tohe.Api/Modules/Identity/ProfileIds.cs); the hub shows them, and checks what people type before
// asking the API, so a mistyped digit or two swapped neighbours are caught on the spot.

/** The Damm quasigroup of order 10 (H. Michael Damm, 2004), as in the API. */
const QUASIGROUP = [
  [0, 3, 1, 7, 5, 9, 8, 6, 4, 2],
  [7, 0, 9, 2, 1, 5, 4, 8, 6, 3],
  [4, 2, 0, 6, 8, 7, 1, 3, 5, 9],
  [1, 7, 5, 0, 9, 8, 3, 4, 2, 6],
  [6, 1, 2, 3, 0, 4, 5, 9, 7, 8],
  [3, 6, 7, 4, 2, 0, 9, 5, 8, 1],
  [5, 8, 6, 9, 7, 2, 0, 1, 3, 4],
  [8, 9, 4, 5, 3, 6, 2, 0, 1, 7],
  [9, 4, 3, 8, 6, 1, 7, 2, 0, 5],
  [2, 5, 8, 1, 4, 3, 6, 7, 9, 0],
];

/** The Damm check digit of a run of decimal digits. */
export function checkDigit(digits: string): number {
  let interim = 0;
  for (const digit of digits) interim = QUASIGROUP[interim]?.[Number(digit)] ?? 0;
  return interim;
}

/** "123456789012" → "1234 5678 9012", as people read it out. */
export const formatProfileId = (id: string) => `${id.slice(0, 4)} ${id.slice(4, 8)} ${id.slice(8)}`;

/** What someone typed — spaces or dashes anywhere — as a profile ID, or null when it cannot be one. */
export function parseProfileId(input: string): string | null {
  const id = input.replace(/[\s-]/g, '');
  return /^[1-9]\d{11}$/.test(id) && checkDigit(id) === 0 ? id : null;
}
