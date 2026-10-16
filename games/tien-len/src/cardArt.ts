// Card faces and backs drawn with the Canvas 2D API, once per card, size, theme and deck (the kit's drawTexture).
// Suits are vector shapes, not font glyphs: some iOS fonts draw ♥ and ♦ as emoji, and shapes stay crisp at any size.
import type { Theme } from '@tohe/game-kit';
import { roundedRect } from '@tohe/game-kit/phaser';
import { type Card, rankOf, suitOf } from './cards.ts';
import { type Deck, suitColour, TABLE } from './palette.ts';

export const RANK_LABELS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
export const SUIT_LABELS = ['♠', '♣', '♦', '♥'];
/** A card in words for screen readers and hints: "10♥". */
export const cardName = (card: Card) => `${RANK_LABELS[rankOf(card)]}${SUIT_LABELS[suitOf(card)]}`;

/** Card height for a width (poker proportions). */
export const CARD_RATIO = 1.4;

/** Adds a suit centred on (x, y), `size` tall, to the current path. */
export function suitPath(ctx: CanvasRenderingContext2D, suit: number, x: number, y: number, size: number) {
  const s = size;
  switch (suit) {
    case 0: // ♠
      ctx.moveTo(x, y - 0.5 * s);
      ctx.bezierCurveTo(x + 0.62 * s, y - 0.02 * s, x + 0.36 * s, y + 0.42 * s, x + 0.04 * s, y + 0.16 * s);
      ctx.lineTo(x + 0.2 * s, y + 0.5 * s);
      ctx.lineTo(x - 0.2 * s, y + 0.5 * s);
      ctx.lineTo(x - 0.04 * s, y + 0.16 * s);
      ctx.bezierCurveTo(x - 0.36 * s, y + 0.42 * s, x - 0.62 * s, y - 0.02 * s, x, y - 0.5 * s);
      break;
    case 1: {
      // ♣: three leaves and a stem
      const r = 0.21 * s;
      for (const [dx, dy] of [
        [0, -0.24],
        [-0.25, 0.06],
        [0.25, 0.06],
      ] as const) {
        ctx.moveTo(x + dx * s + r, y + dy * s);
        ctx.arc(x + dx * s, y + dy * s, r, 0, Math.PI * 2);
      }
      ctx.moveTo(x - 0.06 * s, y);
      ctx.lineTo(x + 0.06 * s, y);
      ctx.lineTo(x + 0.2 * s, y + 0.5 * s);
      ctx.lineTo(x - 0.2 * s, y + 0.5 * s);
      ctx.closePath();
      break;
    }
    case 2: // ♦
      ctx.moveTo(x, y - 0.5 * s);
      ctx.quadraticCurveTo(x + 0.14 * s, y - 0.16 * s, x + 0.4 * s, y);
      ctx.quadraticCurveTo(x + 0.14 * s, y + 0.16 * s, x, y + 0.5 * s);
      ctx.quadraticCurveTo(x - 0.14 * s, y + 0.16 * s, x - 0.4 * s, y);
      ctx.quadraticCurveTo(x - 0.14 * s, y - 0.16 * s, x, y - 0.5 * s);
      break;
    default: // ♥
      ctx.moveTo(x, y + 0.46 * s);
      ctx.bezierCurveTo(x - 0.66 * s, y - 0.02 * s, x - 0.34 * s, y - 0.62 * s, x, y - 0.22 * s);
      ctx.bezierCurveTo(x + 0.34 * s, y - 0.62 * s, x + 0.66 * s, y - 0.02 * s, x, y + 0.46 * s);
  }
  ctx.closePath();
}

function fillSuit(
  ctx: CanvasRenderingContext2D,
  suit: number,
  x: number,
  y: number,
  size: number,
  colour: string,
) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  suitPath(ctx, suit, x, y, size);
  ctx.fill('nonzero');
}

/** Draws a card face `w` × `w·1.4` with a 1 px margin for the edge. */
export function drawFace(ctx: CanvasRenderingContext2D, card: Card, w: number, theme: Theme, deck: Deck) {
  const h = w * CARD_RATIO;
  const style = TABLE[theme];
  const colour = suitColour(card, deck, theme);
  const rank = rankOf(card);
  const suit = suitOf(card);
  const label = RANK_LABELS[rank] as string;
  ctx.fillStyle = style.paper;
  ctx.strokeStyle = style.paperEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  roundedRect(ctx, 0.5, 0.5, w - 1, h - 1, w * 0.1);
  ctx.fill();
  ctx.stroke();

  // The index in the top-left corner: what shows when cards overlap in a hand, so it is large.
  ctx.fillStyle = colour;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const indexSize = w * (label.length > 1 ? 0.3 : 0.36);
  ctx.font = `900 ${indexSize}px system-ui, sans-serif`;
  const indexX = w * 0.2;
  ctx.save();
  if (label.length > 1) {
    ctx.translate(indexX, 0);
    ctx.scale(0.82, 1);
    ctx.fillText(label, 0, w * 0.34);
  } else {
    ctx.fillText(label, indexX, w * 0.36);
  }
  ctx.restore();
  fillSuit(ctx, suit, indexX, w * 0.52, w * 0.22, colour);

  // The middle: a large suit; court cards get their letter in a ring of the suit's colour.
  const cx = w * 0.58;
  const cy = h * 0.6;
  if (rank >= 8 && rank <= 10) {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(1.5, w * 0.03);
    ctx.strokeStyle = colour;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = `900 ${w * 0.34}px system-ui, sans-serif`;
    ctx.fillStyle = colour;
    const box = ctx.measureText(label);
    ctx.fillText(label, cx, cy + (box.actualBoundingBoxAscent - box.actualBoundingBoxDescent) / 2 - w * 0.02);
    fillSuit(ctx, suit, cx + w * 0.22, cy + w * 0.24, w * 0.16, colour);
  } else {
    fillSuit(ctx, suit, cx, cy, w * (rank === 11 ? 0.62 : rank === 12 ? 0.56 : 0.5), colour);
  }
  if (rank === 12) {
    // A 2 (heo) wears a small star: the card everybody watches.
    ctx.fillStyle = '#d4a017';
    ctx.beginPath();
    star(ctx, w * 0.82, w * 0.2, w * 0.1);
    ctx.fill();
  }
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const radius = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** The back of a card: the brand colour with a lattice and a light border. */
export function drawBack(ctx: CanvasRenderingContext2D, w: number, theme: Theme) {
  const h = w * CARD_RATIO;
  const style = TABLE[theme];
  const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
  ctx.fillStyle = style.paper;
  ctx.beginPath();
  roundedRect(ctx, 0.5, 0.5, w - 1, h - 1, w * 0.1);
  ctx.fill();
  const inset = Math.max(2, w * 0.07);
  ctx.save();
  ctx.beginPath();
  roundedRect(ctx, inset, inset, w - inset * 2, h - inset * 2, w * 0.07);
  ctx.clip();
  ctx.fillStyle = hex(style.back);
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = hex(style.backPattern);
  ctx.lineWidth = Math.max(1, w * 0.035);
  const gap = w * 0.16;
  ctx.beginPath();
  for (let d = -h; d < w + h; d += gap) {
    ctx.moveTo(d, 0);
    ctx.lineTo(d + h, h);
    ctx.moveTo(d + h, 0);
    ctx.lineTo(d, h);
  }
  ctx.stroke();
  ctx.fillStyle = style.paper;
  ctx.beginPath();
  suitPath(ctx, 3, w / 2, h / 2, w * 0.34);
  ctx.fill();
  ctx.restore();
}
