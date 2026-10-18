// The hub's one collector, wired to the browser: localStorage, sendBeacon, the page's errors and web vitals, and the
// three switches that decide whether anything is sent (ADR 0015): the server (GET /api/config), the household
// (a parent's choice, in the session) and this device (the transparency page).
import type { QueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import type { ClientConfig, MeView } from '../api/client.ts';
import { configQuery, meQuery } from '../api/queries.ts';
import i18n from '../i18n.ts';
import { newId } from '../storage/db.ts';
import { themeState } from '../theme/theme.ts';
import {
  type Consent,
  consentOf,
  createCollector,
  type KeyValue,
  type TelemetryContext,
  type TelemetrySwitches,
} from './collector.ts';

const DEVICE_OFF = 'tohe:telemetry:device-off';
const FLUSH_MS = 60_000;

let hubVersion = 'unknown';

type DeviceFacts = Omit<TelemetryContext, 'hubVersion' | 'theme' | 'locale'>;
let facts: DeviceFacts | null = null;

/**
 * The device as the API wants it, coarse on purpose (sizes rounded to 50 px, cores capped at 16). Read once when the
 * hub starts: batches are often built while the page unloads, when a browser may already report less.
 */
function deviceFacts(): DeviceFacts {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const touch = navigator.maxTouchPoints > 0 || window.matchMedia('(any-pointer: coarse)').matches;
  const short = Math.min(width, height);
  const long = Math.max(width, height);
  const round = (px: number) => Math.round(px / 50) * 50;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return {
    deviceClass: touch && short < 600 ? 'phone' : touch && long < 1400 ? 'tablet' : 'desktop',
    viewportWidth: round(width),
    viewportHeight: round(height),
    pixelRatio: Math.round((window.devicePixelRatio || 1) * 100) / 100,
    cores: navigator.hardwareConcurrency ? Math.min(16, navigator.hardwareConcurrency) : null,
    memoryGb: typeof memory === 'number' ? memory : null,
    displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
  };
}

function context(): TelemetryContext {
  facts ??= deviceFacts();
  return {
    hubVersion,
    ...facts,
    theme: themeState().theme,
    locale: i18n.language.startsWith('vi') ? 'vi' : 'en',
  };
}

function beacon(json: string): boolean {
  const blob = new Blob([json], { type: 'application/json' });
  if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon('/api/telemetry', blob)) return true;
  // No beacon (or its queue is full): a keepalive fetch survives the page closing too.
  void fetch('/api/telemetry', {
    method: 'POST',
    body: json,
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
  }).catch(() => {});
  return true;
}

/** localStorage, looked up when used (modules importing this one are also loaded by tests without a browser). */
const storage: KeyValue = {
  getItem: (key) => globalThis.localStorage?.getItem(key) ?? null,
  setItem: (key, value) => globalThis.localStorage?.setItem(key, value),
  removeItem: (key) => globalThis.localStorage?.removeItem(key),
};

export const telemetry = createCollector({
  send: beacon,
  online: () => navigator.onLine,
  context,
  storage,
  now: () => Date.now(),
  newId,
});

// ---------------------------------------------------------------- switches

export interface TelemetryState extends TelemetrySwitches {
  /** Whether anything is sent: all three on. */
  consent: Consent;
}

let state: TelemetryState = { server: null, account: true, device: true, consent: null };
const listeners = new Set<() => void>();

function update(next: Partial<TelemetrySwitches>) {
  const merged = { ...state, ...next };
  const consent = consentOf(merged);
  state = { ...merged, consent };
  telemetry.setConsent(consent);
  for (const listener of listeners) listener();
}

export const telemetryState = () => state;

/** Turns telemetry off (or back on) for this device only. */
export function setDeviceTelemetry(on: boolean) {
  if (on) storage.removeItem(DEVICE_OFF);
  else storage.setItem(DEVICE_OFF, '1');
  update({ device: on });
}

export function useTelemetryState(): TelemetryState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

/** Whether a game started now should report telemetry (its `init.telemetry`). */
export const telemetryOn = () => state.consent === true;

// ---------------------------------------------------------------- start

/** Follows the config and the session, catches the hub's own errors, measures web vitals, and sends every minute. */
export function startTelemetry(queryClient: QueryClient) {
  facts = deviceFacts();
  update({ device: storage.getItem(DEVICE_OFF) !== '1' });

  const follow = () => {
    const config = queryClient.getQueryData<ClientConfig>(configQuery.queryKey);
    const me = queryClient.getQueryData<MeView | null>(meQuery.queryKey);
    if (config) hubVersion = config.apiVersion.replace(/[^0-9a-zA-Z.+-]/g, '').slice(0, 40) || 'unknown';
    update({
      server: config ? config.telemetry : state.server,
      account: me ? me.account.telemetry : true,
    });
  };
  queryClient.getQueryCache().subscribe(follow);
  void queryClient.prefetchQuery(configQuery).then(follow, () => {});

  window.addEventListener('error', (event) => telemetry.error(event.error ?? event.message));
  window.addEventListener('unhandledrejection', (event) => telemetry.error(event.reason));

  const flush = () => telemetry.flush();
  window.setInterval(flush, FLUSH_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flush();
  });
  window.addEventListener('pagehide', flush);
  window.addEventListener('online', flush);

  // Web vitals of the hub. Safari reports LCP and INP from 26.2, and its INP is still unreliable: reports split by
  // browser, so it can be read with that in mind.
  void import('web-vitals').then(({ onCLS, onINP, onLCP }) => {
    onLCP((metric) => telemetry.metric('hub.vitals.lcp-ms', Math.round(metric.value)));
    onINP((metric) => telemetry.metric('hub.vitals.inp-ms', Math.round(metric.value)));
    onCLS((metric) => telemetry.metric('hub.vitals.cls', Math.round(metric.value * 1000) / 1000));
  });
}
