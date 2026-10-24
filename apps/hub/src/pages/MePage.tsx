import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ReactNode, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { configQuery } from '../api/queries.ts';
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
import { feedbackLink } from '../ui/feedback.ts';
import { Icon } from '../ui/Icon.tsx';
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
 * Tôi, the frame's third tab (ADR 0046), from the top: who is playing; then groups with a heading and rows — settings
 * (language, theme, sound, installing), help, papers, the account. No title (the bar says where this is) and no card
 * around each group: a heading and its rows. The only screen with links out of Tò He (feedback's mail), which an
 * account's child profile follows with the manage PIN (OutboundLink).
 */
export function MePage() {
  return (
    <RequireSession need="player" door>
      {(session) => <Me session={session} />}
    </RequireSession>
  );
}

/** What a row of a list looks like: its words at the left, a caret (or the icon of where it goes) at the right. */
const ROW =
  'flex min-h-12 items-center justify-between gap-3 border-line border-b py-2 font-semibold text-ink active:bg-soft';

function Me({ session }: { session: PlayingSession }) {
  const { t } = useTranslation();
  const { player } = session;
  const standalone = useStandalone();
  const [installing, setInstalling] = useState(false);
  const language = currentLanguage();
  return (
    <Screen wide>
      <h1 className="sr-only">{t('frame.me')}</h1>
      {/* One column on a phone; two from a computer's width, the groups side by side so the screen is filled. */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-x-10 short:gap-3">
        <div className="flex flex-col gap-6 short:gap-3">
          {/* Who is playing: the one thing here that is a card, because the whole of it is one tap to change. */}
          <Link
            to="/account/profiles"
            data-tile
            aria-label={t('switchProfileOf', { name: player.name })}
            className="flex items-center gap-3 rounded-3xl bg-surface p-4 shadow-sm transition active:scale-[0.99]"
          >
            <Avatar avatar={player.avatar} size="sm" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-bold text-ink text-lg">{player.name}</span>
              <span className="text-ink-soft text-sm">
                {session.status === 'device' ? t('me.playingHere') : t('me.playing')}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-soft px-4 py-2 font-bold text-accent">
              {t('me.change')}
            </span>
          </Link>
          {/* With no account, Tôi leads with what one gives (ADR 0055); the account group below has the details. */}
          {session.status === 'device' ? (
            <div className="flex flex-col gap-2">
              <Link
                to="/account/sign-in"
                onClick={() => funnel.signInOpened()}
                className={buttonClass('primary')}
              >
                {t('device.signIn')}
              </Link>
              <p className="text-center text-ink-soft text-sm">{t('me.keepProgress')}</p>
            </div>
          ) : null}

          <Group id="me-settings" title={t('me.settings')}>
            <Setting label={t('me.language')}>
              <Segmented
                legend={t('me.language')}
                options={LANGUAGES}
                value={language}
                onChange={setLanguage}
              />
            </Setting>
            <Setting label={t('theme.title')}>
              <ThemeSetting />
            </Setting>
            <SoundSetting />
            {standalone ? null : (
              <div className="flex items-center gap-3">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold text-ink">{t('me.install')}</span>
                  <span className="text-ink-soft text-sm">{t('me.installHint')}</span>
                </span>
                <Button variant="secondary" onClick={() => setInstalling(true)}>
                  {t('me.installButton')}
                </Button>
                <InstallSheet open={installing} onClose={() => setInstalling(false)} />
              </div>
            )}
          </Group>
        </div>
        <div className="flex flex-col gap-6 short:gap-3">
          <Group id="me-help" title={t('me.help')}>
            <ul className="flex flex-col">
              <PublicLinks pages={HELP} language={language} />
              <li>
                <Feedback />
              </li>
            </ul>
          </Group>

          <Group id="me-papers" title={t('me.papers')}>
            <ul className="flex flex-col">
              <PublicLinks pages={PAPERS} language={language} />
              <li>
                <Link to="/account/data" className={ROW}>
                  <span>{t('data.link')}</span>
                  <Icon name="caret-right" className="text-ink-soft text-xl" />
                </Link>
              </li>
            </ul>
          </Group>

          <Group id="me-account" title={t('me.account')}>
            {session.status === 'account' ? (
              <>
                <p className="break-all text-ink-soft">
                  {session.me.account.email ?? session.me.account.displayName}
                </p>
                <Link to="/account" search={{ manage: true }} className={buttonClass('secondary')}>
                  <Icon name="gear-six" />
                  {t('profiles.manage')}
                </Link>
              </>
            ) : (
              <>
                <p className="text-ink-soft">{t('me.deviceHint')}</p>
                {/* Signing in leads Tôi, under who is playing (ADR 0055): here only the way to make an account. */}
                <Link to="/account/register" className={`${buttonClass('secondary')} whitespace-nowrap`}>
                  {t('device.signUp')}
                </Link>
              </>
            )}
          </Group>
        </div>
      </div>
      <Version />
    </Screen>
  );
}

/** A heading and what is under it: space and type group them, not a box. */
function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="font-bold text-ink text-lg">
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

/** One switch for the device, the same one a game's sound button turns (ADR 0018). */
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
    <>
      {pages.map(([path, label]) => {
        const page = publicPage(path, language);
        return (
          <li key={path}>
            {/* A public page is not a screen of the app: a full navigation (ADR 0042). */}
            <a href={fromApp(page.href)} className={ROW}>
              <span>
                {t(label)}
                {page.vietnameseOnly ? <span className="text-ink-soft"> {t('me.inVietnamese')}</span> : null}
              </span>
              <Icon name="caret-right" className="text-ink-soft text-xl" />
            </a>
          </li>
        );
      })}
    </>
  );
}

/** "Góp ý / báo lỗi": one row, a mail to the operator with the app's version and the browser, and nothing about the person. */
function Feedback() {
  const { t } = useTranslation();
  const config = useQuery(configQuery);
  return (
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
      className={ROW}
    >
      <span>{t('me.feedbackLink')}</span>
      <Icon name="envelope-simple" className="text-ink-soft text-xl" />
    </OutboundLink>
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
