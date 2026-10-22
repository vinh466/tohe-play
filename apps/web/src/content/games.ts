// The games' public pages, /games/ and /games/<gameId>/, and the same under /en/. A game's page is made at build time
// from the game's own metadata — games/<id>/public/game.json and its icon — so a new game has a page without anyone
// writing one. What the manifest cannot say is the how-to and the kind of game in a few words, in each language: that
// copy is in `gameCopy` below, and content.test.ts fails for a game that lacks it in either language. The owner
// reviews the words in the pull request. (ADR 0047 moves these words into each game's folder, games/<id>/page/.) A game's
// name and description come from game.json in the page's language (ADR 0048).
import { GameManifest, gameDescription, gameName } from '@tohe/contract';
import type { Lang } from '../i18n.ts';

/** The words only a person can write for a game. `howTo`: 3 to 5 short lines, in the order a first game goes. */
export interface GameCopy {
  /** What it is in a few words, after the name in the page's title: "game ghép khối số". */
  kind: string;
  howTo: string[];
  /** Who it suits, beyond what the manifest says (age, alone or together). */
  suits: string;
}

export const gameCopy: Record<string, Record<Lang, GameCopy>> = {
  'merge-block': {
    vi: {
      kind: 'game ghép khối số',
      howTo: [
        'Chạm vào một cột (hoặc kéo khối rồi thả) để thả khối số đang cầm xuống cột đó.',
        'Hai khối cùng số chạm nhau sẽ gộp lại thành một khối lớn hơn.',
        'Khối vừa gộp rơi xuống và có thể gộp tiếp: gộp liên tiếp thì điểm được nhân lên.',
        'Ván kết thúc khi các cột đều đầy. Thử phá kỷ lục của chính mình!',
      ],
      suits:
        'Ai cũng chơi được, chỉ cần biết chạm. Hợp lúc rảnh vài phút, và với người thích ghép số, săn kỷ lục.',
    },
    en: {
      kind: 'number block merging game',
      howTo: [
        'Tap a column (or drag the block and let go) to drop the number block you hold into it.',
        'Two blocks with the same number that touch merge into one bigger block.',
        'The merged block falls and can merge again: merges in a row multiply your points.',
        'The game ends when every column is full. Try to beat your own best!',
      ],
      suits:
        'Anyone who can tap can play. Good for a spare few minutes, and for anyone who likes merging numbers and chasing a high score.',
    },
  },
  'tap-merge': {
    vi: {
      kind: 'game gom khối số',
      howTo: [
        'Bàn luôn đầy khối số. Chạm vào một khối.',
        'Mọi khối cùng số nối liền với nó, kể cả theo đường chéo, gộp vào khối bạn chạm.',
        'Gom càng nhiều khối thì khối mới càng lớn, điểm càng cao. Khối mới trượt vào từ phía trên.',
        'Không có đồng hồ: một chạm là một nước đi. Khi hết nước gộp, ván kết thúc.',
      ],
      suits: 'Hợp với người thích thong thả: không đồng hồ, không vội, mỗi lần chạm là một lựa chọn.',
    },
    en: {
      kind: 'tap-to-merge number game',
      howTo: [
        'The board is always full of number blocks. Tap one.',
        'Every block with the same number connected to it, diagonals included, merges into the block you tapped.',
        'The more blocks you gather, the bigger the new block and the higher your score. New blocks slide in from the top.',
        'There is no clock: one tap is one move. When no merge is left, the game ends.',
      ],
      suits: 'For people who like to take their time: no clock, no rush, every tap is a choice.',
    },
  },
  'tien-len': {
    vi: {
      kind: 'game bài Tiến lên miền Nam',
      howTo: [
        'Mỗi người được chia 13 lá bài và đi lần lượt.',
        'Đến lượt, đánh ra bài cùng loại và lớn hơn bài trên bàn (lẻ, đôi, sám, sảnh…) hoặc bỏ lượt.',
        'Tứ quý và đôi thông có thể chặt heo (quân 2).',
        'Ai hết bài trước là người thắng ván. Luật nhà (chặt chồng, tới trắng…) tự chọn khi mở phòng.',
      ],
      suits:
        'Dành cho người biết (hoặc muốn học) Tiến lên miền Nam. Chơi một mình với bạn máy, hay mở phòng cho cả nhà, mỗi người một điện thoại.',
    },
    en: {
      kind: 'the Vietnamese card game Tiến lên miền Nam',
      howTo: [
        'Each player is dealt 13 cards, and everyone takes turns.',
        'On your turn, play cards of the same kind and higher than those on the table (a single, a pair, three of a kind, a straight…) or pass.',
        'Four of a kind and runs of consecutive pairs can chop a 2 (chặt heo).',
        'The first to play all their cards wins the round. House rules (chop chains, instant wins…) are chosen when the table is opened.',
      ],
      suits:
        'For anyone who knows Tiến lên miền Nam, or wants to learn it. Play alone against bots, or open a table for the whole family, each on their own phone.',
    },
  },
  hello: {
    vi: {
      kind: 'game thử phản xạ 20 giây',
      howTo: [
        'Mỗi ván dài 20 giây.',
        'Chạm thật nhanh vào chấm tròn màu cam: mỗi lần trúng được 1 điểm, chấm nhảy sang chỗ khác.',
        'Chấm nhỏ dần khi bạn ghi điểm. Chạm trượt không bị trừ điểm.',
        'Hết giờ, xem điểm của mình và chơi lại.',
      ],
      suits: 'Mọi lứa tuổi: một ván ngắn để thử phản xạ. Đây cũng là game mẫu của nền tảng.',
    },
    en: {
      kind: '20-second reflex game',
      howTo: [
        'Each round lasts 20 seconds.',
        'Tap the orange dot as fast as you can: each hit scores 1 point, and the dot jumps somewhere else.',
        'The dot gets smaller as you score. A miss costs nothing.',
        'When time is up, see your score and play again.',
      ],
      suits: 'All ages: one short round to test your reflexes. It is also the platform’s sample game.',
    },
  },
};

