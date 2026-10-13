export const strings = {
  vi: {
    title: 'Ghép Khối',
    score: 'Điểm',
    best: 'Kỷ lục',
    next: 'Tiếp',
    start: 'Bắt đầu',
    hints: [
      { icon: '👆', text: 'Chạm vào một cột để thả khối xuống.' },
      { icon: '🧱', text: 'Hai khối giống nhau chạm nhau sẽ gộp thành số lớn hơn.' },
      { icon: '✨', text: 'Gộp liên tiếp để nhân điểm!' },
    ],
    combo: (n: number) => `Combo ×${n}!`,
    over: 'Hết chỗ rồi!',
    record: 'Kỷ lục mới!',
    result: (score: string, best: string) => `Điểm ${score} · Kỷ lục ${best}`,
    again: 'Chơi lại',
    exit: 'Thoát',
  },
  en: {
    title: 'Merge Blocks',
    score: 'Score',
    best: 'Best',
    next: 'Next',
    start: 'Start',
    hints: [
      { icon: '👆', text: 'Tap a column to drop the block.' },
      { icon: '🧱', text: 'Equal blocks that touch merge into a bigger number.' },
      { icon: '✨', text: 'Chain merges to multiply your points!' },
    ],
    combo: (n: number) => `Combo ×${n}!`,
    over: 'No more room!',
    record: 'New record!',
    result: (score: string, best: string) => `Score ${score} · Best ${best}`,
    again: 'Play again',
    exit: 'Exit',
  },
};

export type Strings = (typeof strings)['vi'];

export const stringsFor = (locale: string): Strings => (locale.startsWith('vi') ? strings.vi : strings.en);
