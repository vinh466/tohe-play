import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, type MeView, session } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { Button } from '../ui/Button.tsx';
import { Icon } from '../ui/Icon.tsx';
import { PinPad } from '../ui/PinPad.tsx';
import { StepUp } from './StepUp.tsx';
import { useSetMe } from './useSession.ts';

/**
 * Profile management opens with the account's manage PIN (step-up level 1, ADR 0025). Without one yet — or when it is
 * forgotten — the owner proves it is them (level 2), which opens it too and lets them set the PIN. Used by Quản lý tài
 * khoản and before bringing device profiles into the account (ADR 0043).
 */
export function ParentGate({ me, title, body }: { me: MeView; title?: string; body?: string }) {
  const { t } = useTranslation();
  const setMe = useSetMe();
  const queryClient = useQueryClient();
  const [forgot, setForgot] = useState(false);
  const [wrong, setWrong] = useState(0);
  const unlock = useMutation({
    mutationFn: (pin: string) => session.unlockParentGate(pin),
    onSuccess: setMe,
    onError: async (error) => {
      setWrong((n) => n + 1);
      if (error instanceof ApiError && error.code === 'parent_gate_required') {
        await queryClient.invalidateQueries({ queryKey: ['me'] });
      }
    },
  });
  const usePin = me.account.hasManagePin && !forgot;
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-3xl bg-surface p-6 shadow-sm">
      <Icon name="lock-key" weight="fill" className="mx-auto text-5xl text-accent" />
      <h2 className="text-center font-black text-2xl text-ink">{title ?? t('account.gateTitle')}</h2>
      {usePin ? (
        <>
          <p className="text-center text-ink-soft">
            {body ?? t('account.gateBody', { name: me.account.displayName })}
          </p>
          <PinPad
            length={6}
            errorKey={wrong}
            error={unlock.isError ? t(errorKey(unlock.error)) : null}
            disabled={unlock.isPending}
            onComplete={(pin) => unlock.mutate(pin)}
          />
          <Button variant="ghost" onClick={() => setForgot(true)}>
            {t('managePin.forgot')}
          </Button>
        </>
      ) : (
        <>
          <p className="text-center text-ink-soft">{body ?? t('managePin.firstBody')}</p>
          <StepUp me={me} onDone={setMe} />
        </>
      )}
    </section>
  );
}