const viPage = {
  title: 'Trò chơi — Tò He',
  description:
    'Các trò chơi nhỏ trên Tò He: ghép khối, bài Tiến lên, thử phản xạ. Chơi ngay trên điện thoại, miễn phí, không quảng cáo, không cần tài khoản.',
  heading: 'Trò chơi',
  lead: 'Mỗi trò chơi là một con tò he nhỏ: mở ra là chơi, một ván vài phút. Chọn một trò để xem cách chơi, hay chơi luôn.',
  play: 'Chơi',
  details: 'Xem cách chơi',
  back: '← Tất cả trò chơi',
  playNow: 'Chơi ngay',
  howTo: 'Cách chơi',
  suits: 'Hợp với ai',
  others: 'Các trò khác',
  noAccount: 'Không cần tài khoản, không quảng cáo.',
  install: 'Muốn mở nhanh như một ứng dụng? Xem cách cài lên màn hình chính.',
};

/** The page's own words, apart from the game's. */
export const gamesPage: Record<Lang, typeof viPage> = {
  vi: viPage,
  en: {
    title: 'Games — Tò He',
    description:
      'The small games on Tò He: merging number blocks, the card game Tiến lên, a reflex test. Play now on your phone — free, no ads, no account needed.',
    heading: 'Games',
    lead: 'Every game is a small tò he: open it and play, a round takes a few minutes. Pick one to see how to play, or just play.',
    play: 'Play',
    details: 'How to play',
    back: '← All games',
    playNow: 'Play now',
    howTo: 'How to play',
    suits: 'Who it suits',
    others: 'Other games',
    noAccount: 'No account, no ads.',
    install: 'Want it to open quickly, like an app? See how to add it to your home screen.',
  },
};

