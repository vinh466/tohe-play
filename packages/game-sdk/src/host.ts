// Host side of the contract, used by the hub (and by the conformance kit's fake hub).
// Unlike the game side this validates every message with the Zod schemas from @tohe/contract.
import {
  type GameManifest,
  GameMessage,
  type HostMessage,
  type InitPayload,
  MAX_SAVE_BYTES,
  PROTOCOL_VERSION,
  type Settings,
  type TelemetryEvent,
} from '@tohe/contract';
import type { JsonValue } from './game.ts';
import type { Transport } from './transport.ts';

export { iframeTransport, memoryTransportPair, type Transport } from './transport.ts';

export interface HostOptions {
  transport: Transport;
  manifest: GameManifest;
  /** Builds the init payload once the game says it is ready. */
  init(): InitPayload | Promise<InitPayload>;
  onSave?(data: JsonValue): void | Promise<void>;
  /** `run` is set for a long run's reports (ADR 0014); `final` is false while it goes on. */
  onScore?(score: { value: number; board: string; run?: string; final: boolean }): void | Promise<void>;
  onExit?(): void;
  onLog?(entry: { level: 'info' | 'warn' | 'error'; message: string }): void;
  /** Telemetry from the game, already validated; only sent when `init` set `telemetry` (ADR 0015). */
  onTelemetry?(events: TelemetryEvent[]): void;
  /** A message that failed validation or broke the protocol. */
  onProtocolError?(error: string, raw: unknown): void;
  /** Rejects `ready` if the game does not say ready in time. Default 10000 ms. */
  readyTimeoutMs?: number;
}

export interface HostHandle {
  /** Resolves after the handshake (game ready + init sent). */
  readonly ready: Promise<void>;
  pause(): void;
  resume(): void;
  setSettings(settings: Settings): void;
  dispose(): void;
}

const encoder = new TextEncoder();

export function createHost(options: HostOptions): HostHandle {
  const { transport, manifest } = options;
  const can = (capability: GameManifest['capabilities'][number]) =>
    manifest.capabilities.includes(capability);
  const send = (message: HostMessage) => transport.post(message);
  const reply = (replyTo: string, error?: string) =>
    send({ tohe: PROTOCOL_VERSION, type: 'result', replyTo, ok: error === undefined, error });
  const fail = (error: string, raw: unknown) => options.onProtocolError?.(error, raw);

  let handshaken = false;
  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  // Callers that never await `ready` must not trigger unhandled-rejection noise.
  ready.catch(() => {});
  const timer = setTimeout(
    () => rejectReady(new Error(`game "${manifest.id}" did not send ready`)),
    options.readyTimeoutMs ?? 10_000,
  );

  const handle = async (raw: unknown) => {
    if ((raw as { tohe?: unknown } | null)?.tohe !== PROTOCOL_VERSION) return;
    const parsed = GameMessage.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.message, raw);
    const message = parsed.data;

    if (message.type === 'ready') {
      if (handshaken) return fail('duplicate ready', raw);
      if (message.gameId !== manifest.id)
        return fail(`ready from "${message.gameId}", expected "${manifest.id}"`, raw);
      handshaken = true;
      clearTimeout(timer);
      try {
        send({ tohe: PROTOCOL_VERSION, type: 'init', ...(await options.init()) });
        resolveReady();
      } catch (error) {
        rejectReady(error instanceof Error ? error : new Error(String(error)));
      }
      return;
    }
    if (!handshaken) return fail(`${message.type} before ready`, raw);

    switch (message.type) {
      case 'save': {
        if (!can('save')) return reply(message.id, 'capability "save" not declared in game.json');
        if (encoder.encode(JSON.stringify(message.data)).byteLength > MAX_SAVE_BYTES)
          return reply(message.id, `save exceeds ${MAX_SAVE_BYTES} bytes`);
        return settle(message.id, () => options.onSave?.(message.data as JsonValue));
      }
      case 'score': {
        if (!can('scores')) return reply(message.id, 'capability "scores" not declared in game.json');
        return settle(message.id, () =>
          options.onScore?.({
            value: message.value,
            board: message.board,
            run: message.run,
            final: message.final,
          }),
        );
      }
      case 'exit':
        return options.onExit?.();
      case 'log':
        return options.onLog?.({ level: message.level, message: message.message });
      case 'telemetry':
        return options.onTelemetry?.(message.events);
    }
  };

  const settle = async (id: string, action: () => void | Promise<void>) => {
    try {
      await action();
      reply(id);
    } catch (error) {
      reply(id, error instanceof Error ? error.message : String(error));
    }
  };

  const unsubscribe = transport.subscribe((raw) => void handle(raw));

  return {
    ready,
    pause: () => handshaken && send({ tohe: PROTOCOL_VERSION, type: 'pause' }),
    resume: () => handshaken && send({ tohe: PROTOCOL_VERSION, type: 'resume' }),
    setSettings: (settings) => handshaken && send({ tohe: PROTOCOL_VERSION, type: 'settings', settings }),
    dispose: () => {
      clearTimeout(timer);
      unsubscribe();
    },
  };
}
