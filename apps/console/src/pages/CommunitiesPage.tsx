import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { admin, type Community, type InviteCode } from '../api/client.ts';
import { count, dateTime } from '../format.ts';
import { hubLink, useHubUrl } from '../hub.ts';
import { meKey, useSignedIn } from '../security/Gate.tsx';
import { StepUp } from '../security/StepUp.tsx';
import { Button, Field, problem } from '../ui/forms.tsx';
import { Badge, Card, Failed, Loading, PageTitle } from '../ui/ui.tsx';

const communitiesKey = ['admin', 'communities'] as const;

/** A community's name has a limit of its own (64), unlike a profile's (24). */
const nameProblems = { name_too_long: 'Tên dài quá 64 ký tự.' };

/**
 * Communities and their invite codes (ADR 0028). A code brings new accounts into its community — and, while
 * registration is by invite, it is the only way to make one. Changes ask for step-up level 2 first.
 */
export function CommunitiesPage() {
  const queryClient = useQueryClient();
  const me = useSignedIn();
  const communities = useQuery({ queryKey: communitiesKey, queryFn: admin.communities });

  if (me.isPending || communities.isPending) return <Loading />;
  if (me.isError || communities.isError) return <Failed retry={() => void communities.refetch()} />;

  const mayChange = me.data.permissions.includes('admin.settings.write');
  const canChange = mayChange && Boolean(me.data.secureUntil);
  const show = (next: Community[]) => queryClient.setQueryData(communitiesKey, next);
  return (
    <>
      <PageTitle title="Cộng đồng" aside="Mã mời đưa người mới vào một cộng đồng" />
      {mayChange && !canChange ? (
        <Card title="Thay đổi">
          <p className="text-ink-soft text-sm">
            Để tạo cộng đồng, tạo hay thu hồi mã mời, xác nhận lại là bạn.
          </p>
          <StepUp onDone={() => void queryClient.invalidateQueries({ queryKey: meKey })} />
        </Card>
      ) : null}
      {canChange ? <NewCommunity onChange={show} /> : null}
      {communities.data.length === 0 ? (
        <p className="text-ink-soft">Chưa có cộng đồng nào.</p>
      ) : (
        communities.data.map((community) => (
          <CommunityCard key={community.id} community={community} canChange={canChange} onChange={show} />
        ))
      )}
    </>
  );
}

function NewCommunity({ onChange }: { onChange: (next: Community[]) => void }) {
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: () => admin.createCommunity(name.trim()),
    onSuccess: (next) => {
      setName('');
      onChange(next);
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };
  return (
    <Card title="Cộng đồng mới">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <Field
            label="Tên, ví dụ “Bạn cờ lớp 6”"
            maxLength={64}
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={create.isError ? problem(create.error, nameProblems) : null}
          />
        </div>
        <Button type="submit" busy={create.isPending} disabled={!name.trim()}>
          Tạo cộng đồng
        </Button>
      </form>
    </Card>
  );
}

