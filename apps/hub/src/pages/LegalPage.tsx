import { useTranslation } from 'react-i18next';
import { type LegalDocument, privacy, TERMS_VERSION, terms } from '../legal/documents.ts';
import { BackLink } from '../navigation/leave.tsx';
import { Screen } from '../ui/Screen.tsx';
import { ThemeButton } from '../ui/ThemePicker.tsx';

/** The terms of use: open to everyone, signed in or not (ADR 0025). */
export function TermsPage() {
  return <Legal document={terms} />;
}

/** The privacy notice: open to everyone, signed in or not (ADR 0025). */
export function PrivacyPage() {
  return <Legal document={privacy} />;
}

function Legal({ document }: { document: LegalDocument }) {
  const { t } = useTranslation();
  return (
    <Screen narrow>
      <header className="flex items-center gap-3">
        <BackLink
          to="/play"
          aria-label={t('back')}
          className="grid size-11 place-items-center rounded-full bg-surface text-accent text-xl shadow-sm active:scale-95"
        >
          ←
        </BackLink>
        <h1 className="min-w-0 flex-1 font-black text-2xl text-brand-ink">{document.title}</h1>
        <ThemeButton />
      </header>
      <p role="note" className="rounded-2xl bg-notice px-4 py-3 text-notice-ink text-sm">
        {t('legal.draft', { version: TERMS_VERSION })}
      </p>
      <article lang="vi" className="flex flex-col gap-5 rounded-3xl bg-surface p-5 shadow-sm">
        {document.sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-2">
            <h2 className="font-bold text-ink text-lg">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-ink leading-relaxed">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </article>
    </Screen>
  );
}
