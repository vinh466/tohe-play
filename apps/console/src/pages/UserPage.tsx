import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { type AccountDetail, type AdminMe, admin, type ProfileDetail } from '../api/client.ts';
import { dateTime, publicId, roleName } from '../format.ts';
import { meKey, useSignedIn } from '../security/Gate.tsx';
import { StepUp } from '../security/StepUp.tsx';
import { Button, Field, problem } from '../ui/forms.tsx';
import { Badge, Card, Fact, Failed, Loading, PageTitle } from '../ui/ui.tsx';

const roles = ['owner', 'admin', 'moderator', 'viewer'] as const;

/**
 * One account (ADR 0027): who it is, how it signs in, its profiles and the names they had — and, for whoever may, a
 * suspension, an end to its sessions, its role, a profile renamed. Changes ask for step-up level 2 first.
 */
export function UserPage() {
  const { id } = useParams({ from: '/_session/users/$id' });
  const queryClient = useQueryClient();
  const me = useSignedIn();
  const account = useQuery({ queryKey: ['admin', 'user', id], queryFn: () => admin.user(id) });

  if (me.isPending || account.isPending) return <Loading />;
  if (me.isError || account.isError) return <Failed retry={() => void account.refetch()} />;

  const user = account.data;
  const show = (next: AccountDetail) => queryClient.setQueryData(['admin', 'user', id], next);
  const may = (permission: string) => me.data.permissions.includes(permission);
  const self = me.data.accountId === user.id;
  const changes =
    !self && (may('admin.users.write') || may('admin.roles.write') || may('admin.profiles.moderate'));
  // One step-up for the whole page: until it passes, the changes stay hidden.
  const secure = Boolean(me.data.secureUntil);
  return (
    <>
      <PageTitle title={user.displayName} aside={user.email ?? user.username} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Tài khoản">
          <div>
            <Fact label="Email">{user.email ?? `— (tên đăng nhập cũ: ${user.username})`}</Fact>
            <Fact label="Tạo lúc">{dateTime(user.createdAt)}</Fact>
            <Fact label="Đăng nhập bằng">
              {[user.hasPassword ? 'Mật khẩu' : null, ...user.logins].filter(Boolean).join(', ') || '—'}
            </Fact>
            <Fact label="Xác thực hai lớp">{user.twoFactorEnabled ? 'Bật' : 'Tắt'}</Fact>
            <Fact label="Điều khoản">
              {user.termsVersion
                ? `${user.termsVersion} · ${dateTime(user.termsAcceptedAt ?? user.createdAt)}`
                : '—'}
            </Fact>
            <Fact label="Vai trò">{user.role ? roleName(user.role) : '—'}</Fact>
            <Fact label="Trạng thái">
              {user.suspendedAt ? (
                <Badge tone="danger">Tạm khoá từ {dateTime(user.suspendedAt)}</Badge>
              ) : user.deleteAfter ? null : (
                'Đang hoạt động'
              )}
              {/* Its owner asked to delete it (ADR 0034); past its seven days, it waits for an admin (ADR 0038). */}
              {user.deleteAfter ? (
                new Date(user.deleteAfter).getTime() <= Date.now() ? (
                  <Badge tone="danger">Đến hạn xoá — chờ quản trị viên xoá hẳn</Badge>
                ) : (
                  <Badge tone="notice">Chờ xoá — đến hạn lúc {dateTime(user.deleteAfter)}</Badge>
                )
              ) : null}
            </Fact>
          </div>
          {user.suspendedReason ? (
            <p className="text-ink-soft text-sm">Lý do: {user.suspendedReason}</p>
          ) : null}
        </Card>
        {self ? (
          <Card title="Thao tác">
            <p className="text-ink-soft">Đây là tài khoản của bạn: đổi nó ở Tò He, không ở đây.</p>
          </Card>
        ) : changes && !secure ? (
          <Card title="Thao tác">
            <p className="text-ink-soft text-sm">
              Để thay đổi tài khoản này hoặc hồ sơ của nó, xác nhận lại là bạn.
            </p>
            <StepUp onDone={() => void queryClient.invalidateQueries({ queryKey: meKey })} />
          </Card>
        ) : may('admin.users.write') || may('admin.roles.write') ? (
          <Actions me={me.data} user={user} onChange={show} />
        ) : null}
      </div>
      <Card title="Hồ sơ">
        <ul className="flex flex-col gap-4">
          {user.profiles.map((profile) => (
            <ProfileRow
              key={profile.id}
              profile={profile}
              canModerate={may('admin.profiles.moderate') && !self && secure}
              onChange={show}
            />
          ))}
        </ul>
      </Card>
    </>
  );
}

