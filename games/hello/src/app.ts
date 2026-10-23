// What both stages share (ADR 0020): the session, the words, the sounds, the dots' random sequence and the save.
import { createSfx } from '@tohe/game-kit';
import { connect, createRng } from '@tohe/game-sdk';

export interface Saved {
  best: number;
  /** The how-to was shown before a first round; absent in saves from before 1.3.0. */
  tutorialSeen?: boolean;
}

const text = {
  vi: {
    title: 'Chạm Chấm',
    intro: 'Chạm vào chấm tròn càng nhiều càng tốt trong 20 giây!',
    hints: 'Chấm nhỏ dần khi bạn ghi điểm. Chạm trượt không bị trừ điểm.',
    score: 'Điểm',
    best: 'Kỷ lục',
    bestLine: (best: number) => `Kỷ lục ${best}`,
    over: 'Hết giờ!',
    record: 'Kỷ lục mới!',
    result: (score: number, best: number) => `Bạn được ${score} điểm · Kỷ lục ${best}`,
  },
  en: {
    title: 'Tap Dot',
    intro: 'Tap the dot as many times as you can in 20 seconds!',
    hints: 'The dot shrinks as you score. Missed taps cost nothing.',
    score: 'Score',
    best: 'Best',
    bestLine: (best: number) => `Best ${best}`,
    over: "Time's up!",
    record: 'New record!',
    result: (score: number, best: number) => `You scored ${score} · Best ${best}`,
  },
};

export const session = await connect<Saved>({ gameId: 'hello' });
export const t = session.locale.startsWith('vi') ? text.vi : text.en;
/** One sequence for the whole visit: every round, in every visit to the play stage, places the dot anew. */
export const rng = createRng(session.seed);

export const sfx = createSfx({ telemetry: session.telemetry });
sfx.setMuted(session.settings.muted);
session.on('settings', (settings) => sfx.setMuted(settings.muted));

export const store = {
  best: session.saved?.best ?? 0,
  tutorialSeen: session.saved?.tutorialSeen ?? false,
};

export function persist(): Promise<void> {
  return session
    .save({ best: store.best, tutorialSeen: store.tutorialSeen })
    .catch((error) => session.log('warn', `save failed: ${String(error)}`));
}
