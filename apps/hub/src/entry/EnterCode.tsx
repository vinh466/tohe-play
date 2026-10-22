import { useNavigate } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button.tsx';
import { Icon } from '../ui/Icon.tsx';
import { Modal } from '../ui/Modal.tsx';
import { TextField } from '../ui/TextField.tsx';
import { formatEntryCode, readCode } from './codes.ts';

/**
 * "Nhập mã" (ADR 0044): six digits open a table, eight characters a share link — read leniently, as the API reads them,
 * and a pasted link by its `/r/` or `/s/` part. The way in for whoever cannot follow the link itself: the installed app
 * on an iPhone, whose storage Safari does not share, or a code read aloud across a table.
 */
export function EnterCodeForm({ onGo, autoFocus = false }: { onGo?: () => void; autoFocus?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [tried, setTried] = useState(false);
  const read = readCode(value);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!read) {
      setTried(true);
      return;
    }
    onGo?.();
    if (read.kind === 'room') void navigate({ to: '/r/$code', params: { code: read.code } });
    else void navigate({ to: '/s/$code', params: { code: read.code } });
  };
  // What a code was read as, once it is one; the rule (6 digits, 8 characters) is only in the error.
  const hint = read
    ? t(read.kind === 'room' ? 'entry.codeIsRoom' : 'entry.codeIsShare', { code: formatEntryCode(read) })
    : undefined;
  return (
    <form onSubmit={submit} className="flex flex-col" noValidate>
      <TextField
        label={t('entry.codeLabel')}
        hint={hint}
        live
        error={tried && !read ? t('entry.codeInvalid') : null}
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        maxLength={200}
        autoFocus={autoFocus}
        action={
          <Button type="submit" disabled={value.trim().length === 0} className="shrink-0">
            {t('entry.codeGo')}
          </Button>
        }
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setTried(false);
        }}
      />
    </form>
  );
}

/** The sheet that holds the box: from the catalog (Chơi cùng holds the box itself). */
export function EnterCodeSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const { t } = useTranslation();
  return (
    <Modal open={open} title={t('entry.codeTitle')} onClose={onClose}>
      <EnterCodeForm onGo={onClose} autoFocus />
    </Modal>
  );
}

/** "Nhập mã" at the top of the catalog: in sight on the first screen, for a newcomer and the installed app alike. */
export function EnterCodeButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-surface px-4 font-bold text-accent shadow-sm active:scale-95"
      >
        <Icon name="ticket" className="text-xl" />
        {t('entry.codeButton')}
      </button>
      <EnterCodeSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
