/** Numbers a child can read on a small block: 2048, then 4K, 16K, …, 1M. */
export function formatValue(value: number): string {
  if (value < 4096) return String(value);
  if (value < 1_048_576) return `${Math.round(value / 1024)}K`;
  if (value < 1_073_741_824) return `${Math.round(value / 1_048_576)}M`;
  return `${Math.round(value / 1_073_741_824)}B`;
}

const formats = new Map<string, Intl.NumberFormat>();
/** Number formats are slow to create and a HUD formats every frame while a score counts up. */
function numberFormat(locale: string, decimals?: number): Intl.NumberFormat {
  const key = `${locale}:${decimals ?? ''}`;
  let format = formats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, decimals === undefined ? {} : { maximumFractionDigits: decimals });
    formats.set(key, format);
  }
  return format;
}

/** Scores with thousands separators in the player's locale. */
export function formatScore(value: number, locale: string): string {
  return numberFormat(locale).format(value);
}

/** Units for shortened scores, largest first. */
const UNITS: readonly [size: number, unit: string][] = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

/**
 * A score in at most `maxChars` characters, for a box that cannot grow: in full while it fits ("1.234.567"),
 * otherwise in its own unit, K, M, B or T, with as many decimals as fit ("12,34M"). Digits are cut, never rounded
 * up, so a score never shows more than it is. Returns the shortest form when even that does not fit.
 */
export function formatCompact(value: number, locale: string, maxChars: number): string {
  const full = formatScore(value, locale);
  if (full.length <= maxChars) return full;
  const own = UNITS.find(([size]) => value >= size);
  if (!own) return full;
  const [size, unit] = own;
  let text = full;
  for (let decimals = 2; decimals >= 0; decimals--) {
    // size / 10^decimals is a whole number, so the cut is exact (no 4.35 → 4.34 from binary fractions).
    const scale = 10 ** decimals;
    text = `${numberFormat(locale, decimals).format(Math.floor(value / (size / scale)) / scale)}${unit}`;
    if (text.length <= maxChars) return text;
  }
  return text;
}
