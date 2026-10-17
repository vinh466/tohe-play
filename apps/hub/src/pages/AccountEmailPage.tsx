import { useMutation } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { account } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { RequireSession } from '../session/RequireSession.tsx';
import { useSetMe } from '../session/useSession.ts';
import { Loading, Screen } from '../ui/Screen.tsx';

/** The link in the "Xác nhận email mới" email (ADR 0024): only the account that asked, signed in, can use it. */
export function AccountEmailPage() {
  return <RequireSession need="account">{() => <ConfirmFromLink />}</RequireSession>;
}

function ConfirmFromLink() {
  const { t } = useTranslation();
  const { attempt, code } = useSearch({ from: '/account/email' });
  const setMe = useSetMe();
  const confirm = useMutation({
    mutationFn: () => account.confirmEmailChange(attempt, code),
    onSuccess: setMe,
  });

  const started = useRef(false);
  const run = confirm.mutate;
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
  }, [run]);

  if (confirm.isPending || confirm.isIdle) return <Loading label={t('code.confirming')} />;
  return (
    <Screen narrow>
      <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 text-center shadow-sm">
        {confirm.isSuccess ? (
          <p role="status" className="text-ink">
            {t('account.emailDone', { email: confirm.data.account.email })}
          </p>
        ) : (
          <p role="alert" className="text-danger">
            {t(errorKey(confirm.error))}
          </p>
        )}
        <Link
          to="/account"
          search={{ add: false }}
          className="font-bold text-brand-ink underline underline-offset-4"
        >
          {t('account.title')}
        </Link>
      </section>
    </Screen>
  );
}
