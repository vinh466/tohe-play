import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import {
  type Agent,
  type AgentScope,
  type AgentToken,
  ApiError,
  admin,
  type NewAgentToken as MadeToken,
} from '../api/client.ts';
import { dateTime } from '../format.ts';
import { meKey, useSignedIn } from '../security/Gate.tsx';
import { StepUp } from '../security/StepUp.tsx';
import { Button, Field, problem } from '../ui/forms.tsx';
import { Badge, Card, cell, Failed, Loading, PageTitle, row, Table } from '../ui/ui.tsx';

const agentsKey = ['admin', 'agents'] as const;

/** What each scope allows, in the console's words; the API's own description otherwise. */
const scopeNames: Record<string, string> = {
  'studio.draft':
    'Tạo và sửa bản nháp của chính nó trong Asset Studio, tải tệp nháp lên, chạy kiểm tra mà không lưu',
};

const agentProblems = {
  name_too_long: 'Tên dài quá 60 ký tự.',
  note_too_long: 'Ghi chú dài quá 200 ký tự.',
  agent_exists: 'Đã có agent tên này.',
  agent_disabled: 'Agent này đã tắt, không nhận token mới.',
  scopes_required: 'Chọn ít nhất một quyền.',
  scope_unknown: 'Quyền này không có.',
  days_invalid: 'Số ngày từ 1 đến 90.',
};

/**
 * Agents (ADR 0052): AI agents that call Tò He's API with a token the owner gives them — named, with scopes, an expiry
 * and an audit of every use. Owners and admins see them; only the owner makes and disables agents and makes and revokes
 * tokens, after step-up. A token shows once, here, when it is made.
 */
export function AgentsPage() {
  const queryClient = useQueryClient();
  const me = useSignedIn();
  const agents = useQuery({ queryKey: agentsKey, queryFn: admin.agents });
  const scopes = useQuery({
    queryKey: [...agentsKey, 'scopes'],
    queryFn: admin.agentScopes,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const [made, setMade] = useState<{ agent: string; token: string } | null>(null);

  if (me.isPending || agents.isPending || scopes.isPending) return <Loading />;
  if (me.isError || agents.isError || scopes.isError) {
    return (
      <Failed
        retry={() => {
          void agents.refetch();
          void scopes.refetch();
        }}
      />
    );
  }

  const mayChange = me.data.permissions.includes('admin.agents.write');
  const canChange = mayChange && Boolean(me.data.secureUntil);
  const show = (next: Agent) =>
    queryClient.setQueryData<Agent[]>(agentsKey, (list = []) =>
      list.some((agent) => agent.id === next.id)
        ? list.map((agent) => (agent.id === next.id ? next : agent))
        : [next, ...list],
    );
  return (
    <>
      <PageTitle title="Agent" aside="AI gọi API của Tò He bằng token có quyền giới hạn" />
      {mayChange && !canChange ? (
        <Card title="Thay đổi">
          <p className="text-ink-soft text-sm">
            Để tạo, tắt agent hay tạo, thu hồi token, xác nhận lại là bạn.
          </p>
          <StepUp onDone={() => void queryClient.invalidateQueries({ queryKey: meKey })} />
        </Card>
      ) : null}
      {made ? <TokenOnce agent={made.agent} token={made.token} onDone={() => setMade(null)} /> : null}
      {canChange ? <NewAgent onMade={show} /> : null}
      {agents.data.length === 0 ? (
        <p className="text-ink-soft">Chưa có agent nào.</p>
      ) : (
        agents.data.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            scopes={scopes.data}
            canChange={canChange}
            onChange={show}
            onToken={(next) => {
              show(next.agent);
              setMade({ agent: next.agent.name, token: next.token });
            }}
          />
        ))
      )}
    </>
  );
}

/** The new token, shown this once: Tò He keeps only its hash. */
function TokenOnce({ agent, token, onDone }: { agent: string; token: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
  };
  return (
    <Card title={`Token mới của ${agent}`}>
      <p role="alert" className="rounded-xl bg-notice p-3 text-notice-ink text-sm">
        Token chỉ hiện một lần này. Chép và cất vào nơi an toàn ngay: đóng lại là Tò He không hiện lại được
        nữa.
      </p>
      <span className="select-all rounded-xl bg-soft p-3 font-mono text-ink text-sm wrap-anywhere">
        {token}
      </span>
      <div className="flex flex-wrap gap-2">
        {window.isSecureContext && navigator.clipboard ? (
          <Button variant="secondary" onClick={() => void copy()}>
            {copied ? 'Đã chép' : 'Chép token'}
          </Button>
        ) : null}
        <Button onClick={onDone}>Tôi đã cất token</Button>
      </div>
    </Card>
  );
}

