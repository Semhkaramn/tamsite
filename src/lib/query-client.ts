import { QueryClient } from '@tanstack/react-query'

// 🚀 OPTIMIZED: Query client for 200-300 concurrent users + Background Prefetching
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 🚀 OPTIMIZATION: Longer stale time to reduce API calls
      staleTime: 1000 * 60 * 2, // 2 minutes (increased from 30 seconds)

      // 🚀 OPTIMIZATION: Longer garbage collection time
      gcTime: 1000 * 60 * 15, // 15 minutes (increased from 10 minutes)

      // 🚀 OPTIMIZATION: Reduce refetch frequency to avoid overloading
      refetchOnWindowFocus: false, // Disabled to reduce unnecessary requests
      refetchOnMount: false, // Use cached data on mount - sayfalar cache'den anında yüklenecek
      refetchOnReconnect: true, // Refetch when reconnecting

      // 🚀 NEW: Background refetching disabled by default (her sayfa kendi interval'ını yönetecek)
      refetchInterval: false, // Her query kendi interval'ını belirleyecek

      // 🚀 OPTIMIZATION: Retry strategy
      retry: 2, // Retry failed requests twice
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff

      // 🚀 OPTIMIZATION: Network mode
      networkMode: 'online', // Only fetch when online

      // 🚀 NEW: Instant loading from cache
      placeholderData: (previousData: unknown) => previousData, // Eski veriyi göster, yeni veri gelene kadar
    },
    mutations: {
      // 🚀 OPTIMIZATION: Retry mutations once
      retry: 1,
      retryDelay: 1000,

      // Automatically invalidate queries after mutations
      onSuccess: () => {
        // This will be handled per-mutation in the components
      },
    },
  },
})
