// A version's review, for a session with studio.review (ADR 0051, docs/architecture/asset-studio.md, Reviewing in the
// app): the checklist a person must look at, approve, reject, deprecate — behind step-up — and, apart, withdraw.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { ApiError, type CheckProblem, type PackVersion, type StudioMe, studio } from '../api/client.ts';
import {
  approveReady,
  checklistDone,
  MAX_REASON,
  needsShareAlike,
  REVIEW_CHECKLIST,
  reasonGiven,
  SHARE_ALIKE,
  stepUpOpen,
  versionActions,
  versionName,
} from '../review.ts';
import { meKey } from '../security/Gate.tsx';
import { StepUp } from '../security/StepUp.tsx';
import { Button, Checkbox, Field, problem, TextArea } from '../ui/forms.tsx';
import { Section } from '../ui/ui.tsx';
import { packsKey } from './LibraryPage.tsx';

export const versionKey = (versionId: string) => ['studio', 'version', versionId] as const;

/**
 * After a review action: the version as the API returned it, and the lists that show its status asked again. A
 * `step_up_required` — step-up ran out meanwhile — asks who is signed in again, so the page asks for the code.
 */
function useReviewed(version: PackVersion) {
  const queryClient = useQueryClient();
  return {
    onSuccess: (updated: PackVersion) => {
      queryClient.setQueryData(versionKey(updated.id), updated);
      void queryClient.invalidateQueries({ queryKey: packsKey });
      void queryClient.invalidateQueries({ queryKey: ['studio', 'pack', version.packId] });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.code === 'step_up_required') {
        void queryClient.invalidateQueries({ queryKey: meKey });
      }
    },
  };
}

/** The review of one version: what its status and the session allow, nothing else. */
export function VersionReview({ version, me }: { version: PackVersion; me: StudioMe }) {
  const actions = versionActions(me, version.status);
  const deciding = actions.approve || actions.reject || actions.deprecate;
  return (
    <>
      {deciding ? (
        <Section title="Xét duyệt">
          {actions.approve ? (
            <Decide key={version.id} version={version} me={me} />
          ) : stepUpOpen(me) ? (
            <Deprecate version={version} />
          ) : (
            <StepUp why="Để ngừng dùng phiên bản này, xác nhận lại là bạn." />
          )}
        </Section>
      ) : null}
      {actions.withdraw ? <Withdraw key={version.id} version={version} /> : null}
    </>
  );
}

/**
 * A submitted version: the checklist, then — once step-up is open — approve or reject. The ticks are the reviewer's own
 * check: kept in the page only, empty again on every visit.
 */
function Decide({ version, me }: { version: PackVersion; me: StudioMe }) {
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const tick = (id: string, on: boolean) => {
    const next = new Set(ticked);
    if (on) next.add(id);
    else next.delete(id);
    setTicked(next);
  };
  return (
    <>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-semibold text-ink">Trước khi duyệt, đã xem kỹ:</legend>
        {REVIEW_CHECKLIST.map((item) => (
          <Checkbox
            key={item.id}
            label={item.label}
            hint={item.hint}
            checked={ticked.has(item.id)}
            onChange={(on) => tick(item.id, on)}
          />
        ))}
      </fieldset>
      {stepUpOpen(me) ? (
        <Verdict version={version} ticked={ticked} />
      ) : (
        <StepUp why="Để duyệt hay từ chối, xác nhận lại là bạn." />
      )}
    </>
  );
}

