export const strings = {
  vi: {
    title: 'Chạm Ghép',
    score: 'Điểm',
    best: 'Kỷ lục',
    shuffle: 'Xáo trộn',
    shuffleNow: 'Chạm 🔀!',
    shuffleLabel: (left: number) => `Xáo trộn, còn ${left}`,
    start: 'Bắt đầu',
    hints: [
      { icon: '👆', text: 'Chạm vào một khối số.' },
      { icon: '✨', text: 'Các khối giống nó ở xung quanh, cả đường chéo, nhập vào và số gấp đôi.' },
      { icon: '🔀', text: 'Khi không còn khối nào ghép được, chạm 🔀 để xáo trộn.' },
    ],
    gathered: (n: number) => `Gom ${n}!`,
    newTop: (value: string) => `Khối mới: ${value}!`,
    earned: '+1 🔀',
    over: 'Hết nước đi rồi!',
    record: 'Kỷ lục mới!',
    result: (score: string, best: string) => `Điểm ${score} · Kỷ lục ${best}`,
    again: 'Chơi lại',
    exit: 'Thoát',
    inProgress: (score: string) => `Ván đang chơi dở: ${score} điểm.`,
  },
  en: {
    title: 'Tap Merge',
    score: 'Score',
    best: 'Best',
    shuffle: 'Shuffle',
    shuffleNow: 'Tap 🔀!',
    shuffleLabel: (left: number) => `Shuffle, ${left} left`,
    start: 'Start',
    hints: [
      { icon: '👆', text: 'Tap a number block.' },
      { icon: '✨', text: 'Equal blocks around it, diagonals too, merge into it and its number doubles.' },
      { icon: '🔀', text: 'When nothing can merge, tap 🔀 to shuffle.' },
    ],
    gathered: (n: number) => `${n} at once!`,
    newTop: (value: string) => `New block: ${value}!`,
    earned: '+1 🔀',
    over: 'No more moves!',
    record: 'New record!',
    result: (score: string, best: string) => `Score ${score} · Best ${best}`,
    again: 'Play again',
    exit: 'Exit',
    inProgress: (score: string) => `A game in progress: ${score} points.`,
  },
};

export type Strings = (typeof strings)['vi'];

export const stringsFor = (locale: string): Strings => (locale.startsWith('vi') ? strings.vi : strings.en);
