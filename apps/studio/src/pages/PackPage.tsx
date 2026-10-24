import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { studio } from '../api/client.ts';
import { creatorName, dateTime, statusTone, versionStatusName } from '../format.ts';
import { Badge, Fact, Facts, Failed, Loading, PageTitle, Section } from '../ui/ui.tsx';

const linkClass = 'font-semibold text-brand-ink underline underline-offset-4';

/** /packs/<packId> — a pack: its description, its style and its versions, newest first. */
export function PackPage() {
  const { packId } = useParams({ from: '/_session/packs/$packId' });
  const pack = useQuery({ queryKey: ['studio', 'pack', packId], queryFn: () => studio.pack(packId) });
  return (
    <>
      <PageTitle title={packId} aside="Gói" />
      {pack.isPending ? (
        <Loading />
      ) : pack.isError ? (
        <Failed error={pack.error} retry={() => void pack.refetch()} />
      ) : (
        <>
          <Section title="Gói">
            {pack.data.description ? <p className="text-ink">{pack.data.description}</p> : null}
            <Facts>
              <Fact label="Phong cách">
                <Link to="/styles/$styleId" params={{ styleId: pack.data.styleId }} className={linkClass}>
                  {pack.data.styleId}
                </Link>
              </Fact>
              <Fact label="Tạo bởi">{creatorName(pack.data.createdBy)}</Fact>
              <Fact label="Tạo lúc">{dateTime(pack.data.createdAt)}</Fact>
            </Facts>
          </Section>
          <Section title="Phiên bản">
            <ul className="flex flex-col">
              {pack.data.versions.map((version) => (
                <li
                  key={version.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 border-line border-b py-2 last:border-0"
                >
                  <Link
                    to="/packs/$packId/$versionId"
                    params={{ packId, versionId: version.id }}
                    className={`${linkClass} inline-flex min-h-11 items-center tabular-nums`}
                  >
                    {version.version}
                  </Link>
                  <Badge tone={statusTone(version.status)}>{versionStatusName(version.status)}</Badge>
                  <span className="text-ink-soft text-sm">
                    {creatorName(version.createdBy)} · {dateTime(version.createdAt)}
                  </span>
                  {version.submittedAt ? (
                    <span className="text-ink-soft text-sm">Gửi duyệt {dateTime(version.submittedAt)}</span>
                  ) : null}
                  {version.reviewedAt ? (
                    <span className="text-ink-soft text-sm">Xét duyệt {dateTime(version.reviewedAt)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </>
  );
}
