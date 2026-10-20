// The hub's one connection to the rooms hub (ADR 0016): SignalR over the same origin, so the session cookie — or the
// device key, for a device profile named in its address (ADR 0043) — goes with it. It reconnects by itself (stateful
// reconnect replays what a short drop missed) and again when the page comes back: iOS closes the sockets of a page it
// suspends and does not always say so. A new player acting makes a new connection.
import { type HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { hubUrl, onActingChanged } from './devicePlayer.ts';

let connection: HubConnection | null = null;
const reconnectedListeners = new Set<() => void>();

onActingChanged(() => {
  const old = connection;
  connection = null;
  void old?.stop().catch(() => {});
});

export function roomsHub(): HubConnection {
  if (connection) return connection;
  const hub = new HubConnectionBuilder()
    .withUrl(hubUrl())
    .withAutomaticReconnect([0, 1000, 2000, 5000, 10_000, 10_000, 20_000])
    .withStatefulReconnect()
    .configureLogging(LogLevel.Warning)
    .build();
  hub.onreconnected(() => {
    for (const listener of reconnectedListeners) listener();
  });
  hub.onclose(() => {
    // Automatic reconnect gave up (a long sleep): try again when the page is shown.
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && connection === hub) void ensureConnected();
  });
  connection = hub;
  return hub;
}

/** Connected, or connecting: resolves once the connection can be used. */
export async function ensureConnected(): Promise<HubConnection> {
  const hub = roomsHub();
  if (hub.state === HubConnectionState.Disconnected) {
    await hub.start();
    for (const listener of reconnectedListeners) listener();
  }
  while (hub.state === HubConnectionState.Connecting || hub.state === HubConnectionState.Reconnecting) {
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return hub;
}

/** Called after every reconnection: enter the room again, fetch the lobby again. */
export function onReconnected(listener: () => void): () => void {
  reconnectedListeners.add(listener);
  return () => reconnectedListeners.delete(listener);
}
