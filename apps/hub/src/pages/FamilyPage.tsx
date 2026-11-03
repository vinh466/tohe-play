import { useMutation } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useReducer } from 'react';
import { useTranslation } from 'react-i18next';
import { type MeView, session } from '../api/client.ts';
import { currentLanguage } from '../i18n.ts';
import { fromApp, publicPage } from '../language/language.ts';
import { BackLink } from '../navigation/leave.tsx';
import { ParentGate } from '../session/ParentGate.tsx';
import { RequireSession } from '../session/RequireSession.tsx';
import { parentUnlocked } from '../session/session.ts';
import { useSetMe } from '../session/useSession.ts';
import { Avatar } from '../ui/AvatarGrid.tsx';
import { Button, buttonClass } from '../ui/Button.tsx';
import { Icon } from '../ui/Icon.tsx';
import { backPill, Screen } from '../ui/Screen.tsx';
import { ThemeButton } from '../ui/ThemePicker.tsx';

/**
 * Gia đình (ADR 0057, D-07): the children's profiles, the manage PIN and what a parent set for them, behind the
 * parent gate. It is the one screen of the app in the family register; the shelf and the rest stay 16+.
 */
export function FamilyPage() {
  return <RequireSession need="account">{({ me }) => <Family me={me} />}</RequireSession>;
}

function Family({ me }: { me: MeView }) {
  const { t } = useTranslation();
  const setMe = useSetMe();
  const unlocked = parentUnlocked(me);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const children = me.profiles.filter((profile) => profile.kind === 'child');
  // Re-render when the gate expires so the page locks itself without a request.
  useEffect(() => {
    if (!me.parentUnlockedUntil) return;
    const ms = new Date(me.parentUnlockedUntil).getTime() - Date.now();
    if (ms <= 0) return;
    const timer = setTimeout(rerender, ms + 100);
    return () => clearTimeout(timer);
  }, [me.parentUnlockedUntil]);

  const lock = useMutation({
    mutationFn: () => session.lockParentGate(),
    onSuccess: setMe,
  });

  const familyPage = publicPage('/family/', currentLanguage());
  const privacyPage = publicPage('/privacy/', currentLanguage());

  return (
    <Screen>
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <BackLink to="/account" className={backPill}>
            <Icon name="arrow-left" className="text-xl" />
            {t('back')}
          </BackLink>
          <ThemeButton />
        </div>
        <h1 className="font-black text-3xl text-brand-ink">{t('family.title')}</h1>
        <p className="text-ink-soft">{t('family.lead')}</p>
      </header>

      {unlocked ? (
        <>
          <section
            aria-labelledby="family-profiles"
            className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm"
          >
            <h2 id="family-profiles" className="font-bold text-ink text-xl">
              {t('family.profiles')}
            </h2>
            {children.length === 0 ? (
              <p className="text-ink-soft">{t('family.noChildren')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {children.map((profile) => (
                  <li key={profile.id} className="flex items-center gap-3 rounded-2xl bg-fill p-3">
                    <Avatar avatar={profile.avatar} size="sm" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-bold text-ink">{profile.name}</span>
                      <span className="text-ink-soft text-sm">
                        {profile.ageBand === null
                          ? t('profiles.adult')
                          : t('account.years', { band: profile.ageBand })}
                        {profile.hasPin ? ` · ${t('account.hasPin')}` : ''}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Link to="/account" search={{ manage: true }} className={buttonClass('primary')}>
                {t('family.manage')}
              </Link>
              <Link to="/account" search={{ manage: true, add: true }} className={buttonClass('secondary')}>
                {t('family.add')}
              </Link>
            </div>
          </section>

          <section aria-labelledby="family-pin" className="flex flex-col gap-2">
            <h2 id="family-pin" className="font-bold text-ink text-lg">
              {t('family.pin')}
            </h2>
            <p className="text-ink-soft">
              {me.account.hasManagePin ? t('family.pinOn') : t('family.pinOff')}
            </p>
            <Link to="/account" search={{ manage: true }} className={buttonClass('secondary')}>
              {me.account.hasManagePin ? t('family.pinChange') : t('family.pinSet')}
            </Link>
          </section>

          <section aria-labelledby="family-age" className="flex flex-col gap-2">
            <h2 id="family-age" className="font-bold text-ink text-lg">
              {t('family.age')}
            </h2>
            <p className="text-ink-soft">{t('family.ageBody')}</p>
          </section>

          <section aria-labelledby="family-time" className="flex flex-col gap-2">
            <h2 id="family-time" className="font-bold text-ink text-lg">
              {t('family.time')}
            </h2>
            <p className="text-ink-soft">{t('family.timeBody')}</p>
          </section>

          <section aria-labelledby="family-data" className="flex flex-col gap-2">
            <h2 id="family-data" className="font-bold text-ink text-lg">
              {t('family.data')}
            </h2>
            <p className="text-ink-soft">{t('family.dataBody')}</p>
            <a
              href={fromApp(privacyPage.href)}
              className="font-semibold text-accent underline underline-offset-4"
            >
              {t('family.dataAction')}
              {privacyPage.vietnameseOnly ? (
                <span className="text-ink-soft"> {t('me.inVietnamese')}</span>
              ) : null}
            </a>
          </section>

          <footer className="mt-auto flex flex-col items-start gap-3">
            {/* A public page is not a screen of the app: a full navigation (ADR 0042). */}
            <a
              href={fromApp(familyPage.href)}
              className="font-semibold text-accent underline underline-offset-4"
            >
              {t('family.more')}
              {familyPage.vietnameseOnly ? (
                <span className="text-ink-soft"> {t('me.inVietnamese')}</span>
              ) : null}
            </a>
            <Button variant="secondary" busy={lock.isPending} onClick={() => lock.mutate(undefined)}>
              <Icon name="lock-simple" />
              {t('family.lock')}
            </Button>
          </footer>
        </>
      ) : (
        <ParentGate me={me} title={t('family.gateTitle')} body={t('family.gateBody')} />
      )}
    </Screen>
  );
}
