/** Numbers a child can read on a small block: 2048, then 4K, 16K, …, 1M. */
export function formatValue(value: number): string {
  if (value < 4096) return String(value);
  if (value < 1_048_576) return `${Math.round(value / 1024)}K`;
  if (value < 1_073_741_824) return `${Math.round(value / 1_048_576)}M`;
  return `${Math.round(value / 1_073_741_824)}B`;
}

/** Scores with thousands separators in the player's locale. */
export function formatScore(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}
