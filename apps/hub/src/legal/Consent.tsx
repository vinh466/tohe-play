import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { account, auth, type MeView } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { entry } from '../entry/intent.ts';
import { useSetMe } from '../session/useSession.ts';
import { db } from '../storage/db.ts';
import { Button } from '../ui/Button.tsx';
import { Screen } from '../ui/Screen.tsx';
import { TERMS_VERSION } from './documents.ts';

/**
 * "Tôi từ 16 tuổi trở lên và đồng ý…" (ADR 0025). The documents open in a new tab, so a half-filled form stays.
 */
export function ConsentCheckbox({
  checked,
  onChange,
  error,
}: {
  checked: boolean;
  onChange(checked: boolean): void;
  error?: string | null;
}) {
  const { t } = useTranslation();
  const link = 'font-semibold text-accent underline underline-offset-2';
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-start gap-3 text-ink">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={error ? true : undefined}
          className="mt-1 size-6 shrink-0 accent-brand"
        />
        <span>
          {t('consent.agree')}{' '}
          <a href="/terms" target="_blank" rel="noopener" className={link}>
            {t('legal.terms')}
          </a>{' '}
          {t('consent.and')}{' '}
          <a href="/privacy" target="_blank" rel="noopener" className={link}>
            {t('legal.privacy')}
          </a>
          .
        </span>
      </label>
      {error ? <p className="text-danger text-sm">{error}</p> : null}
    </div>
  );
}

/** The account accepted older terms, or none (an account from before): it accepts these before playing on. */
export function TermsPrompt({ me }: { me: MeView }) {
  const { t } = useTranslation();
  const setMe = useSetMe();
  const [agreed, setAgreed] = useState(false);
  const accept = useMutation({ mutationFn: () => account.acceptTerms(TERMS_VERSION), onSuccess: setMe });
  // Signing out is a choice: it leads to the sign-in screen, not on into a device profile. A full load, so the
  // screen that asked for a player does not take the signed-out device for a visitor and play it as a device profile.
  const signOut = useMutation({
    mutationFn: () => auth.logout(),
    onSettled: async () => {
      // Whoever signs in next on this device did not come for this tab's entry (ADR 0044).
      entry.forget();
      await db.cache.delete('me');
      window.location.assign('/account/sign-in');
    },
  });
  return (
    <Screen narrow>
      <section className="mt-8 flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm">
        <h1 className="font-black text-2xl text-brand-ink">
          {me.account.termsVersion ? t('terms.updatedTitle') : t('terms.title')}
        </h1>
        <p className="text-ink">{t('terms.body')}</p>
        <ConsentCheckbox checked={agreed} onChange={setAgreed} />
        {accept.isError ? (
          <p role="alert" className="text-danger">
            {t(errorKey(accept.error))}
          </p>
        ) : null}
        <Button disabled={!agreed} busy={accept.isPending} onClick={() => accept.mutate()}>
          {t('terms.accept')}
        </Button>
      </section>
      <Button variant="ghost" busy={signOut.isPending} onClick={() => signOut.mutate()}>
        {t('profiles.signOut')}
      </Button>
    </Screen>
  );
}