function Actions({
  me,
  user,
  onChange,
}: {
  me: AdminMe;
  user: AccountDetail;
  onChange: (next: AccountDetail) => void;
}) {
  const [reason, setReason] = useState('');
  const [role, setRole] = useState(user.role ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => admin.deleteUser(user.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      await navigate({ to: '/users', search: { q: '', deleting: true } });
    },
  });
  // Its owner asked, and its seven days are over: the account waits for an admin (ADR 0038).
  const due = user.deleteAfter !== null && new Date(user.deleteAfter).getTime() <= Date.now();
  const suspend = useMutation({ mutationFn: () => admin.suspend(user.id, reason), onSuccess: onChange });
  const lift = useMutation({ mutationFn: () => admin.lift(user.id), onSuccess: onChange });
  const signOut = useMutation({ mutationFn: () => admin.signOut(user.id), onSuccess: onChange });
  const saveRole = useMutation({
    mutationFn: () => admin.setRole(user.id, role || null),
    onSuccess: onChange,
  });
  const failed = suspend.error ?? lift.error ?? signOut.error ?? saveRole.error ?? remove.error;

  const submitSuspend = (event: FormEvent) => {
    event.preventDefault();
    suspend.mutate();
  };
  return (
    <Card title="Thao tác">
      <div className="flex flex-col gap-4">
        {failed ? (
          <p role="alert" className="text-danger">
            {problem(failed)}
          </p>
        ) : null}
        {me.permissions.includes('admin.users.write') ? (
          <>
            {user.suspendedAt ? (
              <Button variant="secondary" busy={lift.isPending} onClick={() => lift.mutate()}>
                Mở khoá tài khoản
              </Button>
            ) : (
              <form onSubmit={submitSuspend} className="flex flex-col gap-2">
                <Field
                  label="Lý do tạm khoá (chỉ quản trị viên thấy)"
                  maxLength={300}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
                <Button type="submit" variant="danger" busy={suspend.isPending} disabled={!reason.trim()}>
                  Tạm khoá: không đăng nhập được, các phiên kết thúc
                </Button>
              </form>
            )}
            <Button variant="secondary" busy={signOut.isPending} onClick={() => signOut.mutate()}>
              Đăng xuất khỏi mọi thiết bị
            </Button>
            {user.deleteAfter && !due ? (
              <p className="text-ink-soft text-sm">
                Chủ tài khoản đã yêu cầu xoá. Tới {dateTime(user.deleteAfter)} họ còn đăng nhập lại để giữ
                được; sau đó tài khoản chờ quản trị viên xoá hẳn.
              </p>
            ) : null}
            {due && !confirmDelete ? (
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                Xoá hẳn tài khoản…
              </Button>
            ) : null}
            {due && confirmDelete ? (
              <div className="flex flex-col gap-2 rounded-xl border border-danger-line p-3">
                <p className="text-danger text-sm">
                  Xoá hẳn tài khoản này cùng {user.profiles.length} hồ sơ của nó: ván đã lưu, điểm, kết quả
                  trên bảng xếp hạng và các run xếp hạng. Ván online đã chơi vẫn còn cho người cùng bàn, nhưng
                  không còn gì của họ. Không thể hoàn tác.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="danger" busy={remove.isPending} onClick={() => remove.mutate()}>
                    Xoá hẳn
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                    Thôi
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
        {me.permissions.includes('admin.roles.write') ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="font-semibold text-ink text-sm">Vai trò</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="rounded-xl border border-line-strong bg-surface px-3 py-2 text-ink"
              >
                <option value="">Không có</option>
                {roles.map((name) => (
                  <option key={name} value={name}>
                    {roleName(name)}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="secondary"
              busy={saveRole.isPending}
              disabled={role === (user.role ?? '')}
              onClick={() => saveRole.mutate()}
            >
              Lưu vai trò
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function ProfileRow({
  profile,
  canModerate,
  onChange,
}: {
  profile: ProfileDetail;
  canModerate: boolean;
  onChange: (next: AccountDetail) => void;
}) {
  const [name, setName] = useState(profile.name);
  const [reason, setReason] = useState('');
  // Hidden from public boards (ADR 0029): the owner's switch stays as it is, and does not bring the profile back.
  const hide = useMutation({
    mutationFn: () => admin.hideProfile(profile.id, reason.trim()),
    onSuccess: (next) => {
      setReason('');
      onChange(next);
    },
  });
  const show = useMutation({ mutationFn: () => admin.showProfile(profile.id), onSuccess: onChange });
  // Composed, as the hub sends names: the API cannot normalize them itself (docs/architecture/identity.md#names).
  const rename = useMutation({
    mutationFn: () => admin.renameProfile(profile.id, name.normalize('NFC')),
    onSuccess: onChange,
  });
  const earlier = profile.names.slice(1);
  return (
    <li className="flex flex-col gap-2 border-line border-b pb-4 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-xl">{profile.avatar}</span>
        <span className="font-semibold text-ink">{profile.name}</span>
        <span className="font-mono text-ink-soft text-sm">{publicId(profile.publicId)}</span>
        <span className="text-ink-soft text-sm">
          {profile.kind === 'child' ? `Trẻ em ${profile.ageBand ?? ''}` : 'Người lớn'} · tạo{' '}
          {dateTime(profile.createdAt)}
        </span>
        {profile.hiddenFromBoards ? <Badge tone="danger">Bị ẩn khỏi bảng công khai</Badge> : null}
      </div>
      <p className="text-ink-soft text-sm">
        Bảng công khai: chủ tài khoản {profile.onPublicBoards ? 'bật' : 'tắt'}
        {profile.hiddenFromBoards ? ', nhưng hồ sơ đang bị ẩn' : ''}.
      </p>
      {earlier.length > 0 ? (
        <p className="text-ink-soft text-sm">
          Tên trước đây: {earlier.map((change) => `${change.name} (đến ${dateTime(change.at)})`).join(', ')}
        </p>
      ) : null}
      {canModerate ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            rename.mutate();
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <div className="min-w-56 flex-1">
            <Field
              label="Đổi tên hồ sơ này"
              maxLength={128}
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={rename.isError ? problem(rename.error) : null}
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            busy={rename.isPending}
            disabled={!name.trim() || name.normalize('NFC') === profile.name}
          >
            Đổi tên
          </Button>
        </form>
      ) : null}
      {canModerate && profile.hiddenFromBoards ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" busy={show.isPending} onClick={() => show.mutate()}>
            Cho hiện lại trên bảng công khai
          </Button>
          {show.isError ? (
            <span role="alert" className="text-danger text-sm">
              {problem(show.error)}
            </span>
          ) : null}
        </div>
      ) : canModerate ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            hide.mutate();
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <div className="min-w-56 flex-1">
            <Field
              label="Lý do ẩn khỏi bảng công khai (chỉ quản trị viên thấy)"
              maxLength={300}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              error={hide.isError ? problem(hide.error) : null}
            />
          </div>
          <Button type="submit" variant="danger" busy={hide.isPending} disabled={!reason.trim()}>
            Ẩn khỏi bảng công khai
          </Button>
        </form>
      ) : null}
    </li>
  );
}
