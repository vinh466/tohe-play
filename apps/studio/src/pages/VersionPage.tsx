import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import {
  type Asset,
  type PackVersion,
  type StudioMe,
  type Style,
  studio,
  versionFileUrl,
} from '../api/client.ts';
import {
  bytes,
  creatorName,
  dateTime,
  isPicture,
  kindName,
  sourceLines,
  statusTone,
  versionStatusName,
} from '../format.ts';
import { mayReview } from '../review.ts';
import { useSignedIn } from '../security/Gate.tsx';
import { Badge, Empty, Fact, Facts, Failed, Loading, PageTitle, Section } from '../ui/ui.tsx';
import { AssetPreviews, StyleCompare } from './Gallery.tsx';
import { styleKey } from './StylesPage.tsx';
import { VersionReview, versionKey } from './VersionReview.tsx';

const linkClass = 'font-semibold text-brand-ink underline underline-offset-4';

/**
 * /packs/<packId>/<versionId> — a version: where it is in its life and its review, and each asset with its picture, its
 * file, its licence and its source. For a reviewer, the gallery, the style to compare with, the checklist and the
 * review's actions (docs/architecture/asset-studio.md, Reviewing in the app).
 */
export function VersionPage() {
  const { packId, versionId } = useParams({ from: '/_session/packs/$packId/$versionId' });
  const me = useSignedIn();
  const version = useQuery({
    queryKey: versionKey(versionId),
    queryFn: () => studio.version(versionId),
  });
  return (
    <>
      <PageTitle
        title={version.data ? `${version.data.packId}@${version.data.version}` : packId}
        aside={
          <Link to="/packs/$packId" params={{ packId }} className={linkClass}>
            Gói {packId}
          </Link>
        }
      />
      {version.isPending ? (
        <Loading />
      ) : version.isError ? (
        <Failed error={version.error} retry={() => void version.refetch()} />
      ) : me && mayReview(me) ? (
        <Reviewed version={version.data} me={me} />
      ) : (
        <>
          <VersionFacts version={version.data} />
          <Assets version={version.data} review={null} />
        </>
      )}
    </>
  );
}

/**
 * A reviewer's view: the gallery beside the pack's style, and the review's actions. The style comes through the pack
 * (a version does not name it); its tile size draws a tileset's grid.
 */
function Reviewed({ version, me }: { version: PackVersion; me: StudioMe }) {
  const pack = useQuery({
    queryKey: ['studio', 'pack', version.packId],
    queryFn: () => studio.pack(version.packId),
  });
  const styleId = pack.data?.styleId;
  const style = useQuery({
    queryKey: styleKey(styleId ?? ''),
    queryFn: () => studio.style(styleId ?? ''),
    enabled: styleId !== undefined,
  });
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <VersionFacts version={version} />
        <Assets version={version} review={{ style: style.data ?? null }} />
      </div>
      <aside aria-label="Xét duyệt" className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4">
        {style.data ? <StyleCompare style={style.data} /> : null}
        {pack.isError || style.isError ? (
          <Failed
            error={pack.error ?? style.error}
            retry={() => void (pack.isError ? pack.refetch() : style.refetch())}
          />
        ) : null}
        <VersionReview version={version} me={me} />
      </aside>
    </div>
  );
}

