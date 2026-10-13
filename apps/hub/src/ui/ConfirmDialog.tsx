import { useEffect, useRef } from 'react';

interface Action {
  label: string;
  onClick(): void;
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body?: string;
  /** Highlighted, first in focus order: the choice that is safe to make by accident. */
  primary: Action;
  secondary: Action;
  /** Escape or a tap on the backdrop. Defaults to the secondary action. */
  onDismiss?(): void;
}

/** Modal question with two answers, on the native <dialog> element (focus trap and Escape by the browser). */
export function ConfirmDialog({ open, title, body, primary, secondary, onDismiss }: ConfirmDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        (onDismiss ?? secondary.onClick)();
      }}
      className="m-auto w-[min(22rem,calc(100vw-2rem))] rounded-3xl bg-surface p-6 text-center text-ink shadow-xl backdrop:bg-scrim"
    >
      <h2 className="font-black text-2xl">{title}</h2>
      {body && <p className="mt-2 text-ink-soft">{body}</p>}
      <div className="mt-6 flex flex-col gap-3">
        {/* First in DOM order, so showModal() focuses the safe choice. */}
        <button
          type="button"
          onClick={primary.onClick}
          className="min-h-14 rounded-2xl bg-brand font-bold text-on-brand text-xl active:scale-95 active:bg-brand-strong"
        >
          {primary.label}
        </button>
        <button
          type="button"
          onClick={secondary.onClick}
          className="min-h-14 rounded-2xl bg-soft font-bold text-accent text-xl active:scale-95 active:bg-soft-strong"
        >
          {secondary.label}
        </button>
      </div>
    </dialog>
  );
}
