import { useQuery } from '@tanstack/react-query';
import { Link, Outlet } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { ApiError, admin } from '../api/client.ts';
import { roleName } from '../format.ts';

const pages = [
  { to: '/', label: 'Tổng quan' },
  { to: '/games', label: 'Game' },
  { to: '/health', label: 'Sức khoẻ thiết bị' },
  { to: '/system', label: 'Hệ thống' },
] as const;

/**
 * Every page sits behind the account's role (ADR 0027): signed out, the console sends people to the hub to sign in;
 * without a role it says how one is granted. The API decides on every request — this only explains its answers.
 */
export function Shell() {
  const me = useQuery({ queryKey: ['admin', 'me'], queryFn: admin.me, retry: false });

  if (me.isPending) {
    return (
      <Centered>
        <p className="text-ink-soft">Đang tải…</p>
      </Centered>
    );
  }

  if (me.isError) {
    return me.error instanceof ApiError && me.error.status === 401 ? (
      <Centered>
        <p className="text-ink">Hãy đăng nhập Tò He trước, rồi quay lại trang này.</p>
        <a href="/welcome" className="font-semibold text-brand-ink underline underline-offset-4">
          Đăng nhập
        </a>
      </Centered>
    ) : (
      <Centered>
        <p role="alert" className="text-danger">
          Không tải được trang quản trị.
        </p>
        <button
          type="button"
          onClick={() => void me.refetch()}
          className="rounded-xl bg-soft px-4 py-2 font-semibold text-ink"
        >
          Thử lại
        </button>
      </Centered>
    );
  }

  if (me.data.role === null) {
    return (
      <Centered>
        <p className="text-ink">Tài khoản {me.data.email ?? me.data.displayName} chưa có vai trò quản trị.</p>
        <p className="text-ink-soft text-sm">
          Người vận hành cấp vai trò trong container của API:{' '}
          <code className="break-all rounded bg-soft px-1">
            dotnet Tohe.Api.dll admin grant &lt;email&gt; --role owner
          </code>
        </p>
        <a href="/" className="font-semibold text-brand-ink underline underline-offset-4">
          Về Tò He
        </a>
      </Centered>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="border-line border-b bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <span className="font-bold text-brand-ink text-lg">Tò He · Quản trị</span>
          <nav aria-label="Trang quản trị" className="flex flex-wrap gap-1">
            {pages.map((page) => (
              <Link
                key={page.to}
                to={page.to}
                activeOptions={{ exact: page.to === '/', includeSearch: false }}
                className="rounded-xl px-3 py-1.5 font-semibold text-ink-soft hover:bg-soft"
                activeProps={{ className: 'bg-soft text-ink', 'aria-current': 'page' }}
              >
                {page.label}
              </Link>
            ))}
          </nav>
          <span className="ml-auto text-ink-soft text-sm">
            {me.data.displayName} · {roleName(me.data.role)}
          </span>
          <a href="/" className="font-semibold text-brand-ink text-sm underline underline-offset-4">
            Về Tò He
          </a>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-4 px-6">
      <h1 className="font-bold text-2xl text-ink">Tò He · Quản trị</h1>
      {children}
    </main>
  );
}
