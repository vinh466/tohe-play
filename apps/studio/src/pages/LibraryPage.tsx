import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type Pack, studio } from '../api/client.ts';
import { dateTime, statusTone, versionStatusName } from '../format.ts';
import { mayReview, reviewQueue } from '../review.ts';
import { useSignedIn } from '../security/Gate.tsx';
import { Badge, Empty, Failed, Loading, PageTitle, Section } from '../ui/ui.tsx';
import { stylesKey } from './StylesPage.tsx';

export const packsKey = ['studio', 'packs'] as const;

const linkClass = 'font-semibold text-brand-ink underline underline-offset-4';

/**
 * / — the library: every pack, its style, and its versions with their status, newest first. A reviewer sees first what
 * waits for review.
 */
export function LibraryPage() {
  const me = useSignedIn();
  const packs = useQuery({ queryKey: packsKey, queryFn: studio.packs });
  return (
    <>
      <PageTitle title="Thư viện" aside={packs.data ? `${packs.data.length} gói` : undefined} />
      {me && mayReview(me) && packs.data ? <Waiting packs={packs.data} /> : null}
      {packs.isPending ? (
        <Loading />
      ) : packs.isError ? (
        <Failed error={packs.error} retry={() => void packs.refetch()} />
      ) : packs.data.length === 0 ? (
        <Empty>Chưa có gói nào. Gói đầu tiên xuất hiện ở đây khi có bản nháp gửi bằng tohe-studio.</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {packs.data.map((pack) => (
            <li key={pack.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Link to="/packs/$packId" params={{ packId: pack.id }} className={`${linkClass} text-lg`}>
                  {pack.id}
                </Link>
                <span className="text-ink-soft text-sm">
                  Phong cách{' '}
                  <Link to="/styles/$styleId" params={{ styleId: pack.styleId }} className={linkClass}>
                    {pack.styleId}
                  </Link>
                </span>
                <span className="text-ink-soft text-sm">Tạo {dateTime(pack.createdAt)}</span>
              </div>
              {pack.description ? <p className="text-ink">{pack.description}</p> : null}
              <ul aria-label={`Các phiên bản của ${pack.id}`} className="flex flex-wrap gap-2">
                {pack.versions.map((version) => (
                  <li key={version.id}>
                    <Link
                      to="/packs/$packId/$versionId"
                      params={{ packId: pack.id, versionId: version.id }}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 hover:bg-soft"
                    >
                      <span className="font-semibold text-ink tabular-nums">{version.version}</span>
                      <Badge tone={statusTone(version.status)}>{versionStatusName(version.status)}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** What waits for a reviewer, oldest first: submitted versions and draft styles, each a link to where it is reviewed. */
function Waiting({ packs }: { packs: Pack[] }) {
  const styles = useQuery({ queryKey: stylesKey, queryFn: studio.styles });
  if (styles.isPending) return null;
  if (styles.isError) return <Failed error={styles.error} retry={() => void styles.refetch()} />;
  const queue = reviewQueue(packs, styles.data);
  return (
    <Section
      title="Chờ duyệt"
      aside={<span className="text-ink-soft text-sm">{queue.length} mục, cũ nhất trước</span>}
    >
      {queue.length === 0 ? (
        <Empty>Không có gì chờ duyệt.</Empty>
      ) : (
        <ol className="flex flex-col">
          {queue.map((item) => (
            <li
              key={item.kind === 'version' ? item.versionId : `style-${item.styleId}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-line border-b py-1 last:border-0"
            >
              {item.kind === 'version' ? (
                <>
                  <Badge>Gói</Badge>
                  <Link
                    to="/packs/$packId/$versionId"
                    params={{ packId: item.packId, versionId: item.versionId }}
                    className={`${linkClass} inline-flex min-h-11 items-center`}
                  >
                    {item.packId}@{item.version}
                  </Link>
                  <span className="text-ink-soft text-sm">Gửi duyệt {dateTime(item.since)}</span>
                </>
              ) : (
                <>
                  <Badge>Phong cách</Badge>
                  <Link
                    to="/styles/$styleId"
                    params={{ styleId: item.styleId }}
                    className={`${linkClass} inline-flex min-h-11 items-center`}
                  >
                    {item.name}
                  </Link>
                  <span className="text-ink-soft text-sm">Sửa lần cuối {dateTime(item.since)}</span>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
