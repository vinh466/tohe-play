// Colours of the table. The felt and the labels on it follow the hub's light/dark theme (ADR 0013); card faces stay
// light paper in both (a little dimmer in dark) because they are objects, with suits that keep at least 4.5:1 on the
// paper (palette.test.ts). The four-colour deck gives each suit its own colour for small screens (SPEC.md, "Screens").
import type { Theme } from '@tohe/game-kit';
import { suitOf } from './cards.ts';

export type Deck = 'classic' | 'four';
export const DECKS: readonly Deck[] = ['classic', 'four'];
export const isDeck = (value: unknown): value is Deck => DECKS.includes(value as Deck);

export interface TableStyle {
  /** Behind everything (the stage), matching the felt's edge. */
  background: string;
  felt: number;
  /** The lighter oval in the middle of the felt. */
  feltCentre: number;
  /** Names and counts on the felt. */
  label: string;
  labelSoft: string;
  /** The ring around the player whose turn it is. */
  turn: number;
  /** Chips under names, badges. */
  chip: number;
  chipText: string;
  paper: string;
  paperEdge: string;
  /** The outline of a selected card. */
  selected: number;
  back: number;
  backPattern: number;
}

export const TABLE: Record<Theme, TableStyle> = {
  light: {
    background: '#256b4b',
    felt: 0x256b4b,
    feltCentre: 0x2e7a57,
    label: '#ffffff',
    labelSoft: '#d9f2e3',
    turn: 0xfacc15,
    chip: 0x123f2b,
    chipText: '#ffffff',
    paper: '#fffdf8',
    paperEdge: '#d6cdbd',
    selected: 0xf97316,
    back: 0xea580c,
    backPattern: 0xc2410c,
  },
  dark: {
    background: '#0f2a1e',
    felt: 0x0f2a1e,
    feltCentre: 0x153826,
    label: '#f3efe8',
    labelSoft: '#b9cfc2',
    turn: 0xfacc15,
    chip: 0x07170f,
    chipText: '#f3efe8',
    paper: '#ece5d8',
    paperEdge: '#b3a996',
    selected: 0xfb923c,
    back: 0xc2410c,
    backPattern: 0x9a3412,
  },
};

/** Suit colours ♠ ♣ ♦ ♥ for a deck and theme. */
export const SUITS: Record<Deck, Record<Theme, [string, string, string, string]>> = {
  classic: {
    light: ['#1f1f24', '#1f1f24', '#c81e1e', '#c81e1e'],
    dark: ['#1f1f24', '#1f1f24', '#b01818', '#b01818'],
  },
  four: {
    light: ['#1f1f24', '#13703a', '#1d5bbf', '#c81e1e'],
    dark: ['#1f1f24', '#0f6332', '#1a50a8', '#b01818'],
  },
};

export const suitColour = (card: number, deck: Deck, theme: Theme): string =>
  SUITS[deck][theme][suitOf(card)] as string;
