import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setThemeChoice, type ThemeChoice } from '../theme/theme.ts';
import { useTheme } from '../theme/useTheme.ts';
import { Modal } from './Modal.tsx';

const CHOICES: { choice: ThemeChoice; icon: string }[] = [
  { choice: 'system', icon: '🌗' },
  { choice: 'light', icon: '☀️' },
  { choice: 'dark', icon: '🌙' },
];

/** Round button in the top corner of hub screens: shows the current look and opens the light/dark choice. */
export function ThemeButton() {
  const { t } = useTranslation();
  const { choice } = useTheme();
  const [open, setOpen] = useState(false);
  const icon = CHOICES.find((option) => option.choice === choice)?.icon;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('theme.button', { choice: t(`theme.${choice}`) })}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-xl shadow-sm active:scale-95"
      >
        <span aria-hidden>{icon}</span>
      </button>
      <Modal open={open} title={t('theme.title')} onClose={() => setOpen(false)}>
        <ThemeChoices />
      </Modal>
    </>
  );
}

/** The three choices; picking one applies it at once, so the sheet doubles as a preview. */
function ThemeChoices() {
  const { t } = useTranslation();
  const { choice: current } = useTheme();
  return (
    <div className="flex flex-col gap-3">
      {CHOICES.map(({ choice, icon }) => (
        <button
          key={choice}
          type="button"
          aria-pressed={choice === current}
          onClick={() => setThemeChoice(choice)}
          className={`flex items-center gap-4 rounded-2xl p-4 text-left transition active:scale-[0.98] ${
            choice === current ? 'bg-soft-strong ring-4 ring-brand' : 'bg-surface'
          }`}
        >
          <span aria-hidden className="text-3xl">
            {icon}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="font-bold text-ink text-lg">{t(`theme.${choice}`)}</span>
            <span className="text-ink-soft text-sm">{t(`theme.${choice}Hint`)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
