import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { configQuery } from '../api/queries.ts';
import { EnterCodeSheet } from '../entry/EnterCode.tsx';
import { InstallSheet, useStandalone } from '../install/InstallNudge.tsx';
import { feedbackLink } from './feedback.ts';
import { Modal } from './Modal.tsx';

const item = 'flex items-center gap-4 rounded-2xl bg-surface p-4 text-left transition active:scale-[0.98]';

/**
 * Round "⋯" button in the catalog's corner: the things that are always there — a code to type, the profile's share
 * links, installing, and writing to the operator.
 */
export function MenuButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [entering, setEntering] = useState(false);
  const standalone = useStandalone();
  const config = useQuery(configQuery);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('menu.button')}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-surface font-black text-ink text-xl shadow-sm active:scale-95"
      >
        <span aria-hidden>⋯</span>
      </button>
      <Modal open={open && !installing && !entering} title={t('menu.title')} onClose={() => setOpen(false)}>
        <ul className="flex flex-col gap-3">
          <li>
            <button type="button" onClick={() => setEntering(true)} className={`${item} w-full`}>
              <span aria-hidden className="text-3xl">
                #️⃣
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-bold text-ink text-lg">{t('menu.code')}</span>
                <span className="text-ink-soft text-sm">{t('menu.codeHint')}</span>
              </span>
            </button>
          </li>
          <li>
            <Link to="/account/links" className={item}>
              <span aria-hidden className="text-3xl">
                🔗
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-bold text-ink text-lg">{t('menu.links')}</span>
                <span className="text-ink-soft text-sm">{t('menu.linksHint')}</span>
              </span>
            </Link>
          </li>
          {standalone ? null : (
            <li>
              <button type="button" onClick={() => setInstalling(true)} className={`${item} w-full`}>
                <span aria-hidden className="text-3xl">
                  📲
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-bold text-ink text-lg">{t('menu.install')}</span>
                  <span className="text-ink-soft text-sm">{t('menu.installHint')}</span>
                </span>
              </button>
            </li>
          )}
          <li>
            <a
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
              className={item}
            >
              <span aria-hidden className="text-3xl">
                ✉️
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-bold text-ink text-lg">{t('menu.feedback')}</span>
                <span className="text-ink-soft text-sm">{t('menu.feedbackHint')}</span>
              </span>
            </a>
          </li>
        </ul>
      </Modal>
      <EnterCodeSheet
        open={entering}
        onClose={() => {
          setEntering(false);
          setOpen(false);
        }}
      />
      <InstallSheet
        open={installing}
        onClose={() => {
          setInstalling(false);
          setOpen(false);
        }}
      />
    </>
  );
}
