import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { rooms } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { parseProfileId } from '../session/profileIds.ts';
import { Button } from '../ui/Button.tsx';
import { TextField } from '../ui/TextField.tsx';

/**
 * Ask a profile to the table by its 12-digit ID (ADR 0033): checked on the phone first — a mistyped digit or two
 * swapped neighbours never reach the API — then by the API, as the profile's owner allows. Not at a table kept to the
 * account.
 */
export function InviteById({ roomId, accountOnly }: { roomId: string; accountOnly: boolean }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const id = parseProfileId(text);
  const invite = useMutation({
    mutationFn: (publicId: string) => rooms.inviteById(roomId, publicId),
    onSuccess: () => {
      setText('');
      setTried(false);
    },
  });

  if (accountOnly) {
    return (
      <section className="mt-5 flex flex-col gap-2 border-line border-t pt-4">
        <h3 className="font-semibold text-ink-soft text-sm">{t('rooms.inviteById')}</h3>
        <p className="text-ink-soft text-sm">{t('rooms.inviteByIdAccountOnly')}</p>
      </section>
    );
  }

  // Twelve digits typed, or a tap on Mời: say at once when they cannot be an ID.
  const wrong = (tried || text.replace(/[\s-]/g, '').length >= 12) && id === null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (id) invite.mutate(id);
  };
  return (
    <form onSubmit={submit} className="mt-5 flex flex-col gap-3 border-line border-t pt-4">
      <h3 className="font-semibold text-ink-soft text-sm">{t('rooms.inviteById')}</h3>
      <TextField
        label={t('rooms.inviteByIdLabel')}
        hint={t('rooms.inviteByIdHint')}
        inputMode="numeric"
        autoComplete="off"
        maxLength={20}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          invite.reset();
        }}
        error={wrong ? t('rooms.errors.profileIdInvalid') : invite.isError ? t(errorKey(invite.error)) : null}
      />
      {invite.isSuccess ? (
        <p role="status" className="font-semibold text-accent">
          ✓ {t('rooms.invitedName', { name: `${invite.data.avatar} ${invite.data.name}` })}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" busy={invite.isPending}>
        {t('rooms.inviteOne')}
      </Button>
    </form>
  );
}
