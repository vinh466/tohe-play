// The hub's own sheets over a game (ADR 0045): a name, an account, a share — always in the hub's words, never the
// game's — and the notice when a link's place does not open in this build. GameFrame opens one at a time.
import type { IdentityLevel, InitProfile, RequireReason, ShareError } from '@tohe/contract';
import type { JsonValue } from '@tohe/game-sdk';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type GameSummary, links, type ShareLinkView } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { shareUrl } from '../entry/share.ts';
import { AtTables } from '../session/AtTables.tsx';
import type { Player, SessionState } from '../session/session.ts';
import { Button } from '../ui/Button.tsx';
import { copyText } from '../ui/copyText.ts';
import { Modal } from '../ui/Modal.tsx';
import { QrCode } from '../ui/QrCode.tsx';
import { profileKind, shareErrorOf } from './requests.ts';

export type PlayingSession = Extract<SessionState, { status: 'device' | 'account' }> & { player: Player };

/** A sheet a game asked for, with how its answer goes back. */
export type GameAsk =
  | {
      kind: 'named';
      reason: RequireReason;
      /** The profile is named: the request is ok, with it. */
      done(profile: InitProfile): void;
      /** "Để sau", or the sheet closed. */
      decline(): void;
      /** The name screen's ways to signing in ("Nhờ bố mẹ", "Đăng nhập"): as `account`'s — the game saves, opens again. */
      signIn(): void;
    }
  | {
      kind: 'account';
      reason: RequireReason;
      /** Sign in or make an account: the game is opened again afterwards, and the request never settles. */
      go(to: 'sign-in' | 'register'): void;
      decline(): void;
    }
  | {
      kind: 'share';
      payload: JsonValue;
      text?: string;
      level?: IdentityLevel;
      /** The player sent, copied or showed the link: the request is ok. */
      sent(): void;
      /** The sheet closed: not ok — with why the link could not be made, else `cancelled` — unless it was sent. */
      close(error: ShareError | null): void;
      /** The name screen's ways to signing in, before the link: as `account`'s — the game saves, opens again. */
      signIn(): void;
    };

/** The sheet the game asked for, if any. */
export function GameAsks({
  ask,
  game,
  session,
}: {
  ask: GameAsk | null;
  game: GameSummary;
  session: PlayingSession | undefined;
}) {
  if (!ask || !session) return null;
  switch (ask.kind) {
    case 'named':
      return <NamedSheet ask={ask} game={game} session={session} />;
    case 'account':
      return <AccountSheet ask={ask} game={game} />;
    case 'share':
      return <GameShareSheet ask={ask} game={game} session={session} />;
  }
}

/** Runs once, when drawn: the profile reached the level asked. */
function Reached({ run }: { run(): void }) {
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    run();
  }, [run]);
  return null;
}

/** `named` (ADR 0043, 0045): the name screen, in a sheet, with the hub's words for the reason. */
function NamedSheet({
  ask,
  game,
  session,
}: {
  ask: Extract<GameAsk, { kind: 'named' }>;
  game: GameSummary;
  session: PlayingSession;
}) {
  const { t } = useTranslation();
  return (
    <Modal open title={game.name} onClose={ask.decline}>
      <AtTables
        session={session}
        purpose="entry"
        inline
        onSignIn={ask.signIn}
        words={{
          title: t('gameAsks.namedTitle'),
          body: t(`gameAsks.reasons.${ask.reason}`),
          go: t('gameAsks.namedGo'),
        }}
      >
        {(player) => (
          <Reached
            run={() =>
              ask.done({ id: player.id, name: player.name, avatar: player.avatar, kind: profileKind(player) })
            }
          />
        )}
      </AtTables>
    </Modal>
  );
}

/** `account` (ADR 0043, 0045): sign in or make an account — the game opens again after — or not now. */
function AccountSheet({ ask, game }: { ask: Extract<GameAsk, { kind: 'account' }>; game: GameSummary }) {
  const { t } = useTranslation();
  return (
    <Modal open title={game.name} onClose={ask.decline}>
      <section className="flex flex-col gap-4 text-center">
        <h3 className="font-black text-2xl text-brand-ink">{t('gameAsks.accountTitle')}</h3>
        <p className="text-ink">{t(`gameAsks.reasons.${ask.reason}`)}</p>
        <p className="text-ink-soft text-sm">{t('gameAsks.accountReopen')}</p>
        <Button onClick={() => ask.go('sign-in')}>{t('gameAsks.signIn')}</Button>
        <Button variant="secondary" onClick={() => ask.go('register')}>
          {t('gameAsks.signUp')}
        </Button>
        <button type="button" onClick={ask.decline} className="py-2 font-semibold text-accent">
          {t('gameAsks.notNow')}
        </button>
      </section>
    </Modal>
  );
}

/**
 * The game's share (ADR 0045): a `named` feature, so a device profile gets its name first; then "Gửi", "Chép link" and
 * "Mã QR". The link is made only when the player taps one of them — a game cannot spend the player's links of the day,
 * and closing leaves nothing behind.
 */
