// The games' public pages, /games/ and /games/<gameId>/, and the same under /en/. A game's page comes from its own
// folder (ADR 0047): games/<id>/public/game.json and its icon say what the manifest holds — its name and description in
// the page's language (ADR 0048), the age, the orientation, the seats — and games/<id>/page/ says the rest, its words
// in each language (vi.md, en.md) and the facts the manifest does not hold (facts.json), read by ./game-page.ts. A game
// without them fails the build. What is here is the pages' own words, the same for every game.
import { GameManifest, gameDescription, gameName } from '@tohe/contract';
import type { Lang } from '../i18n.ts';
import {
  allOffline,
  type GameFacts,
  type GamePageText,
  pageHeadings,
  parseGameFacts,
  parseGamePage,
} from './game-page.ts';

const viPage = {
  title: 'Trò chơi — Tò He',
  description:
    'Các trò chơi nhỏ trên Tò He: ghép khối, bài Tiến Lên, thử phản xạ. Chơi ngay trên điện thoại, miễn phí, không quảng cáo, không cần tài khoản.',
  heading: 'Trò chơi',
  lead: 'Mỗi trò là một ván ngắn: mở là chơi, vài phút. Bấm Chơi, hoặc chọn một trò để xem cách chơi.',
  play: 'Chơi',
  /** Only for a game that can be played at a table with others (the `rooms` capability). */
  playTogether: 'Chơi cùng',
  back: '← Tất cả trò chơi',
  home: 'Trang chủ',
  facts: 'Thông tin nhanh',
  ...pageHeadings.vi,
  others: 'Các trò khác',
  install: 'Muốn mở nhanh như một ứng dụng? Xem cách cài ra màn hình chính.',
};

/** The page's own words, apart from the game's. */
export const gamesPage: Record<Lang, typeof viPage> = {
  vi: viPage,
  en: {
    title: 'Games — Tò He',
    description:
      'The small games on Tò He: merging number blocks, the card game Tiến Lên, a reflex test. Play now on your phone. Free, no ads, no account needed.',
    heading: 'Games',
    lead: 'Every game is a short round: open it and play, a few minutes. Tap Play, or pick a game to see how it plays.',
    play: 'Play',
    playTogether: 'Play together',
    back: '← All games',
    home: 'Home',
    facts: 'At a glance',
    ...pageHeadings.en,
    others: 'Other games',
    install: 'Want it to open quickly, like an app? See how to add it to your home screen.',
  },
};

/** The words for what the manifest and the facts say: the chips, the facts table and the structured data. */
const factWords = {
  vi: {
    tags: {
      puzzle: 'Giải đố',
      numbers: 'Con số',
      cards: 'Bài',
      classic: 'Kinh điển',
      reflex: 'Phản xạ',
    } as Record<string, string>,
    fromAge: (age: number) => `Từ ${age} tuổi`,
    allAges: 'Mọi lứa tuổi',
    together: (min: number, max: number) => `Chơi cùng: ${min}–${max} người`,
    bots: 'Có bạn máy',
    alone: 'Chơi một mình',
    ranked: 'Có bảng xếp hạng',
    rows: {
      ages: 'Tuổi',
      players: 'Người chơi',
      round: 'Một ván',
      screen: 'Cầm máy',
      offline: 'Khi mất mạng',
      ads: 'Quảng cáo',
      data: 'Thông tin cá nhân',
    },
    players: (seats: { min: number; max: number } | undefined, bots: boolean) =>
      !seats
        ? 'Một người'
        : bots
          ? `Một mình với bạn máy, hoặc ${seats.min}–${seats.max} người cùng bàn, mỗi người một máy`
          : `${seats.min}–${seats.max} người cùng bàn, mỗi người một máy`,
    round: (round: GameFacts['round']) =>
      round.kind === 'fixed'
        ? `${round.seconds} giây`
        : round.kind === 'about'
          ? `Khoảng ${round.minMinutes === round.maxMinutes ? round.minMinutes : `${round.minMinutes}–${round.maxMinutes}`} phút`
          : 'Không đặt giờ, chơi đến khi hết ván, game nhớ chỗ đang chơi',
    screen: { portrait: 'Cầm dọc', landscape: 'Cầm ngang', any: 'Dọc hay ngang đều được' },
    yes: 'Chơi được',
    noAds: 'Không có',
    noData: 'Chơi không cần đăng ký, không theo dõi',
  },
  en: {
    tags: {
      puzzle: 'Puzzle',
      numbers: 'Numbers',
      cards: 'Cards',
      classic: 'Classic',
      reflex: 'Reflex',
    } as Record<string, string>,
    fromAge: (age: number) => `Ages ${age}+`,
    allAges: 'All ages',
    together: (min: number, max: number) => `Play together: ${min}–${max} players`,
    bots: 'Bots to play against',
    alone: 'Play alone',
    ranked: 'Leaderboard',
    rows: {
      ages: 'Age',
      players: 'Players',
      round: 'One round',
      screen: 'Hold it',
      offline: 'Without internet',
      ads: 'Ads',
      data: 'Your data',
    },
    players: (seats: { min: number; max: number } | undefined, bots: boolean) =>
      !seats
        ? 'One player'
        : bots
          ? `Alone against bots, or ${seats.min}–${seats.max} at one table, each on their own device`
          : `${seats.min}–${seats.max} at one table, each on their own device`,
    round: (round: GameFacts['round']) =>
      round.kind === 'fixed'
        ? `${round.seconds} seconds`
        : round.kind === 'about'
          ? `About ${round.minMinutes === round.maxMinutes ? round.minMinutes : `${round.minMinutes}–${round.maxMinutes}`} minutes`
          : 'No clock: play until the game is over, and it keeps your place',
    screen: { portrait: 'Upright', landscape: 'Sideways', any: 'Upright or sideways' },
    yes: 'Plays',
    noAds: 'None',
    noData: 'No sign-up needed to play, no tracking',
  },
} satisfies Record<Lang, unknown>;

