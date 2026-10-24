// The Studio's few building blocks. Token colours only (ADR 0013); every block works in light and dark.
import type { ReactNode } from 'react';
import type { Tone } from '../format.ts';
import { problem } from './forms.tsx';

export function PageTitle({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h1 className="font-bold text-2xl text-ink">{title}</h1>
      {aside ? <span className="text-ink-soft text-sm">{aside}</span> : null}
    </div>
  );
}

/** A titled part of a page; `danger` marks one whose action cannot be undone. */
export function Section({
  title,
  aside,
  tone = 'plain',
  children,
}: {
  title: string;
  aside?: ReactNode;
  tone?: 'plain' | 'danger';
  children: ReactNode;
}) {
  const border = tone === 'danger' ? 'border-2 border-danger-line' : 'border border-line';
  return (
    <section className={`flex min-w-0 flex-col gap-3 rounded-2xl bg-surface p-5 ${border}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={`font-bold ${tone === 'danger' ? 'text-danger' : 'text-ink'}`}>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

const tones: Record<Tone, string> = {
  soft: 'bg-soft text-ink',
  brand: 'bg-brand-strong text-on-brand',
  notice: 'bg-notice text-notice-ink',
  danger: 'bg-danger-soft text-danger',
};

export function Badge({ tone = 'soft', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-block w-fit rounded-full px-2 py-0.5 font-semibold text-xs ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** One label and its value, for a version's or an asset's facts. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-line border-b py-2 last:border-0">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="min-w-0 break-words text-right font-semibold text-ink">{children}</dd>
    </div>
  );
}

export function Facts({ children }: { children: ReactNode }) {
  return <dl className="flex flex-col">{children}</dl>;
}

export function Loading() {
  return <p className="text-ink-soft">Đang tải…</p>;
}

/** A page's data did not come: what the API said, and a way to ask again. */
export function Failed({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger-line bg-danger-soft p-4"
    >
      <span className="text-danger">{problem(error)}</span>
      <button
        type="button"
        onClick={retry}
        className="min-h-11 rounded-xl bg-surface px-3 py-1 font-semibold text-ink"
      >
        Thử lại
      </button>
    </div>
  );
}

/** Nothing to show yet, said plainly. */
export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-ink-soft">{children}</p>;
}
