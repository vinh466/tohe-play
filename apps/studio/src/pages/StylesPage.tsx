import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { ApiError, type StudioMe, type Style, studio, styleSampleUrl } from '../api/client.ts';
import { creatorName, dateTime, statusTone, styleStatusName, viewName } from '../format.ts';
import { MAX_REASON, reasonGiven, samplesUploaded, stepUpOpen, styleReviewable } from '../review.ts';
import { meKey, useSignedIn } from '../security/Gate.tsx';
import { StepUp } from '../security/StepUp.tsx';
import { Button, problem, TextArea } from '../ui/forms.tsx';
import { Badge, Empty, Fact, Facts, Failed, Loading, PageTitle, Section } from '../ui/ui.tsx';

export const stylesKey = ['studio', 'styles'] as const;

const linkClass = 'font-semibold text-brand-ink underline underline-offset-4';

/** /styles — the art bibles a pack names, newest first. */
export function StylesPage() {
  const styles = useQuery({ queryKey: stylesKey, queryFn: studio.styles });
  return (
    <>
      <PageTitle title="Phong cách" aside={styles.data ? `${styles.data.length} phong cách` : undefined} />
      {styles.isPending ? (
        <Loading />
      ) : styles.isError ? (
        <Failed error={styles.error} retry={() => void styles.refetch()} />
      ) : styles.data.length === 0 ? (
        <Empty>Chưa có phong cách nào.</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {styles.data.map((style) => (
            <li key={style.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Link to="/styles/$styleId" params={{ styleId: style.id }} className={`${linkClass} text-lg`}>
                  {style.name}
                </Link>
                <span className="font-mono text-ink-soft text-sm">{style.id}</span>
                <Badge tone={statusTone(style.status)}>{styleStatusName(style.status)}</Badge>
              </div>
              <p className="text-ink-soft text-sm">
                {viewName(style.view)}
                {style.tileSize ? ` · ô ${style.tileSize} px` : ''}
                {style.palette ? ` · ${style.palette.length} màu` : ' · không giới hạn màu'}
              </p>
              {style.palette ? <Palette colours={style.palette} /> : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export const styleKey = (styleId: string) => ['studio', 'style', styleId] as const;

/**
 * /styles/<styleId> — one style: what it holds, its review, and its sample pictures; for a reviewer and a draft,
 * approving or rejecting it.
 */
export function StylePage() {
  const { styleId } = useParams({ from: '/_session/styles/$styleId' });
  const me = useSignedIn();
  const style = useQuery({ queryKey: styleKey(styleId), queryFn: () => studio.style(styleId) });
  return (
    <>
      <PageTitle
        title={style.data?.name ?? styleId}
        aside={
          <Link to="/styles" className={linkClass}>
            Mọi phong cách
          </Link>
        }
      />
      {style.isPending ? (
        <Loading />
      ) : style.isError ? (
        <Failed error={style.error} retry={() => void style.refetch()} />
      ) : (
        <>
          <StyleDetail style={style.data} />
          {me && styleReviewable(me, style.data) ? (
            <StyleReview key={style.data.id} style={style.data} me={me} />
          ) : null}
        </>
      )}
    </>
  );
}

/** A draft style's review: approve it — every sample uploaded — or reject it with a reason, behind step-up. */
function StyleReview({ style, me }: { style: Style; me: StudioMe }) {
  return (
    <Section title="Xét duyệt phong cách">
      {stepUpOpen(me) ? (
        <StyleVerdict style={style} />
      ) : (
        <StepUp why="Để duyệt hay từ chối phong cách này, xác nhận lại là bạn." />
      )}
    </Section>
  );
}

function StyleVerdict({ style }: { style: Style }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const reviewed = {
    onSuccess: (updated: Style) => {
      queryClient.setQueryData(styleKey(updated.id), updated);
      void queryClient.invalidateQueries({ queryKey: stylesKey });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.code === 'step_up_required') {
        void queryClient.invalidateQueries({ queryKey: meKey });
      }
    },
  };
  const approve = useMutation({ mutationFn: () => studio.approveStyle(style.id), ...reviewed });
  const reject = useMutation({ mutationFn: () => studio.rejectStyle(style.id, reason.trim()), ...reviewed });
  const pending = approve.isPending || reject.isPending;
  const complete = samplesUploaded(style);
  const submitReject = (event: FormEvent) => {
    event.preventDefault();
    reject.mutate();
  };
  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-ink-soft text-sm">
          Đã duyệt thì phong cách không đổi được nữa, và các gói dùng nó mới được duyệt.
        </p>
        <Button
          className="w-fit"
          busy={approve.isPending}
          disabled={!complete || pending}
          onClick={() => approve.mutate()}
        >
          Duyệt phong cách
        </Button>
        {complete ? null : <p className="text-ink-soft text-sm">Còn hình mẫu chưa được tải lên.</p>}
        {approve.isError ? (
          <p role="alert" className="text-danger text-sm">
            {problem(approve.error)}
          </p>
        ) : null}
      </div>
      <form onSubmit={submitReject} className="flex flex-col gap-3 border-line border-t pt-3">
        <TextArea
          label="Lý do từ chối"
          hint="Người làm sửa phong cách theo lý do này, rồi nó lại chờ duyệt."
          maxLength={MAX_REASON}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={pending}
          error={reject.isError ? problem(reject.error) : null}
        />
        <Button
          type="submit"
          variant="secondary"
          className="w-fit"
          busy={reject.isPending}
          disabled={!reasonGiven(reason) || pending}
        >
          Từ chối
        </Button>
      </form>
    </>
  );
}

function StyleDetail({ style }: { style: Style }) {
  const samples = style.samples.filter((sample) => sample.uploaded);
  return (
    <>
      <Section
        title="Phong cách"
        aside={<Badge tone={statusTone(style.status)}>{styleStatusName(style.status)}</Badge>}
      >
        <Facts>
          <Fact label="Mã">
            <span className="font-mono">{style.id}</span>
          </Fact>
          <Fact label="Góc nhìn">{viewName(style.view)}</Fact>
          <Fact label="Ô">{style.tileSize ? `${style.tileSize} px` : 'Không chia ô'}</Fact>
          {style.outline ? <Fact label="Viền">{style.outline}</Fact> : null}
          <Fact label="Tạo bởi">{creatorName(style.createdBy)}</Fact>
          <Fact label="Tạo lúc">{dateTime(style.createdAt)}</Fact>
          {style.reviewedAt ? <Fact label="Xét duyệt">{dateTime(style.reviewedAt)}</Fact> : null}
          {style.reason ? <Fact label="Lý do từ chối">{style.reason}</Fact> : null}
        </Facts>
      </Section>
      <Section title={style.palette ? `Bảng màu (${style.palette.length})` : 'Bảng màu'}>
        {style.palette ? (
          <Palette colours={style.palette} />
        ) : (
          <Empty>Phong cách vẽ tay: không giới hạn màu.</Empty>
        )}
      </Section>
      <Section title={`Hình mẫu (${samples.length})`}>
        {samples.length === 0 ? (
          <Empty>Chưa có hình mẫu nào được tải lên.</Empty>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {samples.map((sample, index) => (
              <li
                key={sample.sha256}
                className="flex min-h-24 items-center justify-center overflow-auto rounded-xl bg-soft p-3"
              >
                <img
                  src={styleSampleUrl(style.id, sample.sha256)}
                  alt={`Hình mẫu ${index + 1} của ${style.name}`}
                  loading="lazy"
                  className="h-auto max-w-full [image-rendering:pixelated]"
                />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

/**
 * A style's colours as swatches with their hex codes. The colours are the style's data, not the Studio's own look, so
 * they are the one place a colour comes from outside the design tokens.
 */
export function Palette({ colours }: { colours: readonly string[] }) {
  return (
    <ul aria-label="Bảng màu" className="flex flex-wrap gap-1.5">
      {colours.map((colour) => (
        <li key={colour} className="flex items-center gap-1 rounded-lg border border-line px-1.5 py-1">
          <span
            aria-hidden="true"
            className="inline-block size-4 rounded border border-line-strong"
            style={{ backgroundColor: colour }}
          />
          <span className="font-mono text-ink-soft text-xs">{colour}</span>
        </li>
      ))}
    </ul>
  );
}
