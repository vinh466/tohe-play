// Synthesised sound effects (Web Audio): no files to download, license or cache, and pitch can follow the game
// (bigger merges sound higher). The audio context starts on a tap or key press, as iOS requires.
import type { Telemetry } from '@tohe/game-sdk';

export type SoundName = 'click' | 'pop' | 'drop' | 'merge' | 'combo' | 'levelUp' | 'error' | 'fanfare';

export interface Sfx {
  /** `step` raises the pitch along a pentatonic scale (e.g. the merged value's exponent). */
  play(name: SoundName, step?: number): void;
  setMuted(muted: boolean): void;
  readonly muted: boolean;
}

const PENTATONIC = [0, 2, 4, 7, 9];
const C4 = 261.63;

/** Frequency of the n-th note of a C-major pentatonic scale starting at C4; always pleasant together. */
export function noteFrequency(step: number): number {
  const index = Math.max(0, Math.min(step, 24));
  const semitones = Math.floor(index / 5) * 12 + (PENTATONIC[index % 5] ?? 0);
  return C4 * 2 ** (semitones / 12);
}

interface Tone {
  type: OscillatorType;
  frequency: number;
  glideTo?: number;
  duration: number;
  gain: number;
  delay?: number;
}

export interface SfxOptions {
  /** The session's telemetry: reports a device whose sound stays off after the first touch (ADR 0015). */
  telemetry?: Telemetry;
}

/** How long after the first tap the audio context must be running. */
const UNLOCK_CHECK_MS = 1000;

/** Events that may start the audio context. A finger counts when it lifts, not when it lands. */
const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;

/** A user activation (HTML spec): a finger or pen landing is not one, so a browser may keep the sound off for it. */
function activates(event: Event): boolean {
  return !(event.type === 'pointerdown' && 'pointerType' in event && event.pointerType !== 'mouse');
}

export function createSfx({ telemetry }: SfxOptions = {}): Sfx {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = false;

  const ensure = (): AudioContext | null => {
    if (typeof AudioContext === 'undefined') return null;
    if (!context) {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.45;
      master.connect(context.destination);
    }
    // Not only 'suspended': iOS may report 'interrupted' (a call, another app's sound, the app sent to the back).
    // A refused resume is tried again on the next tap.
    if (context.state !== 'running' && context.state !== 'closed') context.resume().catch(() => undefined);
    return context;
  };

  // Start the context inside a user gesture; later sounds can then play from timers and tweens. The listeners stay
  // for the whole visit, so a tap also brings the sound back after iOS interrupted it.
  if (typeof window !== 'undefined') {
    let checked = false;
    const unlock = (event: Event) => {
      if (context?.state === 'running') return;
      const audio = ensure();
      // A silent sample played inside the gesture too: the long-standing way to wake Web Audio on iOS.
      if (audio) {
        const blank = audio.createBufferSource();
        blank.buffer = audio.createBuffer(1, 1, audio.sampleRate);
        blank.connect(audio.destination);
        blank.start();
      }
      if (checked || !activates(event) || !telemetry?.enabled) return;
      checked = true;
      if (!audio) telemetry.count('kit.audio.unsupported');
      else
        setTimeout(() => audio.state !== 'running' && telemetry.count('kit.audio.blocked'), UNLOCK_CHECK_MS);
    };
    for (const type of UNLOCK_EVENTS) window.addEventListener(type, unlock, { capture: true, passive: true });
  }

  const tone = ({ type, frequency, glideTo, duration, gain, delay = 0 }: Tone) => {
    const audio = ensure();
    if (!audio || !master || muted) return;
    const start = audio.currentTime + delay;
    const osc = audio.createOscillator();
    const env = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + duration * 0.6);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env).connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  };

  const voices: Record<SoundName, (step: number) => void> = {
    click: () => tone({ type: 'sine', frequency: 1200, duration: 0.05, gain: 0.15 }),
    pop: () => tone({ type: 'sine', frequency: 700, glideTo: 1100, duration: 0.12, gain: 0.3 }),
    drop: () => tone({ type: 'triangle', frequency: 240, glideTo: 140, duration: 0.11, gain: 0.35 }),
    merge: (step) => {
      const f = noteFrequency(step);
      tone({ type: 'triangle', frequency: f, duration: 0.28, gain: 0.32 });
      tone({ type: 'sine', frequency: f * 2, duration: 0.2, gain: 0.12 });
    },
    combo: (step) => {
      for (let i = 0; i < 3; i++)
        tone({
          type: 'triangle',
          frequency: noteFrequency(step + i * 2),
          duration: 0.16,
          gain: 0.25,
          delay: i * 0.07,
        });
    },
    // A quick run up the scale and a bright chord on top: a level reached.
    levelUp: () => {
      for (let i = 0; i < 6; i++)
        tone({
          type: 'triangle',
          frequency: noteFrequency(4 + i * 2),
          duration: 0.12,
          gain: 0.22,
          delay: i * 0.05,
        });
      for (const offset of [0, 2, 4])
        tone({ type: 'sine', frequency: noteFrequency(15 + offset), duration: 0.6, gain: 0.12, delay: 0.32 });
    },
    error: () => tone({ type: 'square', frequency: 150, glideTo: 110, duration: 0.16, gain: 0.08 }),
    fanfare: () => {
      [0, 2, 4, 7].forEach((offset, i) => {
        tone({
          type: 'triangle',
          frequency: noteFrequency(5 + offset),
          duration: i === 3 ? 0.5 : 0.18,
          gain: 0.3,
          delay: i * 0.11,
        });
      });
    },
  };

  return {
    play(name, step = 0) {
      voices[name](step);
    },
    setMuted(value) {
      muted = value;
      if (master && context) master.gain.setTargetAtTime(value ? 0 : 0.45, context.currentTime, 0.02);
    },
    get muted() {
      return muted;
    },
  };
}
