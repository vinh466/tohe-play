import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { admin, type DeviceProfileDetail } from '../api/client.ts';
import { dateTime } from '../format.ts';
import { meKey, useSignedIn } from '../security/Gate.tsx';
import { StepUp } from '../security/StepUp.tsx';
import { Button, Field, problem } from '../ui/forms.tsx';
import { Card, Failed, Loading } from '../ui/ui.tsx';

/**
 * Device profiles on the server (ADR 0043): players without an account, who sat at a table. No email, no ID: found by
 * name. A moderator renames one — to hide a name — or takes it off its tables, as for any profile (ADR 0035, 0027).
 */
export function DeviceProfiles({ q }: { q: string }) {
  const queryClient = useQueryClient();
  const me = useSignedIn();
  const found = useQuery({
    queryKey: ['admin', 'device-profiles', q],
    queryFn: () => admin.deviceProfiles(q),
  });
  const may = me.data?.permissions.includes('admin.profiles.moderate') ?? false;
  const secure = Boolean(me.data?.secureUntil);
  return (
    <Card title={q ? `Hồ sơ trên máy cho “${q}”` : 'Hồ sơ trên máy — dùng gần đây nhất'}>
      {found.isPending ? (
        <Loading />
      ) : found.isError ? (
        <Failed retry={() => void found.refetch()} />
      ) : found.data.length === 0 ? (
        <p className="text-ink-soft">Không có hồ sơ trên máy nào.</p>
      ) : (
        <>
          {may && !secure ? (
            <div className="mb-4 flex flex-col gap-2">
              <p className="text-ink-soft text-sm">Để đổi tên hoặc mời khỏi bàn, xác nhận lại là bạn.</p>
              <StepUp onDone={() => void queryClient.invalidateQueries({ queryKey: meKey })} />
            </div>
          ) : null}
          <ul className="flex flex-col gap-4">
            {found.data.map((profile) => (
              <DeviceProfileRow
                key={profile.id}
                profile={profile}
                canModerate={may && secure}
                onChange={() =>
                  void queryClient.invalidateQueries({ queryKey: ['admin', 'device-profiles'] })
                }
              />
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function DeviceProfileRow({
  profile,
  canModerate,
  onChange,
}: {
  profile: DeviceProfileDetail;
  canModerate: boolean;
  onChange(): void;
}) {
  const [name, setName] = useState(profile.name);
  // Composed, as the hub sends names: the API cannot normalize them itself (docs/architecture/identity.md#names).
  const rename = useMutation({
    mutationFn: () => admin.renameDeviceProfile(profile.id, name.normalize('NFC')),
    onSuccess: onChange,
  });
  const withdraw = useMutation({ mutationFn: () => admin.withdrawProfile(profile.id) });
  const earlier = profile.names.slice(1);
  return (
    <li className="flex flex-col gap-2 border-line border-b pb-4 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-xl">{profile.avatar}</span>
        <span className="font-semibold text-ink">{profile.name}</span>
        <span className="font-mono text-ink-soft text-xs">{profile.id}</span>
      </div>
      <p className="text-ink-soft text-sm">
        Tạo {dateTime(profile.createdAt)} · dùng gần nhất{' '}
        {profile.lastUsedAt ? dateTime(profile.lastUsedAt) : '—'} · điều khoản {profile.termsVersion ?? '—'}
        {profile.termsAcceptedAt ? ` (${dateTime(profile.termsAcceptedAt)})` : ''}
      </p>
      {earlier.length > 0 ? (
        <p className="text-ink-soft text-sm">
          Tên trước đây: {earlier.map((change) => `${change.name} (đến ${dateTime(change.at)})`).join(', ')}
        </p>
      ) : null}
      {canModerate ? (
        <div className="flex flex-wrap items-end gap-2">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              rename.mutate();
            }}
            className="flex min-w-56 flex-1 flex-wrap items-end gap-2"
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
          <Button variant="secondary" busy={withdraw.isPending} onClick={() => withdraw.mutate()}>
            Mời khỏi bàn chơi
          </Button>
          {withdraw.isSuccess ? <span className="text-ink-soft text-sm">Đã mời khỏi mọi bàn.</span> : null}
          {withdraw.isError ? (
            <span role="alert" className="text-danger text-sm">
              {problem(withdraw.error)}
            </span>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
