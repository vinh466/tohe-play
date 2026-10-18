import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { admin } from '../api/client.ts';
import { ago, count, dateTime, since } from '../format.ts';
import { meKey } from '../security/Gate.tsx';
import { Badge, Card, Failed, Loading, PageTitle, Stat } from '../ui/ui.tsx';

/** The platform at a glance, refreshed every half minute. */
export function OverviewPage() {
  const overview = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: admin.overview,
    refetchInterval: 30_000,
  });
  const me = useQuery({ queryKey: meKey, queryFn: admin.me });
  if (overview.isPending) return <Loading />;
  if (overview.isError) return <Failed retry={() => void overview.refetch()} />;

  const { accounts, profiles, players, rooms, errorsLastDay, catalog, email, heldResults, at, version } =
    overview.data;
  return (
    <>
      <PageTitle title="Tổng quan" aside={`Cập nhật ${dateTime(at)} · phiên bản ${version}`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="Tài khoản">
          <Stat
            value={count(accounts.total)}
            hint={`+${count(accounts.lastDay)} trong 24 giờ · +${count(accounts.lastWeek)} trong 7 ngày`}
          />
        </Card>
        <Card title="Hồ sơ">
          <Stat
            value={count(profiles.total)}
            hint={`+${count(profiles.lastDay)} trong 24 giờ · +${count(profiles.lastWeek)} trong 7 ngày`}
          />
        </Card>
        <Card title="Người chơi">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Stat label="24 giờ" value={count(players.lastDay)} />
            <Stat label="7 ngày" value={count(players.lastWeek)} />
          </div>
          <p className="text-ink-soft text-sm">Hồ sơ đã lưu game hoặc ghi điểm.</p>
        </Card>
        <Card title="Phòng online">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Stat label="Đang mở" value={count(rooms.open)} />
            <Stat label="Đang chơi" value={count(rooms.playing)} />
            <Stat label="Đang kết nối" value={count(rooms.online)} />
          </div>
        </Card>
        <Card
          title="Kết quả chờ xem xét"
          aside={
            me.data?.permissions.includes('admin.results.review') ? (
              <Link
                to="/review"
                search={{ list: 'held' }}
                className="text-brand-ink text-sm underline underline-offset-4"
              >
                Xem
              </Link>
            ) : null
          }
        >
          <Stat value={count(heldResults)} hint="engine giữ lại, chờ một người quyết" />
        </Card>
        <Card
          title="Lỗi trên thiết bị"
          aside={
            <Link
              to="/health"
              search={{ days: 1 }}
              className="text-brand-ink text-sm underline underline-offset-4"
            >
              Xem
            </Link>
          }
        >
          {errorsLastDay === null ? (
            <p className="text-ink-soft">Telemetry đang tắt.</p>
          ) : (
            <Stat value={count(errorsLastDay)} hint="trong 24 giờ" />
          )}
        </Card>
        <Card title="Danh mục game">
          <Stat
            value={count(catalog.listed)}
            hint={catalog.unlisted ? `${count(catalog.unlisted)} game đã gỡ` : 'đang hiển thị'}
          />
          {catalog.lastError ? (
            <Badge tone="danger">Đồng bộ lỗi: {catalog.lastError}</Badge>
          ) : catalog.lastSyncAt ? (
            <p className="text-ink-soft text-sm">Đồng bộ {ago(catalog.lastSyncAt, new Date(at))}</p>
          ) : (
            <p className="text-ink-soft text-sm">Chưa đồng bộ từ khi API khởi động.</p>
          )}
        </Card>
        <Card title="Email">
          {email.enabled ? (
            <>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <Stat label="Đang chờ" value={count(email.waiting)} />
                <Stat label="Đã gửi 24 giờ" value={count(email.sentLastDay)} />
              </div>
              {email.failedLastDay ? (
                <Badge tone="danger">{count(email.failedLastDay)} thư bỏ cuộc trong 24 giờ</Badge>
              ) : null}
              {email.oldestWaitingSince ? (
                <p className="text-ink-soft text-sm">
                  Thư cũ nhất đã chờ {since(email.oldestWaitingSince, new Date(at))}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-ink-soft">Máy chủ không gửi email (Email:Mode = Disabled).</p>
          )}
        </Card>
      </div>
    </>
  );
}
