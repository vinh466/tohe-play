import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type GameSummary, links, type ShareLinkView } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { nameOf } from '../launcher/gameWords.ts';
import { AtTables } from '../session/AtTables.tsx';
import type { Player, SessionState } from '../session/session.ts';
import { Button } from '../ui/Button.tsx';
import { copyText } from '../ui/copyText.ts';
import { Modal } from '../ui/Modal.tsx';
import { QrCode } from '../ui/QrCode.tsx';
import { formatEntryCode } from './codes.ts';
import { gameLinkRequest, reusableLink, shareUrl } from './share.ts';

type PlayingSession = Extract<SessionState, { status: 'device' | 'account' }> & { player: Player };

/** 🔗 in the corner of a game card: "Chia sẻ" that game. */
export function ShareButton({ game, session }: { game: GameSummary; session: PlayingSession }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('share.button', { game: nameOf(game) })}
        className="absolute top-1.5 left-1.5 grid size-10 place-items-center rounded-full bg-soft text-xl active:scale-95"
      >
        <span aria-hidden>🔗</span>
      </button>
      <ShareSheet game={game} session={session} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * "Chia sẻ" (ADR 0044): a `game` link to the game's menu, made by the profile playing — a `named` feature, so a device
 * profile first gets its name, its avatar and the terms line, in the sheet. Then the link, its QR code, the system's
 * share and "Chép link".
 */
export function ShareSheet({
  game,
  session,
  open,
  onClose,
}: {
  game: GameSummary;
  session: PlayingSession;
  open: boolean;
  onClose(): void;
}) {
  const { t } = useTranslation();
  return (
    <Modal open={open} title={t('share.title', { game: nameOf(game) })} onClose={onClose}>
      {open ? (
        <AtTables session={session} purpose="share" inline>
          {(player) => <ShareLink game={game} player={player} />}
        </AtTables>
      ) : null}
    </Modal>
  );
}

function ShareLink({ game, player }: { game: GameSummary; player: Player }) {
  const { t, i18n } = useTranslation();
  const [copied, setCopied] = useState(false);
  // The profile's live link to this game is shown again; a new one only when there is none (30 a day per profile).
  const link = useQuery({
    queryKey: ['share-link', game.id, player.id],
    queryFn: async (): Promise<ShareLinkView> =>
      reusableLink(await links.mine(), game.id, Date.now()) ?? (await links.make(gameLinkRequest(game.id))),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  if (link.isPending)
    return (
      <p role="status" className="text-center text-ink-soft">
        {t('share.making')}
      </p>
    );
  if (link.isError) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-center text-danger">
          {t(errorKey(link.error))}
        </p>
        <Button variant="secondary" onClick={() => void link.refetch()}>
          {t('named.retry')}
        </Button>
      </div>
    );
  }

  const url = shareUrl(link.data.code, window.location.origin);
  const text = t('share.text', { game: nameOf(game) });
  const canShare = typeof navigator.share === 'function';
  const until = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
    new Date(link.data.expiresAt),
  );
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-ink">{t('share.body', { game: nameOf(game) })}</p>
      <QrCode text={url} label={t('share.qr', { game: nameOf(game) })} />
      <p className="flex flex-col">
        <span className="text-ink-soft text-sm">{t('share.code')}</span>
        <span className="font-black text-3xl text-ink tracking-widest">
          {formatEntryCode({ kind: 'share', code: link.data.code })}
        </span>
      </p>
      <p className="wrap-anywhere text-ink-soft text-sm">{url}</p>
      <div className="flex w-full flex-col gap-2">
        {canShare ? (
          <Button
            onClick={() => {
              // Closed without sending: nothing to say.
              navigator.share({ title: t('appName'), text, url }).catch(() => undefined);
            }}
          >
            {t('share.send')}
          </Button>
        ) : null}
        <Button
          variant={canShare ? 'secondary' : 'primary'}
          onClick={async () => {
            setCopied(await copyText(url));
            setTimeout(() => setCopied(false), 2500);
          }}
        >
          {copied ? t('share.copied') : t('share.copy')}
        </Button>
      </div>
      <p className="text-ink-soft text-sm">{t('share.until', { date: until })}</p>
      <Link to="/account/links" className="font-semibold text-accent underline underline-offset-4">
        {t('share.mine')}
      </Link>
    </div>
  );
}