/** The words for what the manifest's tags and capabilities say, for the chips and the structured data. */
const factWords = {
  vi: {
    tags: {
      puzzle: 'Giải đố',
      numbers: 'Con số',
      cards: 'Bài',
      classic: 'Kinh điển',
      reflex: 'Phản xạ',
      sample: 'Game mẫu',
    } as Record<string, string>,
    fromAge: (age: number) => `Từ ${age} tuổi`,
    allAges: 'Mọi lứa tuổi',
    together: (min: number, max: number) => `Cùng bạn bè: ${min}–${max} người`,
    bots: 'Có bạn máy',
    alone: 'Chơi một mình',
    ranked: 'Có bảng xếp hạng',
    kindless: 'chơi ngay',
    bare: (name: string) => `${name}: game nhỏ trên Tò He, chơi ngay không cần tài khoản.`,
  },
  en: {
    tags: {
      puzzle: 'Puzzle',
      numbers: 'Numbers',
      cards: 'Cards',
      classic: 'Classic',
      reflex: 'Reflex',
      sample: 'Sample game',
    } as Record<string, string>,
    fromAge: (age: number) => `Ages ${age}+`,
    allAges: 'All ages',
    together: (min: number, max: number) => `With friends: ${min}–${max} players`,
    bots: 'Bots to play against',
    alone: 'Play alone',
    ranked: 'Leaderboard',
    kindless: 'play now',
    bare: (name: string) => `${name}: a small game on Tò He. Play now, no account needed.`,
  },
} satisfies Record<Lang, unknown>;

export interface Game {
  id: string;
  name: string;
  description: string;
  /** The icon's address under /_web/, hashed. */
  icon: string;
  minAge: number;
  /** The words for the chips under the name: age, how it is played, ranking, tags. */
  facts: string[];
  /** 'SinglePlayer' or 'MultiPlayer' for the structured data: with rooms, a table of several. */
  playMode: 'SinglePlayer' | 'MultiPlayer';
  seats?: { min: number; max: number };
  genre: string[];
  /** The platform's own sample (tag `sample`): listed after the games made to be played. */
  sample: boolean;
  copy?: GameCopy;
  /** The page's title and description. */
  title: string;
  metaDescription: string;
}

/** The facts of a manifest in words of `lang`: pure, so the test can read them without a build. */
export function describeGame(
  manifest: GameManifest,
  icon: string,
  copy: GameCopy | undefined,
  lang: Lang = 'vi',
): Game {
  const words = factWords[lang];
  const rooms = manifest.rooms;
  const facts = [manifest.minAge > 0 ? words.fromAge(manifest.minAge) : words.allAges];
  if (rooms) {
    facts.push(words.together(rooms.seats.min, rooms.seats.max));
    if (rooms.bots.length > 0) facts.push(words.bots);
  } else {
    facts.push(words.alone);
  }
  if (manifest.capabilities.includes('ranked')) facts.push(words.ranked);
  const genre = manifest.tags.flatMap((tag) => (words.tags[tag] ? [words.tags[tag]] : []));
  const game = {
    id: manifest.id,
    name: gameName(manifest, lang),
    description: gameDescription(manifest, lang),
    icon,
    minAge: manifest.minAge,
    facts,
    playMode: rooms ? ('MultiPlayer' as const) : ('SinglePlayer' as const),
    seats: rooms?.seats,
    genre,
    sample: manifest.tags.includes('sample'),
    copy,
  };
  return {
    ...game,
    title: `${game.name} — ${copy?.kind ?? words.kindless} | Tò He`,
    metaDescription: game.description || words.bare(game.name),
  };
}

const manifests = import.meta.glob<unknown>('../../../../games/*/public/game.json', {
  eager: true,
  import: 'default',
});
const icons = import.meta.glob<string>('../../../../games/*/public/*.{svg,png}', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** Every game with a game.json in the words of `lang`, the sample last, else by id (the catalog's order). */
export function loadGames(lang: Lang = 'vi'): Game[] {
  const games = Object.entries(manifests).map(([file, json]) => {
    const manifest = GameManifest.parse(json);
    const folder = file.replace(/game\.json$/, '');
    // A game with no icon shows Tò He's own.
    const icon = manifest.icon ? icons[`${folder}${manifest.icon}`] : '/favicon.svg';
    if (!icon) throw new Error(`${manifest.id}: the icon ${manifest.icon} is not in ${folder}`);
    return describeGame(manifest, icon, gameCopy[manifest.id]?.[lang], lang);
  });
  return games.sort((a, b) => Number(a.sample) - Number(b.sample) || a.id.localeCompare(b.id));
}

/** The game pages of `lang`, for Astro's getStaticPaths: one per game, with the others to suggest. */
export function gamePaths(lang: Lang) {
  const games = loadGames(lang);
  return games.map((game) => ({
    params: { id: game.id },
    props: { game, others: games.filter((other) => other.id !== game.id) },
  }));
}
