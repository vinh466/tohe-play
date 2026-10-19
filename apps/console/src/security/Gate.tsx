// The console's own sign-in (ADR 0027, 0042): the email, the password and a code from the authenticator, on the
// console's host — a session of its own, apart from the hub's. And the claim of a new deployment's first owner, at
// /setup. The authenticator itself is added in the hub, on the account's page.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type FormEvent, type ReactNode, useState } from 'react';
import { admin } from '../api/client.ts';
import { hubLink, useHubUrl } from '../hub.ts';
import { Button, Field, problem } from '../ui/forms.tsx';

export const meKey = ['admin', 'me'] as const;

export function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-4 px-6 py-10">
      <h1 className="font-bold text-2xl text-ink">Tò He · Quản trị</h1>
      {children}
    </main>
  );
}

const linkClass = 'font-semibold text-brand-ink underline underline-offset-4';

/** A page of the hub, when the deployment says where the hub is. */
function HubLink({ path, children }: { path: string; children: ReactNode }) {
  const hubUrl = useHubUrl();
  return hubUrl ? (
    <a href={hubLink(hubUrl, path)} className={linkClass}>
      {children}
    </a>
  ) : null;
}

const signInReasons = {
  invalid_credentials: 'Email, mật khẩu hoặc mã không đúng.',
  account_suspended: 'Tài khoản này đang bị tạm khoá.',
  account_deleting: 'Tài khoản này đang chờ xoá. Đăng nhập Tò He để giữ lại, rồi quay lại đây.',
};

/** Signing in to the console: the email, the password, and a code from the authenticator — or a recovery code. */
export function SignIn() {
  const queryClient = useQueryClient();
  const setup = useQuery({ queryKey: ['admin', 'setup'], queryFn: admin.setup });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const signIn = useMutation({
    mutationFn: () =>
      admin.signIn(recovery ? { email, password, recoveryCode: code } : { email, password, code }),
    onSuccess: (me) => {
      queryClient.setQueryData(meKey, me);
      void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[1] !== 'me' });
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    signIn.mutate();
  };
  return (
    <Centered>
      {setup.data?.open ? (
        <p className="text-ink">
          Tò He mới cài và chưa có chủ.{' '}
          <Link to="/setup" className={linkClass}>
            Nhận quyền chủ
          </Link>
        </p>
      ) : null}
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
          inputMode={recovery ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          spellCheck={false}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          error={signIn.isError ? problem(signIn.error, signInReasons) : null}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" busy={signIn.isPending} disabled={!email.trim() || !password || !code.trim()}>
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
        Bảng quản trị có phiên đăng nhập riêng, dài 12 giờ: đăng nhập Tò He không mở nó. Chỉ tài khoản có vai
        trò quản trị và đã thêm ứng dụng xác thực ở trang Tài khoản của Tò He mới vào được.
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <HubLink path="/account">Tài khoản Tò He</HubLink>
        <HubLink path="/account/password/forgot">Quên mật khẩu</HubLink>
      </div>
    </Centered>
  );
}

/**
 * /setup — a new deployment's first owner (ADR 0027): the setup token from the API's log, with the email and password
 * of an account in the hub. No console session starts: the authenticator comes first, in the hub.
 */
export function SetupPage() {
  const setup = useQuery({ queryKey: ['admin', 'setup'], queryFn: admin.setup });
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const claim = useMutation({ mutationFn: () => admin.claimSetup({ token, email, password }) });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    claim.mutate();
  };

  if (claim.isSuccess) {
    return (
      <Centered>
        <p className="font-semibold text-ink">Tài khoản {email} đã là chủ của Tò He.</p>
        <p className="text-ink">
          Bước tiếp theo: mở trang Tài khoản của Tò He, xác nhận lại mật khẩu và thêm ứng dụng xác thực. Sau
          đó quay lại đây đăng nhập bằng email, mật khẩu và mã 6 số của ứng dụng.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <HubLink path="/account">Thêm ứng dụng xác thực</HubLink>
          <Link to="/" className={linkClass}>
            Đăng nhập bảng quản trị
          </Link>
        </div>
      </Centered>
    );
  }

  if (setup.isPending) {
    return (
      <Centered>
        <p className="text-ink-soft">Đang tải…</p>
      </Centered>
    );
  }

  if (!setup.data?.open) {
    return (
      <Centered>
        <p className="text-ink">Tò He đã có chủ.</p>
        <Link to="/" className={linkClass}>
          Đăng nhập bảng quản trị
        </Link>
      </Centered>
    );
  }

  return (
    <Centered>
      <p className="text-ink">
        Tò He mới cài và chưa có chủ. Nhập mã cài đặt cùng email và mật khẩu của tài khoản Tò He sẽ thành chủ.
      </p>
      <p className="text-ink-soft text-sm">
        Mã nằm trong log của API khi khởi động (dòng “No platform owner yet”), hoặc là giá trị
        Admin:SetupToken.
        {setup.data.onlySomeEmails ? ' Chỉ những email người vận hành đã định mới nhận được quyền chủ.' : ''}
      </p>
      <form onSubmit={submit} className="flex w-full flex-col gap-3">
        <Field
          label="Mã cài đặt"
          autoComplete="off"
          spellCheck={false}
          value={token}
          onChange={(event) => setToken(event.target.value)}
        />
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
          error={claim.isError ? problem(claim.error, signInReasons) : null}
        />
        <Button type="submit" busy={claim.isPending} disabled={!token.trim() || !email.trim() || !password}>
          Nhận quyền chủ
        </Button>
      </form>
      <p className="text-ink-soft text-sm">
        Chưa có tài khoản? <HubLink path="/account/register">Đăng ký ở Tò He</HubLink>
      </p>
    </Centered>
  );
}

/**
 * Who is signed in, for a page inside the shell — which shows the sign-in instead of any page while nobody is, so a
 * missing session here is an error of the page.
 */
export function useSignedIn() {
  return useQuery({
    queryKey: meKey,
    queryFn: admin.me,
    select: (me) => {
      if (me === null) throw new Error('No console session');
      return me;
    },
  });
}

/**
 * The console's session is over — signed out, or two-factor authentication turned off: the sign-in takes the page's
 * place first, so no page asks again without a session, then every page's data goes.
 */
export function useSessionEnded() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.setQueryData(meKey, null);
    queryClient.removeQueries({
      predicate: (query) => !['me', 'config'].includes(String(query.queryKey[1])),
    });
  };
}
