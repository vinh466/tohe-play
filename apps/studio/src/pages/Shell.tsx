import { useMutation } from '@tanstack/react-query';
import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { studio } from '../api/client.ts';
import { roleName } from '../format.ts';
import { hubLink, useHubUrl } from '../hub.ts';
import { Centered, useMe, useSessionEnded } from '../security/Gate.tsx';
import { Button } from '../ui/forms.tsx';

const pages = [
  { to: '/', label: 'Thư viện' },
  { to: '/styles', label: 'Phong cách' },
] as const;

/**
 * Every page but /sign-in sits behind the Studio's own session (ADR 0051): signed in here by an account that holds a
 * studio role. Without one — or once it ended — the browser goes to /sign-in, which brings it back to this page. The
 * router's layout of those pages (router.tsx), so a page renders, and asks the API for anything, only inside it. The
 * API checks it all on every request; this only follows its answers.
 */
export function Shell() {
  const me = useMe();
  const location = useLocation();
  const hubUrl = useHubUrl();
  // The Studio's session only; the hub's and the console's stay.
  const signOut = useMutation({ mutationFn: studio.endSession, onSuccess: useSessionEnded() });

  if (me.isPending) {
    return (
      <Centered>
        <p className="text-ink-soft">Đang tải…</p>
      </Centered>
    );
  }

  if (me.data === null) {
    return <ToSignIn from={location.href} />;
  }

  if (me.isError) {
    return (
      <Centered>
        <p role="alert" className="text-danger">
          Không tải được Studio.
        </p>
        <Button variant="secondary" onClick={() => void me.refetch()}>
          Thử lại
        </Button>
      </Centered>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="border-line border-b bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
          <span className="font-bold text-brand-ink text-lg">Tò He · Studio</span>
          <nav aria-label="Trang của Studio" className="flex flex-wrap gap-1">
            {pages.map((page) => (
              <Link
                key={page.to}
                to={page.to}
                activeOptions={{ exact: page.to === '/', includeSearch: false }}
                className="inline-flex min-h-11 items-center rounded-xl px-3 font-semibold text-ink-soft hover:bg-soft"
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
            className="text-sm"
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

/**
 * Goes to the sign-in once, which brings the browser back to `from`: the page as it was when the session was found
 * missing. Not the router's <Navigate>, which navigates again whenever its props are new: the shell renders again while
 * the router loads the sign-in — by then with the sign-in as its location — so the browser never got there, and the
 * page hung.
 */
function ToSignIn({ from }: { from: string }) {
  const navigate = useNavigate();
  const [redirect] = useState(from);
  useEffect(() => {
    void navigate({ to: '/sign-in', search: { redirect }, replace: true });
  }, [navigate, redirect]);
  return null;
}
