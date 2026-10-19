import { useQuery } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import { admin, type GameHealth, type TelemetryReport } from '../api/client.ts';
import { ago, count, day, milliseconds, percent } from '../format.ts';
import { Badge, Card, cell, Failed, Loading, PageTitle, row, Stat, Table } from '../ui/ui.tsx';

/** The windows the health page offers, in days (the raw events reach 30 days back). */
export const HEALTH_DAYS = [1, 7, 30] as const;

/** Device telemetry (ADR 0015) over the last days: what the operator's report says, as pages. */
export function HealthPage() {
  const { days } = useSearch({ from: '/health' });
  const report = useQuery({ queryKey: ['admin', 'health', days], queryFn: () => admin.health(days) });

  return (
    <>
      <PageTitle
        title="Sức khoẻ thiết bị"
        aside={
          <span className="flex gap-1">
            {HEALTH_DAYS.map((offered) => (
              <Link
                key={offered}
                to="/health"
                search={{ days: offered }}
                className="rounded-xl px-3 py-1 font-semibold text-ink-soft hover:bg-soft"
                activeProps={{ className: 'bg-soft text-ink', 'aria-current': 'page' }}
              >
                {offered === 1 ? '24 giờ' : `${offered} ngày`}
              </Link>
            ))}
          </span>
        }
      />
      {report.isPending ? (
        <Loading />
      ) : report.isError ? (
        <Failed retry={() => void report.refetch()} />
      ) : (
        <Report report={report.data} />
      )}
    </>
  );
}

function Report({ report }: { report: TelemetryReport }) {
  const devices = [...report.devices].sort((a, b) => b.devices - a.devices).slice(0, 15);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Thiết bị">
          <Stat value={count(report.totals.devices)} />
        </Card>
        <Card title="Phiên">
          <Stat value={count(report.totals.sessions)} />
        </Card>
        <Card title="Sự kiện">
          <Stat value={count(report.totals.events)} />
        </Card>
      </div>
      <Card
        title="Theo ngày"
        aside={<span className="text-ink-soft text-sm">Lượt chơi và lỗi, mọi game</span>}
      >
        <Daily points={report.daily} />
      </Card>
      {report.games.map((game) => (
        <GameCard key={`${game.gameId ?? 'hub'}@${game.gameVersion ?? ''}`} game={game} />
      ))}
      <Card title="Thiết bị và trình duyệt">
        {devices.length === 0 ? (
          <p className="text-ink-soft">Chưa có thiết bị nào gửi số liệu.</p>
        ) : (
          <Table head={['Hệ điều hành', 'Trình duyệt', 'Loại', 'Thiết bị', 'Phiên']}>
            {devices.map((device) => (
              <tr
                key={`${device.os}${device.osVersion}${device.browser}${device.deviceClass}`}
                className={row}
              >
                <td className={cell}>
                  {device.os} {device.osVersion}
                </td>
                <td className={cell}>{device.browser}</td>
                <td className={cell}>{device.deviceClass}</td>
                <td className={`${cell} tabular-nums`}>{count(device.devices)}</td>
                <td className={`${cell} tabular-nums`}>{count(device.sessions)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}

function Daily({ points }: { points: TelemetryReport['daily'] }) {
  const byDay = new Map<string, { plays: number; errors: number }>();
  for (const point of points) {
    const total = byDay.get(point.day) ?? { plays: 0, errors: 0 };
    total.plays += point.plays;
    total.errors += point.errors;
    byDay.set(point.day, total);
  }
  const days = [...byDay].sort(([a], [b]) => a.localeCompare(b));
  if (days.length === 0) return <p className="text-ink-soft">Chưa có số liệu cộng dồn theo ngày.</p>;

  const most = Math.max(1, ...days.map(([, total]) => total.plays));
  return (
    <Table head={['Ngày', 'Lượt chơi', '', 'Lỗi']}>
      {days.map(([date, total]) => (
        <tr key={date} className={row}>
          <td className={`${cell} tabular-nums`}>{day(date)}</td>
          <td className={`${cell} tabular-nums`}>{count(total.plays)}</td>
          <td className={`${cell} w-1/2`}>
            <div className="h-2 rounded-full bg-soft">
              <div
                className="h-2 rounded-full bg-brand"
                style={{ width: `${(total.plays / most) * 100}%` }}
              />
            </div>
          </td>
          <td className={`${cell} tabular-nums ${total.errors ? 'font-semibold text-danger' : ''}`}>
            {count(total.errors)}
          </td>
        </tr>
      ))}
    </Table>
  );
}

function GameCard({ game }: { game: GameHealth }) {
  const title = game.gameId ? `${game.gameId} ${game.gameVersion ?? ''}` : 'Hub (ngoài game)';
  const errorShare = game.sessions ? game.sessionsWithErrors / game.sessions : 0;
  return (
    <Card
      title={title}
      aside={
        <span className="text-ink-soft text-sm">
          {count(game.sessions)} phiên · {count(game.devices)} thiết bị · {percent(errorShare)} phiên có lỗi
        </span>
      }
    >
      {game.errors.length === 0 ? (
        <p className="text-ink-soft">Không có lỗi.</p>
      ) : (
        <Table head={['Lỗi', 'Lần', 'Phiên', 'Lần cuối']}>
          {game.errors.slice(0, 8).map((error) => (
            <tr key={error.fingerprint} className={row}>
              <td className={`${cell} break-words`}>
                <span className="mr-2 text-ink-soft text-xs">{error.source}</span>
                {error.message}
                {error.new ? (
                  <span className="ml-2">
                    <Badge tone="danger">mới</Badge>
                  </span>
                ) : null}
              </td>
              <td className={`${cell} tabular-nums`}>{count(error.occurrences)}</td>
              <td className={`${cell} tabular-nums`}>{count(error.sessions)}</td>
              <td className={`${cell} whitespace-nowrap`}>{ago(error.lastSeen)}</td>
            </tr>
          ))}
        </Table>
      )}
      {game.frames.length > 0 ? (
        <Table head={['Khung hình trên', 'Renderer', 'Khung chậm (> 33 ms)', 'p95', 'Chậm nhất']}>
          {game.frames.map((frames) => (
            <tr
              key={`${frames.os}${frames.browser}${frames.deviceClass}${frames.renderer ?? ''}`}
              className={row}
            >
              <td className={cell}>
                {frames.os} · {frames.browser} · {frames.deviceClass}
              </td>
              <td className={cell}>{frames.renderer ?? '—'}</td>
              <td className={`${cell} tabular-nums`}>{percent(frames.slowShare)}</td>
              <td className={`${cell} whitespace-nowrap tabular-nums`}>{frames.p95}</td>
              <td className={`${cell} tabular-nums`}>{milliseconds(frames.slowestMs)}</td>
            </tr>
          ))}
        </Table>
      ) : null}
      {game.metrics.length > 0 ? (
        <Table head={['Chỉ số', 'Mẫu', 'p50', 'p95', 'Lớn nhất']}>
          {game.metrics.map((metric) => (
            <tr key={metric.name} className={row}>
              <td className={cell}>{metric.name}</td>
              <td className={`${cell} tabular-nums`}>{count(metric.samples)}</td>
              <td className={`${cell} tabular-nums`}>{count(Math.round(metric.p50))}</td>
              <td className={`${cell} tabular-nums`}>{count(Math.round(metric.p95))}</td>
              <td className={`${cell} tabular-nums`}>{count(Math.round(metric.max))}</td>
            </tr>
          ))}
        </Table>
      ) : null}
    </Card>
  );
}