export interface Game {
  id: string;
  name: string;
  description: string;
  /** The icon's address under /_web/, hashed. */
  icon: string;
  minAge: number;
  /** The words for the chips under the name: age, how it is played, ranking. */
  chips: string[];
  /** The facts table: the manifest's facts and facts.json's, in words of the page's language. */
  facts: { label: string; value: string }[];
  /** 'SinglePlayer' or 'MultiPlayer' for the structured data: with rooms, a table of several. */
  playMode: 'SinglePlayer' | 'MultiPlayer';
  seats?: { min: number; max: number };
  /** It can be played at a table with others (the `rooms` capability): its page offers "Chơi cùng bạn". */
  together: boolean;
  genre: string[];
  /** The platform's own sample (tag `sample`): listed after the games made to be played. */
  sample: boolean;
  /** The game's words in the page's language, from games/<id>/page/<lang>.md. */
  page: GamePageText;
  /** Its pictures, with their addresses under /_web/. */
  pictures: { src: string; alt: string }[];
  /** The page's title and description. */
  title: string;
  metaDescription: string;
}

/** What a game's page shows of its manifest, its page's words and its facts, in words of `lang`; pure, for the tests. */
export function describeGame(
  manifest: GameManifest,
  icon: string,
  page: GamePageText,
  facts: GameFacts,
  lang: Lang,
  options: { offlineEverywhere?: boolean; pictures?: { src: string; alt: string }[] } = {},
): Game {
  const words = factWords[lang];
  const rooms = manifest.rooms;
  const together = manifest.capabilities.includes('rooms') && rooms !== undefined;
  const ages = manifest.minAge > 0 ? words.fromAge(manifest.minAge) : words.allAges;
  const chips = [ages];
  if (rooms) {
    chips.push(words.together(rooms.seats.min, rooms.seats.max));
    if (rooms.bots.length > 0) chips.push(words.bots);
  } else {
    chips.push(words.alone);
  }
  if (manifest.capabilities.includes('ranked')) chips.push(words.ranked);
  const name = gameName(manifest, lang);
  const description = gameDescription(manifest, lang);
  return {
    id: manifest.id,
    name,
    description,
    icon,
    minAge: manifest.minAge,
    chips,
    facts: [
      { label: words.rows.ages, value: ages },
      { label: words.rows.players, value: words.players(rooms?.seats, (rooms?.bots.length ?? 0) > 0) },
      { label: words.rows.round, value: words.round(facts.round) },
      { label: words.rows.screen, value: words.screen[manifest.orientation] },
      // Said only once every game plays offline (ADR 0047): a table that says "no" for one game would be read as a
      // promise for the others.
      ...(options.offlineEverywhere ? [{ label: words.rows.offline, value: words.yes }] : []),
      { label: words.rows.ads, value: words.noAds },
      { label: words.rows.data, value: words.noData },
    ],
    playMode: rooms ? 'MultiPlayer' : 'SinglePlayer',
    seats: rooms?.seats,
    together,
    genre: manifest.tags.flatMap((tag) => (words.tags[tag] ? [words.tags[tag]] : [])),
    sample: manifest.tags.includes('sample'),
    page,
    pictures: options.pictures ?? [],
    title: `${name} — ${page.kind} | Tò He`,
    metaDescription: description || page.answer,
  };
}

