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

// A page refused because the console's session ended — its twelve hours are over, the role was taken away, the
// account signed out everywhere — asks again who is signed in, and the sign-in takes the page's place.
const queryClient: QueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failures, error) => failures < 1 && !(error instanceof ApiError && error.status === 401),
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (error instanceof ApiError && error.status === 401 && query.queryKey[1] !== meKey[1]) {
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
