// src/app/(app)/monitor/layout.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRef, useEffect } from 'react';
import { TimeProvider } from '@/lib/providers/TimeProvider';
import dynamic from 'next/dynamic';
import '@/styles/monitor.css';

// Import StationsProvider without SSR
const StationsProviderWithoutSSR = dynamic(
  () => import('@/lib/providers/StationsProvider').then(mod => mod.StationsProvider),
  { ssr: false }
);

// Import MonitorProvider without SSR
const MonitorProviderWithoutSSR = dynamic(
  () => import('@/lib/providers/MonitorProvider').then(mod => mod.MonitorProvider),
  { ssr: false }
);

/**
 * Monitor Layout
 *
 * This layout breaks out of the standard iPhone mockup container
 * to provide a full-viewport command center experience.
 */
export default function MonitorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClientRef = useRef<QueryClient | null>(null);

  // Create or reuse a query client optimized for real-time data
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient({
      defaultOptions: {
        queries: {
          // Monitor page needs faster updates
          refetchOnWindowFocus: true,
          retry: 2,
          retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
          staleTime: 0,
          gcTime: 30 * 1000, // 30 seconds cache
          refetchInterval: 15 * 1000, // Refetch every 15 seconds
          refetchOnMount: true,
          refetchOnReconnect: true,
        },
      },
    });
  }

  // Set specific query defaults for different data types
  useEffect(() => {
    const queryClient = queryClientRef.current;
    if (!queryClient) return;

    // Station metadata - long cache (rarely changes)
    queryClient.setQueryDefaults(['stations'], {
      staleTime: 7 * 24 * 60 * 60 * 1000,
      gcTime: 7 * 24 * 60 * 60 * 1000,
      refetchInterval: false,
    });

    // Weather data - 10 minute refresh
    queryClient.setQueryDefaults(['monitor', 'weather'], {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchInterval: 10 * 60 * 1000,
    });

    // Alerts - 1 minute refresh
    queryClient.setQueryDefaults(['monitor', 'alerts'], {
      staleTime: 30 * 1000,
      gcTime: 60 * 1000,
      refetchInterval: 60 * 1000,
    });

    // Train positions - 15 second refresh
    queryClient.setQueryDefaults(['monitor', 'trains'], {
      staleTime: 10 * 1000,
      gcTime: 15 * 1000,
      refetchInterval: 15 * 1000,
    });

    // System status - 15 second refresh
    queryClient.setQueryDefaults(['monitor', 'status'], {
      staleTime: 10 * 1000,
      gcTime: 15 * 1000,
      refetchInterval: 15 * 1000,
    });
  }, []);

  return (
    // Full-viewport dark theme container - breaks out of iPhone mockup
    <div className="monitor-theme min-h-screen w-full bg-[hsl(var(--monitor-bg-primary))]">
      <QueryClientProvider client={queryClientRef.current}>
        <TimeProvider>
          <StationsProviderWithoutSSR>
            <MonitorProviderWithoutSSR>
              {children}
            </MonitorProviderWithoutSSR>
          </StationsProviderWithoutSSR>
        </TimeProvider>
      </QueryClientProvider>
    </div>
  );
}
