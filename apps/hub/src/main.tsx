import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n.ts';
import { installStore, readEnvironment } from './install/install.ts';
import { askPersistentStorage, followLaunches } from './install/launch.ts';
import { followTrail, putAppLevelBehind } from './navigation/leave.tsx';
import { createAppRouter } from './router.tsx';
import './styles.css';
import { keepLastUsed, whoIsPlaying } from './session/whoIsPlaying.ts';
import { funnel, startTelemetry } from './telemetry/telemetry.ts';
import { startTheme } from './theme/theme.ts';
import { startUpdates } from './update/register.ts';

startTheme();
// A new version waits for the next cold start; the frame's screens offer "Tải lại" meanwhile (ADR 0046).
startUpdates();
// "Ai đang chơi?" (ADR 0046): whether this cold start follows 30 minutes unused is decided now, before any screen.
whoIsPlaying.start();
keepLastUsed();
// The public home page shows a device that has used the app "Chơi tiếp" (apps/web returning.js, ADR 0046): every
// start says so, for guests and accounts alike. Whether it was there before tells a returning visit (the funnel).
let returning = false;
try {
  returning = localStorage.getItem('tohe:returning') === '1';
  localStorage.setItem('tohe:returning', '1');
} catch {
  // Storage blocked: the home page shows only "Chơi ngay", which leads here too.
}
// The browser's install prompt fires once, early: keep it until the player asks (or a game has finished).
installStore.capture({
  accepted: () => funnel.installAccepted(),
  dismissed: () => funnel.installDismissed(),
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { networkMode: 'offlineFirst', retry: 1 } },
});
// A game, a table or a link opened straight: the app's level behind it, before the router reads the history.
const behind = putAppLevelBehind();
const router = createAppRouter(queryClient);
followTrail(router.history, behind);
// A link opened while the installed app runs comes to this window (`launch_handler`, Chromium): it goes there.
followLaunches((path) => router.history.push(path));
startTelemetry(queryClient);
const { standalone } = readEnvironment();
// Opening the installed app, and coming back in a browser tab: each counted once a day, as totals (the funnel).
if (standalone) funnel.standaloneOpen();
else if (returning) funnel.browserReturn();
// The installed app keeps its storage: asked once (a device profile's progress lives only here).
if (standalone) void askPersistentStorage(navigator.storage, localStorage);

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
