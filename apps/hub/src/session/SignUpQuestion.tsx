import { useTranslation } from 'react-i18next';
import type { LocalProfile } from '../storage/db.ts';
import { AgeBandPicker } from '../ui/AgeBandPicker.tsx';
import { Avatar } from '../ui/AvatarGrid.tsx';
import { Segmented } from '../ui/Segmented.tsx';
import type { SignUpAnswer } from './signUpDevice.ts';

/**
 * "Hồ sơ 'Mèo Cam' là của bạn?" (ADR 0043): yes, it becomes the account's first profile; no, it is a child's, and joins
 * the account as a child's profile beside the person's own.
 */
export function SignUpQuestion({
  device,
  answer,
  onChange,
}: {
  device: LocalProfile;
  answer: SignUpAnswer;
  onChange(answer: SignUpAnswer): void;
}) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-fill p-4">
      <div className="flex items-center gap-3">
        <Avatar avatar={device.avatar} size="sm" />
        <p className="min-w-0 font-bold text-ink">{t('device.questionTitle', { name: device.name })}</p>
      </div>
      <p className="text-ink-soft text-sm">{t('device.questionBody')}</p>
      <Segmented
        legend={t('device.bringAs')}
        options={[
          { value: 'mine', label: t('device.mine') },
          { value: 'child', label: t('device.myChild') },
        ]}
        value={answer.mine ? 'mine' : 'child'}
        onChange={(value) => onChange({ ...answer, mine: value === 'mine' })}
      />
      {answer.mine ? null : (
        <>
          <p className="text-ink-soft text-sm">{t('device.childNote', { name: device.name })}</p>
          <AgeBandPicker
            label={t('device.childAge')}
            value={answer.ageBand}
            onChange={(ageBand) => onChange({ ...answer, ageBand })}
          />
        </>
      )}
    </section>
  );
}
