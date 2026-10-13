/**
 * A message pipe between a game and its host. The window implementation wraps postMessage;
 * tests use an in-memory pair. Both sides only ever see plain JSON-compatible objects.
 */
export interface Transport {
  post(message: unknown): void;
  subscribe(listener: (message: unknown) => void): () => void;
}

/** Transport from inside the game iframe to the parent window (the hub). */
export function parentWindowTransport(): Transport & { hostOrigin(): string | null } {
  let hostOrigin: string | null = null;
  return {
    hostOrigin: () => hostOrigin,
    post(message) {
      // Until the host has introduced itself (init), only `ready` is sent and it carries no data,
      // so the wildcard target is safe. Afterwards everything goes to the host origin only.
      window.parent.postMessage(message, hostOrigin ?? '*');
    },
    subscribe(listener) {
      const handler = (event: MessageEvent) => {
        if (event.source !== window.parent) return;
        if (hostOrigin === null) {
          if ((event.data as { type?: unknown } | null)?.type !== 'init') return;
          hostOrigin = event.origin;
        } else if (event.origin !== hostOrigin) {
          return;
        }
        listener(event.data);
      };
      window.addEventListener('message', handler);
      return () => window.removeEventListener('message', handler);
    },
  };
}

/** Transport from the hub to one game iframe on a known origin. */
export function iframeTransport(iframe: HTMLIFrameElement, gameOrigin: string): Transport {
  return {
    post(message) {
      iframe.contentWindow?.postMessage(message, gameOrigin);
    },
    subscribe(listener) {
      const handler = (event: MessageEvent) => {
        if (event.source !== iframe.contentWindow || event.origin !== gameOrigin) return;
        listener(event.data);
      };
      window.addEventListener('message', handler);
      return () => window.removeEventListener('message', handler);
    },
  };
}

/** Two connected in-memory transports, delivering asynchronously like postMessage. */
export function memoryTransportPair(): [Transport, Transport] {
  const listeners: [Set<(m: unknown) => void>, Set<(m: unknown) => void>] = [new Set(), new Set()];
  const side = (self: 0 | 1): Transport => ({
    post(message) {
      const copy = structuredClone(message);
      queueMicrotask(() => {
        for (const listener of listeners[self === 0 ? 1 : 0]) listener(copy);
      });
    },
    subscribe(listener) {
      listeners[self].add(listener);
      return () => listeners[self].delete(listener);
    },
  });
  return [side(0), side(1)];
}
