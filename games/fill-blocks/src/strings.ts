import type { Goal, GoalKind } from './logic.ts';

// The game's words. Vietnamese is the face; English is the support. The shell owns its own words.
export interface Strings {
  title: string;
  bestLine(score: string, rank: string): string;
  progress(stars: number, total: number): string;
  inProgress(score: string): string;
  inProgressLevel(level: string, score: string): string;
  inProgressDaily(score: string): string;
  journey: string;
  daily: string;
  stats: string;
  achievements: string;
  palette: string;
  palettePaper: string;
  paletteContrast: string;
  board: string;
  hintsSetting: string;
  on: string;
  off: string;
  hints: { icon: string; text: string }[];
  goal(kind: GoalKind, value: number): string;
  chapterDone(stars: number, total: number): string;
  levelName(n: number): string;
  locked(need: number): string;
  next: string;
  playLevel: string;
  journeyHint: string;
  dailyToday(date: string): string;
  dailyPlay: string;
  dailyDone: string;
  dailyPractice: string;
  dailyCalendar: string;
  dailyNoStreak: string;
  dailyGoal: string;
  statsGames: string;
  statsScore: string;
  statsLines: string;
  statsCombo: string;
  statsPerfects: string;
  statsStars: string;
  statsRank: string;
  statsNext(score: string, rank: string): string;
  achievementsEarned(n: number, total: number): string;
  achievementLocked: string;
  groupFirst: string;
  groupClears: string;
  groupCombos: string;
  groupJourney: string;
  groupDays: string;
  over: string;
  record: string;
  result(score: string, final: string): string;
  levelResult(score: string, stars: number): string;
  levelDone(stars: number): string;
  levelMissed(goal: string): string;
  nextLevel: string;
  combo(n: number): string;
  perfect: string;
  rescue: string;
  rescueLeft(n: number): string;
  rescuePrompt: string;
  undo: string;
  hint: string;
  stuck: string;
  score: string;
  best: string;
  piece(n: number): string;
  cell(row: number, col: number): string;
  boardLabel: string;
  trayLabel: string;
  today: string;
  ofTotal(n: number, total: number): string;
  stars(n: number): string;
  date(iso: string): string;
}

const vi: Strings = {
  title: 'Lấp Ô',
  bestLine: (score, rank) => `Kỷ lục ${score} · Bậc ${rank}`,
  progress: (stars, total) => `Hành trình ${stars}/${total} sao`,
  inProgress: (score) => `Ván đang chơi dở: ${score} điểm.`,
  inProgressLevel: (level, score) => `${level}: ${score} điểm.`,
  inProgressDaily: (score) => `Hôm nay: ${score} điểm.`,
  journey: 'Hành trình',
  daily: 'Hôm nay',
  stats: 'Thống kê',
  achievements: 'Thành tích',
  palette: 'Màu sắc',
  palettePaper: 'Giấy mực',
  paletteContrast: 'Dễ phân biệt',
  board: 'Bàn',
  hintsSetting: 'Gợi ý',
  on: 'Bật',
  off: 'Tắt',
  hints: [
    { icon: '👆', text: 'Kéo hoặc chạm một miếng, rồi chạm ô trên bàn để đặt.' },
    { icon: '🧱', text: 'Một hàng hoặc một cột đầy sẽ biến mất và ghi điểm.' },
    { icon: '✨', text: 'Dọn liên tiếp để tăng combo; dọn sạch bàn được thưởng lớn.' },
  ],
  goal: (kind, value) => {
    switch (kind) {
      case 'score':
        return `Đạt ${value} điểm`;
      case 'lines':
        return `Xoá ${value} hàng/cột`;
      case 'clear':
        return `Xoá ${value} hàng/cột một lần`;
      case 'combo':
        return `Combo ×${value}`;
      case 'perfect':
        return 'Dọn sạch bàn';
    }
  },
  chapterDone: (stars, total) => `${stars}/${total} sao`,
  levelName: (n) => `Màn ${n}`,
  locked: (need) => `Cần ${need} sao để mở`,
  next: 'Tiếp tục',
  playLevel: 'Chơi',
  journeyHint: 'Chọn một con dấu để chơi. Mỗi màn có ba mục tiêu.',
  dailyToday: (date) => `Hôm nay, ${date}`,
  dailyPlay: 'Chơi hôm nay',
  dailyDone: 'Đã đóng dấu hôm nay',
  dailyPractice: 'Chơi lại để luyện',
  dailyCalendar: '28 ngày gần đây',
  dailyNoStreak: 'Nghỉ một ngày cũng không sao.',
  dailyGoal: 'Mục tiêu hôm nay',
  statsGames: 'Ván đã chơi',
  statsScore: 'Tổng điểm',
  statsLines: 'Hàng/cột đã xoá',
  statsCombo: 'Combo cao nhất',
  statsPerfects: 'Bàn sạch',
  statsStars: 'Sao hành trình',
  statsRank: 'Bậc hiện tại',
  statsNext: (score, rank) => `Còn ${score} điểm để lên ${rank}`,
  achievementsEarned: (n, total) => `${n}/${total} đã đạt`,
  achievementLocked: 'Chưa đạt',
  groupFirst: 'Bước đầu',
  groupClears: 'Dọn bàn',
  groupCombos: 'Combo',
  groupJourney: 'Hành trình',
  groupDays: 'Ngày',
  over: 'Hết ván',
  record: 'Kỷ lục mới!',
  result: (score, final) => `Điểm ${score} · Kỷ lục ${final}`,
  levelResult: (score, stars) => `Điểm ${score} · ${stars}/3 sao`,
  levelDone: (stars) => `Hoàn thành · ${stars}/3 sao`,
  levelMissed: (goal) => `Chưa đạt: ${goal}`,
  nextLevel: 'Màn tiếp',
  combo: (n) => `Combo ×${n}!`,
  perfect: 'Sạch bàn!',
  rescue: 'Đổi khay',
  rescueLeft: (n) => `Đổi khay · ${n}`,
  rescuePrompt: 'Không còn miếng nào vừa. Đổi khay?',
  undo: 'Lùi',
  hint: 'Gợi ý',
  stuck: 'Hết chỗ đặt rồi!',
  score: 'Điểm',
  best: 'Kỷ lục',
  piece: (n) => `Miếng ${n}`,
  cell: (row, col) => `Hàng ${row}, cột ${col}`,
  boardLabel: 'Bàn chơi',
  trayLabel: 'Các miếng',
  today: 'Hôm nay',
  ofTotal: (n, total) => `${n}/${total}`,
  stars: (n) => `${n} sao`,
  date: (iso) => {
    const [year, month, day] = iso.split('-').map(Number);
    return new Intl.DateTimeFormat('vi', { day: '2-digit', month: '2-digit' }).format(
      new Date(year ?? 2026, (month ?? 1) - 1, day ?? 1),
    );
  },
};

