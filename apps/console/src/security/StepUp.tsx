import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { admin } from '../api/client.ts';
import { Button, Field, problem } from '../ui/forms.tsx';

/**
 * Step-up level 2 (ADR 0025) in the console's session (ADR 0042): the password again, or a code from the
 * authenticator. It opens what changes something for ten minutes, in this console session only.
 */
export function StepUp({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'password' | 'code'>('password');
  const [value, setValue] = useState('');
  const confirm = useMutation({
    mutationFn: () => admin.stepUp(mode === 'password' ? { password: value } : { code: value }),
    onSuccess: onDone,
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    confirm.mutate();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {mode === 'password' ? (
        <Field
          label="Mật khẩu của bạn"
          type="password"
          autoComplete="current-password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          error={confirm.isError ? problem(confirm.error) : null}
        />
      ) : (
        <Field
          label="Mã 6 số từ ứng dụng xác thực"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          error={confirm.isError ? problem(confirm.error) : null}
        />
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" busy={confirm.isPending} disabled={!value.trim()}>
          Xác nhận
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            confirm.reset();
            setValue('');
            setMode(mode === 'password' ? 'code' : 'password');
          }}
        >
          {mode === 'password' ? 'Dùng mã từ ứng dụng xác thực' : 'Dùng mật khẩu'}
        </Button>
      </div>
    </form>
  );
}
