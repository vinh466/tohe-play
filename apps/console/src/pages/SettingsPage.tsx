import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { admin, type SignInMethod, type SignInSettings } from '../api/client.ts';
import { count } from '../format.ts';
import { meKey, useSignedIn } from '../security/Gate.tsx';
import { StepUp } from '../security/StepUp.tsx';
import { Button, problem } from '../ui/forms.tsx';
import { Badge, Card, Failed, Loading, PageTitle } from '../ui/ui.tsx';

const settingsKey = ['admin', 'settings'] as const;

const modes = [
  {
    id: 'open',
    label: 'Mở',
    hint: 'Ai cũng tạo được tài khoản. Mã mời, nếu có, đưa người mới vào cộng đồng của nó.',
  },
  {
    id: 'invite',
    label: 'Theo lời mời',
    hint: 'Chỉ ai có mã mời còn dùng được của một cộng đồng mới tạo được tài khoản.',
  },
  { id: 'closed', label: 'Đóng', hint: 'Không ai tạo được tài khoản mới. Ai đã có vẫn đăng nhập.' },
] as const;

/**
 * Sign-in and registration at run time (ADR 0028): which ways of signing in are on and who may make an account. The
 * deployment decides what exists, this page what is on. Changes ask for step-up level 2 first.
 */
