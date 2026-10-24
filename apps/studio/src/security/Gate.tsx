// The Studio's own sign-in (ADR 0051): the email, the password and — for a reviewer always, for anyone with two-factor
// authentication on — a code from the authenticator, on the Studio's host. A session of its own, apart from the hub's
// and the console's. The authenticator itself is added in the hub, on the account's page.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { type StudioMe, studio } from '../api/client.ts';
import { hubLink, useHubUrl } from '../hub.ts';
import { Button, Field, problem } from '../ui/forms.tsx';

export const meKey = ['studio', 'me'] as const;

/** The query keys asked before anyone signs in, and answered then without a 401. */
export const anonymousKeys: readonly string[] = ['me', 'config'];

/** Who is signed in to the Studio: null when nobody is. */
export function useMe() {
  return useQuery({ queryKey: meKey, queryFn: studio.me, retry: false });
}

/**
 * Who is signed in, for a page inside the shell — which renders its pages only once the answer came — or null. What a
 * page shows by it is only what the session may do; the API decides.
 */
export function useSignedIn(): StudioMe | null {
  return useMe().data ?? null;
}

export function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-4 px-6 py-10">
      <h1 className="font-bold text-2xl text-ink">Tò He · Studio</h1>
      {children}
    </main>
  );
}

const linkClass = 'font-semibold text-brand-ink underline underline-offset-4';

/**
 * /sign-in — the Studio's sign-in, then back to `redirect` (a page of this host, `safeRedirect`) or the library. Someone
 * already signed in goes straight there.
 */
export function SignInPage({ redirect }: { redirect: string | undefined }) {
  const me = useMe();
  if (me.data) return <GoTo href={redirect ?? '/'} />;
  return (
    <Centered>
      {me.isPending ? <p className="text-ink-soft">Đang tải…</p> : <SignInForm redirect={redirect} />}
    </Centered>
  );
}

/** Goes on to a page of this host given as a whole path (with its query), in place of this one. */
function GoTo({ href }: { href: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate({ href, replace: true });
  }, [navigate, href]);
  return null;
}

const signInReasons = {
  // A reviewer always gives a code, and so does anyone with two-factor authentication on.
  invalid_credentials: 'Email, mật khẩu hoặc mã không đúng. Tài khoản đã bật xác thực hai lớp cần mã 6 số.',
};

function SignInForm({ redirect }: { redirect: string | undefined }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const hubUrl = useHubUrl();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const signIn = useMutation({
    mutationFn: () => {
      const proof = code.trim() ? (recovery ? { recoveryCode: code.trim() } : { code: code.trim() }) : {};
      return studio.signIn({ email, password, ...proof });
    },
    onSuccess: (me) => {
      queryClient.setQueryData(meKey, me);
      void queryClient.invalidateQueries({
        predicate: (query) => !anonymousKeys.includes(String(query.queryKey[1])),
      });
      void navigate({ href: redirect ?? '/', replace: true });
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    signIn.mutate();
  };
  return (
    <>
      <form onSubmit={submit} className="flex w-full flex-col gap-3">
        <Field
          label="Email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Field
          label="Mật khẩu"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Field
          label={recovery ? 'Một mã dự phòng' : 'Mã 6 số từ ứng dụng xác thực'}
          hint={recovery ? undefined : 'Khi tài khoản đã bật xác thực hai lớp. Người duyệt luôn cần mã.'}
          inputMode={recovery ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          spellCheck={false}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          error={signIn.isError ? problem(signIn.error, signInReasons) : null}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" busy={signIn.isPending} disabled={!email.trim() || !password}>
            Đăng nhập
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              signIn.reset();
              setCode('');
              setRecovery(!recovery);
            }}
          >
            {recovery ? 'Dùng ứng dụng xác thực' : 'Dùng mã dự phòng'}
          </Button>
        </div>
      </form>
      <p className="text-ink-soft text-sm">
        Studio có phiên đăng nhập riêng, dài 12 giờ: đăng nhập Tò He không mở nó. Chỉ tài khoản được giao vai
        trò ở Studio mới vào được.
      </p>
      {hubUrl ? (
        <a href={hubLink(hubUrl, '/account/password/forgot')} className={linkClass}>
          Quên mật khẩu?
        </a>
      ) : null}
    </>
  );
}

/**
 * The Studio's session is over — signed out, or ended by the API: who is signed in becomes nobody first, so the gate
 * sends the browser to the sign-in before any page asks again, then every page's data goes.
 */
export function useSessionEnded() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.setQueryData(meKey, null);
    queryClient.removeQueries({ predicate: (query) => !anonymousKeys.includes(String(query.queryKey[1])) });
  };
}
