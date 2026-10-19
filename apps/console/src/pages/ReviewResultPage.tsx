import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { lazy, Suspense, useState } from 'react';
import {
  type AdminMe,
  ApiError,
  admin,
  type ProfileCard,
  type ReviewDecision,
  type ReviewDetail,
} from '../api/client.ts';
import {
  count,
  dateTime,
  decisionDetails,
  evidenceName,
  levelName,
  levelTone,
  publicId,
  reasonName,
} from '../format.ts';
import { meKey, useSignedIn } from '../security/Gate.tsx';
import { StepUp } from '../security/StepUp.tsx';
import { Button, Field, problem } from '../ui/forms.tsx';
import { Badge, Card, cell, Fact, Failed, Loading, PageTitle, row, Stat, Table } from '../ui/ui.tsx';

/** The game in a frame, with the host it needs: loaded only when someone watches a run (ADR 0032). */
const WatchRun = lazy(() => import('./WatchRun.tsx'));

/**
 * One result as a person reviews it (ADR 0029): where it stands and why, what its profile did before on the board, a
 * ranked run's evidence and the run itself in the game (ADR 0032), every change of level — and the decision, after
 * step-up level 2. Nobody decides about their own results.
 */
export function ReviewResultPage() {
  const { id } = useParams({ from: '/_session/review/$id' });
  const resultId = Number(id);
  const valid = Number.isSafeInteger(resultId) && resultId > 0;
  const queryClient = useQueryClient();
  const me = useSignedIn();
  const games = useQuery({ queryKey: ['admin', 'games'], queryFn: admin.games });
  const detail = useQuery({
    queryKey: ['admin', 'review', 'result', resultId],
    queryFn: () => admin.reviewResult(resultId),
    enabled: valid,
  });

  if (!valid || (detail.error instanceof ApiError && detail.error.status === 404)) {
    return <p className="text-ink-soft">Không có kết quả này.</p>;
  }
  if (me.isPending || detail.isPending) return <Loading />;
  if (me.isError || detail.isError) return <Failed retry={() => void detail.refetch()} />;

  const { result, player, history, ranked, decisions } = detail.data;
  const game = games.data?.find((offered) => offered.id === result.gameId)?.name ?? result.gameId;
  const decided = (next: ReviewDetail) => {
    queryClient.setQueryData(['admin', 'review', 'result', resultId], next);
    void queryClient.invalidateQueries({ queryKey: ['admin', 'review', 'list'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
  };
  return (
    <>
      <PageTitle
        title={`${count(result.value)} điểm · ${game}`}
        aside={<Badge tone={levelTone(result.level)}>{levelName(result.level)}</Badge>}
      />
      <Link
        to="/review"
        search={{ list: result.level === 'held' ? 'held' : 'decided' }}
        className="w-fit font-semibold text-brand-ink text-sm underline underline-offset-4"
      >
        Về danh sách
      </Link>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Kết quả">
          <div>
            <Fact label="Hồ sơ">
              {player ? `${player.avatar} ${player.name} · ${publicId(player.publicId)}` : 'Hồ sơ không còn'}
            </Fact>
            {player ? (
              <Fact label="Tài khoản">
                {me.data.permissions.includes('admin.users.read') ? (
                  <Link
                    to="/users/$id"
                    params={{ id: player.accountId }}
                    className="break-all text-brand-ink underline underline-offset-4"
                  >
                    {player.account ?? 'Mở'}
                  </Link>
                ) : (
                  (player.account ?? '—')
                )}
              </Fact>
            ) : null}
            <Fact label="Game">{result.board === 'default' ? game : `${game} · bảng ${result.board}`}</Fact>
            <Fact label="Loại">{result.kind === 'hand' ? 'Ván trong phòng' : 'Lượt chơi'}</Fact>
            <Fact label="Ghi lúc">{dateTime(result.at)}</Fact>
            <Fact label="Lý do">{reasonName(result.reason)}</Fact>
            <Fact label="Từ lúc">
              {dateTime(result.since)}
              {result.by ? ` · ${result.by}` : ' · engine'}
            </Fact>
            <Fact label="Bằng chứng">{evidenceName(result.evidence)}</Fact>
          </div>
        </Card>
        <Decide me={me.data} detail={detail.data} onDecided={decided} />
      </div>
      {ranked ? (
        <Card title="Run xếp hạng">
          <div>
            <Fact label="Số nước">{count(ranked.moves)}</Fact>
            <Fact label="Thời gian, theo máy chủ">{count(ranked.seconds)} giây</Fact>
            <Fact label="Người chơi cần ít nhất">
              {count(Math.round((ranked.moves * ranked.minMsPerMove) / 100) / 10)} giây (
              {count(ranked.minMsPerMove)} ms một nước)
            </Fact>
            <Fact label="Game báo">{ranked.claimed === null ? '—' : count(ranked.claimed)}</Fact>
            <Fact label="Máy chủ chơi lại ra">{ranked.replayed === null ? '—' : count(ranked.replayed)}</Fact>
          </div>
          <RunWatch id={result.id} player={player} />
        </Card>
      ) : null}
      <Card title="Trước đó, cùng hồ sơ và bảng">
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <Stat label="Kỷ lục trước" value={history.best === null ? '—' : count(history.best)} />
          <Stat label="Số lượt được tính" value={count(history.runs)} />
        </div>
        {history.recent.length === 0 ? (
          <p className="text-ink-soft">Chưa có kết quả nào khác.</p>
        ) : (
          <Table head={['Điểm', 'Mức', 'Ghi lúc']}>
            {history.recent.map((recent) => (
              <tr key={recent.id} className={row}>
                <td className={`${cell} tabular-nums`}>
                  <Link
                    to="/review/$id"
                    params={{ id: String(recent.id) }}
                    className="text-brand-ink underline underline-offset-4"
                  >
                    {count(recent.value)}
                  </Link>
                </td>
                <td className={cell}>
                  <Badge tone={levelTone(recent.level)}>{levelName(recent.level)}</Badge>
                </td>
                <td className={`${cell} whitespace-nowrap`}>{dateTime(recent.at)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Card title="Các lần đổi mức" aside={<span className="text-ink-soft text-sm">Chỉ ghi thêm</span>}>
        <ol className="flex flex-col gap-3">
          {decisions.map((decision) => (
            <li key={`${decision.at}-${decision.to}-${decision.reason}`} className="flex flex-col gap-0.5">
              <span className="font-semibold text-ink">
                {decision.from ? `${levelName(decision.from)} → ` : ''}
                {levelName(decision.to)} · {reasonName(decision.reason)}
              </span>
              <span className="text-ink-soft text-sm">
                {dateTime(decision.at)} · {decision.actor ?? `engine, luật v${decision.ruleVersion}`}
              </span>
              {decisionDetails(decision.details) ? (
                <span className="break-words text-ink-soft text-sm">{decisionDetails(decision.details)}</span>
              ) : null}
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}

/** The run played back by the game itself, in the build that played it — while the games origin still serves it. */
function RunWatch({ id, player }: { id: number; player: ProfileCard | null }) {
  const [open, setOpen] = useState(false);
  const run = useQuery({
    queryKey: ['admin', 'review', 'run', id],
    queryFn: () => admin.reviewRun(id),
    enabled: open,
    staleTime: Number.POSITIVE_INFINITY,
  });

  if (!open) {
    return (
      <Button variant="secondary" className="w-fit" onClick={() => setOpen(true)}>
        ▶ Xem lại run trong game
      </Button>
    );
  }
  if (run.isPending) return <Loading />;
  if (run.isError) return <Failed retry={() => void run.refetch()} />;
  if (!run.data.build) {
    return (
      <p className="text-ink-soft text-sm">
        Bản {run.data.version} đã chơi run này không còn trên máy chủ game, nên không xem lại bằng game được;
        các con số ở trên vẫn đúng.
      </p>
    );
  }
  return (
    <Suspense fallback={<Loading />}>
      <WatchRun run={run.data} build={run.data.build} player={player} onClose={() => setOpen(false)} />
    </Suspense>
  );
}

function Decide({
  me,
  detail,
  onDecided,
}: {
  me: AdminMe;
  detail: ReviewDetail;
  onDecided: (next: ReviewDetail) => void;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const decide = useMutation({
    mutationFn: (decision: ReviewDecision) => admin.decide(detail.result.id, decision, note.trim() || null),
    onSuccess: (next) => {
      setNote('');
      onDecided(next);
    },
  });
  const { result, player } = detail;

  if (player && player.accountId === me.accountId) {
    return (
      <Card title="Quyết định">
        <p className="text-ink-soft">Kết quả của chính bạn: để một người khác quyết.</p>
      </Card>
    );
  }
  if (!me.secureUntil) {
    return (
      <Card title="Quyết định">
        <p className="text-ink-soft text-sm">Để quyết, xác nhận lại là bạn.</p>
        <StepUp onDone={() => void queryClient.invalidateQueries({ queryKey: meKey })} />
      </Card>
    );
  }

  // The API's rules: only a held result is approved, a rejected one is not rejected again, a decided one is reopened.
  const choices: Record<
    ReviewDecision,
    { allowed: boolean; label: string; variant: 'primary' | 'secondary' | 'danger'; explains: string }
  > = {
    approve: {
      allowed: result.level === 'held',
      label: `Duyệt: ${levelName(result.evidence === 'device' ? 'checked' : 'verified')}`,
      variant: 'primary',
      explains: `Duyệt: lên bảng, ${result.evidence === 'device' ? 'là số của thiết bị' : 'đã được máy chủ kiểm chứng'}.`,
    },
    reject: {
      allowed: result.level !== 'rejected',
      label: 'Từ chối',
      variant: 'danger',
      explains: 'Từ chối: không bảng nào tính; cần khoá cả tài khoản thì làm ở trang tài khoản.',
    },
    reopen: {
      allowed: ['rejected', 'checked', 'verified'].includes(result.level),
      label: 'Mở lại để xem xét',
      variant: 'secondary',
      explains: 'Mở lại: về hàng chờ, chỉ người chơi thấy, tới khi có người quyết.',
    },
  };
  const offered = (['approve', 'reject', 'reopen'] as const).filter((decision) => choices[decision].allowed);
  return (
    <Card title="Quyết định">
      <form onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-3">
        <Field
          label="Ghi chú cho các quản trị viên khác (không bắt buộc)"
          maxLength={300}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        {decide.isError ? (
          <p role="alert" className="text-danger">
            {problem(decide.error, { admin_self: 'Kết quả của chính bạn: để một người khác quyết.' })}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {offered.map((decision) => (
            <Button
              key={decision}
              variant={choices[decision].variant}
              busy={decide.isPending && decide.variables === decision}
              disabled={decide.isPending}
              onClick={() => decide.mutate(decision)}
            >
              {choices[decision].label}
            </Button>
          ))}
        </div>
        <p className="text-ink-soft text-sm">
          {offered.map((decision) => choices[decision].explains).join(' ')}
        </p>
      </form>
    </Card>
  );
}
