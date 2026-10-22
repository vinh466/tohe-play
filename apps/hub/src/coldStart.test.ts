// A quick cold start (ADR 0046, docs/architecture/surfaces.md): reading the device session never hangs on a weak
// signal — after a timeout, or on a network error, the hub goes on with the copy of the session it keeps and asks again
// in the background, and it never ends the account's session on its own say-so; only the API's answer "nobody is signed
// in" does. The static skeleton `#root` holds until React mounts is checked here too.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type MeView } from './api/client.ts';
import { asksForCodeBox } from './entry/codes.ts';
import { createSessionEnded } from './session/ended.ts';
import {
  createMeWatch,
  isUnreachable,
  loadMe,
  ME_RETRY_FIRST_MS,
  ME_RETRY_LAST_MS,
  ME_TIMEOUT_MS,
  type MeDeps,
} from './session/loadMe.ts';

const account = { account: { id: 'a1' }, profiles: [] } as unknown as MeView;

function memory() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

/** A device whose cache holds `known`, and an API that behaves as `fetchMe` says. */
function device(known: MeView | undefined, fetchMe: MeDeps['fetchMe']) {
  const cache = { copy: known };
  const ended = createSessionEnded(memory());
  const deps: MeDeps = {
    fetchMe,
    known: async () => cache.copy,
    keep: async (me) => {
      cache.copy = me;
    },
    forget: async () => {
      cache.copy = undefined;
    },
    ended,
  };
  return { deps, ended, kept: () => cache.copy };
}

/** A request that never answers: it ends only when its signal says so, as `fetch` does. */
const hangs: MeDeps['fetchMe'] = (signal) =>
  new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason));
  });

describe('reading the session on a cold start', () => {
  it('waits at most about three seconds for the API', () => {
    expect(ME_TIMEOUT_MS).toBe(3000);
  });

  it('goes on with the device’s copy when the API does not answer in time — a slow /me does not hold the catalog', async () => {
    const { deps, ended, kept } = device(account, hangs);
    const started = Date.now();
    const answer = await loadMe(deps, 25);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(answer).toEqual({ me: account, confirmed: false });
    // The session did not end, and the copy is still kept.
    expect(ended.get()).toBe(false);
    expect(kept()).toBe(account);
  });

  it('plays on as a device when the API does not answer and there is no copy', async () => {
    const { deps, ended } = device(undefined, hangs);
    expect(await loadMe(deps, 25)).toEqual({ me: null, confirmed: false });
    expect(ended.get()).toBe(false);
  });

  it('goes on with the copy on a network error, and on a 5xx from the proxy', async () => {
    for (const failure of [new TypeError('Failed to fetch'), new ApiError(502, null)]) {
      const { deps, ended } = device(account, async () => {
        throw failure;
      });
      expect(await loadMe(deps)).toEqual({ me: account, confirmed: false });
      expect(ended.get()).toBe(false);
    }
  });

  it('does not take any other refusal for an unreachable API', async () => {
    const { deps } = device(account, async () => {
      throw new ApiError(401, 'unauthorized');
    });
    await expect(loadMe(deps)).rejects.toBeInstanceOf(ApiError);
    expect(isUnreachable(new ApiError(404, null))).toBe(false);
    expect(isUnreachable(new Error('a bug'))).toBe(false);
    expect(isUnreachable(new DOMException('', 'TimeoutError'))).toBe(true);
    expect(isUnreachable(new DOMException('', 'AbortError'))).toBe(true);
  });

  it('ends the session only when the API itself answers that nobody is signed in', async () => {
    const { deps, ended, kept } = device(account, async () => null);
    expect(await loadMe(deps)).toEqual({ me: null, confirmed: true });
    expect(ended.get()).toBe(true);
    expect(kept()).toBeUndefined();
  });

  it('says nothing of a session a device never had, and keeps and clears when someone is signed in', async () => {
    const never = device(undefined, async () => null);
    expect(await loadMe(never.deps)).toEqual({ me: null, confirmed: true });
    expect(never.ended.get()).toBe(false);

    const back = device(undefined, async () => account);
    back.ended.mark();
    expect(await loadMe(back.deps)).toEqual({ me: account, confirmed: true });
    expect(back.ended.get()).toBe(false);
    expect(back.kept()).toBe(account);
  });
});

describe('asking again in the background', () => {
  function watch() {
    const timers: { run(): void; ms: number }[] = [];
    const cleared: number[] = [];
    const refetch = vi.fn();
    const meWatch = createMeWatch(refetch, {
      setTimeout: ((run: () => void, ms: number) => timers.push({ run, ms })) as unknown as typeof setTimeout,
      clearTimeout: ((id: number) => void cleared.push(id)) as unknown as typeof clearTimeout,
    });
    return { meWatch, timers, cleared, refetch };
  }

  it('treats the device’s copy as stale and asks again after a few seconds, with longer waits each time', () => {
    const { meWatch, timers, refetch } = watch();
    expect(meWatch.unconfirmed).toBe(false);
    meWatch.answered(false);
    expect(meWatch.unconfirmed).toBe(true);
    expect(timers.map((timer) => timer.ms)).toEqual([ME_RETRY_FIRST_MS]);
    // Another unanswered start while one is waiting does not stack a second ask.
    meWatch.answered(false);
    expect(timers).toHaveLength(1);

    timers[0]?.run();
    expect(refetch).toHaveBeenCalledTimes(1);
    meWatch.answered(false);
    expect(timers.map((timer) => timer.ms)).toEqual([ME_RETRY_FIRST_MS, ME_RETRY_FIRST_MS * 2]);
    for (let round = 0; round < 8; round++) {
      timers.at(-1)?.run();
      meWatch.answered(false);
    }
    expect(Math.max(...timers.map((timer) => timer.ms))).toBe(ME_RETRY_LAST_MS);
  });

  it('stops asking once the API answers, and starts the waits over', () => {
    const { meWatch, timers } = watch();
    meWatch.answered(false);
    timers[0]?.run();
    meWatch.answered(false);
    meWatch.answered(true);
    expect(meWatch.unconfirmed).toBe(false);
    meWatch.answered(false);
    expect(timers.at(-1)?.ms).toBe(ME_RETRY_FIRST_MS);
  });
});

describe('the first paint', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const root = /<div id="root">([\s\S]*?)<\/div>\s*<script type="module"/.exec(html)?.[1] ?? '';

  it('is not blank: #root holds a skeleton that React replaces', () => {
    expect(root).toContain('data-skeleton');
    // The frame's navigation and a grid of tile placeholders.
    expect(root.match(/data-skeleton="tile"/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
    expect(root).toContain('<nav');
  });

  it('draws only with the design tokens: no raw palette classes, no inline styles, no scripts', () => {
    expect(root).not.toMatch(
      /\b(?:bg|text|border|from|to)-(?:orange|amber|slate|gray|zinc|neutral|stone|white|black)\b/,
    );
    expect(root).not.toMatch(/\bstyle=/);
    expect(root).not.toMatch(/<script/);
  });

  it('hides from screen readers and takes no focus: it is a picture of what is coming', () => {
    expect(root).toContain('aria-hidden="true"');
    expect(root).not.toMatch(/<(?:a|button|input)\b/);
  });
});

describe('the "Nhập mã" shortcut', () => {
  it('opens the code box at /together?code=1', () => {
    expect(asksForCodeBox('?code=1')).toBe(true);
    expect(asksForCodeBox('code=1&x=2')).toBe(true);
    expect(asksForCodeBox('')).toBe(false);
    expect(asksForCodeBox('?code=482913')).toBe(false);
  });
});
