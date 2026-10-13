// Token values for code that cannot use CSS variables (tests; canvas and Phaser drawing in games). tokens.css
// stays the only source: import it with `?raw` and parse it here.

export type ThemeName = 'light' | 'dark';

/** Token name without the `--tohe-` prefix → CSS value. */
export type Tokens = Record<string, string>;

/** Parses tokens.css into the light and dark token maps. */
export function parseTokens(css: string): Record<ThemeName, Tokens> {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const block = (theme: ThemeName) => {
    const start = text.indexOf(`[data-theme="${theme}"]`);
    const open = text.indexOf('{', start);
    if (start < 0 || open < 0) throw new Error(`tokens.css has no [data-theme="${theme}"] block`);
    const body = text.slice(open + 1, text.indexOf('}', open));
    const tokens: Tokens = {};
    for (const match of body.matchAll(/--tohe-([a-z-]+)\s*:\s*([^;]+);/g)) {
      const [, name, value] = match;
      if (name && value) tokens[name] = value.trim();
    }
    return tokens;
  };
  return { light: block('light'), dark: block('dark') };
}

/** A token's value; throws if the theme does not define it. */
export function token(tokens: Tokens, name: string): string {
  const value = tokens[name];
  if (value === undefined) throw new Error(`unknown token --tohe-${name}`);
  return value;
}

/** WCAG 2 contrast ratio between two `#rrggbb` colours (1 to 21). */
export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

function luminance(hex: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`not a #rrggbb colour: ${hex}`);
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
