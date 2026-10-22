// The games' public pages, /games/ and /games/<gameId>/. A game's page is made at build time from the game's own
// metadata — games/<id>/public/game.json and its icon — so a new game has a page without anyone writing one. What
// the manifest cannot say is the how-to and the kind of game in a few words: that copy is in `gameCopy` below, and
// games.test.ts fails for a game that has none. The owner reviews the words in the pull request.
import { GameManifest, gameDescription, gameName } from '@tohe/contract';

/** The words only a person can write for a game. `howTo`: 3 to 5 short lines, in the order a first game goes. */
export interface GameCopy {
  /** What it is in a few words, after the name in the page's title: "game ghép khối số". */
  kind: string;
  howTo: string[];
  /** Who it suits, beyond what the manifest says (age, alone or together). */
  suits: string;
}

export const gameCopy: Record<string, GameCopy> = {
  'merge-block': {
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
  'tap-merge': {
    kind: 'game gom khối số',
    howTo: [
      'Bàn luôn đầy khối số. Chạm vào một khối.',
      'Mọi khối cùng số nối liền với nó, kể cả theo đường chéo, gộp vào khối bạn chạm.',
      'Gom càng nhiều khối thì khối mới càng lớn, điểm càng cao. Khối mới trượt vào từ phía trên.',
      'Không có đồng hồ: một chạm là một nước đi. Khi hết nước gộp, ván kết thúc.',
    ],
    suits: 'Hợp với người thích thong thả: không đồng hồ, không vội, mỗi lần chạm là một lựa chọn.',
  },
  'tien-len': {
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
  hello: {
    kind: 'game thử phản xạ 20 giây',
    howTo: [
      'Mỗi ván dài 20 giây.',
      'Chạm thật nhanh vào chấm tròn màu cam: mỗi lần trúng được 1 điểm, chấm nhảy sang chỗ khác.',
      'Chấm nhỏ dần khi bạn ghi điểm. Chạm trượt không bị trừ điểm.',
      'Hết giờ, xem điểm của mình và chơi lại.',
    ],
    suits: 'Mọi lứa tuổi: một ván ngắn để thử phản xạ. Đây cũng là game mẫu của nền tảng.',
  },
};

/** The page's own words, apart from the game's. */
export const gamesPage = {
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

/** The words for what the manifest's tags and capabilities say, for the chips and the structured data. */
const tagLabels: Record<string, string> = {
  puzzle: 'Giải đố',
  numbers: 'Con số',
  cards: 'Bài',
  classic: 'Kinh điển',
  reflex: 'Phản xạ',
  sample: 'Game mẫu',
};

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

/** The facts of a manifest in words: pure, so the test can read them without a build. */
export function describeGame(manifest: GameManifest, icon: string, copy: GameCopy | undefined): Game {
  const rooms = manifest.rooms;
  const facts = [manifest.minAge > 0 ? `Từ ${manifest.minAge} tuổi` : 'Mọi lứa tuổi'];
  if (rooms) {
    facts.push(`Cùng bạn bè: ${rooms.seats.min}–${rooms.seats.max} người`);
    if (rooms.bots.length > 0) facts.push('Có bạn máy');
  } else {
    facts.push('Chơi một mình');
  }
  if (manifest.capabilities.includes('ranked')) facts.push('Có bảng xếp hạng');
  const genre = manifest.tags.flatMap((tag) => (tagLabels[tag] ? [tagLabels[tag]] : []));
  return {
    id: manifest.id,
    name: gameName(manifest, 'vi'),
    description: gameDescription(manifest, 'vi'),
    icon,
    minAge: manifest.minAge,
    facts,
    playMode: rooms ? 'MultiPlayer' : 'SinglePlayer',
    seats: rooms?.seats,
    genre,
    sample: manifest.tags.includes('sample'),
    copy,
    title: copy ? `${manifest.name} — ${copy.kind} | Tò He` : `${manifest.name} — chơi ngay | Tò He`,
    metaDescription:
      manifest.description || `${manifest.name}: game nhỏ trên Tò He, chơi ngay không cần tài khoản.`,
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

/** Every game with a game.json, the sample last, else by id (the catalog's order). */
export function loadGames(): Game[] {
  const games = Object.entries(manifests).map(([file, json]) => {
    const manifest = GameManifest.parse(json);
    const folder = file.replace(/game\.json$/, '');
    // A game with no icon shows Tò He's own.
    const icon = manifest.icon ? icons[`${folder}${manifest.icon}`] : '/favicon.svg';
    if (!icon) throw new Error(`${manifest.id}: the icon ${manifest.icon} is not in ${folder}`);
    return describeGame(manifest, icon, gameCopy[manifest.id]);
  });
  return games.sort((a, b) => Number(a.sample) - Number(b.sample) || a.id.localeCompare(b.id));
}