const root = '../../../../games/';
/** The repository's path of a file found from here, for messages: games/<id>/page/vi.md. */
const shown = (file: string) => `games/${file.slice(root.length)}`;
const missing = (file: string) =>
  `${shown(file)} is missing: every game has its page in Vietnamese and English and its facts (docs/guides/create-a-game.md)`;

const manifests = import.meta.glob<unknown>('../../../../games/*/public/game.json', {
  eager: true,
  import: 'default',
});
const icons = import.meta.glob<string>('../../../../games/*/public/*.{svg,png}', {
  eager: true,
  query: '?url',
  import: 'default',
});
const pageFiles = import.meta.glob<string>('../../../../games/*/page/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const factFiles = import.meta.glob<unknown>('../../../../games/*/page/facts.json', {
  eager: true,
  import: 'default',
});
// The page's pictures, not its link-preview pictures (og.<lang>.png), which the build copies beside the page itself
// (scripts/copy-og.ts) and which would otherwise be copied a second time under /_web/.
const pictureFiles = import.meta.glob<string>(
  ['../../../../games/*/page/*.{png,jpg,webp}', '!../../../../games/*/page/og.*.png'],
  { eager: true, query: '?url', import: 'default' },
);

/** A game's folder, its manifest and its facts: the same in both languages. */
interface Source {
  folder: string;
  manifest: GameManifest;
  facts: GameFacts;
}

const sources: Source[] = Object.entries(manifests).map(([file, json]) => {
  const folder = file.replace(/public\/game\.json$/, '');
  const factsFile = `${folder}page/facts.json`;
  const facts = factFiles[factsFile];
  if (facts === undefined) throw new Error(missing(factsFile));
  return { folder, manifest: GameManifest.parse(json), facts: parseGameFacts(facts, shown(factsFile)) };
});

/** Every game with a game.json in the words of `lang`, the sample last, else by id (the catalog's order). */
export function loadGames(lang: Lang = 'vi'): Game[] {
  const offline = offlineEverywhere();
  const games = sources.map(({ folder, manifest, facts }) => {
    // A game with no icon shows Tò He's own.
    const icon = manifest.icon ? icons[`${folder}public/${manifest.icon}`] : '/favicon.svg';
    if (!icon) throw new Error(`${manifest.id}: the icon ${manifest.icon} is not in ${shown(folder)}public/`);
    const pageFile = `${folder}page/${lang}.md`;
    const markdown = pageFiles[pageFile];
    if (markdown === undefined) throw new Error(missing(pageFile));
    const page = parseGamePage(markdown, lang, shown(pageFile));
    const pictures = page.pictures.map(({ file, alt }) => {
      const src = pictureFiles[`${folder}page/${file}`];
      if (!src) throw new Error(`${shown(pageFile)}: the picture ${file} is not beside it`);
      return { src, alt };
    });
    return describeGame(manifest, icon, page, facts, lang, { offlineEverywhere: offline, pictures });
  });
  return games.sort((a, b) => Number(a.sample) - Number(b.sample) || a.id.localeCompare(b.id));
}

/** Every game can be played offline (facts.json): only then may a page say Tò He plays offline (ADR 0047). */
export const offlineEverywhere = (): boolean => allOffline(sources.map((source) => source.facts));

/** The game pages of `lang`, for Astro's getStaticPaths: one per game, with the others to suggest. */
export function gamePaths(lang: Lang) {
  const games = loadGames(lang);
  return games.map((game) => ({
    params: { id: game.id },
    props: { game, others: games.filter((other) => other.id !== game.id) },
  }));
}
