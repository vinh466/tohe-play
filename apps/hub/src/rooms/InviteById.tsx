import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ProfileCardView, rooms } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { formatProfileId, parseProfileId } from '../session/profileIds.ts';
import { Avatar } from '../ui/AvatarGrid.tsx';
import { Button } from '../ui/Button.tsx';
import { TextField } from '../ui/TextField.tsx';

/**
 * Ask a profile to the table by its 12-digit ID (ADR 0033): the phone checks the ID first — a mistyped digit or two
 * swapped neighbours never reach the API — then shows the profile's card, and only a tap on it sends the invitation,
 * so a free name never misleads (D-17). Not at a table kept to the account.
 */
export function InviteById({ roomId, accountOnly }: { roomId: string; accountOnly: boolean }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  /** Whom the last invitation reached, shown until the next ID is typed. */
  const [invited, setInvited] = useState<string | null>(null);
  const id = parseProfileId(text);
  const find = useMutation({ mutationFn: (publicId: string) => rooms.findProfile(publicId) });
  const invite = useMutation({
    mutationFn: (card: ProfileCardView) => rooms.invite(roomId, card.id),
    onSuccess: (_, card) => {
      setInvited(`${card.avatar} ${card.name}`);
      setText('');
      setTried(false);
      find.reset();
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

  // Twelve digits typed, or a tap on Tìm: say at once when they cannot be an ID.
  const wrong = (tried || text.replace(/[\s-]/g, '').length >= 12) && id === null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (id) find.mutate(id);
  };
  const card = find.data;
  return (
    <section className="mt-5 flex flex-col gap-3 border-line border-t pt-4">
      <h3 className="font-semibold text-ink-soft text-sm">{t('rooms.inviteById')}</h3>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <TextField
          label={t('rooms.inviteByIdLabel')}
          hint={t('rooms.inviteByIdHint')}
          inputMode="numeric"
          autoComplete="off"
          maxLength={20}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setInvited(null);
            find.reset();
            invite.reset();
          }}
          error={wrong ? t('rooms.errors.profileIdInvalid') : find.isError ? t(errorKey(find.error)) : null}
        />
        {card ? null : (
          <Button type="submit" variant="secondary" busy={find.isPending}>
            {t('rooms.findById')}
          </Button>
        )}
      </form>
      {card ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface p-3">
          <div className="flex items-center gap-3">
            <Avatar avatar={card.avatar} size="sm" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-bold text-ink">{card.name}</span>
              <span className="text-ink-soft text-sm tabular-nums">{formatProfileId(card.publicId)}</span>
            </span>
          </div>
          {invite.isError ? (
            <p role="alert" className="text-danger text-sm">
              {t(errorKey(invite.error))}
            </p>
          ) : null}
          <Button busy={invite.isPending} onClick={() => invite.mutate(card)}>
            {t('rooms.inviteConfirm', { name: card.name })}
          </Button>
          <Button variant="ghost" onClick={() => find.reset()}>
            {t('rooms.inviteAnother')}
          </Button>
        </div>
      ) : null}
      {invited ? (
        <p role="status" className="font-semibold text-accent">
          ✓ {t('rooms.invitedName', { name: invited })}
        </p>
      ) : null}
    </section>
  );
}
