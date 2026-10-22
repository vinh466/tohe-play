import { type ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon.tsx';

interface ModalProps {
  open: boolean;
  title: string;
  onClose(): void;
  children: ReactNode;
}

/** Bottom sheet on phones, centred card on larger screens; native <dialog> (focus trap, Escape). */
export function Modal({ open, title, onClose, children }: ModalProps) {
  const { t } = useTranslation();
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
      className="mx-auto mt-auto mb-0 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-page p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink shadow-2xl backdrop:bg-scrim sm:my-auto sm:rounded-3xl"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="font-black text-2xl">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-11 items-center gap-1.5 rounded-full bg-soft px-4 font-semibold text-accent active:scale-95"
        >
          <Icon name="x" />
          {t('close')}
        </button>
      </div>
      {open ? children : null}
    </dialog>
  );
}
