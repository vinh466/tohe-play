import { useQuery } from '@tanstack/react-query';
import { Link, Outlet } from '@tanstack/react-router';
import { ApiError, admin } from '../api/client.ts';
import { roleName } from '../format.ts';
import { Centered, meKey, NoRole, TwoFactorCheck, TwoFactorSetup } from '../security/Gate.tsx';

const pages = [
  { to: '/', label: 'Tổng quan' },
  { to: '/games', label: 'Game' },
  { to: '/health', label: 'Sức khoẻ thiết bị' },
  { to: '/system', label: 'Hệ thống' },
] as const;

/**
 * Every page sits behind the account (ADR 0027): signed in, with a role, two-factor authentication on, and a code
 * given on this device. The console walks people through each; the API checks all of them on every request — this only
 * explains its answers.
 */
export function Shell() {
  const me = useQuery({ queryKey: meKey, queryFn: admin.me, retry: false });

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

  if (me.data.role === null) return <NoRole me={me.data} />;
  if (!me.data.twoFactorEnabled) return <TwoFactorSetup me={me.data} />;
  if (!me.data.openUntil) return <TwoFactorCheck />;

  const mayAudit = me.data.permissions.includes('admin.audit.read');
  return (
    <div className="min-h-dvh">
      <header className="border-line border-b bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <span className="font-bold text-brand-ink text-lg">Tò He · Quản trị</span>
          <nav aria-label="Trang quản trị" className="flex flex-wrap gap-1">
            {[
              ...pages,
              ...(mayAudit ? [{ to: '/audit', label: 'Nhật ký' } as const] : []),
              { to: '/security', label: 'Bảo mật' } as const,
            ].map((page) => (
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
