// A game that cannot load (docs/architecture/game-launch-flow.md, "Offline"): until a game has been opened once its
// files are in no cache, so with no connection its iframe never answers. Instead of an endless "Đang tải…" the loading
// screen says so — "Trò này cần mạng để mở lần đầu." and a way back to Tò He — once the device is offline and the game
// has still not answered after a short grace (a game already in the HTTP cache answers within it), or when the handshake
// times out while offline. Online, a game that does not answer fails as before ("Trò chơi không phản hồi").

/** How long a game gets to answer once the device is offline before the loading screen gives up on it. */
export const OFFLINE_GRACE_MS = 3000;

/** What the loading screen turns into when the game did not answer: no connection says why, else the old failure. */
export const loadFailure = (online: boolean): 'offline' | 'failed' => (online ? 'failed' : 'offline');
