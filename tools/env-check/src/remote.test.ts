import { describe, expect, it } from 'vitest';
import type { Fetcher } from './http.ts';
import { chartTag, ciProblem, ghcrHas } from './remote.ts';
import { badLogLines } from './uat-checks.ts';

describe('ciProblem', () => {
  it('passes when the CI run succeeded', () => {
    expect(ciProblem([{ name: 'CI', status: 'completed', conclusion: 'success' }])).toBeNull();
  });

  it('reports a failed, a running and a missing run', () => {
    expect(ciProblem([{ name: 'CI', status: 'completed', conclusion: 'failure' }])).toMatch(
      /concluded failure/,
    );
    expect(ciProblem([{ name: 'CI', status: 'in_progress', conclusion: null }])).toMatch(/in_progress/);
    expect(ciProblem([])).toMatch(/no CI run/);
    expect(ciProblem([{ name: 'Other', status: 'completed', conclusion: 'success' }])).toMatch(/no CI run/);
  });

  it('lets the newest CI run decide', () => {
    expect(
      ciProblem([
        { name: 'CI', status: 'completed', conclusion: 'failure', created_at: '2026-10-19T01:00:00Z' },
        { name: 'CI', status: 'completed', conclusion: 'success', created_at: '2026-10-19T02:00:00Z' },
      ]),
    ).toBeNull();
  });
});

describe('chartTag', () => {
  it('is the Chart.yaml version and the first 7 characters of the commit', () => {
    const yaml = 'apiVersion: v2\nname: tohe\nversion: 0.1.0\nappVersion: "1.0"\n';
    expect(chartTag(yaml, 'd68554779ed2322ec4f06b3267dc2ac6e7062100')).toBe('0.1.0-gd685547');
  });

  it('fails without a version', () => {
    expect(() => chartTag('name: tohe\n', 'abc')).toThrow(/no version/);
  });
});

describe('ghcrHas', () => {
  const answer =
    (manifestStatus: number): Fetcher =>
    async (url) =>
      url.startsWith('https://ghcr.io/token')
        ? { status: 200, headers: {}, body: '{"token":"t"}' }
        : { status: manifestStatus, headers: {}, body: '' };

  it('is true for 200, false for 404, and fails on anything else', async () => {
    expect(await ghcrHas(answer(200), 'vinh466/tohe-play/api', 'sha-1')).toBe(true);
    expect(await ghcrHas(answer(404), 'vinh466/tohe-play/api', 'sha-1')).toBe(false);
    await expect(ghcrHas(answer(500), 'vinh466/tohe-play/api', 'sha-1')).rejects.toThrow(/500/);
  });
});

describe('badLogLines', () => {
  it('finds fail, crit and exception lines only', () => {
    const log = [
      'api-1  | info: Microsoft.Hosting.Lifetime[14] Now listening on: http://[::]:8080',
      'api-1  | fail: Tohe.Api.Mail[0] could not send',
      'api-1  | crit: Microsoft.AspNetCore.Hosting[6] boom',
      'api-1  | Unhandled exception. System.InvalidOperationException: x',
      'api-1  | warn: something',
    ].join('\n');
    expect(badLogLines(log)).toHaveLength(3);
    expect(badLogLines('info: all good\nwarn: slow')).toEqual([]);
  });
});
