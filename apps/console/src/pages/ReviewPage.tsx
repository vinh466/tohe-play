import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import { admin, type ReviewEntry } from '../api/client.ts';
import { count, dateTime, levelName, levelTone, publicId, reasonName, since } from '../format.ts';
import { Button } from '../ui/forms.tsx';
import { Badge, Card, Failed, Loading, PageTitle } from '../ui/ui.tsx';

export type ReviewList = 'held' | 'decided';

/**
 * The review (ADR 0029): what the integrity engine held waits here for a person, oldest first; what people decided
 * about, or the engine rejected, is found again under "Đã quyết", the latest first — to reopen it.
 */
export function ReviewPage() {
  const { list } = useSearch({ from: '/_session/review' });
  const games = useQuery({ queryKey: ['admin', 'games'], queryFn: admin.games });
  const results = useInfiniteQuery({
    queryKey: ['admin', 'review', 'list', list],
    queryFn: ({ pageParam }) => (list === 'held' ? admin.held(pageParam) : admin.decided(pageParam)),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (page) => page.next ?? undefined,
  });

  const names = new Map((games.data ?? []).map((game) => [game.id, game.name]));
  const held = results.data?.pages[0]?.held;
  return (
    <>
      <PageTitle
        title="Xem xét kết quả"
        aside={
          <span className="flex gap-1">
            {(['held', 'decided'] as const).map((offered) => (
              <Link
                key={offered}
                to="/review"
                search={{ list: offered }}
                className="rounded-xl px-3 py-1 font-semibold text-ink-soft hover:bg-soft"
                activeProps={{ className: 'bg-soft text-ink', 'aria-current': 'page' }}
              >
                {offered === 'held'
                  ? `Chờ xem xét${held === undefined ? '' : ` (${count(held)})`}`
                  : 'Đã quyết'}
              </Link>
            ))}
          </span>
        }
      />
      {results.isPending ? (
        <Loading />
      ) : results.isError ? (
        <Failed retry={() => void results.refetch()} />
      ) : (
        <Card
          title={
            list === 'held' ? 'Chờ một người quyết, cũ nhất trước' : 'Người đã quyết, hoặc engine từ chối'
          }
        >
          {list === 'held' ? (
            <p className="text-ink-soft text-sm">
              Engine chỉ giữ lại, không phạt: kết quả ở đây chỉ chính người chơi thấy, kèm “Đang được xem
              xét”.
            </p>
          ) : null}
          <Entries entries={results.data.pages.flatMap((page) => page.results)} list={list} names={names} />
          {results.hasNextPage ? (
            <Button
              variant="secondary"
              busy={results.isFetchingNextPage}
              onClick={() => void results.fetchNextPage()}
            >
              Xem thêm
            </Button>
          ) : null}
        </Card>
      )}
    </>
  );
}

function Entries({
  entries,
  list,
  names,
}: {
  entries: ReviewEntry[];
  list: ReviewList;
  names: Map<string, string>;
}) {
  if (entries.length === 0) {
    return <p className="text-ink-soft">{list === 'held' ? 'Không có gì đang chờ.' : 'Chưa ai quyết gì.'}</p>;
  }

  // A list, not a table: six columns squeeze a phone's width into a word per line.
  return (
    <ul className="flex flex-col gap-2">
      {entries.map(({ result, player }) => (
        <li key={result.id} className="flex flex-col gap-1 rounded-xl border border-line p-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link
              to="/review/$id"
              params={{ id: String(result.id) }}
              className="font-semibold text-brand-ink underline underline-offset-4"
            >
              {player ? `${player.avatar} ${player.name}` : 'Hồ sơ không còn'}
            </Link>
            {player ? (
              <span className="font-mono text-ink-soft text-sm">{publicId(player.publicId)}</span>
            ) : null}
            <Badge tone={levelTone(result.level)}>{levelName(result.level)}</Badge>
          </div>
          <span className="text-ink">
            <span className="font-semibold tabular-nums">{count(result.value)} điểm</span> ·{' '}
            {names.get(result.gameId) ?? result.gameId}
            {result.board === 'default' ? '' : ` · bảng ${result.board}`}
          </span>
          <span className="break-words text-ink-soft text-sm">
            {reasonName(result.reason)}
            {result.by ? ` · ${result.by}` : ''} ·{' '}
            {list === 'held' ? `đã chờ ${since(result.since)}` : dateTime(result.since)}
          </span>
        </li>
      ))}
    </ul>
  );
}
