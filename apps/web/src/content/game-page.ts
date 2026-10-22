// One source per game (ADR 0047): a game's public page is written in its own folder, beside its code —
//   games/<id>/page/vi.md, en.md   the words, one file per language
//   games/<id>/page/facts.json     the facts the manifest does not hold and that do not depend on the language
// — and the rest comes from games/<id>/public/game.json. The folder is not under public/, so the games origin never
// serves it. Pure functions of the files' text: the pages (games.ts, through Vite), the preview pictures
// (scripts/render-og.ts) and the build's check (scripts/check-build.ts) read them with the same rules, and a file that
// breaks one fails the build with its path.
//
// A page's file, in the page's language (the headings are the page's own, `pageHeadings`):
//
//   ---
//   updated: 2026-10-22            the day its words were last revised (YYYY-MM-DD), shown on the page
//   kind: game ghép khối số         what it is in a few words, after the name in the page's title
//   ---
//
//   The answer: one or two sentences — what it is and for whom. No numbers the facts table holds (ages, players, a
//   round's length): they come from game.json and facts.json, never written twice.
//
//   ## Cách chơi                    3 to 5 numbered lines, in the order a first game goes
//   1. …
//
//   ## Hợp với ai                   who it suits, beyond what the manifest says
//   …
//
//   ## Hỏi đáp                      optional: the game's own questions, each a "### question?" and its answer
//   ### …?
//   …
//
//   ## Hình ảnh                     optional: pictures beside the file, "![what it shows](name.png)", one a line
//
// Plain text only: no HTML, links or emphasis. Front matter is one `key: value` a line.
import { z } from 'zod';
import type { Lang } from '../i18n.ts';

/** The headings of a page's file: the page shows the same words. */
export const pageHeadings = {
  vi: { howTo: 'Cách chơi', suits: 'Hợp với ai', questions: 'Hỏi đáp', pictures: 'Hình ảnh' },
  en: { howTo: 'How to play', suits: 'Who it suits', questions: 'Questions', pictures: 'Pictures' },
} satisfies Record<Lang, Record<'howTo' | 'suits' | 'questions' | 'pictures', string>>;

type Section = keyof (typeof pageHeadings)['vi'];

