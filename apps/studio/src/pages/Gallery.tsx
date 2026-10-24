// What a reviewer looks at (ADR 0051, Checks and review): every picture at its real size and at twice it, pixel for
// pixel, on a light and on a dark backdrop; a sprite sheet's frames one by one; a tileset's grid. The backdrops are the
// design tokens' light and dark page, set on the backdrop itself, so both show whatever the app's own theme.
import { Link } from '@tanstack/react-router';
import type { Asset, Style } from '../api/client.ts';
import { styleSampleUrl } from '../api/client.ts';
import { kindName, statusTone, styleStatusName } from '../format.ts';
import { frameOrigins, type Grid, pictureGrid } from '../review.ts';
import { Badge, Empty, Section } from '../ui/ui.tsx';
import { Palette } from './StylesPage.tsx';

const scales = [1, 2] as const;
const backdrops = [
  { theme: 'light', name: 'nền sáng' },
  { theme: 'dark', name: 'nền tối' },
] as const;

const pixelated = '[image-rendering:pixelated]';

/** One asset's pictures, for a reviewer: 1× and 2× on light and dark, then its frames or its grid. */
export function AssetPreviews({
  asset,
  src,
  tileSize,
}: {
  asset: Asset;
  src: string;
  tileSize: number | null;
}) {
  const width = asset.width;
  const height = asset.height;
  const name = `${asset.id}, ${kindName(asset.kind).toLowerCase()}`;
  const grid = pictureGrid(asset, tileSize);
  return (
    <div className="flex flex-col gap-3">
      <ul aria-label={`Xem trước ${asset.id}`} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {scales.flatMap((scale) =>
          backdrops.map((backdrop) => (
            <li key={`${scale}-${backdrop.theme}`} className="flex min-w-0 flex-col gap-1">
              <div
                data-theme={backdrop.theme}
                className="flex min-h-24 items-center justify-center overflow-auto rounded-xl border border-line bg-page p-3"
              >
                <img
                  src={src}
                  alt={`${name}, ${scale}×, ${backdrop.name}`}
                  width={width !== null ? width * scale : undefined}
                  height={height !== null ? height * scale : undefined}
                  loading="lazy"
                  className={`block max-w-none ${pixelated}`}
                />
              </div>
              <span className="text-ink-soft text-xs">
                {scale}× · {backdrop.name}
              </span>
            </li>
          )),
        )}
      </ul>
      {grid && asset.kind === 'spritesheet' && asset.frames ? (
        <Frames
          src={src}
          sheet={{ width: width ?? 0, height: height ?? 0 }}
          grid={grid}
          count={asset.frames.count}
        />
      ) : null}
      {grid && asset.kind === 'tileset' ? (
        <TileGrid src={src} alt={name} sheet={{ width: width ?? 0, height: height ?? 0 }} grid={grid} />
      ) : null}
    </div>
  );
}

const frameScale = 2;

/** A sprite sheet's frames one by one, at 2×: each a window onto the sheet. */
function Frames({
  src,
  sheet,
  grid,
  count,
}: {
  src: string;
  sheet: { width: number; height: number };
  grid: Grid;
  count: number;
}) {
  const origins = frameOrigins(grid, count);
  return (
    <div className="flex flex-col gap-1">
      <span className="font-semibold text-ink text-sm">
        {origins.length} khung, mỗi khung {grid.width} × {grid.height} px (2×)
      </span>
      <ol aria-label="Các khung hình" className="flex flex-wrap gap-2 rounded-xl bg-soft p-3">
        {origins.map((origin, index) => (
          <li key={`${origin.x}-${origin.y}`} className="flex flex-col items-center gap-1">
            <div
              role="img"
              aria-label={`Khung ${index + 1}`}
              className={`bg-no-repeat ${pixelated}`}
              style={{
                width: grid.width * frameScale,
                height: grid.height * frameScale,
                backgroundImage: `url("${src}")`,
                backgroundSize: `${sheet.width * frameScale}px ${sheet.height * frameScale}px`,
                backgroundPosition: `-${origin.x * frameScale}px -${origin.y * frameScale}px`,
              }}
            />
            <span className="text-ink-soft text-xs tabular-nums">{index + 1}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** A tileset at 2× with its grid drawn over it, in the focus colour of the tokens. */
function TileGrid({
  src,
  alt,
  sheet,
  grid,
}: {
  src: string;
  alt: string;
  sheet: { width: number; height: number };
  grid: Grid;
}) {
  const line = 'var(--tohe-focus)';
  return (
    <div className="flex flex-col gap-1">
      <span className="font-semibold text-ink text-sm">
        Lưới {grid.columns} × {grid.rows} ô, mỗi ô {grid.width} × {grid.height} px (2×)
      </span>
      <div className="overflow-auto rounded-xl bg-soft p-3">
        <div className="relative w-fit">
          <img
            src={src}
            alt={`${alt}, lưới ô`}
            width={sheet.width * frameScale}
            height={sheet.height * frameScale}
            loading="lazy"
            className={`block max-w-none ${pixelated}`}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(to right, ${line} 1px, transparent 1px), linear-gradient(to bottom, ${line} 1px, transparent 1px)`,
              backgroundSize: `${grid.width * frameScale}px ${grid.height * frameScale}px`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

const linkClass = 'font-semibold text-brand-ink underline underline-offset-4';

/** The pack's style beside the gallery, to compare with: its status, palette and sample pictures. */
export function StyleCompare({ style }: { style: Style }) {
  const samples = style.samples.filter((sample) => sample.uploaded);
  return (
    <Section
      title="Phong cách để so"
      aside={<Badge tone={statusTone(style.status)}>{styleStatusName(style.status)}</Badge>}
    >
      <Link to="/styles/$styleId" params={{ styleId: style.id }} className={linkClass}>
        {style.name}
      </Link>
      {style.status !== 'approved' ? (
        <p className="text-ink-soft text-sm">
          Phong cách chưa được duyệt: phiên bản chỉ duyệt được khi phong cách đã được duyệt.
        </p>
      ) : null}
      {style.palette ? <Palette colours={style.palette} /> : <Empty>Không giới hạn màu.</Empty>}
      {samples.length === 0 ? (
        <Empty>Chưa có hình mẫu nào.</Empty>
      ) : (
        <ul aria-label="Hình mẫu của phong cách" className="flex flex-wrap gap-2">
          {samples.map((sample, index) => (
            <li
              key={sample.sha256}
              className="flex min-h-16 items-center justify-center overflow-auto rounded-xl bg-soft p-2"
            >
              <img
                src={styleSampleUrl(style.id, sample.sha256)}
                alt={`Hình mẫu ${index + 1} của ${style.name}`}
                loading="lazy"
                className={`h-auto max-w-full ${pixelated}`}
              />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
