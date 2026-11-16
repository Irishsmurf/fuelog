import { QueryClient } from '@tanstack/react-query';

/**
 * App-wide query cache. Firestore already keeps an offline cache, so queries
 * stay fresh for a short while and are not retried aggressively (a failing
 * read is usually "offline", which retrying won't fix).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
