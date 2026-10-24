import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { type Asset, type PackVersion, studio, versionFileUrl } from '../api/client.ts';
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
import { Badge, Empty, Fact, Facts, Failed, Loading, PageTitle, Section } from '../ui/ui.tsx';

const linkClass = 'font-semibold text-brand-ink underline underline-offset-4';

/**
 * /packs/<packId>/<versionId> — a version: where it is in its life and its review, and each asset with its picture, its
 * file, its licence and its source. Reading only; reviewing comes with the gallery.
 */
export function VersionPage() {
  const { packId, versionId } = useParams({ from: '/_session/packs/$packId/$versionId' });
  const version = useQuery({
    queryKey: ['studio', 'version', versionId],
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
      ) : (
        <>
          <VersionFacts version={version.data} />
          <Section title={`Tài nguyên (${version.data.assets.length})`}>
            {version.data.assets.length === 0 ? (
              <Empty>Phiên bản này chưa có tài nguyên nào.</Empty>
            ) : (
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {version.data.assets.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    versionId={version.data.id}
                    filesKept={version.data.status !== 'withdrawn' && version.data.status !== 'rejected'}
                  />
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </>
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

/** One asset: its picture at its real size (pixel for pixel, never smoothed), what it is, its file, licence and source. */
function AssetCard({ asset, versionId, filesKept }: { asset: Asset; versionId: string; filesKept: boolean }) {
  const showPicture = filesKept && asset.uploaded && isPicture(asset.kind);
  const size = asset.width !== null && asset.height !== null ? `${asset.width} × ${asset.height}` : null;
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="break-all font-mono font-semibold text-ink">{asset.id}</h3>
        <Badge>{kindName(asset.kind)}</Badge>
        {asset.uploaded ? null : <Badge tone="notice">Chưa tải tệp lên</Badge>}
      </div>
      {showPicture ? (
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
            {line.value}
          </Fact>
        ))}
        {asset.tags.length > 0 ? <Fact label="Thẻ">{asset.tags.join(', ')}</Fact> : null}
      </Facts>
    </li>
  );
}
