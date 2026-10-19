import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { admin } from '../api/client.ts';
import { count, dateTime } from '../format.ts';
import { meKey } from '../security/Gate.tsx';
import { RecoveryCodes } from '../security/RecoveryCodes.tsx';
import { StepUp } from '../security/StepUp.tsx';
import { Button, problem } from '../ui/forms.tsx';
import { Card, Fact, Failed, Loading, PageTitle } from '../ui/ui.tsx';

/** This account's two-factor authentication: new recovery codes, or turning it off — both behind step-up level 2. */
export function SecurityPage() {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: meKey, queryFn: admin.me });
  const twoFactor = useQuery({ queryKey: ['admin', 'two-factor'], queryFn: admin.twoFactor });
  const [codes, setCodes] = useState<string[] | null>(null);
  const [sure, setSure] = useState(false);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['admin'] });
  const renew = useMutation({
    mutationFn: admin.newRecoveryCodes,
    onSuccess: (result) => setCodes(result.codes),
  });
  const disable = useMutation({ mutationFn: admin.disableTwoFactor, onSuccess: refresh });

  if (me.isPending || twoFactor.isPending) return <Loading />;
  if (me.isError || twoFactor.isError) return <Failed retry={refresh} />;

  return (
    <>
      <PageTitle title="Bảo mật" />
      <Card title="Xác thực hai lớp">
        <div>
          <Fact label="Trạng thái">{twoFactor.data.enabled ? 'Đang bật' : 'Đang tắt'}</Fact>
          <Fact label="Mở trên thiết bị này đến">
            {twoFactor.data.openUntil ? dateTime(twoFactor.data.openUntil) : '—'}
          </Fact>
          <Fact label="Mã dự phòng còn lại">{count(twoFactor.data.recoveryCodesLeft)}</Fact>
        </div>
        {codes ? (
          <RecoveryCodes
            codes={codes}
            onDone={() => {
              setCodes(null);
              refresh();
            }}
          />
        ) : !me.data.secureUntil ? (
          <>
            <p className="text-ink-soft text-sm">
              Để tạo mã dự phòng mới hoặc tắt xác thực hai lớp, xác nhận lại là bạn.
            </p>
            <StepUp hasPassword={me.data.hasPassword} email={me.data.email} onDone={refresh} />
          </>
        ) : (
          <div className="flex flex-col gap-3">
            {renew.isError || disable.isError ? (
              <p role="alert" className="text-danger">
                {problem(renew.error ?? disable.error)}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" busy={renew.isPending} onClick={() => renew.mutate()}>
                Tạo mã dự phòng mới
              </Button>
              {sure ? (
                <Button variant="danger" busy={disable.isPending} onClick={() => disable.mutate()}>
                  Tắt, và đóng bảng quản trị trên mọi thiết bị
                </Button>
              ) : (
                <Button variant="danger" onClick={() => setSure(true)}>
                  Tắt xác thực hai lớp
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
