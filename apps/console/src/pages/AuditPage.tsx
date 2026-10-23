import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { admin } from '../api/client.ts';
import { dateTime } from '../format.ts';
import { Button } from '../ui/forms.tsx';
import { Card, cell, Failed, Loading, PageTitle, row, Table } from '../ui/ui.tsx';

const actions: Record<string, string> = {
  'setup.claim': 'Nhận quyền chủ khi cài đặt',
  'role.grant': 'Cấp vai trò',
  'role.revoke': 'Gỡ vai trò',
  'agent.create': 'Tạo agent',
  'agent.disable': 'Tắt agent',
  'agent.token.create': 'Cấp token cho agent',
  'agent.token.revoke': 'Thu hồi token của agent',
  'studio.member.grant': 'Cấp vai trò Studio',
  'studio.member.revoke': 'Gỡ vai trò Studio',
  'console.open': 'Mở bảng quản trị',
  'two-factor.enable': 'Bật xác thực hai lớp',
  'two-factor.disable': 'Tắt xác thực hai lớp',
  'two-factor.recovery-codes': 'Tạo mã dự phòng mới',
  'user.suspend': 'Tạm khoá tài khoản',
  'user.unsuspend': 'Mở khoá tài khoản',
  'user.sign-out': 'Đăng xuất mọi thiết bị',
  'profile.rename': 'Đổi tên hồ sơ',
  'profile.hide': 'Ẩn hồ sơ khỏi bảng công khai',
  'profile.show': 'Cho hồ sơ hiện lại trên bảng công khai',
  'profile.withdraw': 'Mời hồ sơ khỏi bàn chơi',
  'settings.change': 'Đổi cách đăng nhập, đăng ký',
  'community.create': 'Tạo cộng đồng',
  'invite.create': 'Tạo mã mời',
  'invite.revoke': 'Thu hồi mã mời',
  'result.approve': 'Duyệt kết quả',
  'result.reject': 'Từ chối kết quả',
  'result.reopen': 'Mở lại kết quả',
};

/** A result the review decided about (`result 42`) opens in the review; any other target is text. */
function Target({ target }: { target: string | null }) {
  const result = target?.match(/^result (\d+)$/)?.[1];
  if (result) {
    return (
      <Link to="/review/$id" params={{ id: result }} className="text-brand-ink underline underline-offset-4">
        {target}
      </Link>
    );
  }
  return <>{target ?? '—'}</>;
}

/** Who did what in the console, newest first. The log is append-only: nothing here can be changed or removed. */
export function AuditPage() {
  const log = useInfiniteQuery({
    queryKey: ['admin', 'audit'],
    queryFn: ({ pageParam }) => admin.audit(pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (page) => page.before ?? undefined,
  });
  if (log.isPending) return <Loading />;
  if (log.isError) return <Failed retry={() => void log.refetch()} />;

  const entries = log.data.pages.flatMap((page) => page.entries);
  return (
    <>
      <PageTitle title="Nhật ký" aside="Chỉ ghi thêm, không sửa, không xoá" />
      <Card title="Ai đã làm gì">
        {entries.length === 0 ? (
          <p className="text-ink-soft">Chưa có gì.</p>
        ) : (
          <Table head={['Lúc', 'Ai', 'Việc', 'Đối tượng', 'Từ địa chỉ']}>
            {entries.map((entry) => (
              <tr key={entry.id} className={row}>
                <td className={`${cell} whitespace-nowrap`}>{dateTime(entry.at)}</td>
                <td className={`${cell} break-all`}>{entry.actor}</td>
                <td className={cell}>
                  <div className="font-semibold">{actions[entry.action] ?? entry.action}</div>
                  {entry.details ? (
                    <div className="break-all text-ink-soft text-xs">{entry.details}</div>
                  ) : null}
                </td>
                <td className={`${cell} break-all`}>
                  <Target target={entry.target} />
                </td>
                <td className={`${cell} whitespace-nowrap text-ink-soft`}>{entry.address ?? '—'}</td>
              </tr>
            ))}
          </Table>
        )}
        {log.hasNextPage ? (
          <Button variant="secondary" busy={log.isFetchingNextPage} onClick={() => void log.fetchNextPage()}>
            Xem cũ hơn
          </Button>
        ) : null}
      </Card>
    </>
  );
}
