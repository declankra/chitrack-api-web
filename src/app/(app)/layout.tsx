// src/app/(app)/layout.tsx
'use client';

import { usePathname } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { TimeProvider } from '@/lib/providers/TimeProvider';

// Import without SSR
const NavigationDock = dynamic(
  () => import('@/components/shared/NavigationDock'),
  { ssr: false }
);

const StationsProviderWithoutSSR = dynamic(
  () => import('@/lib/providers/StationsProvider').then(mod => mod.StationsProvider),
  { ssr: false }
);


export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const shouldShowDock = !['/'].includes(pathname);
  const isMonitorRoute = pathname.startsWith('/monitor');
  const queryClientRef = useRef<QueryClient | null>(null);

  // Create or reuse a query client
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient({
      defaultOptions: {
        queries: {
          // General settings for all queries
          refetchOnWindowFocus: true, // Enable refetch when window gets focus
          retry: 1, // Only retry once to prevent hammering API
          retryDelay: 1000, // 1 second retry delay
          // Use a consistent 15s cache time for quick updates
          staleTime: 0, // All data is immediately considered stale, triggering refetch
          gcTime: 15 * 1000, // 15 seconds cache max
          refetchInterval: 15 * 1000, // Refetch every 15 seconds
          refetchOnMount: true, // Refetch on component mount
          refetchOnReconnect: true, // Refetch on network reconnect
        },
      },
    });
  }

  // Set specific query defaults after client initialization
  useEffect(() => {
    const queryClient = queryClientRef.current;
    if (!queryClient) return;

    // For station metadata, use a longer cache time (7 days)
    queryClient.setQueryDefaults(['stations'], {
      staleTime: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days cache
      refetchInterval: false, // Don't auto-refetch station metadata
    });
  }, []);

  if (isMonitorRoute) {
    return <>{children}</>;
  }

  return (
    // Full-width background container
    <div className="min-h-screen w-full bg-background flex items-center justify-center">
      {/* iPhone mockup container with fixed dimensions */}
      <div className="relative w-full max-w-[390px] h-[844px] mx-auto bg-background overflow-hidden shadow-2xl rounded-[40px] border border-border">
        {/* Safe area top spacing - mimics iPhone notch area */}
        <div className="h-12 bg-background" />
        
        {/* Main scrollable content area without bottom padding for dock */}
        <QueryClientProvider client={queryClientRef.current}>
        <TimeProvider>

        <StationsProviderWithoutSSR>
            <div className="h-[calc(844px-3rem)] overflow-hidden flex flex-col relative">
              {/* Main content without bottom padding to allow content to flow behind dock */}
              <main className="flex-1 overflow-y-auto px-4 pb-6">
                {children}
              </main>

              {/* Navigation Dock positioned absolutely */}
              {shouldShowDock && <NavigationDock />}
            </div>
          </StationsProviderWithoutSSR>
        </TimeProvider>
        </QueryClientProvider>
      </div>
    </div>
  );
}