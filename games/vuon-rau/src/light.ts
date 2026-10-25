// Day and night (SPEC.md): the world's light follows the device's local time as a soft tint over the map. It changes
// nothing in play. Pure: the view passes the hour.

export type DayPart = 'morning' | 'day' | 'evening' | 'night';

/** The part of the day at a local hour (0–23, fractions allowed). */
export function dayPart(hour: number): DayPart {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 9) return 'morning';
  if (h >= 9 && h < 17) return 'day';
  if (h >= 17 && h < 19.5) return 'evening';
  return 'night';
}

/** The tint over the world in each part of the day: a colour and how strongly it covers (0 is none). */
export const TINTS: Readonly<Record<DayPart, { colour: number; alpha: number }>> = {
  morning: { colour: 0xffd9a0, alpha: 0.1 },
  day: { colour: 0xffffff, alpha: 0 },
  evening: { colour: 0xff8a3d, alpha: 0.16 },
  night: { colour: 0x1b2450, alpha: 0.38 },
};
