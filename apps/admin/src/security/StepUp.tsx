import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { stepUp } from '../api/client.ts';
import { Button, Field, problem } from '../ui/forms.tsx';

/**
 * Step-up level 2 (ADR 0025), as in the hub: the password, or a code sent to the account's email — the only way for an
 * account made with Google or GitHub. It opens account security on this device for ten minutes.
 */
export function StepUp({
  hasPassword,
  email,
  onDone,
}: {
  hasPassword: boolean;
  email: string | null;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<'password' | 'code'>(hasPassword ? 'password' : 'code');
  const [password, setPassword] = useState('');
  const [attempt, setAttempt] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const byPassword = useMutation({ mutationFn: () => stepUp.password(password), onSuccess: onDone });
  const send = useMutation({ mutationFn: stepUp.sendCode, onSuccess: setAttempt });
  const byCode = useMutation({ mutationFn: () => stepUp.confirm(attempt ?? '', code), onSuccess: onDone });

  if (mode === 'password') {
    const submit = (event: FormEvent) => {
      event.preventDefault();
      byPassword.mutate();
    };
    return (
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field
          label="Mật khẩu của bạn"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={byPassword.isError ? problem(byPassword.error) : null}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" busy={byPassword.isPending} disabled={!password}>
            Xác nhận
          </Button>
          {email ? (
            <Button variant="secondary" onClick={() => setMode('code')}>
              Gửi mã qua email thay cho mật khẩu
            </Button>
          ) : null}
        </div>
      </form>
    );
  }

  if (!attempt) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-ink">
          Tò He sẽ gửi một mã tới {email ?? 'email của tài khoản'} để xác nhận là bạn.
        </p>
        {send.isError ? (
          <p role="alert" className="text-danger">
            {problem(send.error)}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button busy={send.isPending} onClick={() => send.mutate()}>
            Gửi mã
          </Button>
          {hasPassword ? (
            <Button variant="secondary" onClick={() => setMode('password')}>
              Dùng mật khẩu
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    byCode.mutate();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field
        label={`Mã đã gửi tới ${email ?? 'email của bạn'}`}
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        error={byCode.isError ? problem(byCode.error) : null}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" busy={byCode.isPending} disabled={!code.trim()}>
          Xác nhận
        </Button>
        <Button variant="secondary" busy={send.isPending} onClick={() => send.mutate()}>
          Gửi lại mã
        </Button>
      </div>
    </form>
  );
}
