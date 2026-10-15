// Telemetry events a game hands to the hub (ADR 0015, docs/architecture/telemetry.md). Technical data only: names
// are fixed identifiers, values are numbers, and the only text is an error's message and stack from the code itself.
import { z } from 'zod';

/** Lower-case words joined by dots, e.g. `kit.renderer.canvas` or `kit.first-frame-ms`. A metric's name ends in its unit. */
export const TELEMETRY_NAME = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+){0,5}$/;
export const TelemetryName = z.string().max(64).regex(TELEMETRY_NAME);

/** Upper bounds of the frame-time buckets, in ms; the last bucket holds every slower frame. */
export const FRAME_BUCKETS_MS = [17, 25, 33, 50, 100] as const;

/** At most this many events in one `telemetry` message. */
export const MAX_TELEMETRY_EVENTS = 50;

/** An uncaught error, counted rather than repeated. */
export const TelemetryError = z.object({
  kind: z.literal('error'),
  message: z.string().min(1).max(300),
  /** The top stack frames, file:line:column only (no query strings). */
  stack: z.string().max(1000).optional(),
  count: z.number().int().min(1).max(100_000),
});

/** Something that happened, e.g. `kit.renderer.fallback`. */
export const TelemetryCount = z.object({
  kind: z.literal('count'),
  name: TelemetryName,
  count: z.number().int().min(1).max(1_000_000),
});

/** One measurement, e.g. `kit.first-frame-ms`. */
export const TelemetryMetric = z.object({
  kind: z.literal('metric'),
  name: TelemetryName,
  value: z.number().finite().min(0).max(1_000_000),
});

/** How smooth play was over a stretch of time: frames per duration bucket (FRAME_BUCKETS_MS, then slower). */
export const TelemetryFrames = z.object({
  kind: z.literal('frames'),
  buckets: z.array(z.number().int().min(0).max(1_000_000)).length(FRAME_BUCKETS_MS.length + 1),
  slowestMs: z.number().finite().min(0).max(600_000),
  /** The game's own update and render time per frame (not the browser's), median and 95th percentile. */
  stepP50Ms: z.number().finite().min(0).max(600_000).optional(),
  stepP95Ms: z.number().finite().min(0).max(600_000).optional(),
  renderer: z.enum(['webgl', 'canvas']).optional(),
});

export const TelemetryEvent = z.discriminatedUnion('kind', [
  TelemetryError,
  TelemetryCount,
  TelemetryMetric,
  TelemetryFrames,
]);
export type TelemetryEvent = z.infer<typeof TelemetryEvent>;
