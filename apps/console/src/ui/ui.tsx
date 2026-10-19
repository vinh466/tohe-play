// The console's few building blocks. Token colours only (ADR 0013); every block works in light and dark.
import type { ReactNode } from 'react';

export function PageTitle({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h1 className="font-bold text-2xl text-ink">{title}</h1>
      {aside ? <span className="text-ink-soft text-sm">{aside}</span> : null}
    </div>
  );
}

export function Card({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-bold text-ink">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label?: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col">
      {label ? <span className="whitespace-nowrap text-ink-soft text-sm">{label}</span> : null}
      <span className="font-bold text-2xl text-ink tabular-nums">{value}</span>
      {hint ? <span className="text-ink-soft text-sm">{hint}</span> : null}
    </div>
  );
}

const tones = {
  soft: 'bg-soft text-ink',
  notice: 'bg-notice text-notice-ink',
  danger: 'bg-danger-soft text-danger',
};

export function Badge({ tone = 'soft', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return (
    <span className={`inline-block w-fit rounded-full px-2 py-0.5 font-semibold text-xs ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** A table that scrolls sideways on a narrow window rather than squeezing its columns. */
export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-line border-b text-ink-soft">
            {head.map((column) => (
              <th key={column} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-ink">{children}</tbody>
      </table>
    </div>
  );
}

export const cell = 'px-3 py-2 align-top';
export const row = 'border-line border-b last:border-0';

/** One label and its value, for settings and facts. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-line border-b py-2 last:border-0">
      <span className="text-ink-soft">{label}</span>
      <span className="min-w-0 break-words text-right font-semibold text-ink">{children}</span>
    </div>
  );
}

export function Loading() {
  return <p className="text-ink-soft">Đang tải…</p>;
}

export function Failed({ retry }: { retry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger-line bg-danger-soft p-4"
    >
      <span className="text-danger">Không tải được dữ liệu.</span>
      <button
        type="button"
        onClick={retry}
        className="rounded-xl bg-surface px-3 py-1 font-semibold text-ink"
      >
        Thử lại
      </button>
    </div>
  );
}
