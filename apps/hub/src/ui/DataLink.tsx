import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/** A quiet link to "Dữ liệu kỹ thuật" (ADR 0015), at the bottom of the screens everyone sees. */
export function DataLink() {
  const { t } = useTranslation();
  return (
    <Link to="/account/data" className="self-center text-ink-soft text-sm underline underline-offset-4">
      {t('data.link')}
    </Link>
  );
}
