import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { type AdminShareLink, ApiError, admin } from '../api/client.ts';
import { count, dateTime, day } from '../format.ts';
import { meKey, useSignedIn } from '../security/Gate.tsx';
import { StepUp } from '../security/StepUp.tsx';
import { Button, Field, problem } from '../ui/forms.tsx';
import { Badge, Card, cell, Fact, Failed, Loading, PageTitle, row, Table } from '../ui/ui.tsx';

const stateNames: Record<string, string> = {
  ok: 'Đang mở',
  expired: 'Hết hạn',
  revoked: 'Đã thu hồi',
  used_up: 'Hết lượt',
};

const levelNames: Record<string, string> = {
  any: 'Ai cũng mở được',
  named: 'Cần tên hiển thị',
  account: 'Cần tài khoản',
};

/**
 * Share links (ADR 0044): one found by its code — its game, maker, state and every count by day — and revoked by a
 * moderator, with step-up level 2. A revoked link resolves as revoked, and its preview is the generic one; a card a
 * chat app already cached stays there.
 */
export function LinksPage() {
  const { code } = useSearch({ from: '/_session/links' });
  const navigate = useNavigate({ from: '/links' });
  const [text, setText] = useState(code);
  const found = useQuery({
    queryKey: ['admin', 'links', code],
    queryFn: () => admin.shareLink(code),
    enabled: code !== '',
    retry: false,
  });

  const find = (event: FormEvent) => {
    event.preventDefault();
    void navigate({ search: { code: text.trim() } });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Link chia sẻ" />
      <form onSubmit={find} className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <Field
            label="Mã link (8 ký tự, sau /s/)"
            mono
            maxLength={32}
            autoComplete="off"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={!text.trim()}>
          Tìm
        </Button>
      </form>
      {code === '' ? null : found.isPending ? (
        <Loading />
      ) : found.isError ? (
        found.error instanceof ApiError && found.error.status === 404 ? (
          <p className="text-ink-soft">Không có link nào với mã này.</p>
        ) : (
          <Failed retry={() => void found.refetch()} />
        )
      ) : (
        <ShareLinkCard link={found.data} />
      )}
    </div>
  );
}

function ShareLinkCard({ link }: { link: AdminShareLink }) {
  const queryClient = useQueryClient();
  const me = useSignedIn();
  const revoke = useMutation({
    mutationFn: () => admin.revokeShareLink(link.code),
    onSuccess: (next) => queryClient.setQueryData(['admin', 'links', link.code], next),
  });
  const mayRevoke = me.data?.permissions.includes('admin.profiles.moderate') ?? false;
  const secure = Boolean(me.data?.secureUntil);
  const maker = link.maker;
  return (
    <Card
      title={`/s/${link.code}`}
      aside={
        <Badge tone={link.state === 'ok' ? 'soft' : link.state === 'revoked' ? 'danger' : 'notice'}>
          {stateNames[link.state] ?? link.state}
        </Badge>
      }
    >
      <div>
        <Fact label="Trò chơi">
          {link.gameId} · {link.gameVersion}
        </Fact>
        <Fact label="Mở">{link.kind === 'game' ? 'Màn hình chính của trò chơi' : link.kind}</Fact>
        <Fact label="Ai mở được">{levelNames[link.level] ?? link.level}</Fact>
        <Fact label="Người tạo">
          {maker.name ?? '—'}
          {maker.child ? ' (hồ sơ trẻ em)' : ''}
          {maker.stopped ? ' · tài khoản đang bị khoá hoặc chờ xoá' : ''}
        </Fact>
        <Fact label={maker.accountId ? 'Tài khoản' : 'Hồ sơ trên máy'}>
          <span className="font-mono text-xs">{maker.accountId ?? maker.profileId}</span>
        </Fact>
        <Fact label="Tạo lúc">{dateTime(link.createdAt)}</Fact>
        <Fact label="Hết hạn">{dateTime(link.expiresAt)}</Fact>
        <Fact label="Lượt dùng">
          {count(link.uses)}
          {link.maxUses == null ? '' : ` / ${count(link.maxUses)}`}
        </Fact>
        {link.revokedAt ? <Fact label="Thu hồi lúc">{dateTime(link.revokedAt)}</Fact> : null}
        <Fact label="Mở link · vào chơi · tạo tài khoản">
          {count(link.opened)} · {count(link.played)} · {count(link.accountsMade)}
        </Fact>
      </div>
      {link.days.length > 0 ? (
        <Table head={['Ngày (UTC)', 'Mở link', 'Vào chơi', 'Tạo tài khoản']}>
          {link.days.map((entry) => (
            <tr key={entry.day} className={row}>
              <td className={cell}>{day(entry.day)}</td>
              <td className={`${cell} tabular-nums`}>{count(entry.opened)}</td>
              <td className={`${cell} tabular-nums`}>{count(entry.played)}</td>
              <td className={`${cell} tabular-nums`}>{count(entry.accountsMade)}</td>
            </tr>
          ))}
        </Table>
      ) : null}
      {mayRevoke && link.revokedAt == null ? (
        secure ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" busy={revoke.isPending} onClick={() => revoke.mutate()}>
              Thu hồi link
            </Button>
            {revoke.isError ? (
              <span role="alert" className="text-danger text-sm">
                {problem(revoke.error)}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-ink-soft text-sm">Để thu hồi link, xác nhận lại là bạn.</p>
            <StepUp onDone={() => void queryClient.invalidateQueries({ queryKey: meKey })} />
          </div>
        )
      ) : null}
    </Card>
  );
}
