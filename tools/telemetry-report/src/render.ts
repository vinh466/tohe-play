// The telemetry report (GET /api/telemetry/report) as Markdown: what an agent reads in /health-report, with the
// findings worth a look listed first. The types mirror the API's TelemetryReport (services/api/openapi/tohe-api.json).

export interface ErrorGroup {
  source: string;
  fingerprint: string;
  message: string;
  stack?: string | null;
  occurrences: number;
  sessions: number;
  devices: number;
  firstSeen: string;
  lastSeen: string;
  new: boolean;
}

export interface FrameGroup {
  os: string;
  browser: string;
  deviceClass: string;
  renderer?: string | null;
  sessions: number;
  frames: number;
  slowShare: number;
  p95: string;
  slowestMs: number;
  stepP95Ms?: number | null;
}

export interface GameHealth {
  gameId?: string | null;
  gameVersion?: string | null;
  sessions: number;
  devices: number;
  sessionsWithErrors: number;
  errors: ErrorGroup[];
  frames: FrameGroup[];
  metrics: { name: string; samples: number; p50: number; p95: number; max: number }[];
  counts: { name: string; total: number; sessions: number }[];
}

/** The newcomer funnel (docs/architecture/telemetry.md): the hub's `hub.funnel.*` counts; a ratio is null when its base is 0. */
export interface Funnel {
  days: { day: string; counts: Record<string, number> }[];
  totals: Record<string, number>;
  ratios: {
    firstGamePerGuestStart: number | null;
    installAcceptedPerOffered: number | null;
    accountCreatedPerSignInOpened: number | null;
  };
}

export interface TelemetryReport {
  from: string;
  to: string;
  totals: { devices: number; sessions: number; events: number };
  devices: {
    os: string;
    osVersion: string;
    browser: string;
    deviceClass: string;
    devices: number;
    sessions: number;
  }[];
  games: GameHealth[];
  daily: { day: string; gameId?: string | null; errors: number; plays: number }[];
  funnel: Funnel;
}

/** Share of a game's sessions with an error above which it is flagged. */
const ERROR_SESSIONS_FLAG = 0.05;
/** Share of frames over 33 ms on a platform above which it is flagged (the game drops under 30 fps that often). */
const SLOW_SHARE_FLAG = 0.1;
/** Counts that always deserve a look when they appear. */
const WARNING_COUNTS: Record<string, string> = {
  'kit.renderer.fallback': 'fell back from WebGL to Canvas',
  'kit.webgl.context-lost': 'lost its WebGL context',
  'kit.audio.blocked': 'had its sound stay off after a touch',
  'hub.game.failed': 'did not answer the hub (failed to start)',
  'sdk.errors-dropped': 'raised more than 10 different errors in a minute',
  'hub.telemetry.dropped': 'dropped telemetry events (buffer full)',
};

export const label = (game: Pick<GameHealth, 'gameId' | 'gameVersion'>) =>
  game.gameId ? `${game.gameId} ${game.gameVersion ?? ''}`.trim() : 'hub';

const percent = (share: number) => `${(share * 100).toFixed(share < 0.01 ? 2 : 1)} %`;

/** What deserves a look, most serious first: one line each, for a person or an agent to start from. */
export function findings(report: TelemetryReport): string[] {
  const found: string[] = [];
  for (const game of report.games) {
    const name = label(game);
    for (const error of game.errors.filter((e) => e.new)) {
      found.push(
        `🆕 ${name}: new error "${error.message}" (${error.occurrences}× on ${error.devices} device(s))`,
      );
    }
    if (game.sessions > 0 && game.sessionsWithErrors / game.sessions > ERROR_SESSIONS_FLAG) {
      found.push(
        `❗ ${name}: errors in ${percent(game.sessionsWithErrors / game.sessions)} of sessions (${game.sessionsWithErrors}/${game.sessions})`,
      );
    }
    for (const frames of game.frames.filter((f) => f.slowShare > SLOW_SHARE_FLAG)) {
      found.push(
        `🐢 ${name}: ${percent(frames.slowShare)} of frames over 33 ms on ${frames.os} ${frames.browser} (${frames.deviceClass}, ${frames.renderer ?? '?'}), p95 ${frames.p95}`,
      );
    }
    for (const count of game.counts) {
      const what = WARNING_COUNTS[count.name];
      if (what) found.push(`⚠️ ${name}: ${count.sessions} session(s) ${what} (${count.total}×)`);
      if (count.name.startsWith('hub.sync.failed.')) {
        found.push(`⚠️ ${name}: sync failed ${count.total}× (${count.name.slice('hub.sync.failed.'.length)})`);
      }
    }
    if (game.errors.some((e) => e.message.startsWith('protocol:'))) {
      found.push(`❗ ${name}: the game broke the Game Contract (protocol errors)`);
    }
  }
  return found;
}

