'use client';

import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const client: QueryClient = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 30_000, retry: 1 },
      },
      // Any change (approving leave, reading a memo, starting a task...) can
      // move a menu badge, so recount them after every successful one.
      mutationCache: new MutationCache({
        onSuccess: () => client.invalidateQueries({ queryKey: ['badges'] }),
      }),
    });
    return client;
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
