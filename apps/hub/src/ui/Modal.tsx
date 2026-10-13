import { type ReactNode, useEffect, useRef } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose(): void;
  children: ReactNode;
}

/** Bottom sheet on phones, centred card on larger screens; native <dialog> (focus trap, Escape). */
export function Modal({ open, title, onClose, children }: ModalProps) {
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
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="mx-auto mt-auto mb-0 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-orange-50 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-orange-950 shadow-2xl backdrop:bg-orange-950/40 sm:my-auto sm:rounded-3xl"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="font-black text-2xl">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="✕"
          className="grid size-10 place-items-center rounded-full bg-orange-100 text-orange-800 text-xl active:scale-95"
        >
          ✕
        </button>
      </div>
      {open ? children : null}
    </dialog>
  );
}