export function SettingsPage() {
  const queryClient = useQueryClient();
  const me = useSignedIn();
  const settings = useQuery({ queryKey: settingsKey, queryFn: admin.signInSettings });

  if (me.isPending || settings.isPending) return <Loading />;
  if (me.isError || settings.isError) return <Failed retry={() => void settings.refetch()} />;

  const mayChange = me.data.permissions.includes('admin.settings.write');
  const secure = Boolean(me.data.secureUntil);
  const show = (next: SignInSettings) => queryClient.setQueryData(settingsKey, next);
  return (
    <>
      <PageTitle title="Đăng nhập & đăng ký" aside="Áp dụng ngay cho cả Tò He" />
      {mayChange && !secure ? (
        <Card title="Thay đổi">
          <p className="text-ink-soft text-sm">Để bật, tắt hay đổi chế độ đăng ký, xác nhận lại là bạn.</p>
          <StepUp onDone={() => void queryClient.invalidateQueries({ queryKey: meKey })} />
        </Card>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Methods settings={settings.data} canChange={mayChange && secure} onChange={show} />
        <Registration settings={settings.data} canChange={mayChange && secure} onChange={show} />
        <ProofOfWork settings={settings.data} canChange={mayChange && secure} onChange={show} />
      </div>
    </>
  );
}

function Methods({
  settings,
  canChange,
  onChange,
}: {
  settings: SignInSettings;
  canChange: boolean;
  onChange: (next: SignInSettings) => void;
}) {
  // Switching off a method some accounts sign in by alone asks once more.
  const [confirming, setConfirming] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) =>
      admin.saveSignInSettings({ methods: { [id]: on } }),
    onSuccess: (next) => {
      setConfirming(null);
      onChange(next);
    },
  });
  const turn = (method: SignInMethod, on: boolean) => {
    if (!on && method.onlyWayIn > 0 && confirming !== method.id) {
      setConfirming(method.id);
      return;
    }
    save.mutate({ id: method.id, on });
  };
  return (
    <Card title="Cách đăng nhập">
      {save.isError ? (
        <p role="alert" className="text-danger">
          {problem(save.error)}
        </p>
      ) : null}
      <ul className="flex flex-col gap-4">
        {settings.methods.map((method) => (
          <li
            key={method.id}
            className="flex flex-col gap-2 border-line border-b pb-4 last:border-0 last:pb-0"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="font-semibold text-ink">{method.name}</span>
              {!method.configured ? (
                <Badge tone="notice">Chưa cấu hình</Badge>
              ) : method.on ? (
                <Badge>Đang bật</Badge>
              ) : (
                <Badge tone="danger">Đang tắt</Badge>
              )}
              {canChange && method.configured ? (
                <Button
                  variant={method.on ? 'secondary' : 'primary'}
                  className="ml-auto"
                  busy={save.isPending && save.variables?.id === method.id}
                  onClick={() => turn(method, !method.on)}
                >
                  {method.on ? 'Tắt' : 'Bật'}
                </Button>
              ) : null}
            </div>
            <p className="text-ink-soft text-sm">{describe(method)}</p>
            {confirming === method.id ? (
              <div className="flex flex-col gap-2 rounded-xl border border-danger-line p-3">
                <p className="text-danger text-sm">
                  {count(method.onlyWayIn)} tài khoản chỉ đăng nhập bằng{' '}
                  {method.id === 'password' ? 'email và mật khẩu' : method.name}: tắt thì họ không vào được
                  cho tới khi bật lại.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="danger" busy={save.isPending} onClick={() => turn(method, false)}>
                    Vẫn tắt
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirming(null)}>
                    Thôi
                  </Button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function describe(method: SignInMethod): string {
  if (!method.configured) return 'Máy chủ chưa có khoá của nhà cung cấp này, nên chưa bật được.';
  const what =
    method.id === 'password'
      ? 'Đăng nhập, quên mật khẩu và đăng ký bằng email.'
      : `Đăng nhập và đăng ký bằng tài khoản ${method.name}.`;
  const alone =
    method.onlyWayIn > 0
      ? `${count(method.onlyWayIn)} tài khoản chỉ đăng nhập bằng cách này.`
      : 'Không tài khoản nào chỉ dựa vào cách này.';
  return `${what} ${alone}`;
}

function Registration({
  settings,
  canChange,
  onChange,
}: {
  settings: SignInSettings;
  canChange: boolean;
  onChange: (next: SignInSettings) => void;
}) {
  const [mode, setMode] = useState(settings.registration);
  const save = useMutation({
    mutationFn: () => admin.saveSignInSettings({ registration: mode }),
    onSuccess: onChange,
  });
  const passwordOn = settings.methods.some((method) => method.id === 'password' && method.on);
  const providersOn = settings.methods.some((method) => method.id !== 'password' && method.on);
  // Signing up by email needs the password on and email sent; say what that leaves.
  const byEmail = passwordOn && settings.email;
  return (
    <Card title="Đăng ký">
      <fieldset disabled={!canChange} className="flex flex-col gap-2">
        <legend className="sr-only">Ai tạo được tài khoản mới</legend>
        {modes.map((option) => (
          <label
            key={option.id}
            className="flex gap-3 rounded-xl border border-line p-3 has-checked:border-brand-strong"
          >
            <input
              type="radio"
              name="registration"
              value={option.id}
              checked={mode === option.id}
              onChange={() => setMode(option.id)}
              className="mt-1 accent-brand-strong"
            />
            <span className="flex flex-col">
              <span className="font-semibold text-ink">
                {option.label}
                {settings.registration === option.id ? ' · đang dùng' : ''}
              </span>
              <span className="text-ink-soft text-sm">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {settings.registration !== 'closed' && !byEmail ? (
        <p className="rounded-xl bg-notice px-3 py-2 text-notice-ink text-sm">
          {providersOn ? 'Đăng ký bằng email đang không dùng được' : 'Hiện không có cách nào để đăng ký'}
          {passwordOn ? ': máy chủ chưa gửi email.' : ': đăng nhập bằng mật khẩu đang tắt.'}
          {providersOn ? ' Người mới chỉ đăng ký qua các nhà cung cấp đang bật.' : ''}
        </p>
      ) : null}
      {save.isError ? (
        <p role="alert" className="text-danger">
          {problem(save.error)}
        </p>
      ) : null}
      {canChange ? (
        <Button busy={save.isPending} disabled={mode === settings.registration} onClick={() => save.mutate()}>
          Lưu chế độ đăng ký
        </Button>
      ) : null}
    </Card>
  );
}

/**
 * The proof-of-work before a code by email (ADR 0037, E-09): off by default — launch is by invite — and on before
 * registration opens to everyone.
 */
function ProofOfWork({
  settings,
  canChange,
  onChange,
}: {
  settings: SignInSettings;
  canChange: boolean;
  onChange: (next: SignInSettings) => void;
}) {
  const save = useMutation({
    mutationFn: (on: boolean) => admin.saveSignInSettings({ proofOfWork: on }),
    onSuccess: onChange,
  });
  return (
    <Card title="Chống bot đăng ký">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-semibold text-ink">Thiết bị giải một bài toán nhỏ</span>
        {settings.proofOfWork ? <Badge>Đang bật</Badge> : <Badge tone="danger">Đang tắt</Badge>}
        {canChange ? (
          <Button
            variant={settings.proofOfWork ? 'secondary' : 'primary'}
            className="ml-auto"
            busy={save.isPending}
            onClick={() => save.mutate(!settings.proofOfWork)}
          >
            {settings.proofOfWork ? 'Tắt' : 'Bật'}
          </Button>
        ) : null}
      </div>
      <p className="text-ink-soft text-sm">
        Trước khi đăng ký hay xin mã đặt lại mật khẩu, máy của người dùng tính khoảng nửa giây; bot gửi hàng
        nghìn yêu cầu thì tốn hàng nghìn lần như thế. Không gửi gì ra ngoài Tò He. Nên bật trước khi mở đăng
        ký cho mọi người.
      </p>
      {save.isError ? (
        <p role="alert" className="text-danger">
          {problem(save.error)}
        </p>
      ) : null}
    </Card>
  );
}
