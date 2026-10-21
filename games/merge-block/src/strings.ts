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
    bestLine: (score: string) => `👑 Kỷ lục ${score}`,
    // "Thách bạn" (ADR 0045): a challenge on the same blocks, by a share link. The score is the sender's claim.
    challenge: {
      button: 'Thách bạn',
      again: 'Thách lại',
      back: 'Về ván thường',
      text: (score: string) => `Mình được ${score} điểm Ghép Khối. Bạn vượt được không?`,
      target: (score: string, name: string | null) => (name ? `Vượt ${score} của ${name}` : `Vượt ${score}`),
      intro: (score: string, name: string | null) =>
        name
          ? `Cùng bộ khối với ${name}. ${score} là điểm ${name} gửi kèm link.`
          : `Cùng bộ khối với người gửi. ${score} là điểm gửi kèm link.`,
      beaten: (score: string, name: string | null) =>
        name ? `Bạn đã vượt ${name}! 🎉` : `Bạn đã vượt ${score}! 🎉`,
      short: (diff: string) => `Còn thiếu ${diff} điểm nữa thôi!`,
    },
    // Watching a ranked run (ADR 0032), in the admin console.
    replay: {
      title: 'Xem lại run',
      leave: 'Thoát xem lại',
      move: 'Nước',
      back: 'Lùi một nước',
      forward: 'Tới một nước',
      play: 'Phát',
      pause: 'Dừng',
      speed: (n: number) => `Tốc độ ×${n}`,
      scrub: 'Tới nước',
      ended: (score: string) => `Hết ván: ${score} điểm.`,
      unfinished: 'Run dừng ở đây, ván chưa hết.',
      illegal: (move: number) => `Nước ${move} không hợp lệ: chiếu đến trước nó.`,
    },
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
    bestLine: (score: string) => `👑 Best ${score}`,
    challenge: {
      button: 'Challenge a friend',
      again: 'Challenge back',
      back: 'Back to my game',
      text: (score: string) => `I scored ${score} in Merge Blocks. Can you beat it?`,
      target: (score: string, name: string | null) => (name ? `Beat ${name}’s ${score}` : `Beat ${score}`),
      intro: (score: string, name: string | null) =>
        name
          ? `Same blocks as ${name}. ${score} is the score ${name} sent with the link.`
          : `Same blocks as the sender. ${score} is the score sent with the link.`,
      beaten: (score: string, name: string | null) =>
        name ? `You beat ${name}! 🎉` : `You beat ${score}! 🎉`,
      short: (diff: string) => `Just ${diff} points short!`,
    },
    replay: {
      title: 'Watch the run',
      leave: 'Stop watching',
      move: 'Move',
      back: 'One move back',
      forward: 'One move on',
      play: 'Play',
      pause: 'Pause',
      speed: (n: number) => `Speed ×${n}`,
      scrub: 'Go to move',
      ended: (score: string) => `Game over: ${score} points.`,
      unfinished: 'The run stops here, before the game ended.',
      illegal: (move: number) => `Move ${move} is not legal: shown up to it.`,
    },
  },
};

export type Strings = (typeof strings)['vi'];

export const stringsFor = (locale: string): Strings => (locale.startsWith('vi') ? strings.vi : strings.en);