const table = (head: string[], rows: (string | number)[][]) =>
  rows.length === 0
    ? '_none_'
    : [
        `| ${head.join(' | ')} |`,
        `| ${head.map(() => '---').join(' | ')} |`,
        ...rows.map(
          (row) =>
            `| ${row.map((cell) => String(cell).replaceAll('|', '\\|').replaceAll('\n', ' ')).join(' | ')} |`,
        ),
      ].join('\n');

const FUNNEL_PREFIX = 'hub.funnel.';

/** The funnel as Markdown: the three ratios with their counts, then the days and the total of each step. */
export function renderFunnel(funnel: Funnel): string[] {
  const total = (name: string) => funnel.totals[FUNNEL_PREFIX + name] ?? 0;
  const offered = Object.entries(funnel.totals)
    .filter(([name]) => name.startsWith(`${FUNNEL_PREFIX}install-offered.`))
    .reduce((sum, [, count]) => sum + count, 0);
  const ratio = (value: number | null) => (value === null ? 'n/a' : percent(value));
  const names = Object.keys(funnel.totals);
  return [
    '## Newcomer funnel',
    '',
    table(
      ['Step', 'Ratio', 'Counts'],
      [
        [
          'first game / guest start',
          ratio(funnel.ratios.firstGamePerGuestStart),
          `${total('first-game')} / ${total('guest-start')}`,
        ],
        [
          'install accepted / offered',
          ratio(funnel.ratios.installAcceptedPerOffered),
          `${total('install-accepted')} / ${offered}`,
        ],
        [
          'account created / sign-in opened',
          ratio(funnel.ratios.accountCreatedPerSignInOpened),
          `${total('account-created')} / ${total('sign-in-opened')}`,
        ],
      ],
    ),
    '',
    table(
      ['Day', ...names.map((name) => name.slice(FUNNEL_PREFIX.length))],
      names.length === 0
        ? []
        : [
            ...funnel.days.map((d) => [d.day, ...names.map((name) => d.counts[name] ?? 0)]),
            ['total', ...names.map((name) => funnel.totals[name] ?? 0)],
          ],
    ),
  ];
}

const day = (iso: string) => iso.slice(0, 16).replace('T', ' ');

export function renderMarkdown(report: TelemetryReport): string {
  const found = findings(report);
  const out = [
    `# Telemetry report ${day(report.from)} → ${day(report.to)} (UTC)`,
    '',
    `${report.totals.devices} devices · ${report.totals.sessions} hub sessions · ${report.totals.events} events`,
    '',
    '## Worth a look',
    '',
    found.length > 0 ? found.map((line) => `- ${line}`).join('\n') : '_Nothing stands out._',
    '',
    ...renderFunnel(report.funnel),
    '',
    '## Devices',
    '',
    table(
      ['OS', 'Browser', 'Class', 'Devices', 'Sessions'],
      report.devices.map((d) => [
        `${d.os} ${d.osVersion}`.trim(),
        d.browser,
        d.deviceClass,
        d.devices,
        d.sessions,
      ]),
    ),
  ];

  for (const game of report.games) {
    out.push(
      '',
      `## ${label(game)}`,
      '',
      `${game.sessions} sessions on ${game.devices} devices · ${game.sessionsWithErrors} with errors`,
      '',
      '### Errors',
      '',
      table(
        ['', 'Source', 'Message', 'Times', 'Devices', 'Last seen', 'Top frame'],
        game.errors.map((e) => [
          e.new ? '🆕' : '',
          e.source,
          e.message,
          e.occurrences,
          e.devices,
          day(e.lastSeen),
          e.stack?.split('\n')[0] ?? '',
        ]),
      ),
      '',
      '### Frames',
      '',
      table(
        ['Platform', 'Renderer', 'Sessions', 'Frames', '> 33 ms', 'p95', 'Slowest', 'Step p95'],
        game.frames.map((f) => [
          `${f.os} ${f.browser} (${f.deviceClass})`,
          f.renderer ?? '?',
          f.sessions,
          f.frames,
          percent(f.slowShare),
          f.p95,
          `${f.slowestMs} ms`,
          f.stepP95Ms == null ? '' : `${f.stepP95Ms} ms`,
        ]),
      ),
      '',
      '### Metrics',
      '',
      table(
        ['Name', 'Samples', 'p50', 'p95', 'Max'],
        game.metrics.map((m) => [m.name, m.samples, m.p50, m.p95, m.max]),
      ),
      '',
      '### Counts',
      '',
      table(
        ['Name', 'Total', 'Sessions'],
        game.counts.map((c) => [c.name, c.total, c.sessions]),
      ),
    );
  }

  out.push(
    '',
    '## Daily (from roll-ups)',
    '',
    table(
      ['Day', 'Game', 'Errors', 'Plays'],
      report.daily.map((d) => [d.day, d.gameId ?? 'hub', d.errors, d.plays]),
    ),
    '',
  );
  return out.join('\n');
}
