// Whether the device has a connection, as the browser says it (`navigator.onLine`), followed live through the window's
// `online` and `offline` events — a screen that read it once showed a stale strip after the phone lost or found its
// network. `onLine` is only a hint (true on a network that goes nowhere), so what really fails is still handled where
// the request is made; this is for what the screen says in the meantime.
import { useSyncExternalStore } from 'react';

/** The part of `window` the store needs: tests give it a fake. */
export interface OnlineSource {
  readonly navigator: { readonly onLine: boolean };
  addEventListener(type: 'online' | 'offline', listener: () => void): void;
  removeEventListener(type: 'online' | 'offline', listener: () => void): void;
}

/** A store of the connection's state for `useSyncExternalStore`: `subscribe` follows both events, `get` reads now. */
export function createOnlineStore(source: OnlineSource) {
  return {
    get: () => source.navigator.onLine,
    subscribe(listener: () => void) {
      source.addEventListener('online', listener);
      source.addEventListener('offline', listener);
      return () => {
        source.removeEventListener('online', listener);
        source.removeEventListener('offline', listener);
      };
    },
  };
}

let store: ReturnType<typeof createOnlineStore> | undefined;

/** True while the browser says the device is online; the component renders again when it changes. */
export function useOnline(): boolean {
  store ??= createOnlineStore(window);
  return useSyncExternalStore(store.subscribe, store.get, () => true);
}
