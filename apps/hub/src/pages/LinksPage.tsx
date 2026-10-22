import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, type GameSummary, links, type ShareLinkView } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { deviceProfileQuery, gamesQuery } from '../api/queries.ts';
import { formatEntryCode } from '../entry/codes.ts';
import { EXPIRY_CHOICES, shareUrl } from '../entry/share.ts';
import { nameOf } from '../launcher/gameWords.ts';
import { BackLink } from '../navigation/leave.tsx';
import { actAsDevice } from '../rooms/devicePlayer.ts';
import { AtTables } from '../session/AtTables.tsx';
import { RequireSession } from '../session/RequireSession.tsx';
import type { Player, SessionState } from '../session/session.ts';
import { Button } from '../ui/Button.tsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx';
import { copyText } from '../ui/copyText.ts';
import { Modal } from '../ui/Modal.tsx';
import { Loading, Screen } from '../ui/Screen.tsx';

type PlayingSession = Extract<SessionState, { status: 'device' | 'account' }> & { player: Player };

/**
 * "Link của tôi" (ADR 0044): the share links the profile playing made — opened, played, accounts made (shown from three
 * upward), whether each still opens — with a new expiry and revoking. A device profile that never reached the server has
 * made none, so it is not asked for a name only to see that.
 */
export function LinksPage() {
  return <RequireSession need="player">{(session) => <Links session={session} />}</RequireSession>;
}

function Links({ session }: { session: PlayingSession }) {
  const { t } = useTranslation();
  const device = useQuery({ ...deviceProfileQuery(), enabled: session.status === 'device' });
  if (session.status === 'device') {
    if (!device.data) return <Loading label={t('loading')} />;
    if (!device.data.server) {
      actAsDevice(null);
      return (
        <Frame>
          <Empty />
        </Frame>
      );
    }
  }
  return (
    <AtTables session={session} purpose="share">
      {(player) => (
        <Frame>
          <List player={player} />
        </Frame>
      )}
    </AtTables>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Screen narrow>
      <BackLink to="/play" className="font-semibold text-accent">
        ← {t('backToGames')}
      </BackLink>
      <div className="flex flex-col gap-1">
        <h1 className="font-black text-3xl text-brand-ink">{t('links.title')}</h1>
        <p className="text-ink-soft">{t('links.body')}</p>
      </div>
      {children}
    </Screen>
  );
}

function Empty() {
  const { t } = useTranslation();
  return <p className="rounded-2xl bg-surface p-5 text-center text-ink-soft shadow-sm">{t('links.empty')}</p>;
}

function List({ player }: { player: Player }) {
  const { t } = useTranslation();
  const mine = useQuery({ queryKey: ['links-mine', player.id], queryFn: () => links.mine(), retry: false });
  const games = useQuery(gamesQuery(player.id));
  if (mine.isPending) return <p className="text-center text-ink-soft">{t('loading')}</p>;
  if (mine.isError) {
    return (
      <div className="flex flex-col gap-3">
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-center text-danger">
          {t(errorKey(mine.error))}
        </p>
        <Button variant="secondary" onClick={() => void mine.refetch()}>
          {t('named.retry')}
        </Button>
      </div>
    );
  }
  if (mine.data.length === 0) return <Empty />;
  return (
    <>
      <ul className="flex flex-col gap-3">
        {mine.data.map((link) => (
          <LinkCard
            key={link.code}
            link={link}
            game={games.data?.find((game) => game.id === link.gameId)}
            player={player}
          />
        ))}
      </ul>
      <p className="text-center text-ink-soft text-sm">{t('links.accountsNote')}</p>
    </>
  );
}

/** A card's actions: three side by side on a phone, each still a finger's height (44 px). */
const action =
  'min-h-11 flex-1 whitespace-nowrap rounded-2xl px-3 font-bold transition active:scale-[0.97] disabled:opacity-50';

const stateStyle: Record<string, string> = {
  ok: 'bg-soft text-accent',
  expired: 'bg-notice text-notice-ink',
  used_up: 'bg-notice text-notice-ink',
  revoked: 'bg-danger-soft text-danger',
};

