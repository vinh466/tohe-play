import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiError } from './api/client.ts';
import { router } from './router.tsx';
import { meKey } from './security/Gate.tsx';
import './styles.css';
import { startTheme } from './theme.ts';

startTheme();

// A page refused for what the gate checks — the console's twelve hours are over, a role was taken away — sends the
// console back through its gate, which asks again.
const gate = new Set(['admin_required', 'two_factor_setup_required', 'two_factor_required']);
const queryClient: QueryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ApiError && gate.has(error.code ?? '')) {
        void queryClient.invalidateQueries({ queryKey: meKey });
      }
    },
  }),
});

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
