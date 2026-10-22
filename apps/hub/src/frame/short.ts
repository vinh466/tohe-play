/**
 * A short screen (ADR 0046's consequences): a phone held sideways is about 320 to 430 px high, and the frame's bar,
 * a big heading and a first row of tiles together would fill it. The Tailwind variants `short:` and `turn:` in
 * `styles.css` are these two queries, written out; `frame.test.ts` keeps the two in step. Height, not width, tells a
 * phone on its side from a tablet or a computer (500 px and up).
 */
export const SHORT_LANDSCAPE = '(max-height: 499px) and (orientation: landscape)';

/**
 * The same, on a touch screen: where someone can turn the device. A computer's short window gets the frame's rail
 * but never "turn your phone", which it could not do.
 */
export const SHORT_LANDSCAPE_TOUCH = `${SHORT_LANDSCAPE} and (pointer: coarse)`;

/**
 * Whether a game asks the player to turn the phone upright when it is held sideways on a short screen: only a game that
 * declares `portrait`. `any` and `landscape` games never do; the hub neither locks nor rotates the screen.
 */
export const asksToTurnUpright = (orientation: string): boolean => orientation === 'portrait';
