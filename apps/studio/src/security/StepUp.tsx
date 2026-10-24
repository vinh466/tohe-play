import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { studio } from '../api/client.ts';
import { Button, Field, problem } from '../ui/forms.tsx';
import { meKey } from './Gate.tsx';

/**
 * Step-up in the Studio's session (ADR 0051), as the console asks for it: a fresh code from the authenticator — never
 * the password — opens the review actions for ten minutes, in this Studio session only. The API answers who is signed
 * in, with until when step-up is open; the page then shows its actions.
 */
export function StepUp({ why }: { why: string }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const confirm = useMutation({
    mutationFn: () => studio.stepUp(code.trim()),
    onSuccess: (me) => {
      setCode('');
      queryClient.setQueryData(meKey, me);
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    confirm.mutate();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3" aria-label="Xác nhận lại để xét duyệt">
      <p className="text-ink-soft text-sm">{why}</p>
      <Field
        label="Mã 6 số từ ứng dụng xác thực"
        hint="Mở các nút xét duyệt trong 10 phút."
        inputMode="numeric"
        autoComplete="one-time-code"
        spellCheck={false}
        value={code}
        onChange={(event) => setCode(event.target.value)}
        error={confirm.isError ? problem(confirm.error) : null}
      />
      <Button type="submit" className="w-fit" busy={confirm.isPending} disabled={!code.trim()}>
        Xác nhận
      </Button>
    </form>
  );
}
