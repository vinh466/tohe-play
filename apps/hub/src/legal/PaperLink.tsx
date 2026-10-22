import { useTranslation } from 'react-i18next';
import { fromApp } from '../language/language.ts';

/**
 * A link to the terms or the privacy notice, which open in a new tab so a half-filled form stays. They are Vietnamese
 * only for now: in English the link says so ("Terms of use (in Vietnamese)"), as Tôi's papers do. The public page is
 * opened from the app (`?from=app`: no link out of Tò He shows there).
 */
export function PaperLink({
  paper,
  label,
  className,
}: {
  paper: 'terms' | 'privacy';
  /** The link's words; the Vietnamese-only note follows them. */
  label: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const note = t('legal.inVietnamese');
  return (
    <a href={fromApp(`/${paper}/`)} target="_blank" rel="noopener" className={className}>
      {note ? `${label} ${note}` : label}
    </a>
  );
}
