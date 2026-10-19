import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackLink } from '../navigation/leave.tsx';
import { statusOf } from '../telemetry/collector.ts';
import { setDeviceTelemetry, telemetry, useTelemetryState } from '../telemetry/telemetry.ts';
import { Button } from '../ui/Button.tsx';
import { Screen } from '../ui/Screen.tsx';
import { Switch } from '../ui/Switch.tsx';
import { ThemeButton } from '../ui/ThemePicker.tsx';

/**
 * "Dữ liệu kỹ thuật": what telemetry sends and never sends, this device's switch, and the last batch exactly as it
 * was sent (ADR 0015). Open to everyone, guests included; the account's switch is in Manage account.
 */
export function DataPage() {
  const { t } = useTranslation();
  const state = useTelemetryState();
  const [showing, setShowing] = useState(false);
  const last = showing ? telemetry.lastBatch() : null;

  return (
    <Screen narrow>
      <header className="flex items-center gap-3">
        <BackLink
          to="/"
          aria-label={t('back')}
          className="grid size-11 place-items-center rounded-full bg-surface text-accent text-xl shadow-sm active:scale-95"
        >
          ←
        </BackLink>
        <h1 className="min-w-0 flex-1 font-black text-3xl text-brand-ink">{t('data.title')}</h1>
        <ThemeButton />
      </header>

      <p className="text-ink">{t('data.intro')}</p>

      <Card title={t('data.sentTitle')}>
        <Items items={t('data.sent', { returnObjects: true }) as string[]} mark="✓" />
        <p className="text-ink-soft text-sm">{t('data.retention')}</p>
      </Card>

      <Card title={t('data.neverTitle')}>
        <Items items={t('data.never', { returnObjects: true }) as string[]} mark="✕" />
      </Card>

      <Card title={t('data.switchTitle')}>
        <Switch
          label={t('data.device')}
          hint={t('data.deviceHint')}
          checked={state.device}
          onChange={setDeviceTelemetry}
        />
        <p role="status" className="text-ink-soft">
          {t(`data.status.${statusOf(state)}`)}
        </p>
      </Card>

      <Card title={t('data.lastTitle')}>
        <Button variant="secondary" onClick={() => setShowing((value) => !value)}>
          {showing ? t('data.hide') : t('data.show')}
        </Button>
        {showing &&
          (last ? (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-2xl bg-fill p-3 text-ink text-xs">
              {JSON.stringify(last, null, 2)}
            </pre>
          ) : (
            <p className="text-ink-soft">{t('data.none')}</p>
          ))}
      </Card>
    </Screen>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-sm">
      <h2 className="font-bold text-ink text-xl">{title}</h2>
      {children}
    </section>
  );
}

function Items({ items, mark }: { items: string[]; mark: string }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-ink">
          <span aria-hidden className="font-bold text-accent">
            {mark}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