function Verdict({ version, ticked }: { version: PackVersion; ticked: ReadonlySet<string> }) {
  const reviewed = useReviewed(version);
  const shareAlikeNeeded = needsShareAlike(version.assets);
  const [allowShareAlike, setAllowShareAlike] = useState(false);
  const [shareAlikeReason, setShareAlikeReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const approve = useMutation({
    mutationFn: () =>
      studio.approveVersion(
        version.id,
        shareAlikeNeeded && allowShareAlike ? { reason: shareAlikeReason.trim() } : null,
      ),
    ...reviewed,
  });
  const reject = useMutation({
    mutationFn: () => studio.rejectVersion(version.id, rejectReason.trim()),
    ...reviewed,
  });
  const pending = approve.isPending || reject.isPending;
  const ready = approveReady({ ticked, shareAlikeNeeded, allowShareAlike, shareAlikeReason });
  const submitReject = (event: FormEvent) => {
    event.preventDefault();
    reject.mutate();
  };
  return (
    <>
      <div className="flex flex-col gap-3 border-line border-t pt-3">
        {shareAlikeNeeded ? (
          <div className="flex flex-col gap-3 rounded-xl bg-notice p-3">
            <p className="text-notice-ink text-sm">
              Có tài nguyên dùng giấy phép {SHARE_ALIKE}: chủ sở hữu quyết định từng trường hợp. Không cho
              phép thì từ chối phiên bản này.
            </p>
            <Checkbox
              role="switch"
              label={`Cho phép ${SHARE_ALIKE} trong phiên bản này`}
              checked={allowShareAlike}
              onChange={setAllowShareAlike}
              disabled={pending}
            />
            {allowShareAlike ? (
              <TextArea
                label="Lý do cho phép"
                maxLength={MAX_REASON}
                value={shareAlikeReason}
                onChange={(event) => setShareAlikeReason(event.target.value)}
                disabled={pending}
              />
            ) : null}
          </div>
        ) : null}
        <Button
          className="w-fit"
          busy={approve.isPending}
          disabled={!ready || pending}
          onClick={() => approve.mutate()}
        >
          Duyệt và xuất bản
        </Button>
        {checklistDone(ticked) ? null : (
          <p className="text-ink-soft text-sm">Đánh dấu đủ {REVIEW_CHECKLIST.length} mục ở trên để duyệt.</p>
        )}
        {approve.isError ? <Refusal error={approve.error} /> : null}
      </div>
      <form onSubmit={submitReject} className="flex flex-col gap-3 border-line border-t pt-3">
        <TextArea
          label="Lý do từ chối"
          hint="Người làm sẽ đọc lý do này để sửa trong bản nháp mới."
          maxLength={MAX_REASON}
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
          disabled={pending}
          error={reject.isError ? problem(reject.error) : null}
        />
        <Button
          type="submit"
          variant="secondary"
          className="w-fit"
          busy={reject.isPending}
          disabled={!reasonGiven(rejectReason) || pending}
        >
          Từ chối
        </Button>
      </form>
    </>
  );
}

/** An approved version: deprecated, with a reason if one is given. Games that pinned it keep working. */
function Deprecate({ version }: { version: PackVersion }) {
  const reviewed = useReviewed(version);
  const [reason, setReason] = useState('');
  const deprecate = useMutation({
    mutationFn: () => studio.deprecateVersion(version.id, reason.trim() || null),
    ...reviewed,
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    deprecate.mutate();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-ink-soft text-sm">
        Game đã ghim phiên bản này vẫn chạy; game ghim nó mới sẽ được cảnh báo.
      </p>
      <TextArea
        label="Lý do (không bắt buộc)"
        maxLength={MAX_REASON}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        disabled={deprecate.isPending}
        error={deprecate.isError ? problem(deprecate.error) : null}
      />
      <Button type="submit" variant="secondary" className="w-fit" busy={deprecate.isPending}>
        Ngừng dùng
      </Button>
    </form>
  );
}

/**
 * Withdrawing, apart from the rest and marked as what cannot be undone: the owner alone, with a reason and a fresh code
 * in the request. It deletes the version's manifest and its files no other version uses.
 */
function Withdraw({ version }: { version: PackVersion }) {
  const reviewed = useReviewed(version);
  const [reason, setReason] = useState('');
  const [code, setCode] = useState('');
  const [understood, setUnderstood] = useState(false);
  const name = versionName(version);
  const withdraw = useMutation({
    mutationFn: () => studio.withdrawVersion(version.id, { reason: reason.trim(), code: code.trim() }),
    ...reviewed,
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    withdraw.mutate();
  };
  const fieldError = (field: string) =>
    withdraw.error instanceof ApiError && withdraw.error.fields[field] ? problem(withdraw.error) : null;
  const otherError =
    withdraw.isError && !fieldError('code') && !fieldError('reason') ? problem(withdraw.error) : null;
  return (
    <Section title="Rút phiên bản" tone="danger">
      <p className="text-danger text-sm">
        Chỉ chủ sở hữu Tò He, khi bắt buộc (ví dụ một yêu cầu gỡ bỏ). Manifest của {name} và các tệp chỉ nó
        dùng bị xoá khỏi thư viện. Mọi game ghim {name} sẽ không build được nữa cho tới khi ghim phiên bản
        khác. Không hoàn tác được.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <TextArea
          label="Lý do rút"
          maxLength={MAX_REASON}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={withdraw.isPending}
          error={fieldError('reason')}
        />
        <Field
          label="Mã 6 số từ ứng dụng xác thực"
          inputMode="numeric"
          autoComplete="one-time-code"
          spellCheck={false}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          disabled={withdraw.isPending}
          error={fieldError('code')}
        />
        <Checkbox
          label={`Tôi hiểu: mọi game ghim ${name} sẽ không build được nữa.`}
          checked={understood}
          onChange={setUnderstood}
          disabled={withdraw.isPending}
        />
        <Button
          type="submit"
          variant="danger"
          className="w-fit"
          busy={withdraw.isPending}
          disabled={!reasonGiven(reason) || !code.trim() || !understood}
        >
          Rút {name}
        </Button>
        {otherError ? (
          <p role="alert" className="text-danger text-sm">
            {otherError}
          </p>
        ) : null}
      </form>
    </Section>
  );
}

/** A refused approval: the server's checks' report when there is one, its words otherwise. */
function Refusal({ error }: { error: unknown }) {
  const problems = error instanceof ApiError ? error.problems : [];
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-xl border border-danger-line bg-danger-soft p-3">
      <p className="font-semibold text-danger">{problem(error)}</p>
      {problems.length > 0 ? <CheckProblems problems={problems} /> : null}
    </div>
  );
}

/** Each problem of the server's checks as it gave it: its code, its asset (or the whole version), its message. */
export function CheckProblems({ problems }: { problems: readonly CheckProblem[] }) {
  return (
    <ul aria-label="Lỗi kiểm tra" className="flex flex-col gap-1">
      {problems.map((item) => (
        <li
          key={`${item.code} ${item.asset ?? ''} ${item.message}`}
          className="flex flex-wrap gap-x-2 text-ink text-sm"
        >
          <span className="font-mono font-semibold">{item.code}</span>
          <span className="font-mono">{item.asset ?? 'cả phiên bản'}</span>
          <span className="min-w-0 break-words">{item.message}</span>
        </li>
      ))}
    </ul>
  );
}