function LinkCard({ link, game, player }: { link: ShareLinkView; game?: GameSummary; player: Player }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [choosing, setChoosing] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const refresh = (next: ShareLinkView) => {
    queryClient.setQueryData<ShareLinkView[]>(['links-mine', player.id], (list) =>
      list?.map((item) => (item.code === next.code ? next : item)),
    );
    // The share sheet shows a live link again: it must not show a revoked one.
    void queryClient.invalidateQueries({ queryKey: ['share-link'] });
  };
  const change = useMutation({
    mutationFn: (hours: number) => links.change(link.code, hours),
    onSuccess: (next) => {
      setChoosing(false);
      refresh(next);
    },
  });
  const revoke = useMutation({ mutationFn: () => links.revoke(link.code), onSuccess: refresh });
  /** A refused change or revoke, in words: a link gone (a bare 404) has its own. */
  const said = (error: unknown) =>
    error instanceof ApiError && error.status === 404 && !error.code
      ? t('links.errors.gone')
      : t(errorKey(error));
  const date = (at: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(at));
  const when =
    link.state === 'revoked'
      ? t('links.revokedAt', { date: date(link.revokedAt ?? link.expiresAt) })
      : link.state === 'expired'
        ? t('links.expiredAt', { date: date(link.expiresAt) })
        : t('links.until', { date: date(link.expiresAt) });
  const accounts = link.counts.accountsMade;

  return (
    <li className="flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-3">
        {game?.iconUrl ? (
          <img src={game.iconUrl} alt="" className="size-12 rounded-xl" />
        ) : (
          <span className="grid size-12 place-items-center rounded-xl bg-soft text-2xl">🎲</span>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-bold text-ink text-lg">{game ? nameOf(game) : link.gameId}</span>
          <span className="font-semibold text-ink-soft tracking-wider">
            {formatEntryCode({ kind: 'share', code: link.code })}
          </span>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 font-semibold text-sm ${stateStyle[link.state] ?? 'bg-soft text-ink'}`}
        >
          {t(`links.state.${link.state}`, { defaultValue: link.state })}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {(
          [
            ['opened', link.counts.opened],
            ['played', link.counts.played],
            ['accounts', accounts],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="flex flex-col rounded-2xl bg-soft px-2 py-2">
            <dt className="text-ink-soft text-xs">{t(`links.${key}`)}</dt>
            <dd className="font-black text-ink text-xl tabular-nums">{value ?? '—'}</dd>
          </div>
        ))}
      </dl>
      <p className="text-ink-soft text-sm">
        {when}
        {link.maxUses !== null ? ` · ${t('links.uses', { uses: link.uses, max: link.maxUses })}` : ''}
      </p>
      {revoke.isError ? (
        <p role="alert" className="text-danger text-sm">
          {said(revoke.error)}
        </p>
      ) : null}
      {link.state === 'revoked' ? null : (
        <div className="flex flex-wrap gap-2">
          {link.state === 'ok' ? (
            <button
              type="button"
              className={`${action} bg-soft text-accent active:bg-soft-strong`}
              onClick={async () => {
                setCopied(await copyText(shareUrl(link.code, window.location.origin)));
                setTimeout(() => setCopied(false), 2500);
              }}
            >
              {copied ? t('share.copied') : t('share.copy')}
            </button>
          ) : null}
          <button
            type="button"
            className={`${action} bg-soft text-accent active:bg-soft-strong`}
            onClick={() => {
              change.reset();
              setChoosing(true);
            }}
          >
            {t('links.change')}
          </button>
          <button
            type="button"
            disabled={revoke.isPending}
            className={`${action} bg-danger-soft text-danger active:bg-danger-soft-strong`}
            onClick={() => setRevoking(true)}
          >
            {t('links.revoke')}
          </button>
        </div>
      )}
      <Modal open={choosing} title={t('links.changeTitle')} onClose={() => setChoosing(false)}>
        <div className="flex flex-col gap-3">
          <p className="text-ink-soft">{t('links.changeBody')}</p>
          {change.isError ? (
            <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-danger">
              {said(change.error)}
            </p>
          ) : null}
          {EXPIRY_CHOICES.map((hours) => (
            <Button
              key={hours}
              variant="secondary"
              busy={change.isPending && change.variables === hours}
              disabled={change.isPending}
              onClick={() => change.mutate(hours)}
            >
              {t(`links.expiry.h${hours}`)}
            </Button>
          ))}
        </div>
      </Modal>
      <ConfirmDialog
        open={revoking}
        title={t('links.revokeTitle')}
        body={t('links.revokeBody')}
        primary={{ label: t('links.keep'), onClick: () => setRevoking(false) }}
        secondary={{
          label: t('links.revokeYes'),
          onClick: () => {
            setRevoking(false);
            revoke.mutate();
          },
        }}
      />
    </li>
  );
}
