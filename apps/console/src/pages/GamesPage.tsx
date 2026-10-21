import { useQuery } from '@tanstack/react-query';
import { admin } from '../api/client.ts';
import { count, dateTime } from '../format.ts';
import { Badge, Card, cell, Failed, Loading, PageTitle, row, Table } from '../ui/ui.tsx';

/** Every game the registry knows, listed or not, and how much it is played. */
export function GamesPage() {
  const games = useQuery({ queryKey: ['admin', 'games'], queryFn: admin.games });
  if (games.isPending) return <Loading />;
  if (games.isError) return <Failed retry={() => void games.refetch()} />;

  return (
    <>
      <PageTitle title="Game" aside={`${count(games.data.length)} game trong registry`} />
      <Card title="Registry">
        {games.data.length === 0 ? (
          <p className="text-ink-soft">Chưa có game nào: danh mục chưa đồng bộ lần nào.</p>
        ) : (
          <Table
            head={[
              'Game',
              'Phiên bản',
              'Trạng thái',
              'Tuổi',
              'Danh tính',
              'Lối vào',
              'Người chơi 7 ngày',
              'Phòng mở',
              'Cập nhật',
            ]}
          >
            {games.data.map((game) => (
              <tr key={game.id} className={row}>
                <td className={cell}>
                  <div className="font-semibold">{game.name}</div>
                  <div className="text-ink-soft text-xs">{game.id}</div>
                </td>
                <td className={`${cell} tabular-nums`}>{game.version}</td>
                <td className={`${cell} whitespace-nowrap`}>
                  <div className="flex flex-wrap gap-1">
                    {game.listed ? <Badge>Hiển thị</Badge> : <Badge tone="danger">Đã gỡ</Badge>}
                    {game.online ? <Badge tone="notice">Chơi online</Badge> : null}
                  </div>
                </td>
                <td className={`${cell} tabular-nums`}>{game.minAge}+</td>
                {/* What the current build asks of its player, and the entries it opens itself (ADR 0045). */}
                <td className={`${cell} whitespace-nowrap`}>
                  <div>mở: {game.identityPlay}</div>
                  {game.identityRooms ? (
                    <div className="text-ink-soft text-xs">bàn: {game.identityRooms}</div>
                  ) : null}
                </td>
                <td className={`${cell} whitespace-nowrap`}>
                  {game.entries.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {game.entries.map((kind) => (
                        <Badge key={kind}>{kind}</Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-ink-soft">—</span>
                  )}
                </td>
                <td className={`${cell} tabular-nums`}>{count(game.playersLastWeek)}</td>
                <td className={`${cell} tabular-nums`}>{count(game.openRooms)}</td>
                <td className={`${cell} whitespace-nowrap`}>{dateTime(game.updatedAt)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
