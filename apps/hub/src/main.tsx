import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n.ts';
import { createAppRouter } from './router.tsx';
import './styles.css';
import { startTheme } from './theme/theme.ts';

startTheme();

const queryClient = new QueryClient({
  defaultOptions: { queries: { networkMode: 'offlineFirst', retry: 1 } },
});
const router = createAppRouter(queryClient);

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