const en: Strings = {
  title: 'Fill Blocks',
  bestLine: (score, rank) => `Best ${score} · ${rank}`,
  progress: (stars, total) => `Journey ${stars}/${total} stars`,
  inProgress: (score) => `A game in progress: ${score} points.`,
  inProgressLevel: (level, score) => `${level}: ${score} points.`,
  inProgressDaily: (score) => `Today: ${score} points.`,
  journey: 'Journey',
  daily: 'Today',
  stats: 'Stats',
  achievements: 'Achievements',
  palette: 'Colours',
  palettePaper: 'Paper and ink',
  paletteContrast: 'High contrast',
  board: 'Board',
  hintsSetting: 'Hints',
  on: 'On',
  off: 'Off',
  hints: [
    { icon: '👆', text: 'Drag or tap a piece, then tap a cell to place it.' },
    { icon: '🧱', text: 'A full row or column clears and scores.' },
    { icon: '✨', text: 'Clear again and again for a combo; a clean board pays a big bonus.' },
  ],
  goal: (kind, value) => {
    switch (kind) {
      case 'score':
        return `Score ${value}`;
      case 'lines':
        return `Clear ${value} lines`;
      case 'clear':
        return `Clear ${value} lines at once`;
      case 'combo':
        return `Combo ×${value}`;
      case 'perfect':
        return 'Clear the whole board';
    }
  },
  chapterDone: (stars, total) => `${stars}/${total} stars`,
  levelName: (n) => `Level ${n}`,
  locked: (need) => `Needs ${need} stars`,
  next: 'Continue',
  playLevel: 'Play',
  journeyHint: 'Pick a stamp to play. Each level has three goals.',
  dailyToday: (date) => `Today, ${date}`,
  dailyPlay: 'Play today',
  dailyDone: 'Stamped today',
  dailyPractice: 'Play again to practise',
  dailyCalendar: 'The last 28 days',
  dailyNoStreak: 'Missing a day costs nothing.',
  dailyGoal: "Today's goals",
  statsGames: 'Games played',
  statsScore: 'Total score',
  statsLines: 'Lines cleared',
  statsCombo: 'Best combo',
  statsPerfects: 'Clean boards',
  statsStars: 'Journey stars',
  statsRank: 'Current rank',
  statsNext: (score, rank) => `${score} points to ${rank}`,
  achievementsEarned: (n, total) => `${n}/${total} earned`,
  achievementLocked: 'Not yet',
  groupFirst: 'First steps',
  groupClears: 'Clears',
  groupCombos: 'Combos',
  groupJourney: 'Journey',
  groupDays: 'Days',
  over: 'Game over',
  record: 'New record!',
  result: (score, final) => `Score ${score} · Best ${final}`,
  levelResult: (score, stars) => `Score ${score} · ${stars}/3 stars`,
  levelDone: (stars) => `Complete · ${stars}/3 stars`,
  levelMissed: (goal) => `Missed: ${goal}`,
  nextLevel: 'Next level',
  combo: (n) => `Combo ×${n}!`,
  perfect: 'Clean board!',
  rescue: 'Swap tray',
  rescueLeft: (n) => `Swap tray · ${n}`,
  rescuePrompt: 'No piece fits. Swap the tray?',
  undo: 'Undo',
  hint: 'Hint',
  stuck: 'No room left!',
  score: 'Score',
  best: 'Best',
  piece: (n) => `Piece ${n}`,
  cell: (row, col) => `Row ${row}, column ${col}`,
  boardLabel: 'Board',
  trayLabel: 'Pieces',
  today: 'Today',
  ofTotal: (n, total) => `${n}/${total}`,
  stars: (n) => `${n} stars`,
  date: (iso) => {
    const [year, month, day] = iso.split('-').map(Number);
    return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short' }).format(
      new Date(year ?? 2026, (month ?? 1) - 1, day ?? 1),
    );
  },
};

export const stringsFor = (locale: string): Strings => (locale.startsWith('vi') ? vi : en);

export const goalText = (goal: Goal, t: Strings): string => t.goal(goal.kind, goal.value);

/** The local calendar date as YYYY-MM-DD; the daily seed comes from it. */
export function todayId(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** The last `days` dates, oldest first, ending today. */
export function recentDays(days: number, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push(todayId(date));
  }
  return out;
}
