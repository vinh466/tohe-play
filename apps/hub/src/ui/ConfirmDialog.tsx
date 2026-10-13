import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm(): void;
  onCancel(): void;
}

/**
 * Modal confirmation on the native <dialog> element (focus trap, Escape and backdrop handled by the browser).
 * The cancel action is the primary, highlighted button: confirmations here guard against accidental taps.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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
        onCancel();
      }}
      className="m-auto w-[min(22rem,calc(100vw-2rem))] rounded-3xl bg-white p-6 text-center text-orange-950 shadow-xl backdrop:bg-orange-950/40"
    >
      <h2 className="font-black text-2xl">{title}</h2>
      {body && <p className="mt-2 text-orange-900/80">{body}</p>}
      <div className="mt-6 flex flex-col gap-3">
        {/* First in DOM order, so showModal() focuses the safe choice. */}
        <button
          type="button"
          onClick={onCancel}
          className="min-h-14 rounded-2xl bg-orange-500 font-bold text-lg text-white active:scale-95"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="min-h-14 rounded-2xl bg-orange-100 font-bold text-lg text-orange-800 active:scale-95"
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
