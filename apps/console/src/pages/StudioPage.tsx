import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { admin, type StudioMember, type StudioRole } from '../api/client.ts';
import { dateTime } from '../format.ts';
import { meKey, useSignedIn } from '../security/Gate.tsx';
import { StepUp } from '../security/StepUp.tsx';
import { Button, Field, problem } from '../ui/forms.tsx';
import { Badge, Card, cell, Failed, Loading, PageTitle, row, Table } from '../ui/ui.tsx';

const membersKey = ['admin', 'studio', 'members'] as const;

const studioRoles: { role: StudioRole; name: string }[] = [
  { role: 'contributor', name: 'Người đóng góp' },
  { role: 'reviewer', name: 'Người duyệt' },
];

const roleName = (role: string) => studioRoles.find((known) => known.role === role)?.name ?? role;

const studioProblems = {
  role_invalid: 'Chọn một vai trò Studio.',
  account_required: 'Nhập email của tài khoản.',
  account_not_found: 'Không có tài khoản nào dùng email này.',
  studio_member_not_found: 'Tài khoản này không còn vai trò Studio.',
};

/**
 * Studio roles (ADR 0051): who may make drafts in the Asset Studio, and who may approve them. A studio role is not a
 * platform role — it opens nothing in this console. Owners, admins and moderators see who holds one; only the owner
 * gives, changes and takes them, after step-up. Taking one away ends that person's Studio session at once.
 */
export function StudioPage() {
  const queryClient = useQueryClient();
  const me = useSignedIn();
  const members = useQuery({ queryKey: membersKey, queryFn: admin.studioMembers });

  if (me.isPending || members.isPending) return <Loading />;
  if (me.isError || members.isError) return <Failed retry={() => void members.refetch()} />;

  const mayChange = me.data.permissions.includes('admin.studio.write');
  const canChange = mayChange && Boolean(me.data.secureUntil);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: membersKey });
  return (
    <>
      <PageTitle title="Studio" aside="Ai làm và ai duyệt tài nguyên game trong Asset Studio" />
      <p className="text-ink-soft text-sm">
        Vai trò Studio không phải vai trò quản trị: nó không mở được gì trong trang này. Người đóng góp làm và
        sửa bản nháp. Người duyệt duyệt, từ chối hay ngừng dùng một phiên bản gói, và phải bật xác thực hai
        lớp mới đăng nhập Studio được.
      </p>
      {mayChange && !canChange ? (
        <Card title="Thay đổi">
          <p className="text-ink-soft text-sm">Để cấp, đổi hay gỡ vai trò Studio, xác nhận lại là bạn.</p>
          <StepUp onDone={() => void queryClient.invalidateQueries({ queryKey: meKey })} />
        </Card>
      ) : null}
      {canChange ? <Grant onDone={refresh} /> : null}
      <Card title="Người có vai trò Studio">
        {members.data.length === 0 ? (
          <p className="text-ink-soft">Chưa ai có vai trò Studio.</p>
        ) : (
          <Table head={['Tài khoản', 'Vai trò', 'Xác thực hai lớp', 'Cấp bởi', 'Lúc cấp', '']}>
            {members.data.map((member) => (
              <MemberRow key={member.accountId} member={member} canChange={canChange} onChange={refresh} />
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}

function RoleSelect({ value, onChange }: { value: StudioRole; onChange: (role: StudioRole) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-semibold text-ink text-sm">Vai trò</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as StudioRole)}
        className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-ink"
      >
        {studioRoles.map((known) => (
          <option key={known.role} value={known.role}>
            {known.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** A role given — or changed — by the account's email. */
function Grant({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StudioRole>('contributor');
  const grant = useMutation({
    mutationFn: () => admin.grantStudioRole({ email: email.trim() }, role),
    onSuccess: () => {
      setEmail('');
      onDone();
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    grant.mutate();
  };
  return (
    <Card title="Cấp vai trò Studio">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
          <Field
            label="Email tài khoản Tò He"
            hint="Đã có vai trò thì vai trò mới thay vai trò cũ."
            type="email"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={grant.isError ? problem(grant.error, studioProblems) : null}
          />
          <RoleSelect value={role} onChange={setRole} />
        </div>
        <Button type="submit" className="w-fit" busy={grant.isPending} disabled={!email.trim()}>
          Cấp vai trò
        </Button>
      </form>
    </Card>
  );
}

function MemberRow({
  member,
  canChange,
  onChange,
}: {
  member: StudioMember;
  canChange: boolean;
  onChange: () => void;
}) {
  const other: StudioRole = member.role === 'reviewer' ? 'contributor' : 'reviewer';
  const change = useMutation({
    mutationFn: () => admin.grantStudioRole({ accountId: member.accountId }, other),
    onSuccess: onChange,
  });
  const revoke = useMutation({
    mutationFn: () => admin.revokeStudioRole(member.accountId),
    onSuccess: onChange,
  });
  return (
    <tr className={row}>
      <td className={cell}>
        <div className="font-semibold text-ink">{member.displayName}</div>
        <div className="break-all text-ink-soft text-sm">{member.email ?? '—'}</div>
      </td>
      <td className={cell}>
        <Badge tone={member.role === 'reviewer' ? 'notice' : 'soft'}>{roleName(member.role)}</Badge>
      </td>
      <td className={cell}>
        {member.twoFactorEnabled ? (
          'Đã bật'
        ) : member.role === 'reviewer' ? (
          <Badge tone="danger">Chưa bật · chưa đăng nhập Studio được</Badge>
        ) : (
          'Chưa bật'
        )}
      </td>
      <td className={`${cell} break-all text-ink-soft text-sm`}>{member.grantedByName ?? '—'}</td>
      <td className={`${cell} whitespace-nowrap`}>{dateTime(member.grantedAt)}</td>
      <td className={cell}>
        {canChange ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                className="px-3 py-1 text-sm"
                busy={change.isPending}
                onClick={() => change.mutate()}
              >
                Đổi thành {roleName(other).toLowerCase()}
              </Button>
              <Button
                variant="danger"
                className="px-3 py-1 text-sm"
                busy={revoke.isPending}
                onClick={() => revoke.mutate()}
              >
                Gỡ vai trò
              </Button>
            </div>
            {change.isError || revoke.isError ? (
              <p role="alert" className="text-danger text-sm">
                {problem(change.error ?? revoke.error, studioProblems)}
              </p>
            ) : null}
          </div>
        ) : null}
      </td>
    </tr>
  );
}