const text = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !/[<>`]|\*\*|\]\(/.test(value), 'plain text only: no HTML, code, emphasis or links');

/** A real day, written YYYY-MM-DD. */
export const IsoDate = z.iso.date();

/** The words of a game's page in one language, as its file holds them. */
export const GamePageText = z.strictObject({
  updated: IsoDate,
  kind: text.pipe(z.string().max(60)),
  /** One or two sentences: what it is and for whom. */
  answer: text.pipe(z.string().max(320)),
  howTo: z.array(text).min(3).max(5),
  suits: text,
  questions: z.array(
    z.strictObject({ q: text.refine((q) => q.endsWith('?'), 'a question ends with "?"'), a: text }),
  ),
  pictures: z.array(
    z.strictObject({
      file: z
        .string()
        .regex(/^[a-z0-9][a-z0-9-]*\.(png|jpg|webp)$/, 'a file beside the page: name.png, .jpg or .webp'),
      alt: text,
    }),
  ),
});
export type GamePageText = z.infer<typeof GamePageText>;

/**
 * How long a round lasts: `fixed` (a clock ends it), `about` (a typical range in minutes), or `open` (no set length:
 * a game goes on until it is over, and the game keeps the player's place).
 */
const Round = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('fixed'), seconds: z.int().positive() }),
  z
    .strictObject({
      kind: z.literal('about'),
      minMinutes: z.int().positive(),
      maxMinutes: z.int().positive(),
    })
    .refine((round) => round.minMinutes <= round.maxMinutes, 'minMinutes is more than maxMinutes'),
  z.strictObject({ kind: z.literal('open') }),
]);

/** games/<id>/page/facts.json: what the manifest does not say, the same in every language. */
export const GameFacts = z.strictObject({
  round: Round,
  /**
   * The game can be played with no connection once it has been opened: true only when that is guaranteed, not left to
   * the browser's cache (a games-origin service worker, ADR 0005's spike S1). The pages claim offline play only when
   * every game says true.
   */
  offline: z.boolean(),
});
export type GameFacts = z.infer<typeof GameFacts>;

/** An error that names the file, so a broken page says where it is. */
const fail = (where: string, problem: string): never => {
  throw new Error(`${where}: ${problem}`);
};

const issues = (error: z.ZodError) =>
  error.issues.map((issue) => `${issue.path.join('.') || '(file)'}: ${issue.message}`).join('; ');

/** Reads facts.json's parsed JSON; `where` names the file in errors. */
export function parseGameFacts(json: unknown, where: string): GameFacts {
  const result = GameFacts.safeParse(json);
  return result.success ? result.data : fail(where, issues(result.error));
}

/** Paragraphs of `lines`: blank lines part them, a paragraph's lines are joined with a space. */
const paragraphs = (lines: readonly string[]) =>
  lines
    .join('\n')
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split('\n')
        .map((line) => line.trim())
        .join(' ')
        .trim(),
    )
    .filter((block) => block !== '');

/** Reads a page's file in `lang`; `where` names the file in errors. */
export function parseGamePage(markdown: string, lang: Lang, where: string): GamePageText {
  const source = markdown.replace(/\r\n/g, '\n');
  const front = /^---\n([\s\S]*?)\n---\n/.exec(source);
  if (!front)
    return fail(where, 'no front matter: the file starts with ---, then updated: and kind:, then ---');
  const meta: Record<string, string> = {};
  for (const line of (front[1] ?? '').split('\n')) {
    if (line.trim() === '') continue;
    const field = /^([a-z]+):\s*(.*)$/.exec(line);
    if (!field) return fail(where, `front matter: "${line}" is not "key: value"`);
    const [, key = '', raw = ''] = field;
    if (key !== 'updated' && key !== 'kind') return fail(where, `front matter: unknown key "${key}"`);
    meta[key] = raw.trim().replace(/^(['"])(.*)\1$/, '$2');
  }

  // The answer, then the sections under their headings.
  const titles = Object.entries(pageHeadings[lang]) as [Section, string][];
  const sections = new Map<Section | 'answer', string[]>([['answer', []]]);
  let current: Section | 'answer' = 'answer';
  for (const line of source.slice(front[0].length).split('\n')) {
    const heading = /^## (.+)$/.exec(line.trim());
    if (heading) {
      const title = (heading[1] ?? '').trim();
      const section = titles.find(([, words]) => words === title)?.[0];
      if (!section) {
        return fail(
          where,
          `"## ${title}" is no heading of a page in ${lang}: ${titles.map(([, w]) => w).join(', ')}`,
        );
      }
      if (sections.has(section)) return fail(where, `"## ${title}" twice`);
      sections.set(section, []);
      current = section;
    } else {
      sections.get(current)?.push(line);
    }
  }

  // A numbered line starts a step; an indented line goes on with the one before.
  const steps: string[] = [];
  for (const line of (sections.get('howTo') ?? []).filter((line) => line.trim() !== '')) {
    const step = /^\d+\.\s+(.*)$/.exec(line);
    if (step) steps.push((step[1] ?? '').trim());
    else if (/^\s/.test(line) && steps.length > 0) steps.push(`${steps.pop()} ${line.trim()}`);
    else return fail(where, `${pageHeadings[lang].howTo}: "${line.trim()}" is not a numbered line`);
  }
  const [beforeFirst = '', ...asked] = (sections.get('questions') ?? []).join('\n').split(/^### /m);
  if (beforeFirst.trim() !== '') {
    return fail(
      where,
      `${pageHeadings[lang].questions}: each question is a "### question?" line, its answer below`,
    );
  }
  const questions = asked.map((block) => {
    const [q = '', ...answer] = block.split('\n');
    return { q: q.trim(), a: paragraphs(answer).join(' ') };
  });
  const pictures = paragraphs(sections.get('pictures') ?? [])
    .flatMap((block) => block.split(/\s+(?=!\[)/))
    .map((item) => {
      const picture = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(item);
      return picture
        ? { alt: picture[1] ?? '', file: picture[2] ?? '' }
        : fail(where, `${pageHeadings[lang].pictures}: "${item}" is not "![what it shows](name.png)"`);
    });

  const result = GamePageText.safeParse({
    updated: meta.updated,
    kind: meta.kind,
    answer: paragraphs(sections.get('answer') ?? []).join(' '),
    howTo: steps,
    suits: sections.has('suits') ? paragraphs(sections.get('suits') ?? []).join(' ') : undefined,
    questions,
    pictures,
  });
  return result.success ? result.data : fail(where, issues(result.error));
}

/** Every game can be played offline: only then may a page say so (ADR 0047). */
export const allOffline = (facts: readonly GameFacts[]): boolean =>
  facts.length > 0 && facts.every((fact) => fact.offline);

/** The latest of some days, written YYYY-MM-DD (they sort as text). */
export const latestDay = (days: readonly string[]): string => [...days].sort().at(-1) ?? '';
