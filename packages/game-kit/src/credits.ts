// Who made a game's pictures, sounds and fonts, under which licence (ADR 0053): the build writes them to
// `studio/credits.json` in the game's folder, and the shell shows them on its Ghi công screen. The kit reads the file
// without @tohe/contract's schema (games carry no Zod), so it checks the shape itself.

/** `studio/credits.json`: the same shape as `AssetCredits` of @tohe/contract. */
export interface AssetCredits {
  packs: {
    id: string;
    version: string;
    licences: string[];
    attributions: { assets: string[]; text: string }[];
  }[];
}

/** One pack's credits as the shell shows them: a title and its lines. */
export interface CreditBlock {
  /** The pack and its version, e.g. `farm-crops 1.0.0`. */
  title: string;
  /** Its licences (`Giấy phép: CC-BY-4.0, CC0-1.0`), then each attribution's text. */
  lines: string[];
}

/** Relative to the game's page: both files are in the game's own folder (Game Contract v1). */
const MANIFEST_URL = './game.json';
export const CREDITS_URL = './studio/credits.json';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const isTextList = (value: unknown): value is string[] => Array.isArray(value) && value.every(isText);

/** The credits when `value` has the shape of `studio/credits.json`, else null. */
export function parseCredits(value: unknown): AssetCredits | null {
  if (!isRecord(value) || !Array.isArray(value.packs)) return null;
  const valid = value.packs.every(
    (pack) =>
      isRecord(pack) &&
      isText(pack.id) &&
      isText(pack.version) &&
      isTextList(pack.licences) &&
      Array.isArray(pack.attributions) &&
      pack.attributions.every(
        (attribution) =>
          isRecord(attribution) &&
          isText(attribution.text) &&
          isTextList(attribution.assets) &&
          attribution.assets.length > 0,
      ),
  );
  return valid ? (value as unknown as AssetCredits) : null;
}

async function readJson(fetcher: (url: string) => Promise<Response>, url: string): Promise<unknown> {
  const response = await fetcher(url);
  if (!response.ok) return null;
  return response.json();
}

/**
 * The game's credits, or null when it has none to show: a game without `assets` in its `game.json` (its credits file
 * is not asked for, so nothing logs a 404), or one whose `studio/credits.json` is missing, malformed or lists no pack.
 */
export async function readCredits(
  fetcher: (url: string) => Promise<Response> = (url) => fetch(url),
): Promise<AssetCredits | null> {
  try {
    const manifest = await readJson(fetcher, MANIFEST_URL);
    if (!isRecord(manifest) || !isRecord(manifest.assets) || Object.keys(manifest.assets).length === 0)
      return null;
    const credits = parseCredits(await readJson(fetcher, CREDITS_URL));
    return credits && credits.packs.length > 0 ? credits : null;
  } catch {
    return null;
  }
}

/** The credits as lines per pack: `licences` is the word before the licences (`Giấy phép`, `Licences`). */
export function formatCredits(credits: AssetCredits, words: { licences: string }): CreditBlock[] {
  return credits.packs.map((pack) => ({
    title: `${pack.id} ${pack.version}`,
    lines: [
      ...(pack.licences.length > 0 ? [`${words.licences}: ${pack.licences.join(', ')}`] : []),
      ...pack.attributions.map((attribution) => attribution.text),
    ],
  }));
}
