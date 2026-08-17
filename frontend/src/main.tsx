import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {BrowserRouter} from 'react-router-dom';
import App from './App.tsx';
import { GlobalBusyIndicator } from './components/common/GlobalBusyIndicator';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Server data barely changes between two clicks, so serve from cache
      // first and refetch in the background. This keeps navigation instant
      // even with 300+ employees and thousands of documents.
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      networkMode: 'online',
    },
    mutations: {
      retry: 0,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
        {/* Always-on activity feedback: thin top progress bar for reads and a
            blocking spinner overlay while a write request is running. */}
        <GlobalBusyIndicator />
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);
