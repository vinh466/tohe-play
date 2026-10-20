import { describe, expect, it } from 'vitest';
import { findings, renderMarkdown, type TelemetryReport } from './render.ts';

const report: TelemetryReport = {
  from: '2026-10-08T09:00:00Z',
  to: '2026-10-15T09:00:00Z',
  totals: { devices: 4, sessions: 30, events: 900 },
  devices: [
    { os: 'Android', osVersion: '15', browser: 'Chrome', deviceClass: 'phone', devices: 3, sessions: 25 },
  ],
  games: [
    {
      gameId: null,
      gameVersion: null,
      sessions: 30,
      devices: 4,
      sessionsWithErrors: 0,
      errors: [],
      frames: [],
      metrics: [{ name: 'hub.vitals.lcp-ms', samples: 30, p50: 900, p95: 2100, max: 3200 }],
      counts: [{ name: 'hub.sync.failed.http-5xx', total: 2, sessions: 1 }],
    },
    {
      gameId: 'tap-merge',
      gameVersion: '0.4.1',
      sessions: 20,
      devices: 3,
      sessionsWithErrors: 2,
      errors: [
        {
          source: 'game',
          fingerprint: 'TypeError: x|at f',
          message: 'TypeError: x | y',
          stack: 'at f (/tap-merge/0.4.1/assets/index.js:1:20)\nat g',
          occurrences: 5,
          sessions: 2,
          devices: 2,
          firstSeen: '2026-10-14T10:00:00Z',
          lastSeen: '2026-10-15T08:00:00Z',
          new: true,
        },
      ],
      frames: [
        {
          os: 'Android',
          browser: 'Samsung Internet',
          deviceClass: 'phone',
          renderer: 'webgl',
          sessions: 4,
          frames: 50_000,
          slowShare: 0.18,
          p95: '≤ 50 ms',
          slowestMs: 400,
          stepP95Ms: 6.5,
        },
        {
          os: 'iOS',
          browser: 'Safari',
          deviceClass: 'phone',
          renderer: 'webgl',
          sessions: 6,
          frames: 90_000,
          slowShare: 0.004,
          p95: '≤ 17 ms',
          slowestMs: 60,
          stepP95Ms: 2.1,
        },
      ],
      metrics: [],
      counts: [{ name: 'kit.renderer.fallback', total: 1, sessions: 1 }],
    },
  ],
  daily: [{ day: '2026-10-14', gameId: 'tap-merge', errors: 3, plays: 12 }],
  funnel: {
    days: [
      { day: '2026-10-14', counts: { 'hub.funnel.guest-start': 4, 'hub.funnel.first-game': 2 } },
      {
        day: '2026-10-15',
        counts: { 'hub.funnel.guest-start': 2, 'hub.funnel.install-offered.prompt': 1 },
      },
    ],
    totals: {
      'hub.funnel.first-game': 2,
      'hub.funnel.guest-start': 6,
      'hub.funnel.install-offered.prompt': 1,
    },
    ratios: {
      firstGamePerGuestStart: 0.3333,
      installAcceptedPerOffered: 0,
      accountCreatedPerSignInOpened: null,
    },
  },
};

describe('report findings', () => {
  it('lists what deserves a look, and leaves alone what is fine', () => {
    expect(findings(report)).toEqual([
      '⚠️ hub: sync failed 2× (http-5xx)',
      '🆕 tap-merge 0.4.1: new error "TypeError: x | y" (5× on 2 device(s))',
      '❗ tap-merge 0.4.1: errors in 10.0 % of sessions (2/20)',
      '🐢 tap-merge 0.4.1: 18.0 % of frames over 33 ms on Android Samsung Internet (phone, webgl), p95 ≤ 50 ms',
      '⚠️ tap-merge 0.4.1: 1 session(s) fell back from WebGL to Canvas (1×)',
    ]);
  });

  it('says so when nothing stands out', () => {
    expect(renderMarkdown({ ...report, games: [] })).toContain('_Nothing stands out._');
  });
});

describe('markdown', () => {
  it('renders one section per game version with tables that survive pipes in messages', () => {
    const markdown = renderMarkdown(report);
    expect(markdown).toContain('# Telemetry report 2026-10-08 09:00 → 2026-10-15 09:00 (UTC)');
    expect(markdown).toContain('## tap-merge 0.4.1');
    expect(markdown).toContain('## hub');
    expect(markdown).toContain(
      '| 🆕 | game | TypeError: x \\| y | 5 | 2 | 2026-10-15 08:00 | at f (/tap-merge/0.4.1/assets/index.js:1:20) |',
    );
    expect(markdown).toContain(
      '| Android Samsung Internet (phone) | webgl | 4 | 50000 | 18.0 % | ≤ 50 ms | 400 ms | 6.5 ms |',
    );
    expect(markdown).toContain('| 2026-10-14 | tap-merge | 3 | 12 |');
  });
});

describe('funnel', () => {
  it('shows the three ratios with their counts, n/a when the base is 0, and a column per step', () => {
    const markdown = renderMarkdown(report);
    expect(markdown).toContain('## Newcomer funnel');
    expect(markdown).toContain('| first game / guest start | 33.3 % | 2 / 6 |');
    expect(markdown).toContain('| install accepted / offered | 0.00 % | 0 / 1 |');
    expect(markdown).toContain('| account created / sign-in opened | n/a | 0 / 0 |');
    expect(markdown).toContain('| Day | first-game | guest-start | install-offered.prompt |');
    expect(markdown).toContain('| 2026-10-14 | 2 | 4 | 0 |');
    expect(markdown).toContain('| total | 2 | 6 | 1 |');
  });

  it('still renders the section when no newcomer has been counted', () => {
    const empty = { days: [], totals: {}, ratios: report.funnel.ratios };
    expect(renderMarkdown({ ...report, funnel: empty })).toContain('## Newcomer funnel');
  });
});