function CommunityCard({
  community,
  canChange,
  onChange,
}: {
  community: Community;
  canChange: boolean;
  onChange: (next: Community[]) => void;
}) {
  const revoke = useMutation({
    mutationFn: (code: string) => admin.revokeInviteCode(code),
    onSuccess: onChange,
  });
  return (
    <Card
      title={community.name}
      aside={
        <span className="text-ink-soft text-sm">
          {count(community.members)} tài khoản · tạo {dateTime(community.createdAt)}
        </span>
      }
    >
      {revoke.isError ? (
        <p role="alert" className="text-danger">
          {problem(revoke.error)}
        </p>
      ) : null}
      {community.codes.length === 0 ? (
        <p className="text-ink-soft text-sm">Chưa có mã mời.</p>
      ) : (
        // A list, not a table: each usable code carries its link, which no column could hold on a phone.
        <ul className="flex flex-col gap-2">
          {community.codes.map((code) => (
            <li key={code.code} className="flex flex-col gap-2 rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono font-semibold text-ink">{code.code}</span>
                <CodeStatus code={code} />
                <span className="text-ink-soft text-sm">
                  đã dùng{' '}
                  {code.maxUses === null ? count(code.uses) : `${count(code.uses)}/${count(code.maxUses)}`}
                  {' · '}
                  {code.expiresAt ? `hết hạn ${dateTime(code.expiresAt)}` : 'không hết hạn'}
                </span>
              </div>
              {code.usable ? (
                <InviteLink
                  code={code.code}
                  revoke={canChange ? () => revoke.mutate(code.code) : null}
                  busy={revoke.isPending && revoke.variables === code.code}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canChange ? <NewCode communityId={community.id} onChange={onChange} /> : null}
    </Card>
  );
}

function CodeStatus({ code }: { code: InviteCode }) {
  if (code.usable) return <Badge>Dùng được</Badge>;
  if (code.revokedAt) return <Badge tone="danger">Đã thu hồi</Badge>;
  if (code.maxUses !== null && code.uses >= code.maxUses) return <Badge tone="notice">Hết lượt</Badge>;
  return <Badge tone="notice">Hết hạn</Badge>;
}

/**
 * The link to share: the hub's sign-up with the code filled in — on the hub's host, not the console's (ADR 0042). Copied
 * where the browser allows it (HTTPS). Without the hub's address, the code alone.
 */
function InviteLink({ code, revoke, busy }: { code: string; revoke: (() => void) | null; busy: boolean }) {
  const [copied, setCopied] = useState(false);
  const hubUrl = useHubUrl();
  const register = `/account/register?invite=${encodeURIComponent(code)}`;
  const link = hubUrl ? hubLink(hubUrl, register) : code;
  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
  };
  return (
    <div className="flex flex-col gap-2">
      <span className="select-all font-mono text-ink-soft text-xs wrap-anywhere">{link}</span>
      <div className="flex flex-wrap gap-2">
        {window.isSecureContext && navigator.clipboard ? (
          <Button variant="secondary" className="px-3 py-1 text-sm" onClick={() => void copy()}>
            {copied ? 'Đã chép' : 'Chép link'}
          </Button>
        ) : null}
        {revoke ? (
          <Button variant="danger" className="px-3 py-1 text-sm" busy={busy} onClick={revoke}>
            Thu hồi
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** A new invite code, behind a button: one open form per community would bury the codes. */
function NewCode({ communityId, onChange }: { communityId: string; onChange: (next: Community[]) => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [until, setUntil] = useState('');
  const create = useMutation({
    mutationFn: () =>
      admin.createInviteCode(communityId, {
        code: code.trim() || null,
        maxUses: maxUses ? Number(maxUses) : null,
        // The end of that day, here.
        expiresAt: until ? new Date(`${until}T23:59:59`).toISOString() : null,
      }),
    onSuccess: (next) => {
      setCode('');
      setMaxUses('');
      setUntil('');
      setOpen(false);
      onChange(next);
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };
  if (!open) {
    return (
      <Button variant="secondary" className="w-fit" onClick={() => setOpen(true)}>
        Mã mời mới
      </Button>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 border-line border-t pt-3">
      <h3 className="font-semibold text-ink">Mã mời mới</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          label="Mã"
          hint="Để trống thì Tò He tự đặt."
          mono
          maxLength={32}
          autoCapitalize="characters"
          spellCheck={false}
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
        />
        <Field
          label="Số lượt"
          hint="Để trống: không giới hạn."
          type="number"
          inputMode="numeric"
          min={1}
          value={maxUses}
          onChange={(event) => setMaxUses(event.target.value)}
        />
        <Field
          label="Hết hạn sau ngày"
          hint="Để trống: không hết hạn."
          type="date"
          value={until}
          onChange={(event) => setUntil(event.target.value)}
        />
      </div>
      {create.isError ? (
        <p role="alert" className="text-danger text-sm">
          {problem(create.error)}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" busy={create.isPending}>
          Tạo mã mời
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Thôi
        </Button>
      </div>
    </form>
  );
}
