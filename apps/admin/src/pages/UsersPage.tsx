import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { admin } from '../api/client.ts';
import { count, dateTime, roleName } from '../format.ts';
import { Button, Field } from '../ui/forms.tsx';
import { Badge, Card, cell, Failed, Loading, PageTitle, row, Table } from '../ui/ui.tsx';

/** Accounts by address, username, name or profile ID (ADR 0027); nothing typed, the newest ones. */
export function UsersPage() {
  const { q } = useSearch({ from: '/users' });
  const navigate = useNavigate({ from: '/users' });
  const [text, setText] = useState(q);
  const users = useQuery({ queryKey: ['admin', 'users', q], queryFn: () => admin.users(q) });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void navigate({ search: { q: text.trim() } });
  };

  return (
    <>
      <PageTitle title="Người dùng" />
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <div className="min-w-64 flex-1">
          <Field
            label="Tìm theo email, tên, hoặc ID hồ sơ (từ 4 số)"
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        <Button type="submit">Tìm</Button>
      </form>
      <Card title={q ? `Kết quả cho “${q}”` : 'Tài khoản mới nhất'}>
        {users.isPending ? (
          <Loading />
        ) : users.isError ? (
          <Failed retry={() => void users.refetch()} />
        ) : users.data.length === 0 ? (
          <p className="text-ink-soft">Không tìm thấy ai.</p>
        ) : (
          <Table head={['Tài khoản', 'Vai trò', 'Hồ sơ', 'Tạo lúc']}>
            {users.data.map((account) => (
              <tr key={account.id} className={row}>
                <td className={cell}>
                  <Link
                    to="/users/$id"
                    params={{ id: account.id }}
                    className="font-semibold text-brand-ink underline underline-offset-4"
                  >
                    {account.displayName}
                  </Link>
                  <div className="break-all text-ink-soft text-xs">{account.email ?? account.username}</div>
                </td>
                <td className={`${cell} whitespace-nowrap`}>
                  <div className="flex flex-wrap gap-1">
                    {account.role ? <Badge tone="notice">{roleName(account.role)}</Badge> : null}
                    {account.suspended ? <Badge tone="danger">Tạm khoá</Badge> : null}
                    {account.deleteAfter ? <Badge tone="notice">Chờ xoá</Badge> : null}
                  </div>
                </td>
                <td className={`${cell} tabular-nums`}>{count(account.profiles)}</td>
                <td className={`${cell} whitespace-nowrap`}>{dateTime(account.createdAt)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