function GameShareSheet({
  ask,
  game,
  session,
}: {
  ask: Extract<GameAsk, { kind: 'share' }>;
  game: GameSummary;
  session: PlayingSession;
}) {
  const { t } = useTranslation();
  const failed = useRef<ShareError | null>(null);
  return (
    <Modal open title={t('share.title', { game: game.name })} onClose={() => ask.close(failed.current)}>
      <AtTables session={session} purpose="share" inline onSignIn={ask.signIn}>
        {() => (
          <ShareChoices
            ask={ask}
            game={game}
            onError={(error) => {
              failed.current = error;
            }}
          />
        )}
      </AtTables>
    </Modal>
  );
}

function ShareChoices({
  ask,
  game,
  onError,
}: {
  ask: Extract<GameAsk, { kind: 'share' }>;
  game: GameSummary;
  onError(error: ShareError | null): void;
}) {
  const { t } = useTranslation();
  const [link, setLink] = useState<ShareLinkView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code: ShareError; key: string } | null>(null);
  const [shown, setShown] = useState<'copied' | 'qr' | null>(null);
  const canSend = typeof navigator.share === 'function';

  /** The link, made on the first tap and kept for the next: one link per sheet. */
  const made = async (): Promise<ShareLinkView | null> => {
    if (link) return link;
    setBusy(true);
    setError(null);
    onError(null);
    try {
      const next = await links.make({
        kind: 'entry',
        gameId: game.id,
        payload: ask.payload,
        ...(ask.level ? { level: ask.level } : {}),
        ...(ask.text ? { text: ask.text } : {}),
      });
      setLink(next);
      return next;
    } catch (caught) {
      const code = shareErrorOf(caught);
      setError({ code, key: code === 'offline' ? 'gameAsks.offline' : errorKey(caught) });
      onError(code);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const urlOf = (view: ShareLinkView) => shareUrl(view.code, window.location.origin);
  // The game's words when they passed the API's checks, else the hub's own (ADR 0045).
  const messageOf = (view: ShareLinkView) => view.message ?? t('share.text', { game: game.name });

  const send = async () => {
    const view = await made();
    if (!view) return;
    try {
      await navigator.share({ title: t('appName'), text: messageOf(view), url: urlOf(view) });
      ask.sent();
    } catch {
      // Closed without sending, or the browser wants a fresh tap now that the link is made: the sheet stays.
    }
  };
  const copy = async () => {
    const view = await made();
    if (!view) return;
    if (await copyText(urlOf(view))) {
      setShown('copied');
      ask.sent();
    }
  };
  const qr = async () => {
    const view = await made();
    if (!view) return;
    setShown('qr');
    ask.sent();
  };

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-ink">{t('gameAsks.shareBody', { game: game.name })}</p>
      {link && shown === 'qr' ? (
        <QrCode text={urlOf(link)} label={t('share.qr', { game: game.name })} />
      ) : null}
      {link ? (
        <>
          {/* The message that goes with the link: the game's words when they passed the checks, else the hub's. */}
          <p className="w-full rounded-2xl bg-soft px-4 py-3 text-ink">{messageOf(link)}</p>
          <p className="wrap-anywhere text-ink-soft text-sm">{urlOf(link)}</p>
        </>
      ) : null}
      {error ? (
        <p role="alert" className="w-full rounded-2xl bg-danger-soft px-4 py-3 text-center text-danger">
          {t(error.key)}
        </p>
      ) : null}
      <div className="flex w-full flex-col gap-2">
        {canSend ? (
          <Button busy={busy} onClick={() => void send()}>
            {t('gameAsks.send')}
          </Button>
        ) : null}
        <Button variant={canSend ? 'secondary' : 'primary'} busy={busy} onClick={() => void copy()}>
          {shown === 'copied' ? t('share.copied') : t('share.copy')}
        </Button>
        <Button variant="secondary" busy={busy} onClick={() => void qr()}>
          {t('gameAsks.qr')}
        </Button>
      </div>
    </div>
  );
}

/** The hub's notice over the game's menu: the link's place did not open in this build (ADR 0045). */
export function EntryNotice({ open, game, onClose }: { open: boolean; game: GameSummary; onClose(): void }) {
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
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(22rem,calc(100vw-2rem))] rounded-3xl bg-surface p-6 text-center text-ink shadow-xl backdrop:bg-scrim"
    >
      <h2 className="font-black text-2xl">{t('gameAsks.noticeTitle')}</h2>
      <p className="mt-2 text-ink-soft">{t('gameAsks.noticeBody', { game: game.name })}</p>
      <button
        type="button"
        onClick={onClose}
        className="mt-6 min-h-14 w-full rounded-2xl bg-brand font-bold text-on-brand text-xl active:scale-95 active:bg-brand-strong"
      >
        {t('gameAsks.noticeOk')}
      </button>
    </dialog>
  );
}

/** A line under the game's name while it opens again after signing in. */
export function Reopening({ game }: { game: GameSummary }): ReactNode {
  const { t } = useTranslation();
  return <span className="text-ink-soft">{t('gameAsks.reopening', { game: game.name })}</span>;
}
