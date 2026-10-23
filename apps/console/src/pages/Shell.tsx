import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, Outlet } from '@tanstack/react-router';
import { admin } from '../api/client.ts';
import { roleName } from '../format.ts';
import { hubLink, useHubUrl } from '../hub.ts';
import { Centered, meKey, SignIn, useSessionEnded } from '../security/Gate.tsx';
import { Button } from '../ui/forms.tsx';

const pages = [
  { to: '/', label: 'Tổng quan' },
  { to: '/games', label: 'Game' },
  { to: '/health', label: 'Sức khoẻ thiết bị' },
  { to: '/system', label: 'Hệ thống' },
] as const;

/**
 * Every page but /setup sits behind the console's own session (ADR 0027, 0042): signed in here with the password and a
 * code from the authenticator, by an account that holds a role. Without one — or once it ended — the sign-in takes the
 * page's place. The router's layout of those pages (router.tsx), so a page renders only inside it. The API checks it
 * all on every request; this only explains its answers.
 */
export function Shell() {
  const me = useQuery({ queryKey: meKey, queryFn: admin.me, retry: false });
  const hubUrl = useHubUrl();
  // The console's session only; the hub's stays.
  const signOut = useMutation({ mutationFn: admin.endSession, onSuccess: useSessionEnded() });

  if (me.isPending) {
    return (
      <Centered>
        <p className="text-ink-soft">Đang tải…</p>
      </Centered>
    );
  }

  if (me.data === null) return <SignIn />;

  if (me.isError) {
    return (
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

  const mayAudit = me.data.permissions.includes('admin.audit.read');
  const mayUsers = me.data.permissions.includes('admin.users.read');
  const mayReview = me.data.permissions.includes('admin.results.review');
  const mayAgents = me.data.permissions.includes('admin.agents.read');
  return (
    <div className="min-h-dvh">
      <header className="border-line border-b bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
          <span className="font-bold text-brand-ink text-lg">Tò He · Quản trị</span>
          <nav aria-label="Trang quản trị" className="flex flex-wrap gap-1">
            {[
              ...pages,
              ...(mayUsers ? [{ to: '/users', label: 'Người dùng' } as const] : []),
              ...(mayReview ? [{ to: '/review', label: 'Xem xét kết quả' } as const] : []),
              ...(mayUsers ? [{ to: '/links', label: 'Link chia sẻ' } as const] : []),
              { to: '/communities', label: 'Cộng đồng' } as const,
              { to: '/settings', label: 'Đăng nhập & đăng ký' } as const,
              ...(mayUsers ? [{ to: '/studio', label: 'Studio' } as const] : []),
              ...(mayAgents ? [{ to: '/agents', label: 'Agent' } as const] : []),
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
          {hubUrl ? (
            <a
              href={hubLink(hubUrl, '/play')}
              className="font-semibold text-brand-ink text-sm underline underline-offset-4"
            >
              Về Tò He
            </a>
          ) : null}
          <Button
            variant="secondary"
            className="px-3 py-1 text-sm"
            busy={signOut.isPending}
            onClick={() => signOut.mutate()}
          >
            Đăng xuất
          </Button>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
