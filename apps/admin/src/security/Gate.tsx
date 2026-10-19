// The screens before the console opens (ADR 0027): no role yet — or, on a new deployment, the claim of its first
// owner — then two-factor authentication: set up once per account, a code once per device.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, type ReactNode, useState } from 'react';
import { type AdminMe, admin } from '../api/client.ts';
import { Button, Field, problem } from '../ui/forms.tsx';
import { QrCode } from '../ui/QrCode.tsx';
import { RecoveryCodes } from './RecoveryCodes.tsx';
import { StepUp } from './StepUp.tsx';

export const meKey = ['admin', 'me'] as const;

function useRefreshMe() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: meKey });
}

export function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-4 px-6 py-10">
      <h1 className="font-bold text-2xl text-ink">Tò He · Quản trị</h1>
      {children}
    </main>
  );
}

/** Signed in without a role: how one is granted — or, while the deployment has no owner, the claim of the first. */
export function NoRole({ me }: { me: AdminMe }) {
  const setup = useQuery({ queryKey: ['admin', 'setup'], queryFn: admin.setup });
  if (setup.data?.open) return <ClaimSetup onlySomeEmails={setup.data.onlySomeEmails} />;
  return (
    <Centered>
      <p className="text-ink">Tài khoản {me.email ?? me.displayName} chưa có vai trò quản trị.</p>
      <p className="text-ink-soft text-sm">
        Người vận hành cấp vai trò trong container của API:{' '}
        <code className="break-all rounded bg-soft px-1">
          dotnet Tohe.Api.dll admin grant &lt;email&gt; --role owner
        </code>
      </p>
      <a href="/play" className="font-semibold text-brand-ink underline underline-offset-4">
        Về Tò He
      </a>
    </Centered>
  );
}

function ClaimSetup({ onlySomeEmails }: { onlySomeEmails: boolean }) {
  const refresh = useRefreshMe();
  const [token, setToken] = useState('');
  const claim = useMutation({ mutationFn: () => admin.claimSetup(token), onSuccess: refresh });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    claim.mutate();
  };
  return (
    <Centered>
      <p className="text-ink">Tò He mới cài và chưa có chủ. Nhập mã cài đặt để tài khoản này thành chủ.</p>
      <p className="text-ink-soft text-sm">
        Mã nằm trong log của API khi khởi động (dòng “No platform owner yet”), hoặc là giá trị
        Admin:SetupToken.
        {onlySomeEmails ? ' Chỉ những email người vận hành đã định mới nhận được quyền chủ.' : ''}
      </p>
      <form onSubmit={submit} className="flex w-full flex-col gap-3">
        <Field
          label="Mã cài đặt"
          autoComplete="off"
          spellCheck={false}
          value={token}
          onChange={(event) => setToken(event.target.value)}
          error={claim.isError ? problem(claim.error) : null}
        />
        <Button type="submit" busy={claim.isPending} disabled={!token.trim()}>
          Nhận quyền chủ
        </Button>
      </form>
    </Centered>
  );
}

/** Two-factor authentication, once per account: step-up level 2, a new key in the authenticator, its first code. */
export function TwoFactorSetup({ me }: { me: AdminMe }) {
  const refresh = useRefreshMe();
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState('');
  const start = useMutation({ mutationFn: admin.setUpAuthenticator });
  const enable = useMutation({
    mutationFn: () => admin.enableTwoFactor(code),
    onSuccess: (result) => setCodes(result.codes),
    // Step-up lasts ten minutes; past it, the screen asks again.
    onError: refresh,
  });

  if (codes) {
    return (
      <Centered>
        <p className="font-semibold text-ink">Đã bật xác thực hai lớp.</p>
        <RecoveryCodes codes={codes} onDone={refresh} />
      </Centered>
    );
  }

  return (
    <Centered>
      <p className="text-ink">
        Bảng quản trị cần xác thực hai lớp: mỗi lần mở trên một thiết bị, bạn nhập thêm mã 6 số từ một ứng
        dụng xác thực (Google Authenticator, Microsoft Authenticator, 1Password…).
      </p>
      {!me.secureUntil ? (
        <>
          <p className="text-ink-soft text-sm">Trước hết, xác nhận lại là bạn.</p>
          <StepUp hasPassword={me.hasPassword} email={me.email} onDone={refresh} />
        </>
      ) : !start.data ? (
        <>
          {start.isError ? (
            <p role="alert" className="text-danger">
              {problem(start.error)}
            </p>
          ) : null}
          <Button busy={start.isPending} onClick={() => start.mutate()}>
            Tạo khoá cho ứng dụng xác thực
          </Button>
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            enable.mutate();
          }}
          className="flex w-full flex-col gap-3"
        >
          <p className="text-ink">Quét mã này bằng ứng dụng xác thực, hoặc gõ khoá bên dưới.</p>
          <QrCode text={start.data.uri} label="Mã QR của khoá xác thực" />
          <Field
            label="Khoá xác thực"
            mono
            readOnly
            spellCheck={false}
            value={start.data.sharedKey}
            onFocus={(event) => event.target.select()}
          />
          <Field
            label="Mã 6 số ứng dụng đang hiện"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            error={enable.isError ? problem(enable.error) : null}
          />
          <Button type="submit" busy={enable.isPending} disabled={!code.trim()}>
            Bật xác thực hai lớp
          </Button>
        </form>
      )}
    </Centered>
  );
}

/** A code from the authenticator — or a recovery code — opens the console on this device for twelve hours. */
export function TwoFactorCheck() {
  const refresh = useRefreshMe();
  const [recovery, setRecovery] = useState(false);
  const [value, setValue] = useState('');
  const verify = useMutation({
    mutationFn: () => admin.verifyTwoFactor(recovery ? { recoveryCode: value } : { code: value }),
    onSuccess: refresh,
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    verify.mutate();
  };
  return (
    <Centered>
      <form onSubmit={submit} className="flex w-full flex-col gap-3">
        <Field
          label={recovery ? 'Một mã dự phòng' : 'Mã 6 số từ ứng dụng xác thực'}
          inputMode={recovery ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          spellCheck={false}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          error={verify.isError ? problem(verify.error) : null}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" busy={verify.isPending} disabled={!value.trim()}>
            Mở bảng quản trị
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              verify.reset();
              setValue('');
              setRecovery(!recovery);
            }}
          >
            {recovery ? 'Dùng ứng dụng xác thực' : 'Dùng mã dự phòng'}
          </Button>
        </div>
      </form>
    </Centered>
  );
}
