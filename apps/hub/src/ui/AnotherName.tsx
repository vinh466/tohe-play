import { useTranslation } from 'react-i18next';
import { Button } from './Button.tsx';
import { Icon } from './Icon.tsx';

/** "Tên khác" beside a name field: draws another animal's name, with a die and its words. */
export function AnotherName({ onClick }: { onClick(): void }) {
  const { t } = useTranslation();
  return (
    <Button variant="secondary" className="shrink-0 px-4 text-base" onClick={onClick}>
      <Icon name="dice-five" weight="fill" className="text-xl" />
      {t('register.anotherName')}
    </Button>
  );
}
