export const strings = {
  vi: {
    title: 'Ghép Khối',
    score: 'Điểm',
    best: 'Kỷ lục',
    next: 'Tiếp',
    hints: [
      { icon: '👆', text: 'Chạm vào một cột để thả khối xuống.' },
      { icon: '🧱', text: 'Hai khối giống nhau chạm nhau sẽ gộp thành số lớn hơn.' },
      { icon: '✨', text: 'Gộp liên tiếp để nhân điểm!' },
    ],
    colours: 'Màu khối',
    palettes: {
      sunset: 'Hoàng hôn',
      bold: 'Tương phản mạnh',
      pastel: 'Kẹo pastel',
      neon: 'Neon',
      colorblind: 'Dễ phân biệt',
    },
    combo: (n: number) => `Combo ×${n}!`,
    over: 'Hết chỗ rồi!',
    record: 'Kỷ lục mới!',
    result: (score: string, best: string) => `Điểm ${score} · Kỷ lục ${best}`,
    inProgress: (score: string) => `Ván đang chơi dở: ${score} điểm.`,
  },
  en: {
    title: 'Merge Blocks',
    score: 'Score',
    best: 'Best',
    next: 'Next',
    hints: [
      { icon: '👆', text: 'Tap a column to drop the block.' },
      { icon: '🧱', text: 'Equal blocks that touch merge into a bigger number.' },
      { icon: '✨', text: 'Chain merges to multiply your points!' },
    ],
    colours: 'Block colours',
    palettes: {
      sunset: 'Sunset',
      bold: 'High contrast',
      pastel: 'Pastel candy',
      neon: 'Neon',
      colorblind: 'Colour-blind friendly',
    },
    combo: (n: number) => `Combo ×${n}!`,
    over: 'No more room!',
    record: 'New record!',
    result: (score: string, best: string) => `Score ${score} · Best ${best}`,
    inProgress: (score: string) => `A game in progress: ${score} points.`,
  },
};

export type Strings = (typeof strings)['vi'];

export const stringsFor = (locale: string): Strings => (locale.startsWith('vi') ? strings.vi : strings.en);
