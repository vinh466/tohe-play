import { useMemo } from 'react';
import { encode } from 'uqr';

/**
 * A QR code as an SVG path (no image, no network). Always dark on white, in both themes: cameras read inverted codes
 * badly, so these two colours are part of the code, not of the look (not design tokens on purpose).
 */
export function QrCode({ text, label, size = 168 }: { text: string; label: string; size?: number }) {
  const { path, cells } = useMemo(() => {
    const { data } = encode(text, { ecc: 'M', border: 2 });
    const parts: string[] = [];
    data.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) parts.push(`M${x} ${y}h1v1h-1z`);
      });
    });
    return { path: parts.join(''), cells: data.length };
  }, [text]);

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${cells} ${cells}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="rounded-2xl"
    >
      <rect width={cells} height={cells} rx={2} fill="#ffffff" />
      <path d={path} fill="#111111" />
    </svg>
  );
}
