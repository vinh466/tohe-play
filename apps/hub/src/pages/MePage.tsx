import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ReactNode, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { configQuery } from '../api/queries.ts';
import { TabHeader } from '../frame/AppFrame.tsx';
import { OutboundLink } from '../frame/OutboundLink.tsx';
import { currentLanguage, setLanguage } from '../i18n.ts';
import { InstallSheet, useStandalone } from '../install/InstallNudge.tsx';
import { fromApp, type Language, publicPage } from '../language/language.ts';
import { RequireSession } from '../session/RequireSession.tsx';
import type { Player, SessionState } from '../session/session.ts';
import { readMuted, saveMuted, subscribeMuted } from '../settings/sound.ts';
import { funnel } from '../telemetry/telemetry.ts';
import { setThemeChoice, type ThemeChoice } from '../theme/theme.ts';
import { useTheme } from '../theme/useTheme.ts';
import { Avatar } from '../ui/AvatarGrid.tsx';
import { Button, buttonClass } from '../ui/Button.tsx';
import { DataLink } from '../ui/DataLink.tsx';
import { feedbackLink } from '../ui/feedback.ts';
import { Screen } from '../ui/Screen.tsx';
import { Segmented } from '../ui/Segmented.tsx';
import { Switch } from '../ui/Switch.tsx';
import { shortVersion } from '../ui/version.ts';

type PlayingSession = Extract<SessionState, { status: 'device' | 'account' }> & { player: Player };

/** The app's languages, each named in itself. */
const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' },
];

const THEMES: ThemeChoice[] = ['system', 'light', 'dark'];

/** Help and about, and the papers: public pages (apps/web), a full navigation away — not the app's screens. */
const HELP = [
  ['/guides/', 'me.guides'],
  ['/faq/', 'me.faq'],
  ['/about/', 'me.about'],
  ['/promise/', 'me.promise'],
] as const;
const PAPERS = [
  ['/terms/', 'legal.terms'],
  ['/privacy/', 'legal.privacy'],
] as const;

/**
 * Tôi, the frame's third tab (ADR 0046), from the top: who is playing; settings — language, theme, sound; installing;
 * help and about; feedback; papers; the account. The only screen with links out of Tò He (feedback's mail), which an
 * account's child profile follows with the manage PIN (OutboundLink).
 */
export function MePage() {
  return <RequireSession need="player">{(session) => <Me session={session} />}</RequireSession>;
}

function Me({ session }: { session: PlayingSession }) {
  const { t } = useTranslation();
  const { player } = session;
  const standalone = useStandalone();
  const [installing, setInstalling] = useState(false);
  const language = currentLanguage();

  return (
    <Screen>
      <TabHeader title={t('frame.me')} player={player} />

      <Card id="me-profiles" title={t('me.profiles')}>
        <div className="flex items-center gap-3">
          <Avatar avatar={player.avatar} size="sm" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-bold text-ink text-lg">{player.name}</span>
            <span className="text-ink-soft text-sm">{t('me.playing')}</span>
          </span>
          <Link to="/account/profiles" className={buttonClass('secondary')}>
            {t('me.change')}
          </Link>
        </div>
      </Card>

      <Card id="me-settings" title={t('me.settings')}>
        <Setting label={t('me.language')}>
          <Segmented legend={t('me.language')} options={LANGUAGES} value={language} onChange={setLanguage} />
        </Setting>
        <Setting label={t('theme.title')}>
          <ThemeSetting />
        </Setting>
        <SoundSetting />
      </Card>

      {standalone ? null : (
        <Card id="me-install" title={t('me.install')}>
          <p className="-mt-2 text-ink-soft">{t('me.installHint')}</p>
          <Button variant="secondary" onClick={() => setInstalling(true)}>
            {t('me.installButton')}
          </Button>
          <InstallSheet open={installing} onClose={() => setInstalling(false)} />
        </Card>
      )}

      <Card id="me-help" title={t('me.help')}>
        <PublicLinks pages={HELP} language={language} />
      </Card>

      <Card id="me-feedback" title={t('me.feedback')}>
        <Feedback />
      </Card>

      <Card id="me-papers" title={t('me.papers')}>
        <PublicLinks pages={PAPERS} language={language} />
        <DataLink />
      </Card>

      <Card id="me-account" title={t('me.account')}>
        {session.status === 'account' ? (
          <>
            <p className="-mt-2 break-all text-ink-soft">
              {session.me.account.email ?? session.me.account.displayName}
            </p>
            <Link to="/account" search={{ manage: true }} className={buttonClass('secondary')}>
              ⚙️ {t('profiles.manage')}
            </Link>
          </>
        ) : (
          <>
            <p className="-mt-2 text-ink-soft">{t('me.deviceHint')}</p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/account/sign-in"
                onClick={() => funnel.signInOpened()}
                className={`${buttonClass('primary')} flex-1`}
              >
                {t('device.signIn')}
              </Link>
              <Link to="/account/register" className={`${buttonClass('secondary')} flex-1`}>
                {t('device.signUp')}
              </Link>
            </div>
          </>
        )}
      </Card>

      <Version />
    </Screen>
  );
}