function NewAgent({ onMade }: { onMade: (agent: Agent) => void }) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const create = useMutation({
    mutationFn: () => admin.createAgent(name.trim(), note.trim() || null),
    onSuccess: (agent) => {
      setName('');
      setNote('');
      onMade(agent);
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };
  const fields = create.error instanceof ApiError ? create.error.fields : {};
  return (
    <Card title="Agent mới">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Tên, ví dụ “studio-agent trên máy trạm”"
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={create.isError && !fields.note ? problem(create.error, agentProblems) : null}
          />
          <Field
            label="Ghi chú"
            hint="Không bắt buộc: chạy ở đâu, ai trông."
            maxLength={200}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            error={fields.note ? problem(create.error, agentProblems) : null}
          />
        </div>
        <Button type="submit" className="w-fit" busy={create.isPending} disabled={!name.trim()}>
          Tạo agent
        </Button>
      </form>
    </Card>
  );
}

function AgentCard({
  agent,
  scopes,
  canChange,
  onChange,
  onToken,
}: {
  agent: Agent;
  scopes: AgentScope[];
  canChange: boolean;
  onChange: (agent: Agent) => void;
  onToken: (made: MadeToken) => void;
}) {
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const disable = useMutation({
    mutationFn: () => admin.disableAgent(agent.id),
    onSuccess: (next) => {
      setConfirmDisable(false);
      onChange(next);
    },
  });
  const revoke = useMutation({
    mutationFn: (tokenId: string) => admin.revokeAgentToken(agent.id, tokenId),
    onSuccess: onChange,
  });
  const enabled = agent.disabledAt === null;
  return (
    <Card
      title={agent.name}
      aside={
        <span className="flex flex-wrap items-center gap-2 text-ink-soft text-sm">
          {enabled ? (
            <Badge>Đang bật</Badge>
          ) : (
            <Badge tone="danger">Đã tắt {dateTime(agent.disabledAt ?? '')}</Badge>
          )}
          tạo {dateTime(agent.createdAt)}
        </span>
      }
    >
      {agent.note ? <p className="text-ink-soft text-sm">{agent.note}</p> : null}
      {revoke.isError || disable.isError ? (
        <p role="alert" className="text-danger text-sm">
          {problem(revoke.error ?? disable.error, agentProblems)}
        </p>
      ) : null}
      {agent.tokens.length === 0 ? (
        <p className="text-ink-soft text-sm">Chưa có token.</p>
      ) : (
        <Table head={['Token', 'Quyền', 'Tạo', 'Hết hạn', 'Dùng lần cuối', 'Trạng thái', '']}>
          {agent.tokens.map((token) => (
            <tr key={token.id} className={row}>
              <td className={`${cell} font-mono text-xs`}>{token.id.slice(0, 8)}</td>
              <td className={`${cell} font-mono text-xs`}>{token.scopes.join(', ')}</td>
              <td className={`${cell} whitespace-nowrap`}>{dateTime(token.createdAt)}</td>
              <td className={`${cell} whitespace-nowrap`}>{dateTime(token.expiresAt)}</td>
              <td className={`${cell} whitespace-nowrap`}>
                {token.lastUsedAt ? dateTime(token.lastUsedAt) : 'Chưa dùng'}
              </td>
              <td className={cell}>
                <TokenState token={token} />
              </td>
              <td className={cell}>
                {canChange && usable(token) ? (
                  <Button
                    variant="danger"
                    className="px-3 py-1 text-sm"
                    busy={revoke.isPending && revoke.variables === token.id}
                    onClick={() => revoke.mutate(token.id)}
                  >
                    Thu hồi
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </Table>
      )}
      {canChange && enabled ? <NewToken agent={agent} scopes={scopes} onMade={onToken} /> : null}
      {canChange && enabled && !confirmDisable ? (
        <Button variant="danger" className="w-fit" onClick={() => setConfirmDisable(true)}>
          Tắt agent…
        </Button>
      ) : null}
      {canChange && enabled && confirmDisable ? (
        <div className="flex flex-col gap-2 rounded-xl border border-danger-line p-3">
          <p className="text-danger text-sm">
            Tắt agent này: mọi token của nó bị thu hồi ngay và nó không nhận token mới nữa. Không bật lại
            được.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" busy={disable.isPending} onClick={() => disable.mutate()}>
              Tắt agent
            </Button>
            <Button variant="secondary" onClick={() => setConfirmDisable(false)}>
              Thôi
            </Button>
          </div>
        </div>
      ) : null}
      <Button variant="secondary" className="w-fit" onClick={() => setAuditOpen(!auditOpen)}>
        {auditOpen ? 'Ẩn nhật ký' : 'Xem nhật ký'}
      </Button>
      {auditOpen ? <AgentAudit agentId={agent.id} /> : null}
    </Card>
  );
}

const usable = (token: AgentToken) => token.revokedAt === null && new Date(token.expiresAt) > new Date();

function TokenState({ token }: { token: AgentToken }) {
  if (token.revokedAt) return <Badge tone="danger">Đã thu hồi</Badge>;
  if (new Date(token.expiresAt) <= new Date()) return <Badge tone="notice">Hết hạn</Badge>;
  return <Badge>Dùng được</Badge>;
}

/** A new token, behind a button: the scopes it holds and how many days it lasts, 30 unless chosen. */
function NewToken({
  agent,
  scopes,
  onMade,
}: {
  agent: Agent;
  scopes: AgentScope[];
  onMade: (made: MadeToken) => void;
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [days, setDays] = useState('30');
  const create = useMutation({
    mutationFn: () => admin.createAgentToken(agent.id, chosen, Number(days)),
    onSuccess: (made) => {
      setChosen([]);
      setDays('30');
      setOpen(false);
      onMade(made);
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };
  if (!open) {
    return (
      <Button variant="secondary" className="w-fit" onClick={() => setOpen(true)}>
        Token mới
      </Button>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 border-line border-t pt-3">
      <h3 className="font-semibold text-ink">Token mới</h3>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold text-ink text-sm">Quyền</legend>
        {scopes.map((scope) => (
          <label key={scope.name} className="flex min-h-11 items-start gap-3 text-ink">
            <input
              type="checkbox"
              className="mt-1 size-5"
              checked={chosen.includes(scope.name)}
              onChange={(event) =>
                setChosen(
                  event.target.checked
                    ? [...chosen, scope.name]
                    : chosen.filter((name) => name !== scope.name),
                )
              }
            />
            <span className="flex flex-col">
              <span className="font-mono text-sm">{scope.name}</span>
              <span className="text-ink-soft text-sm">{scopeNames[scope.name] ?? scope.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="max-w-48">
        <Field
          label="Dùng được trong (ngày)"
          hint="Từ 1 đến 90."
          type="number"
          inputMode="numeric"
          min={1}
          max={90}
          value={days}
          onChange={(event) => setDays(event.target.value)}
        />
      </div>
      {create.isError ? (
        <p role="alert" className="text-danger text-sm">
          {problem(create.error, agentProblems)}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" busy={create.isPending} disabled={chosen.length === 0 || !days}>
          Tạo token
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Thôi
        </Button>
      </div>
    </form>
  );
}

/** Every use of the agent's tokens, refusals too, newest first, a page at a time. */
function AgentAudit({ agentId }: { agentId: string }) {
  const log = useInfiniteQuery({
    queryKey: [...agentsKey, agentId, 'audit'],
    queryFn: ({ pageParam }) => admin.agentAudit(agentId, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (page) => page.before ?? undefined,
  });
  if (log.isPending) return <Loading />;
  if (log.isError) return <Failed retry={() => void log.refetch()} />;

  const entries = log.data.pages.flatMap((page) => page.entries);
  return (
    <div className="flex flex-col gap-3 border-line border-t pt-3">
      <h3 className="font-semibold text-ink">Nhật ký</h3>
      {entries.length === 0 ? (
        <p className="text-ink-soft text-sm">Chưa dùng lần nào.</p>
      ) : (
        <Table head={['Lúc', 'Token', 'Quyền', 'Gọi', 'Kết quả']}>
          {entries.map((entry) => (
            <tr key={entry.id} className={row}>
              <td className={`${cell} whitespace-nowrap`}>{dateTime(entry.at)}</td>
              <td className={`${cell} font-mono text-xs`}>{entry.tokenId.slice(0, 8)}</td>
              <td className={`${cell} font-mono text-xs`}>{entry.scope}</td>
              <td className={`${cell} break-all font-mono text-xs`}>{entry.action}</td>
              <td className={cell}>
                <Result status={entry.result} />
              </td>
            </tr>
          ))}
        </Table>
      )}
      {log.hasNextPage ? (
        <Button
          variant="secondary"
          className="w-fit"
          busy={log.isFetchingNextPage}
          onClick={() => void log.fetchNextPage()}
        >
          Xem cũ hơn
        </Button>
      ) : null}
    </div>
  );
}

/** A status code, with what it means to the owner: refused by the token check, or the endpoint's own answer. */
function Result({ status }: { status: number }) {
  if (status === 401) return <Badge tone="danger">401 · token không dùng được</Badge>;
  if (status === 403) return <Badge tone="danger">403 · thiếu quyền</Badge>;
  if (status >= 200 && status < 300) return <Badge>{status}</Badge>;
  return <Badge tone="notice">{status}</Badge>;
}
