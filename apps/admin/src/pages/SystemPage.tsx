import { useQuery } from '@tanstack/react-query';
import { admin } from '../api/client.ts';
import { ago, count, dateTime, since } from '../format.ts';
import { Badge, Card, cell, Fact, Failed, Loading, PageTitle, row, Table } from '../ui/ui.tsx';

const workerNames: Record<string, string> = {
  'catalog-sync': 'Đồng bộ danh mục game',
  'email-delivery': 'Gửi email',
  'telemetry-maintenance': 'Cộng dồn và dọn telemetry',
};

/** The running deployment: its build, database, background work and settings — never its secrets. */
export function SystemPage() {
  const system = useQuery({ queryKey: ['admin', 'system'], queryFn: admin.system, refetchInterval: 30_000 });
  if (system.isPending) return <Loading />;
  if (system.isError) return <Failed retry={() => void system.refetch()} />;

  const { version, environment, startedAt, database, workers, settings } = system.data;
  return (
    <>
      <PageTitle title="Hệ thống" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Bản đang chạy">
          <div>
            <Fact label="Phiên bản">{version}</Fact>
            <Fact label="Môi trường">{environment}</Fact>
            <Fact label="Khởi động">
              {dateTime(startedAt)} · đã chạy {since(startedAt)}
            </Fact>
          </div>
        </Card>
        <Card title="Cơ sở dữ liệu">
          <div>
            <Fact label="Migration đã chạy">{count(database.applied)}</Fact>
            <Fact label="Migration mới nhất">{database.latest ?? '—'}</Fact>
            <Fact label="Chờ chạy">
              {database.pending.length === 0 ? (
                'Không có'
              ) : (
                <Badge tone="danger">{database.pending.join(', ')}</Badge>
              )}
            </Fact>
          </div>
        </Card>
      </div>
      <Card title="Việc chạy nền" aside={<span className="text-ink-soft text-sm">Từ khi API khởi động</span>}>
        {workers.length === 0 ? (
          <p className="text-ink-soft">Chưa có việc nào chạy xong.</p>
        ) : (
          <Table head={['Việc', 'Lần chạy cuối', 'Lần thành công cuối', 'Lỗi liên tiếp', 'Lỗi gần nhất']}>
            {workers.map((worker) => (
              <tr key={worker.name} className={row}>
                <td className={cell}>
                  <div className="font-semibold">{workerNames[worker.name] ?? worker.name}</div>
                  <div className="text-ink-soft text-xs">{worker.name}</div>
                </td>
                <td className={`${cell} whitespace-nowrap`}>{ago(worker.lastRunAt)}</td>
                <td className={`${cell} whitespace-nowrap`}>
                  {worker.lastSuccessAt ? ago(worker.lastSuccessAt) : '—'}
                </td>
                <td className={`${cell} tabular-nums`}>
                  {worker.failuresInARow ? <Badge tone="danger">{count(worker.failuresInARow)}</Badge> : '0'}
                </td>
                <td className={`${cell} break-words text-ink-soft`}>{worker.lastError ?? '—'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Card title="Cấu hình" aside={<span className="text-ink-soft text-sm">Không gồm bí mật</span>}>
        <div>
          <Fact label="Địa chỉ của hub (App:PublicUrl)">{settings.publicUrl ?? 'Chưa đặt'}</Fact>
          <Fact label="Origin của game">{settings.gamesOrigin}</Fact>
          <Fact label="Email">
            {settings.emailMode === 'Disabled'
              ? 'Tắt'
              : `${settings.emailMode} · ${settings.emailFrom ?? ''}`}
          </Fact>
          <Fact label="Đăng nhập bằng">{['Email', ...settings.providers].join(', ')}</Fact>
          <Fact label="Telemetry">{settings.telemetry ? 'Bật' : 'Tắt'}</Fact>
          <Fact label="Báo cáo cho người vận hành">
            {settings.operatorReport ? 'Có (đã đặt token)' : 'Không'}
          </Fact>
        </div>
      </Card>
      <p className="text-ink-soft text-sm">CPU, bộ nhớ và ổ đĩa nằm ở Prometheus và Grafana của cluster.</p>
    </>
  );
}