function Card({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm">
      <h2 id={id} className="font-bold text-ink text-xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Setting({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span aria-hidden className="font-semibold text-ink">
        {label}
      </span>
      {children}
    </div>
  );
}

/** Light, dark or the device's: applied at once, as the sheet on the other screens does. */
function ThemeSetting() {
  const { t } = useTranslation();
  const { choice } = useTheme();
  return (
    <Segmented
      legend={t('theme.title')}
      options={THEMES.map((value) => ({ value, label: t(`theme.${value}`) }))}
      value={choice}
      onChange={setThemeChoice}
    />
  );
}

/** One switch for the device, the same one a game's 🔊 turns (ADR 0018). */
function SoundSetting() {
  const { t } = useTranslation();
  const muted = useSyncExternalStore(subscribeMuted, () => readMuted());
  return (
    <Switch
      label={t('me.sound')}
      hint={t('me.soundHint')}
      checked={!muted}
      onChange={(on) => saveMuted(!on)}
    />
  );
}

function PublicLinks({
  pages,
  language,
}: {
  pages: readonly (readonly [path: string, label: string])[];
  language: Language;
}) {
  const { t } = useTranslation();
  return (
    <ul className="-mt-1 flex flex-col">
      {pages.map(([path, label]) => {
        const page = publicPage(path, language);
        return (
          <li key={path}>
            {/* A public page is not a screen of the app: a full navigation (ADR 0042). */}
            <a
              href={fromApp(page.href)}
              className="flex min-h-12 items-center justify-between gap-3 border-line border-b py-2 font-semibold text-ink"
            >
              <span>
                {t(label)}
                {page.vietnameseOnly ? <span className="text-ink-soft"> {t('me.inVietnamese')}</span> : null}
              </span>
              <span aria-hidden className="text-ink-soft text-xl">
                ›
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** "Góp ý / báo lỗi": a mail to the operator with the app's version and the browser, and nothing about the person. */
function Feedback() {
  const { t } = useTranslation();
  const config = useQuery(configQuery);
  return (
    <>
      <p className="-mt-2 text-ink-soft">{t('me.feedbackHint')}</p>
      <OutboundLink
        href={feedbackLink({
          version: config.data?.apiVersion ?? 'unknown',
          userAgent: navigator.userAgent,
          text: {
            subject: t('feedback.subject'),
            intro: t('feedback.intro'),
            version: t('feedback.version'),
            browser: t('feedback.browser'),
          },
        })}
        className={buttonClass('secondary')}
      >
        ✉️ {t('me.feedbackLink')}
      </OutboundLink>
    </>
  );
}

function Version() {
  const { t } = useTranslation();
  const config = useQuery(configQuery);
  return config.data ? (
    <p className="text-center text-ink-soft text-xs">
      {t('account.version', { version: shortVersion(config.data.apiVersion) })}
    </p>
  ) : null;
}
