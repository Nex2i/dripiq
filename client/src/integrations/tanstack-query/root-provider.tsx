import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Consider data stale after 30 seconds
      staleTime: 1000 * 30,
      // Keep data in cache for 5 minutes
      gcTime: 1000 * 60 * 5,
      // Refetch on window focus and reconnect
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      // Retry failed requests once
      retry: 1,
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,
    },
  },
})

export function getContext() {
  return {
    queryClient,
  }
}

export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