/** Its assets; `review` holds what the gallery needs, for a reviewer. */
function Assets({ version, review }: { version: PackVersion; review: { style: Style | null } | null }) {
  return (
    <Section title={`Tài nguyên (${version.assets.length})`}>
      {version.assets.length === 0 ? (
        <Empty>Phiên bản này chưa có tài nguyên nào.</Empty>
      ) : (
        <ul className={`grid grid-cols-1 gap-3 ${review ? '' : 'md:grid-cols-2'}`}>
          {version.assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              versionId={version.id}
              filesKept={version.status !== 'withdrawn' && version.status !== 'rejected'}
              review={review}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

function VersionFacts({ version }: { version: PackVersion }) {
  return (
    <Section
      title="Phiên bản"
      aside={<Badge tone={statusTone(version.status)}>{versionStatusName(version.status)}</Badge>}
    >
      <Facts>
        <Fact label="Tạo bởi">{creatorName(version.createdBy)}</Fact>
        <Fact label="Tạo lúc">{dateTime(version.createdAt)}</Fact>
        <Fact label="Sửa lần cuối">{dateTime(version.updatedAt)}</Fact>
        {version.submittedAt ? <Fact label="Gửi duyệt">{dateTime(version.submittedAt)}</Fact> : null}
        {version.reviewedAt ? <Fact label="Xét duyệt">{dateTime(version.reviewedAt)}</Fact> : null}
        {version.reason ? <Fact label="Lý do từ chối">{version.reason}</Fact> : null}
        {version.shareAlikeAllowed ? (
          <Fact label="Cho phép CC-BY-SA-4.0">{version.shareAlikeReason ?? 'Có'}</Fact>
        ) : null}
        {version.deprecatedAt ? (
          <Fact label="Không nên dùng từ">{dateTime(version.deprecatedAt)}</Fact>
        ) : null}
        {version.withdrawnAt ? <Fact label="Rút lúc">{dateTime(version.withdrawnAt)}</Fact> : null}
        {version.withdrawReason ? <Fact label="Lý do rút">{version.withdrawReason}</Fact> : null}
        {version.manifestSha256 ? (
          <Fact label="Manifest">
            {version.manifestUrl ? (
              <a href={version.manifestUrl} className={`${linkClass} font-mono text-xs`}>
                {version.manifestSha256.slice(0, 16)}…
              </a>
            ) : (
              <span className="font-mono text-xs">{version.manifestSha256.slice(0, 16)}…</span>
            )}
          </Fact>
        ) : null}
      </Facts>
    </Section>
  );
}

/**
 * One asset: its picture at its real size (pixel for pixel, never smoothed) — for a reviewer, the gallery's previews —
 * what it is, its file, licence and source.
 */
function AssetCard({
  asset,
  versionId,
  filesKept,
  review,
}: {
  asset: Asset;
  versionId: string;
  filesKept: boolean;
  review: { style: Style | null } | null;
}) {
  const showPicture = filesKept && asset.uploaded && isPicture(asset.kind);
  const size = asset.width !== null && asset.height !== null ? `${asset.width} × ${asset.height}` : null;
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="break-all font-mono font-semibold text-ink">{asset.id}</h3>
        <Badge>{kindName(asset.kind)}</Badge>
        {asset.uploaded ? null : <Badge tone="notice">Chưa tải tệp lên</Badge>}
      </div>
      {showPicture && review ? (
        <AssetPreviews
          asset={asset}
          src={versionFileUrl(versionId, asset.sha256)}
          tileSize={review.style?.tileSize ?? null}
        />
      ) : showPicture ? (
        <div className="flex min-h-24 items-center justify-center overflow-auto rounded-xl bg-soft p-3">
          <img
            src={versionFileUrl(versionId, asset.sha256)}
            alt={`${asset.id}, ${kindName(asset.kind).toLowerCase()}`}
            width={asset.width ?? undefined}
            height={asset.height ?? undefined}
            loading="lazy"
            className="h-auto max-w-full [image-rendering:pixelated]"
          />
        </div>
      ) : null}
      <Facts>
        {size ? <Fact label="Kích thước">{size} px</Fact> : null}
        {asset.frames ? (
          <Fact label="Khung hình">
            {asset.frames.count} khung {asset.frames.width} × {asset.frames.height} px
          </Fact>
        ) : null}
        {asset.wang ? <Fact label="Cạnh Wang">{asset.wang.tiles.length} ô</Fact> : null}
        <Fact label="Tệp">
          {asset.ext.toUpperCase()} · {bytes(asset.bytes)}
        </Fact>
        <Fact label="sha256">
          <span className="font-mono text-xs">{asset.sha256.slice(0, 16)}…</span>
        </Fact>
        <Fact label="Giấy phép">{asset.licence}</Fact>
        {asset.attribution ? <Fact label="Ghi công">{asset.attribution}</Fact> : null}
        {sourceLines(asset.source).map((line) => (
          <Fact key={line.label} label={line.label}>
            {line.href ? (
              <a
                href={line.href}
                target="_blank"
                rel="noreferrer noopener"
                className={`${linkClass} break-all`}
              >
                {line.value}
              </a>
            ) : (
              line.value
            )}
          </Fact>
        ))}
        {asset.tags.length > 0 ? <Fact label="Thẻ">{asset.tags.join(', ')}</Fact> : null}
      </Facts>
    </li>
  );
}
