import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n.ts';
import { installStore, readEnvironment } from './install/install.ts';
import { followTrail } from './navigation/leave.tsx';
import { createAppRouter } from './router.tsx';
import './styles.css';
import { funnel, startTelemetry } from './telemetry/telemetry.ts';
import { startTheme } from './theme/theme.ts';

startTheme();
// The public home page sends a device that has used the app on to it (apps/web returning.js, ADR 0042): every start
// says so, for guests and accounts alike.
try {
  localStorage.setItem('tohe:returning', '1');
} catch {
  // Storage blocked: the home page shows itself, and its button leads here.
}
// The browser's install prompt fires once, early: keep it until the player asks (or a game has finished).
installStore.capture({
  accepted: () => funnel.installAccepted(),
  dismissed: () => funnel.installDismissed(),
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { networkMode: 'offlineFirst', retry: 1 } },
});
const router = createAppRouter(queryClient);
followTrail(router.history);
startTelemetry(queryClient);
// Opening the installed app: counted once a day (the newcomer funnel).
if (readEnvironment().standalone) funnel.standaloneOpen();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
